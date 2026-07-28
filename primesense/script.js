"use strict";

const GAME_CONFIG = {
  questionCount: 10,
  secondsPerQuestion: 10,
  difficulties: {
    1: { min: 1, max: 99 },
    2: { min: 100, max: 999 },
    3: { min: 1000, max: 9999 }
  }
};

const elements = {
  startScreen: document.querySelector("#start-screen"),
  gameScreen: document.querySelector("#game-screen"),
  resultScreen: document.querySelector("#result-screen"),
  startButton: document.querySelector("#start-button"),
  retryButton: document.querySelector("#retry-button"),
  backButton: document.querySelector("#back-button"),
  questionIndex: document.querySelector("#question-index"),
  score: document.querySelector("#score"),
  timerBar: document.querySelector("#timer-bar"),
  streakBadge: document.querySelector("#streak-badge"),
  stageNote: document.querySelector("#stage-note"),
  numberGrid: document.querySelector("#number-grid"),
  feedback: document.querySelector("#feedback"),
  answerTime: document.querySelector("#answer-time"),
  bonusPop: document.querySelector("#bonus-pop"),
  finalScore: document.querySelector("#final-score"),
  resultDifficulty: document.querySelector("#result-difficulty"),
  comboScoreResult: document.querySelector("#combo-score-result"),
  timeMultiplier: document.querySelector("#time-multiplier"),
  correctBonusResult: document.querySelector("#correct-bonus-result"),
  correctCount: document.querySelector("#correct-count"),
  averageTime: document.querySelector("#average-time"),
  maxStreak: document.querySelector("#max-streak"),
  screenFlash: document.querySelector("#screen-flash")
};

let state = {};

function isPrime(number) {
  if (number < 2) return false;
  if (number === 2) return true;
  if (number % 2 === 0) return false;
  for (let divisor = 3; divisor * divisor <= number; divisor += 2) {
    if (number % divisor === 0) return false;
  }
  return true;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function panelCountFor(questionIndex) {
  return questionIndex < 7 ? 4 : 9;
}

function basePointsFor(questionIndex) {
  return questionIndex < 7 ? 10 : 30;
}

function makeQuestions(difficulty) {
  const { min, max } = GAME_CONFIG.difficulties[difficulty];
  const allowed = [];
  for (let number = min; number <= max; number++) {
    if (number === 2 || number % 2 !== 0) allowed.push(number);
  }

  const primeAnswers = shuffle(allowed.filter(isPrime))
    .slice(0, GAME_CONFIG.questionCount);
  const nonPrimes = allowed.filter(number => !isPrime(number));

  return primeAnswers.map((answer, index) => {
    const distractors = shuffle(nonPrimes)
      .slice(0, panelCountFor(index) - 1);
    return {
      answer,
      panels: shuffle([answer, ...distractors])
    };
  });
}

function showScreen(screen) {
  [elements.startScreen, elements.gameScreen, elements.resultScreen]
    .forEach(item => item.classList.toggle("hidden", item !== screen));
}

function startGame() {
  const difficulty = Number(document.querySelector('input[name="difficulty"]:checked').value);
  state = {
    difficulty,
    questions: makeQuestions(difficulty),
    index: 0,
    comboScore: 0,
    streak: 0,
    maxStreak: 0,
    correctCount: 0,
    elapsedTimes: [],
    locked: false,
    startedAt: 0,
    timerId: null,
    nextId: null
  };
  elements.score.textContent = "0";
  showScreen(elements.gameScreen);
  showQuestion();
}

function showQuestion() {
  const question = state.questions[state.index];
  const panelCount = panelCountFor(state.index);
  const basePoints = basePointsFor(state.index);
  state.locked = false;

  elements.questionIndex.textContent = state.index + 1;
  elements.stageNote.textContent = `${panelCount}枚から選択・正解 ${basePoints}pt`;
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  elements.answerTime.textContent = "";
  elements.answerTime.className = "answer-time";
  elements.numberGrid.className = `number-grid${panelCount === 9 ? " nine" : ""}`;
  elements.numberGrid.replaceChildren(...question.panels.map(number => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-panel";
    button.textContent = number;
    button.dataset.number = number;
    button.setAttribute("aria-label", `${number}を選ぶ`);
    button.addEventListener("click", () => answerQuestion(number, button));
    return button;
  }));

  updateStreakBadge();
  startTimer();
}

function startTimer() {
  clearInterval(state.timerId);
  state.startedAt = performance.now();
  elements.timerBar.style.transform = "scaleX(1)";
  elements.timerBar.classList.remove("urgent");

  state.timerId = setInterval(() => {
    const elapsed = (performance.now() - state.startedAt) / 1000;
    const ratio = Math.max(0, 1 - elapsed / GAME_CONFIG.secondsPerQuestion);
    elements.timerBar.style.transform = `scaleX(${ratio})`;
    elements.timerBar.classList.toggle("urgent", ratio <= 0.3);
    if (ratio <= 0) answerQuestion(null, null);
  }, 50);
}

function answerQuestion(selectedNumber, selectedButton) {
  if (state.locked) return;
  state.locked = true;
  clearInterval(state.timerId);

  const question = state.questions[state.index];
  const isCorrect = selectedNumber === question.answer;
  const measuredElapsed = Math.min(
    GAME_CONFIG.secondsPerQuestion,
    (performance.now() - state.startedAt) / 1000
  );
  const elapsedForBonus = isCorrect ? measuredElapsed : GAME_CONFIG.secondsPerQuestion;
  state.elapsedTimes.push(elapsedForBonus);

  const buttons = [...elements.numberGrid.querySelectorAll(".number-panel")];
  buttons.forEach(button => {
    button.disabled = true;
    if (Number(button.dataset.number) === question.answer) button.classList.add("answer");
  });

  if (isCorrect) {
    state.streak += 1;
    state.maxStreak = Math.max(state.maxStreak, state.streak);
    state.correctCount += 1;

    const basePoints = basePointsFor(state.index);
    const comboMultiplier = 1 + Math.max(0, state.streak - 1) * 0.2;
    const earned = Math.round(basePoints * comboMultiplier);
    state.comboScore += earned;
    elements.score.textContent = state.comboScore.toLocaleString("ja-JP");
    elements.feedback.textContent = "正解！";
    elements.feedback.classList.add("correct");
    elements.answerTime.textContent = `TIME ${elapsedForBonus.toFixed(2)}秒`;
    elements.answerTime.classList.add("correct");
    showBonus(`${basePoints} × コンボ${comboMultiplier.toFixed(1)} ＝ +${earned}`);
    playEffect("correct");
  } else {
    state.streak = 0;
    if (selectedButton) selectedButton.classList.add("wrong-choice");
    elements.feedback.textContent = selectedNumber === null
      ? `時間切れ！　正解は ${question.answer}`
      : `不正解　正解は ${question.answer}`;
    elements.feedback.classList.add("wrong");
    elements.answerTime.textContent = `TIME ${GAME_CONFIG.secondsPerQuestion.toFixed(2)}秒`;
    elements.answerTime.classList.add("wrong");
    playEffect("wrong");
  }

  updateStreakBadge();
  state.nextId = setTimeout(nextQuestion, 1350);
}

function updateStreakBadge() {
  const visible = state.streak >= 2;
  elements.streakBadge.classList.toggle("hidden", !visible);
  if (visible) {
    const multiplier = 1 + (state.streak - 1) * 0.2;
    elements.streakBadge.innerHTML = `${state.streak} COMBO <b>×${multiplier.toFixed(1)}</b>`;
  }
}

function showBonus(text) {
  elements.bonusPop.textContent = text;
  elements.bonusPop.classList.remove("show");
  void elements.bonusPop.offsetWidth;
  elements.bonusPop.classList.add("show");
}

function playEffect(type) {
  elements.screenFlash.className = `screen-flash ${type}`;
  setTimeout(() => { elements.screenFlash.className = "screen-flash"; }, 450);
}

function nextQuestion() {
  state.index += 1;
  if (state.index >= GAME_CONFIG.questionCount) showResult();
  else showQuestion();
}

function showResult() {
  clearInterval(state.timerId);
  const difficultyNames = { 1: "初級", 2: "中級", 3: "上級" };
  const correctCountFactors = { 1: 0, 2: 1, 3: 10 };
  const averageTime = state.elapsedTimes
    .reduce((total, time) => total + time, 0) / GAME_CONFIG.questionCount;
  const averageRemaining = GAME_CONFIG.secondsPerQuestion - averageTime;
  const timeMultiplier = 1 + averageRemaining / GAME_CONFIG.secondsPerQuestion;
  const correctCountFactor = correctCountFactors[state.difficulty];
  const correctCountMultiplier = correctCountFactor === 0
    ? 1
    : state.correctCount * correctCountFactor;
  const finalScore = Math.ceil(
    state.comboScore * timeMultiplier * correctCountMultiplier
  );

  elements.finalScore.textContent = finalScore.toLocaleString("ja-JP");
  elements.resultDifficulty.textContent = difficultyNames[state.difficulty];
  elements.comboScoreResult.textContent = state.comboScore.toLocaleString("ja-JP");
  elements.timeMultiplier.textContent = timeMultiplier.toFixed(2);
  elements.correctBonusResult.classList.toggle("hidden", correctCountFactor === 0);
  elements.correctBonusResult.textContent =
    `× 正解数倍率 ${correctCountMultiplier}（${state.correctCount} × ${correctCountFactor}）`;
  elements.correctCount.textContent = state.correctCount;
  elements.averageTime.textContent = averageTime.toFixed(2);
  elements.maxStreak.textContent = state.maxStreak;
  showScreen(elements.resultScreen);
}

elements.startButton.addEventListener("click", startGame);
elements.retryButton.addEventListener("click", startGame);
elements.backButton.addEventListener("click", () => showScreen(elements.startScreen));
