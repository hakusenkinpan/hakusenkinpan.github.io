const CATALOG = {
  puyu: {
    name: "ぷゆちゃん", emoji: "🥺", subtitle: "うるうる・きゅん", color: "LEMON CANDY", prefix: "p",
    names: ["うるうるぷゆ", "おめかしぷゆ", "だいすきぷゆ", "おやすみぷゆ", "いちごぷゆ", "しあわせぷゆ"]
  },
  takoyaki: {
    name: "たこやき", emoji: "😡", subtitle: "あつあつ・ぷんぷん", color: "SPICY SAUCE", prefix: "t",
    names: ["ぷんぷんたこ", "おまつりたこ", "ソースたっぷり", "はちまきたこ", "からくちたこ", "おうえんたこ"]
  },
  geek: {
    name: "ギーク", emoji: "🤓", subtitle: "ひらめき・わくわく", color: "MINT CODE", prefix: "g",
    names: ["めがねギーク", "ラップトップ", "リスニング", "ロボギーク", "ラボギーク", "ゲーマーギーク"]
  }
};
const THEME_KEYS = Object.keys(CATALOG);
const STICKERS_PER_PACK = 50;
const STORAGE_KEY = "puchipuchi-sealbook-v1";
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const stickerPath = (theme, design) => {
  const number = String(design + 1).padStart(3, "0");
  return `assets/stickers/${theme}/${CATALOG[theme].prefix}-${number}.webp`;
};
const stickerName = (theme, design) => CATALOG[theme].names[design] || `${CATALOG[theme].name} ${String(design + 1).padStart(3, "0")}`;

let state = loadState();
let selectedId = null;
let trayFilter = "all";
let drag = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.inventory && saved?.placed) return saved;
  } catch (_) {}
  return { inventory: [], placed: [], seen: [], opened: 0 };
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateCounters();
}
function specimen(theme, design) {
  const sizeRoll = Math.random();
  const effectRoll = Math.random();
  return {
    id: uid(), theme, design,
    size: sizeRoll < .07 ? "small" : sizeRoll > .985 ? "xlarge" : sizeRoll > .93 ? "large" : "normal",
    effect: effectRoll < .04 ? "rainbow" : effectRoll < .12 ? "metallic" : "normal"
  };
}
function displayMeta(item) {
  const sizes = { small: "ちびサイズ", normal: "ノーマル", large: "でかサイズ", xlarge: "XLサイズ" };
  const effects = { normal: "", metallic: " · メタリック", rainbow: " · レインボー" };
  return sizes[item.size] + effects[item.effect];
}
function sizePx(size) { return ({ small: 86, normal: 112, large: 168, xlarge: 224 })[size] || 112; }
function effectIcon(effect) { return effect === "rainbow" ? "🌈" : effect === "metallic" ? "✦" : ""; }
function showToast(text) {
  const toast = document.querySelector("#toast");
  toast.textContent = text; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 1700);
}

function renderPacks() {
  document.querySelector("#packGrid").innerHTML = THEME_KEYS.map((theme, i) => {
    const p = CATALOG[theme];
    return `<article class="pack-card ${theme}">
      <div class="pack-top"><span class="pack-tag">${p.color}</span><span class="pack-no">PACK 0${i+1}</span></div>
      <div class="pack-art"><img src="${stickerPath(theme, 0)}" alt="${p.name}の001番シール"></div>
      <div class="pack-info"><div><small>${p.emoji} ${p.subtitle}</small><h3>${p.name}</h3></div><button class="open-pack" data-theme="${theme}">OPEN</button></div>
    </article>`;
  }).join("");
}
function renderHeroStickers() {
  document.querySelectorAll("[data-hero-theme]").forEach(image => {
    const theme = image.dataset.heroTheme;
    const randomDesign = Math.floor(Math.random() * STICKERS_PER_PACK);
    image.src = stickerPath(theme, randomDesign);
  });
}
function openPack(theme) {
  const rewards = Array.from({length:3}, () => specimen(theme, Math.floor(Math.random()*STICKERS_PER_PACK)));
  rewards.forEach(item => {
    state.inventory.push(item);
    const key = `${item.theme}-${item.design}`;
    if (!state.seen.includes(key)) state.seen.push(key);
  });
  state.opened++;
  saveState();
  const p = CATALOG[theme];
  document.querySelector("#modalTitle").textContent = `${p.name}が やってきた！`;
  document.querySelector("#revealArea").innerHTML = rewards.map(item => `
    <div class="reveal-card effect-${item.effect}">
      <img src="${stickerPath(item.theme,item.design)}" alt="${stickerName(item.theme,item.design)}">
      <b>${stickerName(item.theme,item.design)}</b><small>${effectIcon(item.effect)} ${displayMeta(item)}</small>
    </div>`).join("");
  document.querySelector("#packModal").hidden = false;
  renderAll();
}
function closeModal(goBook=false) {
  document.querySelector("#packModal").hidden = true;
  if (goBook) switchView("book");
}
function renderFilters() {
  const filters = [{key:"all",label:"ぜんぶ"}, ...THEME_KEYS.map(key => ({key,label:CATALOG[key].name}))];
  document.querySelector("#trayFilters").innerHTML = filters.map(f => `<button class="filter-btn ${trayFilter===f.key?"active":""}" data-filter="${f.key}">${f.label}</button>`).join("");
}
function renderTray() {
  renderFilters();
  const items = state.inventory.filter(x => trayFilter === "all" || x.theme === trayFilter);
  const tray = document.querySelector("#stickerTray");
  if (!items.length) {
    tray.innerHTML = `<div class="empty-tray">パックを開けると、ここにシールが並ぶよ</div>`; return;
  }
  tray.innerHTML = items.map(item => `<div class="tray-card effect-${item.effect}">
    <span class="badge">${item.size==="xlarge"?"XL":item.size==="large"?"L":item.size==="small"?"S":"M"}</span>
    <span class="effect-label">${effectIcon(item.effect)}</span>
    <img src="${stickerPath(item.theme,item.design)}" alt="${stickerName(item.theme,item.design)}">
    <button data-place="${item.id}">貼る</button>
  </div>`).join("");
}
function placeSticker(id) {
  const index = state.inventory.findIndex(x => x.id === id);
  if (index < 0) return;
  const item = state.inventory.splice(index,1)[0];
  const offset = state.placed.length % 7;
  state.placed.push({...item, x: 50 + offset*2, y: 48 + offset*1.2, rotation: (Math.random()*20-10), z: Date.now()});
  selectedId = item.id; saveState(); renderBook(); renderTray(); showToast("シールを貼ったよ！");
}
function renderBook() {
  const board = document.querySelector("#stickerBoard");
  board.querySelectorAll(".placed-sticker").forEach(el => el.remove());
  const sorted = [...state.placed].sort((a,b)=>a.z-b.z);
  sorted.forEach(item => {
    const el = document.createElement("div");
    el.className = `placed-sticker effect-${item.effect}${selectedId===item.id?" selected":""}`;
    el.dataset.id = item.id;
    el.style.left = `${item.x}%`; el.style.top = `${item.y}%`;
    el.style.setProperty("--size", `${sizePx(item.size)}px`);
    el.style.setProperty("--rotation", `${item.rotation}deg`);
    el.innerHTML = `<img src="${stickerPath(item.theme,item.design)}" alt="${stickerName(item.theme,item.design)}">`;
    board.appendChild(el);
  });
  document.querySelector("#emptyBoard").style.display = state.placed.length ? "none" : "grid";
}
function rotateSelected(delta) {
  const item = state.placed.find(x => x.id === selectedId);
  if (!item) return showToast("シールを選んでね");
  item.rotation = (item.rotation + delta) % 360; saveState(); renderBook();
}
function bringFront() {
  const item = state.placed.find(x => x.id === selectedId);
  if (!item) return showToast("シールを選んでね");
  item.z = Date.now(); saveState(); renderBook();
}
function peelSelected() {
  const index = state.placed.findIndex(x => x.id === selectedId);
  if (index < 0) return showToast("はがすシールを選んでね");
  const item = state.placed.splice(index,1)[0];
  delete item.x; delete item.y; delete item.rotation; delete item.z;
  state.inventory.push(item); selectedId = null; saveState(); renderBook(); renderTray(); showToast("トレイにもどしたよ");
}

function renderCollection() {
  let html = "";
  THEME_KEYS.forEach(theme => {
    html += `<h2 class="collection-section">${CATALOG[theme].emoji} ${CATALOG[theme].name}</h2>`;
    for (let design=0; design<STICKERS_PER_PACK; design++) {
      const found = state.seen.includes(`${theme}-${design}`);
      const owned = [...state.inventory,...state.placed].filter(x => x.theme===theme && x.design===design).length;
      html += `<div class="collection-card ${found?"":"locked"}"><img src="${stickerPath(theme,design)}" alt="${found?stickerName(theme,design):"未発見"}"><b>${found?stickerName(theme,design):"？？？"}</b><small>${found?`持っている：${owned}枚`:"まだ出会っていない"}</small></div>`;
    }
  });
  document.querySelector("#collectionGrid").innerHTML = html;
  document.querySelector("#completionRate").textContent = `${Math.round(state.seen.length/(STICKERS_PER_PACK*THEME_KEYS.length)*100)}%`;
}
function updateCounters() {
  document.querySelector("#totalCount").textContent = state.inventory.length + state.placed.length;
}
function renderAll() { renderTray(); renderBook(); renderCollection(); updateCounters(); }
function switchView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `${view}View`));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  window.scrollTo({top:0,behavior:"smooth"});
  if (view==="book") renderBook();
}

document.addEventListener("click", e => {
  const nav = e.target.closest(".nav-btn"); if (nav) switchView(nav.dataset.view);
  const open = e.target.closest(".open-pack"); if (open) openPack(open.dataset.theme);
  const filter = e.target.closest("[data-filter]"); if (filter) { trayFilter=filter.dataset.filter; renderTray(); }
  const place = e.target.closest("[data-place]"); if (place) placeSticker(place.dataset.place);
  const sticker = e.target.closest(".placed-sticker");
  if (sticker) { selectedId=sticker.dataset.id; renderBook(); }
});
document.querySelector("#closeModal").onclick = () => closeModal();
document.querySelector(".modal-backdrop").onclick = () => closeModal();
document.querySelector("#modalDone").onclick = () => closeModal(true);
document.querySelector("#rotateLeft").onclick = () => rotateSelected(-15);
document.querySelector("#rotateRight").onclick = () => rotateSelected(15);
document.querySelector("#bringFront").onclick = bringFront;
document.querySelector("#peelSticker").onclick = peelSelected;

const board = document.querySelector("#stickerBoard");
board.addEventListener("pointerdown", e => {
  const el = e.target.closest(".placed-sticker");
  if (!el) {
    selectedId = null;
    board.querySelectorAll(".placed-sticker.selected").forEach(sticker => sticker.classList.remove("selected"));
    return;
  }
  selectedId = el.dataset.id;
  board.querySelectorAll(".placed-sticker").forEach(sticker => sticker.classList.toggle("selected", sticker === el));
  const rect = board.getBoundingClientRect();
  drag = { id: selectedId, rect }; el.setPointerCapture(e.pointerId);
});
board.addEventListener("pointermove", e => {
  if (!drag) return;
  const item = state.placed.find(x => x.id === drag.id); if (!item) return;
  item.x = Math.max(4,Math.min(96,(e.clientX-drag.rect.left)/drag.rect.width*100));
  item.y = Math.max(5,Math.min(95,(e.clientY-drag.rect.top)/drag.rect.height*100));
  const el = board.querySelector(`[data-id="${drag.id}"]`);
  if (el) { el.style.left=`${item.x}%`; el.style.top=`${item.y}%`; }
});
board.addEventListener("pointerup", () => { if (drag) { saveState(); drag=null; } });
board.addEventListener("pointercancel", () => { if (drag) { saveState(); drag=null; } });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !document.querySelector("#packModal").hidden) closeModal();
  if ((e.key === "Delete" || e.key === "Backspace") && selectedId && document.querySelector("#bookView").classList.contains("active")) { e.preventDefault(); peelSelected(); }
});

renderPacks();
renderHeroStickers();
renderAll();
