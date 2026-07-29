const squishy = document.querySelector(".squishy");
const mainEmoji = document.querySelector(".main-emoji");
const choices = [...document.querySelectorAll(".emoji-choice")];
const shadow = document.querySelector(".orb-shadow");
const soundToggle = document.querySelector(".sound-toggle");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  dragging: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  lastX: 0,
  lastY: 0,
  lastTime: 0,
  animation: 0,
  soundOn: true,
};

let audioContext;

function render(x = state.x, y = state.y) {
  const distance = Math.hypot(x, y);
  const angle = Math.atan2(y, x);
  const maxStretch = Math.min(distance / 310, 0.56);
  const squash = state.dragging ? 0.94 : 1;
  const sx = (1 + maxStretch) * squash;
  const sy = (1 - maxStretch * 0.43) / squash;
  const rotation = (angle * 180) / Math.PI * 0.08;
  const skew = Math.max(-10, Math.min(10, x / 24));

  squishy.style.setProperty("--x", `${x * 0.48}px`);
  squishy.style.setProperty("--y", `${y * 0.48}px`);
  squishy.style.setProperty("--sx", sx.toFixed(3));
  squishy.style.setProperty("--sy", sy.toFixed(3));
  squishy.style.setProperty("--rot", `${rotation.toFixed(2)}deg`);
  squishy.style.setProperty("--skew", `${skew.toFixed(2)}deg`);
  squishy.style.transformOrigin = `${50 - Math.cos(angle) * 32}% ${50 - Math.sin(angle) * 32}%`;
  shadow.style.transform = `translateX(${x * 0.12}px) scaleX(${Math.max(0.55, 1 - Math.abs(y) / 700)})`;
  shadow.style.opacity = `${Math.max(0.08, 0.2 - y / 1400)}`;
}

function pluckSound(force = 0.5) {
  if (!state.soundOn) return;
  audioContext ||= new AudioContext();
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(150 + force * 80, now);
  oscillator.frequency.exponentialRampToValueAtTime(75, now + 0.22);
  filter.type = "lowpass";
  filter.frequency.value = 700;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

  oscillator.connect(filter).connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.3);
}

function settle() {
  cancelAnimationFrame(state.animation);
  const stiffness = reducedMotion ? 0.45 : 0.105;
  const damping = reducedMotion ? 0.45 : 0.79;

  function frame() {
    state.vx = (state.vx - state.x * stiffness) * damping;
    state.vy = (state.vy - state.y * stiffness) * damping;
    state.x += state.vx;
    state.y += state.vy;
    render();

    if (Math.abs(state.x) + Math.abs(state.y) + Math.abs(state.vx) + Math.abs(state.vy) < 0.45) {
      state.x = state.y = state.vx = state.vy = 0;
      squishy.style.transformOrigin = "50% 50%";
      render();
      return;
    }
    state.animation = requestAnimationFrame(frame);
  }

  state.animation = requestAnimationFrame(frame);
}

squishy.addEventListener("pointerdown", (event) => {
  cancelAnimationFrame(state.animation);
  state.dragging = true;
  state.pointerId = event.pointerId;
  state.startX = event.clientX - state.x;
  state.startY = event.clientY - state.y;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  state.lastTime = performance.now();
  state.vx = state.vy = 0;
  squishy.setPointerCapture(event.pointerId);
  squishy.classList.add("is-dragging");
  document.body.classList.add("has-played");
  render();
});

squishy.addEventListener("pointermove", (event) => {
  if (!state.dragging || event.pointerId !== state.pointerId) return;
  const now = performance.now();
  const dt = Math.max(now - state.lastTime, 8);
  const rawX = event.clientX - state.startX;
  const rawY = event.clientY - state.startY;
  const distance = Math.hypot(rawX, rawY);
  const limit = Math.min(innerWidth * 0.43, 290);
  const resistance = distance > limit ? limit + Math.sqrt(distance - limit) * 3.5 : distance;
  const ratio = distance ? resistance / distance : 1;

  state.x = rawX * ratio;
  state.y = rawY * ratio;
  state.vx = ((event.clientX - state.lastX) / dt) * 11;
  state.vy = ((event.clientY - state.lastY) / dt) * 11;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  state.lastTime = now;
  render();
});

function release(event) {
  if (!state.dragging || event.pointerId !== state.pointerId) return;
  state.dragging = false;
  state.pointerId = null;
  squishy.classList.remove("is-dragging");
  pluckSound(Math.min(1, Math.hypot(state.x, state.y) / 200));
  settle();
}

squishy.addEventListener("pointerup", release);
squishy.addEventListener("pointercancel", release);

squishy.addEventListener("keydown", (event) => {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(event.key)) return;
  event.preventDefault();
  cancelAnimationFrame(state.animation);
  const amount = 72;
  if (event.key === "ArrowUp") state.y = -amount;
  if (event.key === "ArrowDown") state.y = amount;
  if (event.key === "ArrowLeft") state.x = -amount;
  if (event.key === "ArrowRight") state.x = amount;
  if (event.key === " " || event.key === "Enter") {
    state.y = 46;
    state.x = 0;
  }
  render();
  pluckSound(0.4);
  settle();
});

choices.forEach((choice) => {
  choice.addEventListener("click", () => {
    choices.forEach((item) => {
      const selected = item === choice;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-checked", String(selected));
    });
    mainEmoji.textContent = choice.dataset.emoji;
    mainEmoji.animate(
      [
        { transform: "scale(.79) rotate(0deg)" },
        { transform: "scale(.58) rotate(-7deg)", offset: 0.35 },
        { transform: "scale(.9) rotate(4deg)", offset: 0.68 },
        { transform: "scale(.79) rotate(0deg)" },
      ],
      { duration: reducedMotion ? 1 : 430, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
    pluckSound(0.25);
  });
});

soundToggle.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  soundToggle.setAttribute("aria-pressed", String(state.soundOn));
  soundToggle.innerHTML = `<span aria-hidden="true">♪</span> SOUND ${state.soundOn ? "ON" : "OFF"}`;
  if (state.soundOn) pluckSound(0.2);
});
