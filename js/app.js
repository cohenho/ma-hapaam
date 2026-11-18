// Screens and what happens when you tap things.

const view = document.getElementById("view");
const tabbar = document.querySelector(".tabbar");

const bookById = (id) => window.BOOKS.find((b) => b.id === id);

function visibleCategories() {
  return window.CATEGORIES.filter((c) => Store.state.settings.adult || !c.adultOnly);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

// ---------- navigation ----------

function setTab(tab) {
  tabbar.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab));
}

tabbar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (!btn) return;
  Shelf.close();
  if (btn.dataset.tab === "home") showHome();
  if (btn.dataset.tab === "mybooks") showMyBooks();
});

function render(html, screen) {
  view.innerHTML = html;
  view.dataset.screen = screen;
  window.scrollTo(0, 0);
}

// ---------- home: the card-catalogue cabinet ----------

function showHome() {
  setTab("home");
  render(`
    <header class="hero">
      <p class="brand">By the Book</p>
      <h1>מה הפעם?</h1>
      <p class="hero-sub">איזו מגירה ${g("נפתח", "נפתח", "נפתח")} היום?</p>
    </header>
    <section class="cabinet">
      ${visibleCategories().map((c) => `
        <button class="drawer" data-cat="${esc(c.id)}">
          <span class="drawer-label">
            <span class="drawer-name">${esc(c.name)}</span>
            <span class="drawer-desc">${esc(c.desc)}</span>
          </span>
          <span class="drawer-pull" aria-hidden="true"></span>
        </button>`).join("")}
    </section>
  `, "home");
  view.querySelectorAll(".drawer").forEach((btn) =>
    btn.addEventListener("click", () => {
      btn.classList.add("opening");
      setTimeout(() => showRecommendations(btn.dataset.cat), 260);
    }));
}

// ---------- recommendations: three books on a shelf ----------

const PICK_ACTIONS = [
  { id: "taken",    label: "לקחתי",              kind: "primary" },
  { id: "read",     label: "כבר קראתי",          kind: "soft" },
  { id: "disliked", label: "קראתי ולא התחברתי",  kind: "soft" },
  { id: "rejected", label: "תחזיר למדף",         kind: "quiet" },
];

const PICK_RESULT = {
  taken:    { status: "taken",    toast: () => "הספר עבר ל\"הספרים שלי\". קריאה מהנה!" },
  read:     { status: "read",     toast: () => "רשמתי שכבר קראת אותו." },
  disliked: { status: "read",     extra: { liked: false }, toast: () => "רשמתי. אציע פחות ספרים כאלה." },
  rejected: { status: "rejected", toast: () => "החזרתי למדף. לא אציע אותו שוב." },
};

// current: ids on the shelf now (so "תציע לי אחרים" brings different ones).
// samePicks: show exactly these books again (used by "ביטול").
function showRecommendations(categoryId, current = [], samePicks = null) {
  setTab("home");
  const cat = window.CATEGORIES.find((c) => c.id === categoryId);
  const picks = samePicks || Recommend.next(categoryId, current);

  render(`
    <header class="page-head">
      <button class="back" aria-label="חזרה">→</button>
      <div class="plaque"><span>${esc(cat.name)}</span></div>
    </header>
    <p class="hint">${picks.length
      ? `${g("געי", "גע", "געו")} בספר כדי להוציא אותו מהמדף`
      : "עברת על כל הספרים במגירה הזו! בקרוב יתווספו עוד."}</p>
    <div class="shelf-area">${Shelf.shelfHtml(picks)}</div>
    <p class="shelf-empty" hidden>המדף התרוקן.</p>
    ${picks.length ? `<button class="btn btn-wide more">תציע לי אחרים</button>` : ""}
  `, "recs");

  view.querySelector(".back").addEventListener("click", showHome);
  const more = view.querySelector(".more");
  if (more) more.addEventListener("click", () => {
    view.querySelector(".shelf").classList.add("swap-out");
    setTimeout(() => showRecommendations(categoryId, picks.map((b) => b.id)), 300);
  });

  wireShelf(view.querySelector(".shelf-area"), (book, spine) => {
    Shelf.open(book, {
      spine,
      actions: PICK_ACTIONS,
      onAction: async (actionId) => {
        const result = PICK_RESULT[actionId];
        const before = Store.state.books[book.id];
        Store.setBookStatus(book.id, result.status, result.extra);
        await Shelf.removeSpine(spine, actionId === "rejected" ? "down" : "up");
        if (!view.querySelector(".shelf .spine")) {
          view.querySelector(".shelf-empty").hidden = false;
        }
        Toast.show(result.toast(), () => {
          Store.restoreBook(book.id, before);
          // the same shelf again, with this book back in place
          showRecommendations(categoryId, current,
            picks.filter((b) => !Store.state.books[b.id]));
        });
      },
    });
  });
}

// One click handler for every spine inside a container.
function wireShelf(container, onPick) {
  container.addEventListener("click", (e) => {
    const spine = e.target.closest(".spine");
    if (spine) onPick(bookById(spine.dataset.id), spine);
  });
}

// ---------- my books: your own shelves ----------

function showMyBooks() {
  setTab("mybooks");
  const entries = Object.entries(Store.state.books)
    .map(([id, info]) => ({ book: bookById(id), ...info }))
    .filter((e) => e.book)
    .sort((a, b) => b.date.localeCompare(a.date));
  const of = (status) => entries.filter((e) => e.status === status);

  const shelfBlock = (status, title, empty) => {
    const list = of(status);
    return `
      <section class="my-shelf">
        <h3><span>${title}</span> <span class="count">${list.length}</span></h3>
        ${list.length
          ? `<div class="shelf-area" data-status="${status}">${Shelf.shelfHtml(list.map((e) => e.book), { wrap: true })}</div>`
          : `<div class="shelf shelf-wrap is-empty"><p>${empty}</p></div>`}
      </section>`;
  };

  const rejected = of("rejected");
  render(`
    <header class="page-head"><h2 class="page-title">הספרים שלי</h2></header>
    ${shelfBlock("taken", "לקחתי",
      `עוד לא לקחת ספרים. ${g("כשתלחצי", "כשתלחץ", "כשתלחצו")} "לקחתי", הספר יעמוד כאן.`)}
    ${shelfBlock("read", "קראתי", "כאן יעמדו ספרים שכבר קראת.")}
    <details class="returned">
      <summary>ספרים שהחזרתי למדף <span class="count">${rejected.length}</span></summary>
      ${rejected.length ? `<ul>${rejected.map((e) => `
        <li data-id="${esc(e.book.id)}">
          <span><strong>${esc(e.book.title)}</strong> · ${esc(e.book.author)}</span>
          <button class="btn btn-quiet restore">להחזיר להמלצות</button>
        </li>`).join("")}</ul>` : `<p>אין כאן כלום.</p>`}
    </details>
  `, "mybooks");

  view.querySelectorAll(".shelf-area").forEach((area) =>
    wireShelf(area, (book, spine) => openMyBook(book, spine)));

  view.querySelectorAll(".restore").forEach((btn) => btn.addEventListener("click", () => {
    Store.clearBookStatus(btn.closest("li").dataset.id);
    showMyBooks();
    view.querySelector(".returned").open = true;
  }));
}

function openMyBook(book, spine) {
  const rec = Store.state.books[book.id];
  const actions = rec.status === "taken"
    ? [
        { id: "finished", label: "סיימתי לקרוא", kind: "primary" },
        { id: "disliked", label: "קראתי ולא התחברתי", kind: "soft" },
        { id: "remove",   label: "להוציא מהרשימה", kind: "quiet" },
      ]
    : [{ id: "remove", label: "להוציא מהרשימה", kind: "quiet" }];

  const note = rec.status === "taken"
    ? `לקחת אותו ב-${formatDate(rec.date)}`
    : rec.liked === false
      ? `קראת ולא התחברת · ${formatDate(rec.date)}`
      : `קראת · ${formatDate(rec.date)}`;

  Shelf.open(book, {
    spine,
    note,
    actions,
    onAction: (id) => {
      const before = { ...rec };
      if (id === "finished") Store.setBookStatus(book.id, "read");
      if (id === "disliked") Store.setBookStatus(book.id, "read", { liked: false });
      if (id === "remove") Store.clearBookStatus(book.id);
      showMyBooks();
      Toast.show(
        id === "remove" ? "הוצאתי מהרשימה." : "הספר עבר למדף \"קראתי\".",
        () => { Store.restoreBook(book.id, before); showMyBooks(); });
    },
  });
}

// ---------- start ----------

Store.load();
showHome();
Install.maybeShowHelp();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
