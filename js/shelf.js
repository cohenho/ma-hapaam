// Books lying in a stack on the lending desk, the library card that opens when you
// pick one, and the little paper slip ("toast") with a "ביטול" button.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// A stable number from a book id, so a book always gets the same colour and shape.
function hashOf(id, mod, seed = 7) {
  return [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0) + seed) % 100003, seed) % mod;
}

// Old cloth bindings: oxblood, bottle green, navy, mustard, plum, slate, rust, teal...
const CLOTH = ["#7a2430", "#284a3c", "#2c3550", "#8a6a2c", "#5b3350", "#3f4a52",
               "#8c4a2a", "#2f5a5e", "#6b2a2a", "#4f5d3a", "#43355e", "#7a5a3a"];

function coverUrl(book, size = "L") {
  return `https://covers.openlibrary.org/b/id/${book.cover}-${size}.jpg?default=false`;
}

// Where to look on the shelf: Hebrew fiction is shelved by the author's surname,
// and the spine label usually shows its first letters.
// Non-fiction is shelved by subject (Dewey numbers), not by the author's name.
const isNonfiction = (book) => book.cats.includes("nonfiction");
const shelfMark = (book) => (isNonfiction(book) ? "עיון" : "ס");

function shelfLetters(book) {
  const firstAuthor = book.author.split(" ו")[0].trim();
  const surname = firstAuthor.split(/\s+/).pop().replace(/["״.]/g, "");
  // First three letters; a geresh (ג' ז' צ') stays with its letter.
  let out = "", letters = 0;
  for (const ch of surname) {
    if (ch === "'" || ch === "׳") { if (letters) out += "'"; continue; }
    if (letters === 3) break;
    out += ch;
    letters++;
  }
  return out;
}

// Shrink each title until it fits inside its book (never spills over the edge).
function fitTitles(root = document) {
  root.querySelectorAll(".fit").forEach((box) => {
    const t = box.firstElementChild;
    let size = parseFloat(box.dataset.max || 26);
    const min = parseFloat(box.dataset.min || 12);
    t.style.fontSize = size + "px";
    while ((t.scrollHeight > box.clientHeight + 0.5 || t.scrollWidth > box.clientWidth + 0.5) && size > min) {
      size -= 0.5;
      t.style.fontSize = size + "px";
    }
  });
}
// Fonts arrive a moment after the page; measure again when they do.
if (document.fonts) document.fonts.ready.then(() => fitTitles());

const Shelf = (() => {
  // ---------- a book lying on its side ----------

  function bookHtml(book) {
    const colour = CLOTH[hashOf(book.id, CLOTH.length)];
    const len = 86 + hashOf(book.id, 15, 3);                 // 86–100% of the desk
    const shift = (hashOf(book.id, 9, 5) - 4) * 3;            // a slightly untidy stack
    const thick = book.title.length > 14 ? 74 : 60 + hashOf(book.id, 3, 2) * 4;
    return `
      <button class="bk" data-id="${esc(book.id)}"
              style="--c:${colour};--len:${len}%;--t:${thick}px;--x:${shift}px"
              aria-label="${esc(book.title)} מאת ${esc(book.author)}">
        <span class="bk-label"><span class="bk-mark">${shelfMark(book)}</span>${isNonfiction(book) ? "" : `<br>${esc(shelfLetters(book))}`}</span>
        ${Store.state.books[book.id]?.rating ? `<span class="bk-stars" aria-label="${Store.state.books[book.id].rating} כוכבים">★${Store.state.books[book.id].rating}</span>` : ""}
        <span class="fit" data-max="26"><span class="bk-title">${esc(book.title)}</span></span>
        <span class="bk-author">${esc(book.author)}</span>
      </button>`;
  }

  function stackHtml(books) {
    return `<div class="stack">${books.map(bookHtml).join("")}</div>`;
  }

  // ---------- the library card ----------

  const backdrop = document.querySelector(".sheet-backdrop");
  const sheet = document.querySelector(".sheet");
  let pulled = null;
  let onClose = null;

  function coverBlock(book) {
    const colour = CLOTH[hashOf(book.id, CLOTH.length)];
    const drawn = `<div class="card-cover drawn" style="--c:${colour}">
        <span class="drawn-title">${esc(book.title)}</span>
        <span class="drawn-author">${esc(book.author)}</span>
      </div>`;
    if (!book.cover) return drawn;
    return `<div class="card-cover-wrap" data-fallback="${esc(drawn)}">
        <img class="card-cover" src="${coverUrl(book)}" alt="כריכת ${esc(book.title)}">
      </div>`;
  }

  // actions: [{ id, label, kind: "stamp-red" | "stamp-blue" | "link" }]
  function open(book, { spine, actions, note = "", onAction, closed }) {
    pulled = spine || null;
    onClose = closed || null;
    if (pulled) {
      pulled.closest(".stack")?.classList.add("has-pulled");
      pulled.classList.add("pulled");
    }

    const stamps = actions.filter((a) => a.kind !== "link");
    const links = actions.filter((a) => a.kind === "link");
    sheet.innerHTML = `
      <div class="sheet-grip" aria-hidden="true"></div>
      <button class="sheet-close" aria-label="סגירה">✕</button>
      <div class="card-top typed"><span>${isNonfiction(book) ? "עיון" : `ס · ${esc(shelfLetters(book))}`}</span><span>${book.year}</span></div>
      <div class="card-book">
        ${coverBlock(book)}
        <div class="card-head">
          <h2>${esc(book.title)}</h2>
          <p class="card-author typed">${esc(book.author)}</p>
          <p class="card-tags typed">${book.tags.map(esc).join(" / ")}</p>
        </div>
      </div>
      <p class="card-summary">${esc(book.summary)}</p>
      <p class="card-where"><b>איפה במדף?</b> ${isNonfiction(book)
        ? `במדפי העיון, לפי נושא. הכי קל לשאול את הספרנית.`
        : `במדף הסיפורת, לפי שם המשפחה של ${book.author.includes(" ו") ? "הכותבים" : "הסופר/ת"}.
        ${g("חפשי", "חפש", "חפשו")} מדבקה עם <span class="typed">ס</span> ומתחתיה <span class="typed">${esc(shelfLetters(book))}</span>`}</p>
      ${note ? `<p class="card-note">${note}</p>` : ""}
      <div class="card-stamps">
        ${stamps.map((a) => `<button class="stamp ${a.kind}" data-action="${a.id}">${a.label}</button>`).join("")}
      </div>
      ${links.length ? `<div class="card-links">
        ${links.map((a) => `<button class="card-link" data-action="${a.id}">${a.label}</button>`).join("")}
      </div>` : ""}`;

    const img = sheet.querySelector("img.card-cover");
    if (img) img.addEventListener("error", () => {
      img.parentElement.outerHTML = img.parentElement.dataset.fallback;
    });

    sheet.querySelector(".sheet-close").addEventListener("click", () => close());
    sheet.querySelectorAll("[data-action]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.dataset.action;
        if (id === "taken") await stampCard("נלקח");
        close({ keepPulled: true });
        onAction(id);
      }));

    setTimeout(() => {
      backdrop.hidden = false;
      sheet.hidden = false;
      sheet.scrollTop = 0;
      requestAnimationFrame(() => {
        backdrop.classList.add("show");
        sheet.classList.add("show");
      });
    }, pulled ? 260 : 0);
  }

  // A big date stamp lands on the card, like at the library desk.
  function stampCard(word) {
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
    sheet.insertAdjacentHTML("beforeend",
      `<div class="big-stamp" aria-hidden="true"><span>${word}</span><span class="typed">${date}</span></div>`);
    return new Promise((r) => setTimeout(r, 750));
  }

  function close({ keepPulled = false } = {}) {
    if (sheet.hidden) return;
    backdrop.classList.remove("show");
    sheet.classList.remove("show");
    sheet.style.transform = "";
    setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 320);
    if (pulled && !keepPulled) {
      pulled.classList.remove("pulled");
      pulled.closest(".stack")?.classList.remove("has-pulled");
    }
    pulled = null;
    if (onClose && !keepPulled) onClose();
  }

  backdrop.addEventListener("click", () => close());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // swipe the card down to put the book back
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

  // Take a book off the stack with a little animation.
  function removeBook(spine, direction = "out") {
    const stack = spine.closest(".stack");
    spine.classList.add(`leaving-${direction}`);
    return new Promise((resolve) => setTimeout(() => {
      spine.remove();
      stack?.classList.remove("has-pulled");
      resolve();
    }, 380));
  }

  return { bookHtml, stackHtml, open, close, removeBook };
})();

// ---------- toast: a paper slip at the bottom ----------

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
