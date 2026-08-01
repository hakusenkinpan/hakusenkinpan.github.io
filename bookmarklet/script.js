document.querySelectorAll(".copy-area").forEach((copyArea) => {
    const copyButton = copyArea.querySelector(".copy-button");
    const bookmarkletCode = copyArea.querySelector("textarea");
    const copyStatus = copyArea.querySelector(".copy-status");

    copyButton.addEventListener("click", async () => {
        const code = bookmarkletCode.value;

        try {
            await navigator.clipboard.writeText(code);
            copyStatus.textContent = "コピーしました！ブックマークのURL欄へ貼り付けてください。";
        } catch {
            bookmarkletCode.focus();
            bookmarkletCode.select();
            const copied = document.execCommand("copy");
            copyStatus.textContent = copied
                ? "コピーしました！ブックマークのURL欄へ貼り付けてください。"
                : "テキストを選択しました。コピーしてください。";
        }
    });
});
