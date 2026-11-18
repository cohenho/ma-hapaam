// Screens and what happens when you tap things.

const view = document.getElementById("view");
const tabbar = document.querySelector(".tabbar");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const bookById = (id) => window.BOOKS.find((b) => b.id === id);

function visibleCategories() {
  return window.CATEGORIES.filter((c) => Store.state.settings.adult || !c.adultOnly);
}

// ---------- covers ----------

// A drawn cover in the book's own colour, used when there is no picture
// (or the picture fails to load, e.g. without internet).
function placeholderHtml(book) {
  const hue = [...book.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return `<div class="cover placeholder" style="--hue:${hue}"><span>${esc(book.title)}</span></div>`;
}

function coverHtml(book, size = "M") {
  if (!book.cover) return placeholderHtml(book);
  return `<img class="cover" alt="כריכת ${esc(book.title)}" loading="lazy" data-id="${esc(book.id)}"
    src="https://covers.openlibrary.org/b/id/${book.cover}-${size}.jpg?default=false">`;
}

// Image errors don't bubble, so listen in the capture phase.
view.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.classList.contains("cover")) {
    img.outerHTML = placeholderHtml(bookById(img.dataset.id));
  }
}, true);

// ---------- navigation ----------

function setTab(tab) {
  tabbar.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab));
}

tabbar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (!btn) return;
  if (btn.dataset.tab === "home") showHome();
  if (btn.dataset.tab === "mybooks") showMyBooks();
});

function render(html) {
  view.innerHTML = html;
  window.scrollTo(0, 0);
}

// ---------- home ----------

function showHome() {
  setTab("home");
  render(`
    <header class="hero">
      <h1>מה הפעם?</h1>
      <p>על מה בא לך היום?</p>
    </header>
    <section class="categories">
      ${visibleCategories().map((c) => `
        <button class="category" data-cat="${esc(c.id)}">
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-name">${esc(c.name)}</span>
          <span class="cat-desc">${esc(c.desc)}</span>
        </button>`).join("")}
    </section>
  `);
  view.querySelectorAll(".category").forEach((btn) =>
    btn.addEventListener("click", () => showRecommendations(btn.dataset.cat)));
}

// ---------- recommendations ----------

const ACTIONS = {
  taken:    { label: "לקחתי",     done: () => "נשמר ב\"הספרים שלי\". קריאה מהנה!" },
  rejected: { label: "לא לקחתי",  done: () => "בסדר, לא אציע אותו שוב." },
  read:     { label: "כבר קראתי", done: () => "רשמתי שכבר קראת אותו." },
};

function showRecommendations(categoryId, current = []) {
  setTab("home");
  const cat = window.CATEGORIES.find((c) => c.id === categoryId);
  const picks = Recommend.next(categoryId, current);

  const cards = picks.length
    ? picks.map(bookCard).join("")
    : `<div class="empty">
         <p>עברת על כל הספרים בקטגוריה הזו!</p>
         <p>בקרוב יתווספו עוד. בינתיים אפשר לנסות קטגוריה אחרת.</p>
       </div>`;

  render(`
    <header class="page-head">
      <button class="back" aria-label="חזרה">→</button>
      <h2>${cat.icon} ${esc(cat.name)}</h2>
    </header>
    <section class="cards">${cards}</section>
    ${picks.length ? `<button class="big-btn more">תציע לי אחרים</button>` : ""}
  `);

  view.querySelector(".back").addEventListener("click", showHome);
  const more = view.querySelector(".more");
  if (more) more.addEventListener("click", () =>
    showRecommendations(categoryId, picks.map((b) => b.id)));

  view.querySelectorAll(".card").forEach(wireCard);
}

function bookCard(book) {
  return `
    <article class="card" data-id="${esc(book.id)}">
      <div class="card-body">
        ${coverHtml(book)}
        <div class="card-text">
          <h3>${esc(book.title)}</h3>
          <p class="author">${esc(book.author)}</p>
          <p class="summary">${esc(book.summary)}</p>
          <ul class="tags">${book.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="card-actions">
        ${Object.entries(ACTIONS).map(([status, a]) =>
          `<button class="act act-${status}" data-status="${status}">${a.label}</button>`).join("")}
      </div>
      <div class="card-done" hidden>
        <span class="done-text"></span>
        <button class="undo">ביטול</button>
      </div>
    </article>`;
}

function wireCard(card) {
  const id = card.dataset.id;
  const done = card.querySelector(".card-done");
  const actions = card.querySelector(".card-actions");

  card.querySelectorAll(".act").forEach((btn) => btn.addEventListener("click", () => {
    const status = btn.dataset.status;
    Store.setBookStatus(id, status);
    done.querySelector(".done-text").textContent = ACTIONS[status].done();
    card.classList.add("is-done", `done-${status}`);
    actions.hidden = true;
    done.hidden = false;
  }));

  done.querySelector(".undo").addEventListener("click", () => {
    Store.clearBookStatus(id);
    card.className = "card";
    actions.hidden = false;
    done.hidden = true;
  });
}

// ---------- my books ----------

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

function showMyBooks() {
  setTab("mybooks");
  const entries = Object.entries(Store.state.books)
    .map(([id, info]) => ({ book: bookById(id), ...info }))
    .filter((e) => e.book)
    .sort((a, b) => b.date.localeCompare(a.date));

  const section = (status, title, empty, extra = () => "") => {
    const list = entries.filter((e) => e.status === status);
    return `
      <section class="shelf">
        ${title ? `<h3>${title} <span class="count">${list.length}</span></h3>` : ""}
        ${list.length ? `<ul class="shelf-list">${list.map((e) => `
          <li class="shelf-item" data-id="${esc(e.book.id)}">
            ${coverHtml(e.book, "S")}
            <div>
              <strong>${esc(e.book.title)}</strong>
              <span class="author">${esc(e.book.author)}</span>
              <span class="date">${formatDate(e.date)}</span>
            </div>
            ${extra(e)}
          </li>`).join("")}</ul>` : `<p class="muted">${empty}</p>`}
      </section>`;
  };

  render(`
    <header class="page-head"><h2>הספרים שלי</h2></header>
    ${section("taken", "לקחתי",
      `עוד לא לקחת ספרים. ${g("כשתלחצי", "כשתלחץ", "כשתלחצו")} "לקחתי", הספר יופיע כאן.`)}
    ${section("read", "קראתי", "כאן יופיעו ספרים שכבר קראת.")}
    <details class="rejected">
      <summary>ספרים שוויתרתי עליהם</summary>
      ${section("rejected", "", "אין כאן כלום.", () =>
        `<button class="restore">להחזיר להמלצות</button>`)}
    </details>
  `);

  view.querySelectorAll(".restore").forEach((btn) => btn.addEventListener("click", () => {
    Store.clearBookStatus(btn.closest(".shelf-item").dataset.id);
    showMyBooks();
    view.querySelector(".rejected").open = true;
  }));
}

// ---------- start ----------

Store.load();
showHome();
