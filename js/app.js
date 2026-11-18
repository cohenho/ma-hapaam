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
  fitTitles(view);
}

// ---------- home: the card catalogue ----------

function showHome() {
  setTab("home");
  render(`
    <header class="hero">
      <div class="brand-stamp" aria-hidden="true">By the<br>Book</div>
      <h1>מה<br>הפעם?</h1>
      <p class="hero-sub">${g("שלפי", "שלוף", "שלפו")} כרטיס מהקטלוג</p>
    </header>
    <section class="catalogue">
      ${visibleCategories().map((c, i) => `
        <button class="index-card" data-cat="${esc(c.id)}" style="--tab:${[14, 110, 206, 60, 160, 240][i % 6]}px">
          <span class="ic-tab typed">${String(i + 1).padStart(2, "0")}</span>
          <span class="ic-num typed">№ ${String(i + 1).padStart(2, "0")}</span>
          <span class="ic-name">${esc(c.name)}</span>
          <span class="ic-desc">${esc(c.desc)}</span>
        </button>`).join("")}
    </section>
  `, "home");
  view.querySelectorAll(".index-card").forEach((btn) =>
    btn.addEventListener("click", () => {
      btn.classList.add("pulling");
      setTimeout(() => showRecommendations(btn.dataset.cat), 260);
    }));
}

// ---------- recommendations: three books on the lending desk ----------

const PICK_ACTIONS = [
  { id: "taken",    label: "לקחתי",              kind: "stamp-red" },
  { id: "read",     label: "כבר קראתי",          kind: "stamp-blue" },
  { id: "disliked", label: "קראתי ולא התחברתי",  kind: "link" },
  { id: "rejected", label: "תחזיר לערימה",       kind: "link" },
];

// learn: how much this choice nudges your taste profile towards (+) or away from (−) books like it
const PICK_RESULT = {
  taken:    { status: "taken",    learn: 0.5,  toast: () => "הספר עבר ל\"הספרים שלי\". קריאה מהנה!" },
  read:     { status: "read",     learn: 0.3,  toast: () => "רשמתי שכבר קראת אותו." },
  disliked: { status: "read",     learn: -1.5, extra: { liked: false }, toast: () => "רשמתי. אציע פחות ספרים כאלה." },
  rejected: { status: "rejected", learn: -0.4, toast: () => "החזרתי לערימה. לא אציע אותו שוב." },
};

// Change a book's status and teach the profile; returns a function that undoes both.
function applyChoice(book, status, extra, learnAmount) {
  const before = Store.state.books[book.id];
  const learnedBefore = JSON.stringify(Store.state.profile.learned || {});
  if (status) Store.setBookStatus(book.id, status, extra);
  else Store.clearBookStatus(book.id);
  if (learnAmount) { Taste.learn(Store.state.profile, book, learnAmount); Store.save(); }
  return () => {
    Store.state.profile.learned = JSON.parse(learnedBefore);
    Store.restoreBook(book.id, before);
  };
}

// current: ids on the desk now (so "ערימה אחרת" brings different ones).
// samePicks: show exactly these books again (used by "ביטול").
function showRecommendations(categoryId, current = [], samePicks = null) {
  setTab("home");
  const cat = window.CATEGORIES.find((c) => c.id === categoryId);
  const index = window.CATEGORIES.indexOf(cat) + 1;
  const picks = samePicks || Recommend.next(categoryId, current);

  render(`
    <header class="page-head">
      <button class="back">→ חזרה לקטלוג</button>
      <span class="typed muted">דלפק ההשאלה</span>
    </header>
    <div class="tab-title"><span class="typed">№ ${String(index).padStart(2, "0")}</span>${esc(cat.name)}</div>
    <p class="hint">${picks.length
      ? `הספרנית הניחה לך ${picks.length === 1 ? "ספר אחד" : `${picks.length} ספרים`}. ${g("געי", "גע", "געו")} באחד`
      : "עברת על כל הספרים במגירה הזו! בקרוב יתווספו עוד."}</p>
    <div class="desk">
      <div class="desk-books">${Shelf.stackHtml(picks)}</div>
      <p class="desk-empty" hidden>הדלפק התרוקן.</p>
      <div class="desk-top" aria-hidden="true">
        <div class="desk-card"><b>כרטיס השאלה</b>הושאל: ____<br>להחזיר עד: ____</div>
        <div class="desk-stamp"></div>
      </div>
    </div>
    ${picks.length ? `<button class="dashed-btn more">ערימה אחרת, בבקשה</button>` : ""}
  `, "recs");

  view.querySelector(".back").addEventListener("click", showHome);
  const more = view.querySelector(".more");
  if (more) more.addEventListener("click", () => {
    view.querySelector(".stack").classList.add("swap-out");
    setTimeout(() => showRecommendations(categoryId, picks.map((b) => b.id)), 300);
  });

  wireBooks(view.querySelector(".desk-books"), (book, spine) => {
    Shelf.open(book, {
      spine,
      actions: PICK_ACTIONS,
      onAction: async (actionId) => {
        const result = PICK_RESULT[actionId];
        const undo = applyChoice(book, result.status, result.extra, result.learn);
        await Shelf.removeBook(spine, actionId === "taken" ? "out" : "away");
        if (!view.querySelector(".stack .bk")) view.querySelector(".desk-empty").hidden = false;
        Toast.show(result.toast(), () => {
          undo();
          showRecommendations(categoryId, current, picks.filter((b) => !Store.state.books[b.id]));
        });
      },
    });
  });
}

// One click handler for every book inside a container.
function wireBooks(container, onPick) {
  container.addEventListener("click", (e) => {
    const spine = e.target.closest(".bk");
    if (spine) onPick(bookById(spine.dataset.id), spine);
  });
}

// ---------- my books: your own stacks ----------

function showMyBooks() {
  setTab("mybooks");
  const entries = Object.entries(Store.state.books)
    .map(([id, info]) => ({ book: bookById(id), ...info }))
    .filter((e) => e.book)
    .sort((a, b) => b.date.localeCompare(a.date));
  const of = (status) => entries.filter((e) => e.status === status);

  const stackBlock = (status, title, empty) => {
    const list = of(status);
    return `
      <section class="my-stack ${status === "rejected" ? "returned-stack" : ""}">
        <h3>${title} <span class="count typed">${list.length}</span></h3>
        ${list.length
          ? `<div class="desk small" data-status="${status}"><div class="desk-books">${Shelf.stackHtml(list.map((e) => e.book))}</div><div class="desk-top"></div></div>`
          : `<p class="empty-note">${empty}</p>`}
      </section>`;
  };

  render(`
    <header class="page-head"><h2 class="page-title">הספרים שלי</h2></header>
    ${stackBlock("taken", "לקחתי",
      `עוד לא לקחת ספרים. ${g("כשתלחצי", "כשתלחץ", "כשתלחצו")} "לקחתי", הספר יחכה כאן.`)}
    ${stackBlock("read", "קראתי", "כאן יחכו ספרים שכבר קראת.")}
    ${stackBlock("rejected", "החזרתי לערימה",
      `כאן יחכו ספרים ${g("שהחזרת", "שהחזרת", "שהחזרתם")} לערימה. אם ${g("תתחרטי", "תתחרט", "תתחרטו")}, אפשר להחזיר אותם להמלצות.`)}
  `, "mybooks");

  view.querySelectorAll(".desk-books").forEach((area) =>
    wireBooks(area, (book, spine) => openMyBook(book, spine)));
}

function openMyBook(book, spine) {
  const rec = Store.state.books[book.id];
  const actions =
    rec.status === "taken" ? [
      { id: "rate",     label: `${g("סיימתי", "סיימתי", "סיימנו")}, לדרג`, kind: "stamp-blue" },
      { id: "disliked", label: "קראתי ולא התחברתי", kind: "link" },
      { id: "remove",   label: "להוציא מהרשימה", kind: "link" },
    ] :
    rec.status === "rejected" ? [
      { id: "restore",  label: "להחזיר להמלצות", kind: "stamp-blue" },
    ] :
    [
      { id: "rate",   label: rec.rating ? "לשנות את הדירוג" : "לדרג", kind: "stamp-blue" },
      { id: "remove", label: "להוציא מהרשימה", kind: "link" },
    ];

  const note =
    rec.status === "taken" ? `נלקח ב-${formatDate(rec.date)}` :
    rec.status === "rejected" ? `${g("החזרת", "החזרת", "החזרתם")} לערימה ב-${formatDate(rec.date)}` :
    rec.rating ? `<span class="note-stars">${Rating.starsText(rec.rating)}</span> · ${formatDate(rec.date)}` +
      (rec.quick?.length ? `<br>${rec.quick.map(esc).join(" · ")}` : "") +
      (rec.comment ? `<br>"${esc(rec.comment)}"` : "") :
    rec.liked === false ? `קראת ולא התחברת · ${formatDate(rec.date)}` :
    `קראת · ${formatDate(rec.date)}`;

  Shelf.open(book, {
    spine,
    note,
    actions,
    onAction: (id) => {
      if (id === "rate") {
        spine.classList.remove("pulled");
        spine.closest(".stack")?.classList.remove("has-pulled");
        Rating.open(book, {
          onSaved: () => { showMyBooks(); Toast.show("הדירוג נשמר, וההמלצות ילמדו ממנו."); },
          onSnoozed: () => Toast.show(`בסדר, ${g("אזכיר לך", "אזכיר לך", "אזכיר לכם")} בעוד שבוע.`),
        });
        return;
      }
      const undo =
        id === "finished" ? applyChoice(book, "read", {}, 0.5) :
        id === "disliked" ? applyChoice(book, "read", { liked: false }, -1.5) :
        id === "restore" ? applyChoice(book, null, null, 0.4) : // takes back the "returned" nudge
        applyChoice(book, null, null, 0);
      showMyBooks();
      Toast.show(
        id === "remove" ? "הוצאתי מהרשימה." :
        id === "restore" ? "הספר חזר להמלצות." : "הספר עבר לערימת \"קראתי\".",
        () => { undo(); showMyBooks(); });
    },
  });
}

// ---------- start ----------

Store.load();
if (Store.state.onboarded) {
  showHome();
  setTimeout(Rating.maybeRemind, 1200); // "סיימת את…? איך היה?"
} else {
  Onboarding.start();
}
Install.maybeShowHelp();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
