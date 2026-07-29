(() => {
  "use strict";

  const STORAGE_KEY = "my-bookmarks-v1";
  const APP_URL = "https://hakusenkinpan.github.io/bookmark/";
  const $ = (selector) => document.querySelector(selector);

  const titleInput = $("#titleInput");
  const urlInput = $("#urlInput");
  const bookmarkButton = $("#bookmarkButton");
  const editMode = $("#editMode");
  const editNotice = $("#editNotice");
  const bookmarkGrid = $("#bookmarkGrid");
  const emptyState = $("#emptyState");
  const randomButton = $("#randomButton");
  const helpDialog = $("#helpDialog");
  const bookmarkletLink = $("#bookmarkletLink");
  const copyStatus = $("#copyStatus");
  const toast = $("#toast");

  let bookmarks = loadBookmarks();
  let selectedId = null;
  let saveTimer = null;
  let toastTimer = null;

  function loadBookmarks() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(value) ? value.filter(item => item && item.id && item.url) : [];
    } catch {
      return [];
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const withProtocol = /^[a-z][a-z\d+\-.]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function faviconUrl(url) {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsed.origin)}&sz=128`;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function setButtonState(saved) {
    bookmarkButton.classList.toggle("is-saved", saved);
    bookmarkButton.querySelector("span").textContent = saved ? "★" : "☆";
    const label = saved ? "ブックマークを解除" : "ブックマークに登録";
    bookmarkButton.setAttribute("aria-label", label);
    bookmarkButton.title = label;
  }

  function resetSelection(clearInputs = true) {
    selectedId = null;
    if (clearInputs) {
      titleInput.value = "";
      urlInput.value = "";
    }
    setButtonState(false);
    render();
  }

  function render() {
    bookmarkGrid.replaceChildren();
    emptyState.hidden = bookmarks.length > 0;

    bookmarks.forEach(bookmark => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `bookmark-card${editMode.checked && bookmark.id === selectedId ? " selected" : ""}`;
      card.dataset.id = bookmark.id;
      card.setAttribute("aria-label", `${bookmark.title}を${editMode.checked ? "編集" : "開く"}`);

      const fallback = document.createElement("span");
      fallback.className = "site-fallback";
      fallback.textContent = (bookmark.title || new URL(bookmark.url).hostname).trim().charAt(0);

      const icon = document.createElement("img");
      icon.className = "site-icon";
      icon.alt = "";
      icon.loading = "lazy";
      icon.src = faviconUrl(bookmark.url);
      icon.addEventListener("error", () => icon.replaceWith(fallback), { once: true });

      const title = document.createElement("span");
      title.className = "bookmark-title";
      title.textContent = bookmark.title;

      card.append(icon, title);
      card.addEventListener("click", () => handleCardClick(bookmark));
      bookmarkGrid.append(card);
    });
  }

  function handleCardClick(bookmark) {
    if (!editMode.checked) {
      window.open(bookmark.url, "_blank", "noopener,noreferrer");
      return;
    }
    selectedId = bookmark.id;
    titleInput.value = bookmark.title;
    urlInput.value = bookmark.url;
    setButtonState(true);
    render();
    titleInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addBookmark() {
    const url = normalizeUrl(urlInput.value);
    const title = titleInput.value.trim();
    if (!title || !url) {
      showToast(!title ? "タイトルを入力してください" : "有効なURLを入力してください");
      (!title ? titleInput : urlInput).focus();
      return;
    }

    const duplicate = bookmarks.find(item => item.url === url);
    if (duplicate) {
      selectedId = duplicate.id;
      titleInput.value = duplicate.title;
      urlInput.value = duplicate.url;
      setButtonState(true);
      render();
      showToast("このURLは登録済みです");
      return;
    }

    const item = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, title, url };
    bookmarks.unshift(item);
    persist();
    selectedId = item.id;
    titleInput.value = item.title;
    urlInput.value = item.url;
    setButtonState(true);
    render();
    showToast("ブックマークに追加しました");
  }

  function removeSelected() {
    bookmarks = bookmarks.filter(item => item.id !== selectedId);
    persist();
    resetSelection(false);
    showToast("ブックマークを解除しました");
  }

  function autoSaveSelected() {
    if (!editMode.checked || !selectedId) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const item = bookmarks.find(bookmark => bookmark.id === selectedId);
      const title = titleInput.value.trim();
      const url = normalizeUrl(urlInput.value);
      if (!item || !title || !url) return;
      item.title = title;
      item.url = url;
      urlInput.value = url;
      persist();
      render();
      showToast("変更を保存しました");
    }, 450);
  }

  bookmarkButton.addEventListener("click", () => {
    if (selectedId && bookmarks.some(item => item.id === selectedId)) removeSelected();
    else addBookmark();
  });

  titleInput.addEventListener("input", autoSaveSelected);
  urlInput.addEventListener("input", autoSaveSelected);
  [titleInput, urlInput].forEach(input => input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !selectedId) addBookmark();
  }));

  editMode.addEventListener("change", () => {
    editNotice.hidden = !editMode.checked;
    if (!editMode.checked) resetSelection();
    else render();
  });

  randomButton.addEventListener("click", () => {
    if (!bookmarks.length) {
      showToast("ブックマークがありません");
      return;
    }
    const bookmark = bookmarks[Math.floor(Math.random() * bookmarks.length)];
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  });

  $("#helpButton").addEventListener("click", () => helpDialog.showModal());
  $("#closeHelpButton").addEventListener("click", () => helpDialog.close());
  helpDialog.addEventListener("click", event => {
    if (event.target === helpDialog) helpDialog.close();
  });

  const bookmarkletCode = `javascript:(()=>{const blank=location.href==='about:blank';const u=${JSON.stringify(APP_URL)}+(blank?'':'?title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href));window.open(u,'_blank','noopener')})()`;
  bookmarkletLink.href = bookmarkletCode;
  $("#copyBookmarkletButton").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      copyStatus.textContent = "コピーしました。ブックマークのURL欄へ貼り付けてください。";
    } catch {
      const area = document.createElement("textarea");
      area.value = bookmarkletCode;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      copyStatus.textContent = "コピーしました。";
    }
  });

  const params = new URLSearchParams(location.search);
  const receivedUrl = params.get("url");
  const isAboutBlank = receivedUrl?.trim().toLowerCase() === "about:blank";
  const sharedTitle = isAboutBlank ? null : params.get("title");
  const sharedUrl = isAboutBlank ? null : receivedUrl;
  if (sharedTitle || sharedUrl) {
    titleInput.value = sharedTitle || "";
    urlInput.value = sharedUrl || "";
    const normalizedSharedUrl = normalizeUrl(sharedUrl || "");
    const savedBookmark = bookmarks.find(item => item.url === normalizedSharedUrl);
    if (savedBookmark) {
      selectedId = savedBookmark.id;
      setButtonState(true);
    }
    history.replaceState(null, "", `${location.pathname}${location.hash}`);
    setTimeout(() => showToast(savedBookmark ? "登録済みのページです" : "ページ情報を入力しました"), 200);
  } else if (isAboutBlank) {
    history.replaceState(null, "", `${location.pathname}${location.hash}`);
  }

  render();
})();
