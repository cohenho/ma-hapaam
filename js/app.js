// Screens and what happens when you tap things.

const view = document.getElementById("view");
const tabbar = document.querySelector(".tabbar");

const bookById = (id) => window.BOOKS.find((b) => b.id === id);

// Drawers you can use: adult-only ones need the age setting.
function allowedCategories() {
  return window.CATEGORIES.filter((c) => Store.state.settings.adult || !c.adultOnly);
}

// …and of those, the ones you didn't hide in the settings.
function visibleCategories() {
  const hidden = Store.state.settings.hiddenCats || [];
  return allowedCategories().filter((c) => !hidden.includes(c.id));
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
  if (btn.dataset.tab === "librarian") showLibrarian();
  if (btn.dataset.tab === "mybooks") showMyBooks();
  if (btn.dataset.tab === "taste") showTaste();
  if (btn.dataset.tab === "settings") showSettings();
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
    ${Cloud.enabled && !Store.state.privacySeen ? `
      <aside class="backup-slip privacy-slip">
        <p><b>קצת על פרטיות.</b> כדי שהספרנית תדע אילו ספרים אוהבים, האפליקציה שולחת לה אילו ספרים נלקחו ודורגו,
          ${Store.state.settings.name ? `יחד עם השם ${g("שבחרת", "שבחרת", "שבחרתם")} (${esc(Store.state.settings.name)})` : "עם מספר אקראי, בלי שם"}. שום דבר אחר. אפשר לכבות או למחוק את השם בהגדרות.</p>
        <div class="slip-actions"><button class="stamp stamp-blue privacy-ok">הבנתי</button></div>
      </aside>` : ""}
    <button class="scan-btn">
      <span class="scan-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg></span>
      <span><b>${g("ראית", "ראית", "ראיתם")} ספר בספרייה?</b><br>${g("צלמי", "צלם", "צלמו")} את הכריכה, ואגיד לך אם ${g("תתחברי", "תתחבר", "תתחברו")} אליו</span>
    </button>
    ${Cloud.enabled && Store.state.privacySeen && !Store.state.namePrompted ? `
      <aside class="backup-slip name-slip">
        <p><b>איך קוראים לך?</b> אם ${g("תרצי", "תרצה", "תרצו")}, הספרנית תראה את השם יחד עם הספרים ${g("שלקחת", "שלקחת", "שלקחתם")} ודירגת. לא חובה.</p>
        <input class="slip-name" maxlength="40" placeholder="שם פרטי או כינוי" autocomplete="name">
        <div class="slip-actions">
          <button class="stamp stamp-blue name-ok">שמירה</button>
          <button class="card-link name-no">בלי שם, תודה</button>
        </div>
      </aside>` : ""}
    ${Backup.shouldNag() ? `
      <aside class="backup-slip">
        <p><b>כדאי לגבות את הספרים שלך.</b> הכול שמור רק בטלפון הזה, וגיבוי שומר אותו גם אם הטלפון יתחלף.</p>
        <div class="slip-actions">
          <button class="stamp stamp-blue slip-go">לגבות עכשיו</button>
          <button class="card-link slip-later">אחר כך</button>
        </div>
      </aside>` : ""}
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
  view.querySelector(".privacy-ok")?.addEventListener("click", (e) => {
    Store.state.privacySeen = true; Store.save();
    e.target.closest(".privacy-slip").remove();
    Cloud.trackOpen();
  });
  const nameSlip = view.querySelector(".name-slip");
  if (nameSlip) {
    const done = (name) => {
      Store.state.settings.name = name; Store.state.namePrompted = true; Store.save();
      nameSlip.remove();
      if (name) Toast.show(`תודה, ${name}!`);
    };
    nameSlip.querySelector(".name-ok").addEventListener("click", () => done(nameSlip.querySelector(".slip-name").value.trim()));
    nameSlip.querySelector(".name-no").addEventListener("click", () => done(""));
  }
  view.querySelector(".scan-btn").addEventListener("click", Scan.start);
  const slip = view.querySelector(".backup-slip:not(.privacy-slip)");
  if (slip) {
    Backup.markNagged(); // once a month is enough, even if ignored
    slip.querySelector(".slip-go").addEventListener("click", async () => {
      if (await Backup.exportNow()) { slip.remove(); Toast.show("הגיבוי מוכן. כדאי לשמור אותו במקום בטוח."); }
    });
    slip.querySelector(".slip-later").addEventListener("click", () => slip.remove());
  }
  view.querySelectorAll(".index-card").forEach((btn) =>
    btn.addEventListener("click", () => {
      btn.classList.add("pulling");
      setTimeout(() => showRecommendations(btn.dataset.cat), 260);
    }));
}

// ---------- הספרנית: the librarian's tab ----------
// The librarian's weekly picks on a display stand, and the book readers love most.

function standItem(book, noteHtml, extraMark = "") {
  const st = Store.state.books[book.id];
  const mark = st ? { taken: "נלקח", read: "נקרא", rejected: "הוחזר" }[st.status] : extraMark;
  return `
    <button class="lib-item" data-id="${esc(book.id)}" aria-label="${esc(book.title)}">
      <span class="lib-cover">${book.cover
        ? `<img src="${coverUrl(book, "M")}" alt="" loading="lazy">`
        : `<span class="lib-drawn" style="--c:${CLOTH[hashOf(book.id, CLOTH.length)]}">${esc(book.title)}</span>`}
        ${mark ? `<span class="lib-mark">${mark}</span>` : ""}</span>
      <span class="lib-card">
        <span class="fit" data-max="16" data-min="10"><span class="lib-title">${esc(book.title)}</span></span>
        <span class="lib-author">${esc(book.author)}</span>
        ${noteHtml}
      </span>
    </button>`;
}

function librarianPicks() {
  const lib = Store.state.librarian;
  return (lib && lib.picks || []).map((p) => ({ ...p, book: bookById(p.book_id) })).filter((p) => p.book);
}

// The highest-rated book in our list that isn't already one of the picks.
function topRatedBook() {
  const picked = new Set(librarianPicks().map((p) => p.book.id));
  const row = (Store.state.topRated || []).find((r) => bookById(r.book_id) && !picked.has(r.book_id));
  return row ? { book: bookById(row.book_id), avg: Number(row.avg_rating), n: Number(row.ratings) } : null;
}

function librarianHtml() {
  const picks = librarianPicks();
  const lib = Store.state.librarian;
  const top = topRatedBook();
  const when = lib && lib.week ? new Date(lib.week + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long" }) : "";
  return `
    ${picks.length ? `
    <section class="lib-stand" aria-label="הספרנית ממליצה">
      <div class="lib-wall" aria-hidden="true"></div>
      <div class="lib-sign hand">הספרנית ממליצה</div>
      <p class="lib-week typed">השבוע של ${when}</p>
      <div class="lib-row">
        ${picks.map((p) => standItem(p.book, p.note ? `<span class="lib-note hand">${esc(p.note)}</span>` : "")).join("")}
      </div>
    </section>` : ""}
    ${top ? `
    <section class="lib-stand lib-top" aria-label="הכי אהוב על הקוראים">
      <div class="lib-wall" aria-hidden="true"></div>
      <div class="lib-sign hand">הכי אהוב על הקוראים</div>
      <p class="lib-week typed">לפי הדירוגים של כל מי שקורא כאן</p>
      <div class="lib-row">
        ${standItem(top.book, `<span class="lib-note hand">★${top.avg.toFixed(1)} · ${top.n === 1 ? "דירוג אחד" : `${top.n} דירוגים`}</span>`)}
      </div>
    </section>` : ""}`;
}

function showLibrarian() {
  setTab("librarian");
  const content = librarianHtml();
  render(`
    <header class="page-head"><h2 class="page-title">הספרנית</h2></header>
    ${content.trim() ? content : `
      <p class="empty-note">הספרנית עוד בוחרת את ההמלצות של השבוע. ${g("בואי", "בוא", "בואו")} לבדוק שוב בקרוב!</p>`}
    <p class="lib-soon hand">בקרוב: "במיוחד בשבילך", לפי מה שקוראים דומים ${g("לך", "לך", "לכם")} אוהבים</p>
  `, "librarian");
  wireLibrarian();
}

function wireLibrarian() {
  view.querySelectorAll(".lib-item").forEach((btn) => btn.addEventListener("click", () => {
    const book = bookById(btn.dataset.id);
    const pick = librarianPicks().find((p) => p.book.id === book.id);
    const top = topRatedBook();
    const note = pick && pick.note ? `<span class="hand lib-quote">"${esc(pick.note)}" · הספרנית</span>`
      : top && top.book.id === book.id ? `<span class="hand lib-quote">★${top.avg.toFixed(1)} מהקוראים</span>` : "";
    Shelf.open(book, {
      actions: Store.state.books[book.id] ? [{ id: "close", label: "סגירה", kind: "link" }] : PICK_ACTIONS,
      note,
      onAction: (actionId) => {
        if (actionId === "close") return;
        const result = PICK_RESULT[actionId];
        const undo = applyChoice(book, result.status, result.extra);
        showLibrarian();
        Toast.show(result.toast(), () => { undo(); showLibrarian(); });
      },
    });
  }));
}

// After fresh picks or ratings arrive, redraw the librarian's tab if it's showing.
function refreshLibrarian() {
  if (view.dataset.screen === "librarian") showLibrarian();
}

// ---------- recommendations: three books on the lending desk ----------

const PICK_ACTIONS = [
  { id: "taken",    label: "לקחתי",              kind: "stamp-red" },
  { id: "read",     label: "כבר קראתי",          kind: "stamp-blue" },
  { id: "disliked", label: "קראתי ולא התחברתי",  kind: "link" },
  { id: "rejected", label: "תחזיר לערימה",       kind: "link" },
];

const PICK_RESULT = {
  taken:    { status: "taken",    toast: () => "הספר עבר ל\"הספרים שלי\". קריאה מהנה!" },
  read:     { status: "read",     toast: () => "רשמתי שכבר קראת אותו." },
  disliked: { status: "read",     extra: { liked: false }, toast: () => "רשמתי. אציע פחות ספרים כאלה." },
  rejected: { status: "rejected", toast: () => "החזרתי לערימה. לא אציע אותו שוב." },
};

// Change a book's status; returns a function that undoes it. (What the app
// learns is worked out from all your books together, so undo needs nothing else.)
function applyChoice(book, status, extra) {
  const before = Store.state.books[book.id];
  if (status) Store.setBookStatus(book.id, status, extra);
  else Store.clearBookStatus(book.id);
  // anonymous usage for the librarian's numbers (see js/cloud.js)
  const kind = status === "read" && extra && extra.liked === false ? "disliked"
    : status || (before && before.status === "rejected" ? "restored" : null);
  if (kind) Cloud.track(kind, book.id);
  setTimeout(Ranks.celebrateIfUp, 700);
  return () => Store.restoreBook(book.id, before);
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
        const undo = applyChoice(book, result.status, result.extra);
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

const MY_RECENT = 5; // how many books each pile on "הספרים שלי" shows

function myEntries() {
  return Object.entries(Store.state.books)
    .map(([id, info]) => ({ book: bookById(id), ...info }))
    .filter((e) => e.book)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function deskHtml(books, status) {
  return `<div class="desk small" data-status="${status}"><div class="desk-books">${Shelf.stackHtml(books)}</div><div class="desk-top"></div></div>`;
}

function showMyBooks() {
  setTab("mybooks");
  const entries = myEntries();
  const of = (status) => entries.filter((e) => e.status === status);

  // "Taken" books are few, so all of them show; the other piles show the latest few
  // and the rest wait in "הספרייה שלי".
  const stackBlock = (status, title, empty, more) => {
    const list = of(status);
    const shown = status === "taken" ? list : list.slice(0, MY_RECENT);
    return `
      <section class="my-stack ${status === "rejected" ? "returned-stack" : ""}">
        <h3>${title} <span class="count typed">${list.length}</span></h3>
        ${list.length ? deskHtml(shown.map((e) => e.book), status) : `<p class="empty-note">${empty}</p>`}
        ${list.length > shown.length ? `<button class="more-books" data-all="${status}">${more(list.length)} ←</button>` : ""}
      </section>`;
  };

  render(`
    <header class="page-head"><h2 class="page-title">הספרים שלי</h2></header>
    ${stackBlock("taken", "לקחתי",
      `עוד לא לקחת ספרים. ${g("כשתלחצי", "כשתלחץ", "כשתלחצו")} "לקחתי", הספר יחכה כאן.`)}
    ${stackBlock("read", "קראתי לאחרונה", "כאן יחכו ספרים שכבר קראת.",
      (n) => `לכל ${n} הספרים בספרייה שלי`)}
    ${stackBlock("rejected", "החזרתי לערימה",
      `כאן יחכו ספרים ${g("שהחזרת", "שהחזרת", "שהחזרתם")} לערימה. אם ${g("תתחרטי", "תתחרט", "תתחרטו")}, אפשר להחזיר אותם להמלצות.`,
      (n) => `לכל ${n} הספרים ${g("שהחזרת", "שהחזרת", "שהחזרתם")}`)}
  `, "mybooks");

  view.querySelectorAll(".desk-books").forEach((area) =>
    wireBooks(area, (book, spine) => openMyBook(book, spine, showMyBooks)));
  view.querySelectorAll("[data-all]").forEach((btn) =>
    btn.addEventListener("click", () => showMyLibrary(btn.dataset.all)));
}

// ---------- הספרייה שלי: every book read (or returned), shelf after shelf ----------

const SHELF_SIZE = 6;
let librarySort = "date";
let libraryQuery = "";

function showMyLibrary(status = "read") {
  setTab("mybooks");
  const all = myEntries().filter((e) => e.status === status);
  const sorts = status === "read"
    ? [["date", "אחרונים"], ["rating", "לפי דירוג"], ["title", "לפי שם"]]
    : [["date", "אחרונים"], ["title", "לפי שם"]];
  if (!sorts.some(([id]) => id === librarySort)) librarySort = "date";

  render(`
    <header class="page-head">
      <button class="back">→ חזרה לספרים שלי</button>
    </header>
    <h2 class="page-title">${status === "read" ? "הספרייה שלי" : "החזרתי לערימה"}</h2>
    <p class="hint">${status === "read"
      ? `כל ${all.length} הספרים ${g("שקראת", "שקראת", "שקראתם")}.`
      : `כל ${all.length} הספרים ${g("שהחזרת", "שהחזרת", "שהחזרתם")} לערימה.`}</p>
    <div class="lib-tools">
      ${all.length > 8 ? `<input class="lib-search" type="search" placeholder="חיפוש לפי שם הספר או הסופר" value="${esc(libraryQuery)}">` : ""}
      <div class="lib-sorts">${sorts.map(([id, label]) =>
        `<button class="lib-sort ${id === librarySort ? "on" : ""}" data-sort="${id}">${label}</button>`).join("")}</div>
    </div>
    <div class="my-library ${status === "rejected" ? "returned-stack" : ""}"></div>
  `, "mylibrary");

  const shelves = view.querySelector(".my-library");
  const draw = () => {
    const q = libraryQuery.trim();
    let list = all.filter((e) => !q || e.book.title.includes(q) || e.book.author.includes(q));
    if (librarySort === "rating") list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (librarySort === "title") list = [...list].sort((a, b) => a.book.title.localeCompare(b.book.title, "he"));
    const rows = [];
    for (let i = 0; i < list.length; i += SHELF_SIZE) rows.push(list.slice(i, i + SHELF_SIZE));
    shelves.innerHTML = rows.length
      ? rows.map((row) => deskHtml(row.map((e) => e.book), status)).join("")
      : `<p class="empty-note">${q ? "לא מצאתי ספר כזה." : "עוד אין כאן ספרים."}</p>`;
    fitTitles(shelves);
  };
  draw();
  wireBooks(shelves, (book, spine) => openMyBook(book, spine, () => {
    const y = window.scrollY;
    showMyLibrary(status);
    window.scrollTo(0, y);
  }));

  view.querySelector(".back").addEventListener("click", () => { libraryQuery = ""; showMyBooks(); });
  view.querySelector(".lib-search")?.addEventListener("input", (e) => { libraryQuery = e.target.value; draw(); });
  view.querySelectorAll("[data-sort]").forEach((btn) => btn.addEventListener("click", () => {
    librarySort = btn.dataset.sort;
    view.querySelectorAll("[data-sort]").forEach((b) => b.classList.toggle("on", b === btn));
    draw();
  }));
}

function openMyBook(book, spine, refresh = showMyBooks) {
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
          onSaved: () => { refresh(); Toast.show("הדירוג נשמר, וההמלצות ילמדו ממנו."); },
          onSnoozed: () => Toast.show(`בסדר, ${g("אזכיר לך", "אזכיר לך", "אזכיר לכם")} בעוד שבוע.`),
        });
        return;
      }
      const undo =
        id === "finished" ? applyChoice(book, "read", {}) :
        id === "disliked" ? applyChoice(book, "read", { liked: false }) :
        id === "restore" ? applyChoice(book, null, null) :
        applyChoice(book, null, null);
      refresh();
      Toast.show(
        id === "remove" ? "הוצאתי מהרשימה." :
        id === "restore" ? "הספר חזר להמלצות." : "הספר עבר לערימת \"קראתי\".",
        () => { undo(); refresh(); });
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
if (Cloud.enabled) {
  Cloud.trackOpen();
  Cloud.flush();
  Promise.all([Cloud.fetchPicks(), Cloud.fetchTopRated()]).then(refreshLibrarian);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
