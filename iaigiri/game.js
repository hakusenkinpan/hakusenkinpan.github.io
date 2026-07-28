"use strict";

const START_THRESHOLD = 6.5;
const STOP_THRESHOLD = 2.2;
const MAX_MEASURE_MS = 4000;
const scenes = {
  title: document.querySelector("#titleScene"),
  ready: document.querySelector("#readyScene"),
  measure: document.querySelector("#measureScene"),
  result: document.querySelector("#resultScene"),
};
const game = document.querySelector(".game");
const countdown = document.querySelector("#countdown");
const meter = document.querySelector("#motionMeter");
const errorMessage = document.querySelector("#errorMessage");
const sounds = {
  start: new Audio("start.mp3"),
  slash: new Audio("slash.mp3"),
};

Object.keys(sounds).forEach(function (name) {
  sounds[name].preload = "auto";
  sounds[name].setAttribute("playsinline", "");
});

let scene = "title";
let startedAt = 0;
let lastAt = 0;
let peak = 0;
let impulse = 0;
let lastMagnitude = 0;
let quietSince = null;
let slashPlayed = false;
let finishTimer = null;
let gravity = { x: 0, y: 0, z: 0 };
let audioUnlocked = false;

function showScene(next) {
  scene = next;
  Object.entries(scenes).forEach(([name, element]) => {
    element.hidden = name !== next;
  });
  game.className = `game scene-${next}`;
}

function unlockAudio() {
  if (audioUnlocked) return Promise.resolve();

  const attempts = Object.keys(sounds).map(function (name) {
    const audio = sounds[name];
    audio.muted = true;
    audio.currentTime = 0;

    return audio.play().then(function () {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    }).catch(function () {
      audio.muted = false;
    });
  });

  audioUnlocked = true;
  return Promise.all(attempts);
}

function playSound(name) {
  const audio = sounds[name];
  audio.pause();
  audio.currentTime = 0;
  audio.muted = false;
  audio.volume = 1;
  audio.play().catch(function () {
    errorMessage.textContent =
      "音声を再生できませんでした。消音モードとブラウザの音声設定をご確認ください。";
    errorMessage.hidden = false;
  });
}

function finishMeasurement() {
  if (scene !== "measure") return;
  clearTimeout(finishTimer);
  // 40m/s²を1点、120m/s²を約500点、200m/s²を999点として直線評価。
  const result = Math.max(1, Math.min(999, Math.round(((peak - 40) / 160) * 999)));
  document.querySelector("#power").textContent = result.toLocaleString("ja-JP");
  document.querySelector("#peakAcceleration").textContent = peak.toFixed(1);
  document.querySelector("#rank").textContent =
    result >= 700 ? "天下無双" : result >= 600 ? "剣豪" : result >= 500 ? "達人" : "素人";
  showScene("result");
}

function beginMeasurement() {
  peak = impulse = lastMagnitude = 0;
  quietSince = null;
  slashPlayed = false;
  gravity = { x: 0, y: 0, z: 0 };
  startedAt = lastAt = performance.now();
  meter.style.setProperty("--level", "0%");
  showScene("measure");
  playSound("start");
  finishTimer = setTimeout(finishMeasurement, MAX_MEASURE_MS);
}

function handleMotion(event) {
  if (scene !== "measure") return;
  let { x, y, z } = event.acceleration || {};

  if (x == null || y == null || z == null) {
    const raw = event.accelerationIncludingGravity;
    if (!raw || raw.x == null || raw.y == null || raw.z == null) return;
    const smoothing = 0.82;
    gravity.x = smoothing * gravity.x + (1 - smoothing) * raw.x;
    gravity.y = smoothing * gravity.y + (1 - smoothing) * raw.y;
    gravity.z = smoothing * gravity.z + (1 - smoothing) * raw.z;
    x = raw.x - gravity.x;
    y = raw.y - gravity.y;
    z = raw.z - gravity.z;
  }

  const now = performance.now();
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const dt = Math.min(0.1, Math.max(0, (now - lastAt) / 1000));
  lastAt = now;
  peak = Math.max(peak, magnitude);
  impulse += Math.max(0, magnitude - STOP_THRESHOLD) * dt;
  meter.style.setProperty("--level", `${Math.min(100, magnitude * 5.8)}%`);

  if (magnitude >= START_THRESHOLD && !slashPlayed) {
    slashPlayed = true;
    quietSince = null;
    playSound("slash");
  }

  if (slashPlayed && now - startedAt > 450) {
    if (magnitude < STOP_THRESHOLD) {
      if (quietSince === null) quietSince = now;
      if (now - quietSince > 520) finishMeasurement();
    } else {
      quietSince = null;
    }
  }
  lastMagnitude = magnitude;
}

async function startGame() {
  errorMessage.textContent = "センサーの利用可否を確認しています…";
  errorMessage.hidden = false;
  const audioUnlocking = unlockAudio();

  if (location.protocol === "file:") {
    errorMessage.textContent =
      "直接ファイルを開いた状態では測定できません。READMEの手順でWebサーバーから開いてください。";
    return;
  }

  if (!window.isSecureContext && location.hostname !== "localhost") {
    errorMessage.textContent =
      "センサー測定にはHTTPS接続が必要です。HTTPSまたはlocalhostから開いてください。";
    return;
  }

  if (!("DeviceMotionEvent" in window)) {
    errorMessage.textContent = "この端末はモーションセンサーに対応していません。";
    return;
  }

  if (typeof window.DeviceMotionEvent.requestPermission === "function") {
    try {
      const permission = await window.DeviceMotionEvent.requestPermission();
      if (permission !== "granted") {
        throw new Error("denied");
      }
    } catch {
      errorMessage.textContent = "モーションセンサーの利用を許可してください。";
      return;
    }
  }

  await audioUnlocking;
  errorMessage.hidden = true;
  countdown.textContent = "3";
  showScene("ready");
  let remaining = 3;
  const timer = setInterval(() => {
    remaining -= 1;
    if (remaining === 0) {
      clearInterval(timer);
      beginMeasurement();
    } else {
      countdown.textContent = String(remaining);
      countdown.animate([{ opacity: 0, transform: "scale(1.2)" }, { opacity: 1, transform: "scale(1)" }], 800);
    }
  }, 1000);
}

window.addEventListener("devicemotion", handleMotion);
document.querySelector("#startButton").addEventListener("click", startGame);
document.querySelector("#retryButton").addEventListener("click", startGame);
document.querySelector("#titleButton").addEventListener("click", () => {
  clearTimeout(finishTimer);
  showScene("title");
});
