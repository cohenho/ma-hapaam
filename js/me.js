// "הטעם שלי" (your reader card: what the app learned about you) and "הגדרות".

// How a profile feature is shown to people.
const FEATURE_NAMES = {
  "style:fast": "קצב מהיר", "style:slow": "קצב איטי", "style:twists": "טוויסטים",
  "style:dark": "אווירה אפלה", "style:funny": "הומור", "style:warm": "מחמם לב",
  "style:emotional": "מרגש", "style:character": "דמויות חזקות", "style:smart": "מעמיק",
  "style:historical": "היסטורי", "style:short": "ספרים קצרים", "style:scary": "מפחיד",
  "style:romantic": "רומנטי", "style:mystery": "תעלומות",
  "tag:רומן": null, "tag:קצר": "ספרים קצרים", "tag:מתח": "מותחנים", "tag:מותחן": "מותחנים",
  "tag:בלשי": "תעלומות", "tag:תעלומה": "תעלומות", "tag:רומנטי": "רומנטי", "tag:אימה": "מפחיד",
  "tag:הומור": "הומור", "tag:מרגש": "מרגש", "tag:רומן היסטורי": "היסטורי", "tag:היסטורי": "היסטורי",
  "tag:רוחות": "על-טבעי", "tag:ערפדים": "על-טבעי", "tag:על-טבעי": "על-טבעי",
  "cat:thriller": "מותחנים", "cat:horror": "מפחיד", "cat:romance": "רומנטי", "cat:light": "קליל",
  "cat:trendy": "רבי מכר", "cat:classic": "קלאסיקות", "tag:קלאסיקה": "קלאסיקות",
};

function featureName(f) {
  if (f in FEATURE_NAMES) return FEATURE_NAMES[f];
  if (f.startsWith("tag:")) return f.slice(4);
  if (f.startsWith("cat:")) {
    const c = window.CATEGORIES.find((x) => x.id === f.slice(4));
    return c ? c.name : null;
  }
  return null; // authors are shown separately
}

// Group the profile weights into readable likes / dislikes / authors.
function tasteSummary() {
  const w = Taste.weights(Store.state.profile);
  const byName = {};
  const authors = [];
  for (const [f, v] of Object.entries(w)) {
    if (f.startsWith("author:")) { authors.push([f.slice(7), v]); continue; }
    const name = featureName(f);
    if (!name) continue;
    byName[name] = (byName[name] || 0) + v;
  }
  const rows = Object.entries(byName);
  return {
    likes: rows.filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n),
    dislikes: rows.filter(([, v]) => v <= -1).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([n]) => n),
    authorsLiked: authors.filter(([, v]) => v >= 1.5).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n),
    authorsNot: authors.filter(([, v]) => v <= -1.5).map(([n]) => n),
  };
}

// ---------- reading ranks: they go up as you finish books ----------

const Ranks = (() => {
  const LEVELS = [
    { from: 0,  name: () => g("מנויה חדשה", "מנוי חדש", "מנויים חדשים") },
    { from: 1,  name: () => g("קוראת מזדמנת", "קורא מזדמן", "קוראים מזדמנים") },
    { from: 3,  name: () => g("תולעת ספרים", "תולעת ספרים", "תולעי ספרים") },
    { from: 6,  name: () => g("חברת מועדון הקריאה", "חבר מועדון הקריאה", "חברי מועדון הקריאה") },
    { from: 11, name: () => g("ספרנית של כבוד", "ספרן של כבוד", "ספרנים של כבוד") },
    { from: 21, name: () => g("שומרת הקטלוג", "שומר הקטלוג", "שומרי הקטלוג") },
    { from: 36, name: () => "אגדה של הספרייה" },
  ];

  // Books you finished through the app (not the ones you told about in the introduction).
  const finished = () => Object.values(Store.state.books).filter((r) => r.status === "read" && r.from !== "intro").length;

  function current() {
    const n = finished();
    let i = 0;
    LEVELS.forEach((l, k) => { if (n >= l.from) i = k; });
    const next = LEVELS[i + 1];
    return { n, index: i, name: LEVELS[i].name(), next: next && { name: next.name(), left: next.from - n } };
  }

  function celebrateIfUp() {
    const { index, name } = current();
    const seen = Store.state.rankSeen ?? index;
    if (index > seen) {
      Toast.show(`עלית דרגה! מעכשיו ${g("את", "אתה", "אתם")}: ${name} 🎉`);
    }
    if (Store.state.rankSeen !== index) { Store.state.rankSeen = index; Store.save(); }
  }

  return { LEVELS, current, celebrateIfUp };
})();

// ---------- הטעם שלי ----------

function showTaste() {
  setTab("taste");
  const st = Store.state;
  const books = Object.values(st.books);
  const rated = books.filter((b) => b.rating);
  const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : null;
  const sum = tasteSummary();
  const empty = !sum.likes.length && !sum.authorsLiked.length;
  const rank = Ranks.current();
  const chipRow = (items, cls) => `<div class="chips">${items.map((x) => `<span class="chip ${cls}">${esc(x)}</span>`).join("")}</div>`;

  render(`
    <header class="page-head"><h2 class="page-title">הטעם שלי</h2></header>
    <section class="reader-card">
      <div class="card-top typed"><span>כרטיס קורא/ת</span><span>By the Book</span></div>
      <dl class="reader-fields">
        <dt>דרגה:</dt><dd class="typed">${esc(rank.name)}</dd>
        <dt>${g("חברה", "חבר", "חברים")} מאז:</dt><dd class="typed">${new Date(st.createdAt).toLocaleDateString("he-IL")}</dd>
        <dt>לקחת:</dt><dd class="typed">${books.filter((b) => b.status === "taken" || b.takenAt).length} ספרים</dd>
        <dt>קראת:</dt><dd class="typed">${books.filter((b) => b.status === "read").length} ספרים${avg ? ` · ממוצע ★${avg}` : ""}</dd>
      </dl>
      <div class="rank-box">
        <p class="rank-next">${rank.next
          ? `עוד ${rank.next.left === 1 ? "ספר אחד" : rank.next.left + " ספרים"} ${g("שתסיימי", "שתסיים", "שתסיימו")}, ו${g("תהיי", "תהיה", "תהיו")}: <b>${esc(rank.next.name)}</b>`
          : `הגעת לדרגה הכי גבוהה. כל הכבוד!`}</p>
        <details class="rank-ladder">
          <summary>כל הדרגות</summary>
          <ol>${Ranks.LEVELS.map((l, i) => `
            <li class="${i === rank.index ? "here" : i < rank.index ? "done" : ""}">
              <span>${esc(l.name())}</span><span class="typed">${l.from === 0 ? "מההתחלה" : `${l.from} ספרים`}</span>
            </li>`).join("")}</ol>
          <p class="set-note">ספר נחשב כשמסמנים אותו כ"קראתי" או מדרגים אותו.</p>
        </details>
      </div>

      ${empty ? `
        <p class="reader-empty">עוד לא ${g("סיפרת", "סיפרת", "סיפרתם")} לי מה ${g("את אוהבת", "אתה אוהב", "אתם אוהבים")}, אז בינתיים אני מציעה בעיקר ספרים מוכרים ואהובים מאוד.</p>
      ` : `
        ${sum.likes.length ? `<p class="chip-title">${g("את אוהבת", "אתה אוהב", "אתם אוהבים")}</p>${chipRow(sum.likes, "chip-like")}` : ""}
        ${sum.authorsLiked.length ? `<p class="chip-title">סופרים ${g("שאת אוהבת", "שאתה אוהב", "שאתם אוהבים")}</p>${chipRow(sum.authorsLiked, "chip-author")}` : ""}
      `}

      ${st.profile.text ? `
        <p class="chip-title">מה ${g("שסיפרת", "שסיפרת", "שסיפרתם")} לי${st.profile.updatedAt ? ` · ${new Date(st.profile.updatedAt).toLocaleDateString("he-IL")}` : ""}</p>
        <blockquote class="reader-quote">"${esc(st.profile.text)}"</blockquote>` : ""}
      <p class="reader-learn">כל דירוג, "לקחתי" ו"תחזיר לערימה" מלמדים אותי עוד קצת.</p>
    </section>
    <button class="stamp stamp-red tell-again" style="width:100%;margin-top:18px">${empty ? "לספר לי מה " + g("את אוהבת", "אתה אוהב", "אתם אוהבים") : "לספר לי שוב"}</button>
    ${Object.keys(Taste.learned(st.books, st.profile.forgetBefore)).length ? `<button class="card-link forget" style="display:block;margin:12px auto 0">לשכוח את מה שלמדתי מהדירוגים</button>` : ""}
  `, "taste");

  view.querySelector(".tell-again").addEventListener("click", () =>
    Onboarding.taste({ then: showTaste, text: st.profile.text || "" }));
  view.querySelector(".forget")?.addEventListener("click", () => {
    if (!confirm("לשכוח את כל מה שלמדתי מהדירוגים ומהבחירות? מה שסיפרת לי בטקסט יישאר.")) return;
    st.profile.forgetBefore = new Date().toISOString();
    Store.save();
    showTaste();
    Toast.show("שכחתי. מתחילים ללמוד מחדש.");
  });
}

// ---------- הגדרות ----------
// How the app addresses you and your age are set once, in the introduction.

const APP_VERSION = "11";
let versionTaps = 0;

function showSettings() {
  setTab("settings");
  const st = Store.state;
  const s = st.settings;
  const last = st.lastBackup ? new Date(st.lastBackup).toLocaleDateString("he-IL") : null;

  render(`
    <header class="page-head"><h2 class="page-title">הגדרות</h2></header>

    <section class="set-card">
      <h3>מגירות בקטלוג</h3>
      <p class="set-note">${g("בחרי", "בחר", "בחרו")} אילו מגירות יופיעו במסך הבית.</p>
      <div class="cat-toggles">
        ${allowedCategories().map((c) => `
          <label class="cat-toggle">
            <input type="checkbox" data-cat="${esc(c.id)}" ${(s.hiddenCats || []).includes(c.id) ? "" : "checked"}>
            <span class="box" aria-hidden="true"></span>
            <span>${esc(c.name)}</span>
          </label>`).join("")}
      </div>
    </section>

    <section class="set-card">
      <h3>גיבוי ושחזור</h3>
      <p class="set-note">כל המידע שלך שמור רק בטלפון הזה. גיבוי שומר הכול בקובץ אחד:
        הספרים, הדירוגים, הטעם וההגדרות. באייפון ${g("בחרי", "בחר", "בחרו")} <b>"שמירה בקבצים"</b>, ואפשר לשמור ב-iCloud Drive.</p>
      <p class="set-note typed">${last ? `גיבוי אחרון: ${last}` : "עוד לא היה גיבוי"}</p>
      <button class="stamp stamp-blue do-backup" style="width:100%;margin-top:12px">ייצוא גיבוי</button>
      <button class="card-link do-restore" style="display:block;margin:10px auto 0">שחזור מגיבוי</button>
    </section>

    ${Cloud.enabled ? `
    <section class="set-card">
      <h3>פרטיות</h3>
      <label class="cat-toggle">
        <input type="checkbox" class="share-toggle" ${s.share === false ? "" : "checked"}>
        <span class="box" aria-hidden="true"></span>
        <span>לשתף מידע עם הספרנית</span>
      </label>
      <p class="set-note">נשלחים רק אילו ספרים נלקחו, נקראו ודורגו, ${s.name ? "יחד עם השם שלמטה" : "עם מספר אקראי בלי שם"}. ככה הספרנית יודעת מה אהוב.</p>
      <label class="field set-name"><span>השם שלך (לא חובה)</span>
        <input class="name-input" maxlength="40" value="${esc(s.name || "")}" placeholder="שם פרטי או כינוי" autocomplete="name"></label>
      <p class="set-note">${g("מחקי", "מחק", "מחקו")} את השם כדי להישאר ${g("אנונימית", "אנונימי", "אנונימיים")}.</p>
    </section>` : ""}

    <p class="version typed">By the Book · גרסה ${APP_VERSION}</p>
    <section class="set-card test-tools" ${st.testMode ? "" : "hidden"}>
      <h3>מצב בדיקה</h3>
      <p class="set-note">כלים לבדוק דברים שבדרך כלל לוקחים זמן.</p>
      <button class="stamp stamp-blue test-remind" style="width:100%">להציג עכשיו "סיימת את…? איך היה?"</button>
      <button class="stamp stamp-blue test-backup" style="width:100%;margin-top:12px">להציג עכשיו את תזכורת הגיבוי</button>
      <button class="card-link test-off" style="display:block;margin:10px auto 0">לסגור את מצב הבדיקה</button>
    </section>
  `, "settings");

  view.querySelectorAll("[data-cat]").forEach((box) => box.addEventListener("change", () => {
    const hidden = new Set(s.hiddenCats || []);
    box.checked ? hidden.delete(box.dataset.cat) : hidden.add(box.dataset.cat);
    if (allowedCategories().every((c) => hidden.has(c.id))) {
      box.checked = true; hidden.delete(box.dataset.cat);
      Toast.show("צריך להשאיר לפחות מגירה אחת.");
    }
    s.hiddenCats = [...hidden]; Store.save();
  }));

  view.querySelector(".share-toggle")?.addEventListener("change", (e) => {
    Cloud.setSharing(e.target.checked);
    if (e.target.checked) { Store.state.privacySeen = true; Store.save(); }
    Toast.show(e.target.checked ? "תודה! המידע האנונימי יעזור לספרנית." : "בסדר, לא יישלח יותר מידע.");
  });
  view.querySelector(".name-input")?.addEventListener("change", (e) => {
    s.name = e.target.value.trim(); st.namePrompted = true; Store.save();
    Toast.show(s.name ? `השם נשמר: ${s.name}` : "השם נמחק. מעכשיו הכול אנונימי.");
    showSettings();
  });
  view.querySelector(".do-backup").addEventListener("click", async () => {
    if (await Backup.exportNow()) { showSettings(); Toast.show("הגיבוי מוכן. כדאי לשמור אותו במקום בטוח."); }
  });
  view.querySelector(".do-restore").addEventListener("click", () => Backup.pickAndRestore());

  // Tap the version five times to open the testing tools.
  view.querySelector(".version").addEventListener("click", () => {
    if (++versionTaps < 5) return;
    versionTaps = 0;
    st.testMode = true; Store.save();
    view.querySelector(".test-tools").hidden = false;
    Toast.show("מצב בדיקה נפתח.");
  });
  view.querySelector(".test-remind").addEventListener("click", () => {
    if (!Rating.maybeRemind(true)) Toast.show(`קודם צריך ללחוץ "לקחתי" על ספר שעוד לא דורג.`);
  });
  view.querySelector(".test-backup").addEventListener("click", () => {
    st.forceBackupNag = true; Store.save();
    showHome();
  });
  view.querySelector(".test-off").addEventListener("click", () => {
    st.testMode = false; Store.save(); showSettings();
  });
}
