// The bookshelf: book spines, the book that slides off the shelf, and the little
// note that pops up at the bottom ("toast") with a "ביטול" button.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// A stable number from a book id, so a book always gets the same colour and shape.
function hashOf(id, mod, seed = 7) {
  return [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0) + seed) % 100003, seed) % mod;
}

// Cloth / leather colours for spines: [hue, saturation, lightness]
const SPINE_COLOURS = [
  [355, 52, 30], [18, 55, 34], [32, 45, 40], [150, 30, 24], [200, 35, 26],
  [222, 30, 30], [270, 22, 30], [40, 62, 44], [8, 38, 22], [170, 25, 32],
  [345, 30, 40], [28, 25, 52], [95, 20, 30], [210, 15, 20],
];

function coverUrl(book, size = "L") {
  return `https://covers.openlibrary.org/b/id/${book.cover}-${size}.jpg?default=false`;
}

const Shelf = (() => {
  // ---------- spines ----------

  function spineHtml(book) {
    const [h, s, l] = SPINE_COLOURS[hashOf(book.id, SPINE_COLOURS.length)];
    const len = book.title.length;
    const width = Math.min(78, Math.max(50, 38 + len * 1.5));
    const height = 168 + hashOf(book.id, 5, 3) * 8;          // 168–200px
    const style = ["bands", "label", "foil", "split"][hashOf(book.id, 4, 11)];
    return `
      <div class="spine-slot">
        <button class="spine spine-${style}" data-id="${esc(book.id)}"
                style="--h:${h};--s:${s}%;--l:${l}%;--w:${width}px;--ht:${height}px"
                aria-label="${esc(book.title)} מאת ${esc(book.author)}">
          <span class="spine-title">${esc(book.title)}</span>
          <span class="spine-author">${esc(book.author)}</span>
        </button>
      </div>`;
  }

  // A row of books standing on a wooden board.
  function shelfHtml(books, { wrap = false, ends = !wrap } = {}) {
    return `
      <div class="shelf ${wrap ? "shelf-wrap" : ""}">
        ${ends ? `<div class="spine-slot bookend-slot"><div class="bookend"></div></div>` : ""}
        ${books.map(spineHtml).join("")}
        ${ends ? `<div class="spine-slot bookend-slot"><div class="bookend flip"></div></div>` : ""}
      </div>`;
  }

  // ---------- the book off the shelf ----------

  const backdrop = document.querySelector(".sheet-backdrop");
  const sheet = document.querySelector(".sheet");
  let pulledSpine = null;
  let onClose = null;

  function coverBlock(book) {
    const [h, s, l] = SPINE_COLOURS[hashOf(book.id, SPINE_COLOURS.length)];
    const drawn = `<div class="big-cover drawn" style="--h:${h};--s:${s}%;--l:${l}%">
        <span class="drawn-title">${esc(book.title)}</span>
        <span class="drawn-author">${esc(book.author)}</span>
      </div>`;
    if (!book.cover) return drawn;
    return `<div class="big-cover-wrap" data-fallback="${esc(drawn)}">
        <img class="big-cover" src="${coverUrl(book)}" alt="כריכת ${esc(book.title)}">
      </div>`;
  }

  // actions: [{ id, label, kind: "primary" | "soft" | "quiet" }]
  function open(book, { spine, actions, note = "", onAction, closed }) {
    pulledSpine = spine || null;
    onClose = closed || null;
    if (pulledSpine) pulledSpine.classList.add("pulled");

    sheet.innerHTML = `
      <div class="sheet-grip" aria-hidden="true"></div>
      <button class="sheet-close" aria-label="סגירה">✕</button>
      <div class="sheet-book">
        ${coverBlock(book)}
        <div class="sheet-head">
          <h2>${esc(book.title)}</h2>
          <p class="sheet-author">${esc(book.author)} · ${book.year}</p>
          <ul class="tags">${book.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        </div>
      </div>
      <p class="sheet-summary">${esc(book.summary)}</p>
      ${note ? `<p class="sheet-note">${note}</p>` : ""}
      <div class="sheet-actions">
        ${actions.map((a) =>
          `<button class="btn btn-${a.kind || "soft"}" data-action="${a.id}">${a.label}</button>`).join("")}
      </div>`;

    const img = sheet.querySelector("img.big-cover");
    if (img) img.addEventListener("error", () => {
      img.parentElement.outerHTML = img.parentElement.dataset.fallback;
    });

    sheet.querySelector(".sheet-close").addEventListener("click", () => close());
    sheet.querySelectorAll("[data-action]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.dataset.action;
        close({ keepPulled: true });
        onAction(id);
      }));

    // wait for the spine to slide out, then bring the book forward
    setTimeout(() => {
      backdrop.hidden = false;
      sheet.hidden = false;
      sheet.scrollTop = 0;
      requestAnimationFrame(() => {
        backdrop.classList.add("show");
        sheet.classList.add("show");
      });
    }, pulledSpine ? 230 : 0);
  }

  function close({ keepPulled = false } = {}) {
    if (sheet.hidden) return;
    backdrop.classList.remove("show");
    sheet.classList.remove("show");
    sheet.style.transform = "";
    setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 320);
    if (pulledSpine && !keepPulled) pulledSpine.classList.remove("pulled");
    pulledSpine = null;
    if (onClose && !keepPulled) onClose();
  }

  backdrop.addEventListener("click", () => close());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // swipe the book down to put it back
  let startY = null;
  sheet.addEventListener("touchstart", (e) => {
    startY = sheet.scrollTop <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", (e) => {
    if (startY === null) return;
    const dy = e.changedTouches[0].clientY - startY;
    startY = null;
    if (dy > 110) close();
    else sheet.style.transform = "";
  });

  // Remove a spine from the shelf with a little animation.
  function removeSpine(spine, direction = "up") {
    const slot = spine.closest(".spine-slot");
    slot.classList.add(`leaving-${direction}`);
    return new Promise((resolve) => setTimeout(() => { slot.remove(); resolve(); }, 380));
  }

  return { spineHtml, shelfHtml, open, close, removeSpine };
})();

// ---------- toast ----------

const Toast = (() => {
  const el = document.querySelector(".toast");
  let timer = null;

  function show(text, undo) {
    clearTimeout(timer);
    el.innerHTML = `<span>${esc(text)}</span>${undo ? `<button class="toast-undo">ביטול</button>` : ""}`;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    if (undo) el.querySelector(".toast-undo").addEventListener("click", () => { hide(); undo(); });
    timer = setTimeout(hide, 5000);
  }

  function hide() {
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 250);
  }

  return { show, hide };
})();
