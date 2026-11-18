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
        <p><b>קצת על פרטיות.</b> כדי שהספרנית תדע אילו ספרים אוהבים, האפליקציה שולחת מידע אנונימי:
          מספר אקראי בלי שם, ואילו ספרים נלקחו ודורגו. שום דבר אחר. אפשר לכבות את זה בהגדרות.</p>
        <div class="slip-actions"><button class="stamp stamp-blue privacy-ok">הבנתי</button></div>
      </aside>` : ""}
    <button class="scan-btn">
      <span class="scan-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg></span>
      <span><b>${g("ראית", "ראית", "ראיתם")} ספר בספרייה?</b><br>${g("צלמי", "צלם", "צלמו")} את הכריכה, ואגיד לך אם ${g("תתחברי", "תתחבר", "תתחברו")} אליו</span>
    </button>
    <div class="lib-slot">${librarianHtml()}</div>
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
  wireLibrarian();
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

// ---------- הספרנית ממליצה: the display stand on the home screen ----------

function librarianHtml() {
  const lib = Store.state.librarian;
  const picks = (lib && lib.picks || [])
    .map((p) => ({ ...p, book: bookById(p.book_id) }))
    .filter((p) => p.book);
  if (!picks.length) return "";
  const when = new Date(lib.week + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long" });
  return `
    <section class="lib-stand" aria-label="הספרנית ממליצה">
      <div class="lib-wall" aria-hidden="true"></div>
      <div class="lib-sign hand">הספרנית ממליצה</div>
      <p class="lib-week typed">השבוע של ${when}</p>
      <div class="lib-row">
        ${picks.map((p) => {
          const st = Store.state.books[p.book.id];
          const mark = st ? { taken: "נלקח", read: "נקרא", rejected: "הוחזר" }[st.status] : "";
          return `
          <button class="lib-item" data-id="${esc(p.book.id)}" aria-label="${esc(p.book.title)}">
            <span class="lib-cover">${p.book.cover
              ? `<img src="${coverUrl(p.book, "M")}" alt="" loading="lazy">`
              : `<span class="lib-drawn" style="--c:${CLOTH[hashOf(p.book.id, CLOTH.length)]}">${esc(p.book.title)}</span>`}
              ${mark ? `<span class="lib-mark">${mark}</span>` : ""}</span>
            <span class="lib-card">
              <span class="fit" data-max="16" data-min="10"><span class="lib-title">${esc(p.book.title)}</span></span>
              <span class="lib-author">${esc(p.book.author)}</span>
              ${p.note ? `<span class="lib-note hand">${esc(p.note)}</span>` : ""}
            </span>
          </button>`;
        }).join("")}
      </div>
    </section>`;
}

function wireLibrarian() {
  view.querySelectorAll(".lib-item").forEach((btn) => btn.addEventListener("click", () => {
    const book = bookById(btn.dataset.id);
    const pick = (Store.state.librarian.picks || []).find((p) => p.book_id === book.id) || {};
    Shelf.open(book, {
      actions: Store.state.books[book.id] ? [{ id: "close", label: "סגירה", kind: "link" }] : PICK_ACTIONS,
      note: pick.note ? `<span class="hand lib-quote">"${esc(pick.note)}" · הספרנית</span>` : "",
      onAction: (actionId) => {
        if (actionId === "close") return;
        const result = PICK_RESULT[actionId];
        const undo = applyChoice(book, result.status, result.extra);
        showHome();
        Toast.show(result.toast(), () => { undo(); showHome(); });
      },
    });
  }));
}

// After fresh picks arrive, redraw the stand if the home screen is showing.
function refreshLibrarian() {
  const slot = view.dataset.screen === "home" && view.querySelector(".lib-slot");
  if (!slot) return;
  slot.innerHTML = librarianHtml();
  fitTitles(slot);
  wireLibrarian();
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
        id === "finished" ? applyChoice(book, "read", {}) :
        id === "disliked" ? applyChoice(book, "read", { liked: false }) :
        id === "restore" ? applyChoice(book, null, null) :
        applyChoice(book, null, null);
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
if (Cloud.enabled) {
  Cloud.trackOpen();
  Cloud.flush();
  Cloud.fetchPicks().then(refreshLibrarian);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
