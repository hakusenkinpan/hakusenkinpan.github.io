(() => {
  "use strict";

  const LEVELS = {
    intro: { label: "入門", pitchClasses: [0, 2, 4, 5, 7, 9, 11], min: 60, max: 71 },
    easy: { label: "初級", pitchClasses: [0, 2, 4, 5, 7, 9, 11], min: 48, max: 96 },
    medium: { label: "中級", pitchClasses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], min: 48, max: 96 },
    advanced: { label: "上級", pitchClasses: null, min: 48, max: 96 }
  };
  const NOTE_JA = ["ド", "ド♯", "レ", "レ♯", "ミ", "ファ", "ファ♯", "ソ", "ソ♯", "ラ", "ラ♯", "シ"];
  const NOTE_EN = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

  const $ = (selector) => document.querySelector(selector);
  const screens = {
    title: $("#title-screen"),
    quiz: $("#quiz-screen"),
    result: $("#result-screen")
  };
  let level = "intro";
  let questions = [];
  let current = 0;
  let answers = [];
  let audioContext = null;

  function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function noteLabel(midi, includeOctave = true) {
    const pc = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    return includeOctave ? `${NOTE_EN[pc]}${octave}（${NOTE_JA[pc]}）` : `${NOTE_JA[pc]}（${NOTE_EN[pc]}）`;
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function generateQuestions() {
    const config = LEVELS[level];
    if (level === "advanced") {
      // C3〜C7の対数的な範囲から、半音に限定しない連続周波数を選ぶ。
      // fractional MIDI を使うことで、再生処理は他の難易度と共通化できる。
      questions = Array.from({ length: 5 }, () => {
        const fractionalMidi = config.min + Math.random() * (config.max - config.min);
        return Math.round(fractionalMidi * 10000) / 10000;
      });
      return;
    }
    const pool = [];
    for (let midi = config.min; midi <= config.max; midi += 1) {
      if (!config.pitchClasses || config.pitchClasses.includes(midi % 12)) pool.push(midi);
    }
    questions = [];
    while (questions.length < 5) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (questions.at(-1) !== pick) questions.push(pick);
    }
  }

  function playTone(midi, button) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext ||= new AudioCtx();
    if (audioContext.state === "suspended") audioContext.resume();

    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const warmth = audioContext.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(midiToHz(midi), now);
    warmth.type = "lowpass";
    warmth.frequency.value = 2400;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.48, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
    osc.connect(warmth).connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 1.7);
    if (button) {
      button.classList.remove("playing");
      void button.offsetWidth;
      button.classList.add("playing");
      setTimeout(() => button.classList.remove("playing"), 750);
    }
  }

  function buildNoteButtons() {
    const pcs = LEVELS[level].pitchClasses;
    const container = $("#note-buttons");
    container.innerHTML = "";
    pcs.forEach((pc) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "note-btn";
      btn.textContent = NOTE_JA[pc];
      btn.setAttribute("aria-label", `${NOTE_JA[pc]}、${NOTE_EN[pc]}`);
      btn.addEventListener("click", () => answerNote(pc));
      container.appendChild(btn);
    });
  }

  function renderQuestion(autoplay = true) {
    const config = LEVELS[level];
    $("#quiz-level").textContent = config.label;
    $("#progress-text").textContent = `QUESTION ${current + 1} / 5`;
    $("#progress-bar").style.width = `${(current + 1) * 20}%`;
    const advanced = level === "advanced";
    $("#note-answer").classList.toggle("hidden", advanced);
    $("#frequency-answer").classList.toggle("hidden", !advanced);
    if (advanced) {
      $("#frequency-input").value = "";
      setTimeout(() => $("#frequency-input").focus(), 100);
    } else {
      buildNoteButtons();
    }
    if (autoplay) setTimeout(() => playTone(questions[current], $("#replay-btn")), 240);
  }

  function sameOctaveMidi(targetMidi, answerPc) {
    const octaveBase = Math.floor(targetMidi / 12) * 12;
    return octaveBase + answerPc;
  }

  function answerNote(pc) {
    const targetMidi = questions[current];
    const answerMidi = sameOctaveMidi(targetMidi, pc);
    answers.push({
      targetMidi,
      answerText: noteLabel(answerMidi, false),
      correctText: noteLabel(targetMidi, false),
      answerHz: midiToHz(answerMidi),
      correctHz: midiToHz(targetMidi)
    });
    nextQuestion();
  }

  function answerFrequency(value) {
    const targetMidi = questions[current];
    answers.push({
      targetMidi,
      answerText: `${value.toFixed(2)} Hz`,
      correctText: `${midiToHz(targetMidi).toFixed(2)} Hz`,
      answerHz: value,
      correctHz: midiToHz(targetMidi)
    });
    nextQuestion();
  }

  function nextQuestion() {
    current += 1;
    if (current < 5) renderQuestion();
    else renderResults();
  }

  function renderResults() {
    const totalDifference = answers.reduce((sum, a) => sum + Math.abs(a.correctHz - a.answerHz), 0);
    const score = Math.round(999 - totalDifference);
    $("#result-level").textContent = LEVELS[level].label;
    $("#score-number").textContent = score;
    $("#result-body").innerHTML = "";
    answers.forEach((answer, index) => {
      const difference = Math.abs(answer.correctHz - answer.answerHz);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>0${index + 1}</td>
        <td>${answer.answerText}</td>
        <td>${answer.correctText}</td>
        <td>${difference.toFixed(2)} Hz</td>
        <td><button class="table-play" type="button" aria-label="第${index + 1}問の音を再生">▶</button></td>
      `;
      row.querySelector(".table-play").addEventListener("click", (event) => playTone(answer.targetMidi, event.currentTarget));
      $("#result-body").appendChild(row);
    });
    showScreen("result");
  }

  function startGame() {
    current = 0;
    answers = [];
    generateQuestions();
    showScreen("quiz");
    renderQuestion();
  }

  document.querySelectorAll(".difficulty").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".difficulty").forEach((b) => b.classList.remove("selected"));
      button.classList.add("selected");
      level = button.dataset.level;
    });
  });
  $("#start-btn").addEventListener("click", startGame);
  $("#replay-btn").addEventListener("click", (event) => playTone(questions[current], event.currentTarget));
  $("#frequency-answer").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = Number($("#frequency-input").value);
    if (!Number.isFinite(value) || value <= 0) {
      $("#frequency-input").focus();
      return;
    }
    answerFrequency(value);
  });
  $("#retry-btn").addEventListener("click", startGame);
  $("#home-btn").addEventListener("click", () => showScreen("title"));
})();
