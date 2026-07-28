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

function showScene(next) {
  scene = next;
  Object.entries(scenes).forEach(([name, element]) => {
    element.hidden = name !== next;
  });
  game.className = `game scene-${next}`;
}

function playSound(path) {
  const audio = new Audio(path);
  audio.preload = "auto";
  audio.play().catch(() => {});
}

function finishMeasurement() {
  if (scene !== "measure") return;
  clearTimeout(finishTimer);
  const peakScore = Math.max(0, peak - START_THRESHOLD) * 460;
  const impulseScore = Math.min(2600, impulse * 48);
  const sharpness = Math.max(0, peak - lastMagnitude) * 80;
  const result = Math.max(1, Math.min(9999, Math.round(520 + peakScore + impulseScore + sharpness)));
  document.querySelector("#power").textContent = result.toLocaleString("ja-JP");
  document.querySelector("#rank").textContent =
    result >= 7500 ? "天下無双" : result >= 5000 ? "剣豪" : result >= 2800 ? "達人" : "見習い剣士";
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
  playSound("start.mp3");
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
    playSound("slash.mp3");
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
