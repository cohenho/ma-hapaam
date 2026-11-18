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

// ---------- הטעם שלי ----------

function showTaste() {
  setTab("taste");
  const st = Store.state;
  const books = Object.values(st.books);
  const rated = books.filter((b) => b.rating);
  const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : null;
  const sum = tasteSummary();
  const empty = !sum.likes.length && !sum.dislikes.length && !sum.authorsLiked.length;
  const title = { f: "אשת חיל", m: "גבר על", x: "חתול סיני" }[st.settings.gender];
  const chipRow = (items, cls) => `<div class="chips">${items.map((x) => `<span class="chip ${cls}">${esc(x)}</span>`).join("")}</div>`;

  render(`
    <header class="page-head"><h2 class="page-title">הטעם שלי</h2></header>
    <section class="reader-card">
      <div class="card-top typed"><span>כרטיס קורא/ת</span><span>By the Book</span></div>
      <dl class="reader-fields">
        <dt>דרגה:</dt><dd class="typed">${title}</dd>
        <dt>${g("חברה", "חבר", "חברים")} מאז:</dt><dd class="typed">${new Date(st.createdAt).toLocaleDateString("he-IL")}</dd>
        <dt>לקחת:</dt><dd class="typed">${books.filter((b) => b.status === "taken" || b.takenAt).length} ספרים</dd>
        <dt>קראת:</dt><dd class="typed">${books.filter((b) => b.status === "read").length} ספרים${avg ? ` · ממוצע ★${avg}` : ""}</dd>
      </dl>

      ${empty ? `
        <p class="reader-empty">עוד לא ${g("סיפרת", "סיפרת", "סיפרתם")} לי מה ${g("את אוהבת", "אתה אוהב", "אתם אוהבים")}, אז בינתיים אני מציעה בעיקר ספרים מוכרים ואהובים מאוד.</p>
      ` : `
        ${sum.likes.length ? `<p class="chip-title">${g("את אוהבת", "אתה אוהב", "אתם אוהבים")}</p>${chipRow(sum.likes, "chip-like")}` : ""}
        ${sum.authorsLiked.length ? `<p class="chip-title">סופרים ${g("שאת אוהבת", "שאתה אוהב", "שאתם אוהבים")}</p>${chipRow(sum.authorsLiked, "chip-author")}` : ""}
        ${sum.dislikes.length ? `<p class="chip-title">פחות</p>${chipRow(sum.dislikes, "chip-dislike")}` : ""}
        ${sum.authorsNot.length ? `<p class="chip-title">סופרים שפחות</p>${chipRow(sum.authorsNot, "chip-dislike")}` : ""}
      `}

      ${st.profile.text ? `
        <p class="chip-title">מה ${g("שסיפרת", "שסיפרת", "שסיפרתם")} לי${st.profile.updatedAt ? ` · ${new Date(st.profile.updatedAt).toLocaleDateString("he-IL")}` : ""}</p>
        <blockquote class="reader-quote">"${esc(st.profile.text)}"</blockquote>` : ""}
      <p class="reader-learn">כל דירוג, "לקחתי" ו"תחזיר לערימה" מלמדים אותי עוד קצת.</p>
    </section>
    <button class="stamp stamp-red tell-again" style="width:100%;margin-top:18px">${empty ? "לספר לי מה " + g("את אוהבת", "אתה אוהב", "אתם אוהבים") : "לספר לי שוב"}</button>
    ${Object.keys(st.profile.learned || {}).length ? `<button class="card-link forget" style="display:block;margin:12px auto 0">לשכוח את מה שלמדתי מהדירוגים</button>` : ""}
  `, "taste");

  view.querySelector(".tell-again").addEventListener("click", () =>
    Onboarding.taste({ then: showTaste, text: st.profile.text || "" }));
  view.querySelector(".forget")?.addEventListener("click", () => {
    if (!confirm("לשכוח את כל מה שלמדתי מהדירוגים ומהבחירות? מה שסיפרת לי בטקסט יישאר.")) return;
    st.profile.learned = {};
    Store.save();
    showTaste();
    Toast.show("שכחתי. מתחילים ללמוד מחדש.");
  });
}

// ---------- הגדרות ----------

const APP_VERSION = "6";
let versionTaps = 0;

function showSettings() {
  setTab("settings");
  const s = Store.state.settings;
  const option = (name, value, label, current) =>
    `<button class="opt ${current === value ? "on" : ""}" data-${name}="${value}">${label}</button>`;

  render(`
    <header class="page-head"><h2 class="page-title">הגדרות</h2></header>

    <section class="set-card">
      <h3>איך לפנות אליך</h3>
      <div class="opts">
        ${option("gender", "m", "גבר על", s.gender)}
        ${option("gender", "f", "אשת חיל", s.gender)}
        ${option("gender", "x", "חתול סיני", s.gender)}
      </div>
    </section>

    <section class="set-card">
      <h3>גיל</h3>
      <div class="opts">
        ${option("adult", "1", "מעל 18", s.adult ? "1" : "0")}
        ${option("adult", "0", "מתחת ל-18", s.adult ? "1" : "0")}
      </div>
      <p class="set-note">מתחת ל-18 לא מוצגים המגירה "רומנטי/אירוטי" וספרים עם תוכן למבוגרים בלבד.</p>
    </section>

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
      <p class="set-note">בשלב הבא: שמירת כל המידע שלך בקובץ, כדי שלא ילך לאיבוד בהחלפת טלפון.</p>
    </section>

    <section class="set-card">
      <h3>ההיכרות</h3>
      <button class="card-link again">לעבור שוב את ההיכרות מההתחלה</button>
    </section>

    <p class="version typed">By the Book · גרסה ${APP_VERSION}</p>
    <section class="set-card test-tools" ${Store.state.testMode ? "" : "hidden"}>
      <h3>מצב בדיקה</h3>
      <p class="set-note">כלים לבדוק דברים שבדרך כלל לוקחים זמן.</p>
      <button class="stamp stamp-blue test-remind" style="width:100%">להציג עכשיו "סיימת את…? איך היה?"</button>
      <button class="card-link test-off" style="display:block;margin:10px auto 0">לסגור את מצב הבדיקה</button>
    </section>
  `, "settings");

  view.querySelectorAll("[data-gender]").forEach((b) => b.addEventListener("click", () => {
    s.gender = b.dataset.gender; Store.save(); showSettings();
    Toast.show(g("מעכשיו אפנה אלייך בלשון נקבה.", "מעכשיו אפנה אליך בלשון זכר.", "מעכשיו אפנה אליכם בלשון רבים."));
  }));
  view.querySelectorAll("[data-adult]").forEach((b) => b.addEventListener("click", () => {
    s.adult = b.dataset.adult === "1"; Store.save(); showSettings();
  }));
  view.querySelectorAll("[data-cat]").forEach((box) => box.addEventListener("change", () => {
    const hidden = new Set(s.hiddenCats || []);
    box.checked ? hidden.delete(box.dataset.cat) : hidden.add(box.dataset.cat);
    if (allowedCategories().every((c) => hidden.has(c.id))) {
      box.checked = true; hidden.delete(box.dataset.cat);
      Toast.show("צריך להשאיר לפחות מגירה אחת.");
    }
    s.hiddenCats = [...hidden]; Store.save();
  }));
  view.querySelector(".again").addEventListener("click", () => {
    if (!confirm("לעבור שוב את ההיכרות? הספרים שלך יישארו.")) return;
    Onboarding.start();
  });

  // Tap the version five times to open the testing tools.
  view.querySelector(".version").addEventListener("click", () => {
    if (++versionTaps < 5) return;
    versionTaps = 0;
    Store.state.testMode = true; Store.save();
    view.querySelector(".test-tools").hidden = false;
    Toast.show("מצב בדיקה נפתח.");
  });
  view.querySelector(".test-remind").addEventListener("click", () => {
    if (!Rating.maybeRemind(true)) Toast.show(`קודם צריך ללחוץ "לקחתי" על ספר שעוד לא דורג.`);
  });
  view.querySelector(".test-off").addEventListener("click", () => {
    Store.state.testMode = false; Store.save(); showSettings();
  });
}
