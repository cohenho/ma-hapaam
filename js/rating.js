// Rating a book you took (1–5 stars, quick tags, a few words — typed or spoken),
// and the weekly "סיימת את…? איך היה?" reminder.

const Rating = (() => {
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  // Quick tags and what they teach the profile.
  const QUICK = [
    { label: "דמויות מעולות", nudge: [["style:character", 1]] },
    { label: "סוף מפתיע",     nudge: [["style:twists", 1]] },
    { label: "קצב סוחף",      nudge: [["style:fast", 1]] },
    { label: "כתיבה יפה",     nudge: [["style:smart", 0.6]] },
    { label: "מצחיק",         nudge: [["style:funny", 1]] },
    { label: "מרגש",          nudge: [["style:emotional", 1]] },
    { label: "קצב איטי",      nudge: [["style:slow", -1], ["style:fast", 0.4]] },
    { label: "משעמם",         nudge: "book" },                 // less of books like this
    { label: "צפוי מראש",     nudge: [["style:twists", 0.6]] }, // wants more surprises
    { label: "ארוך מדי",      nudge: [["style:short", 0.6]] },
    { label: "סוף מאכזב",     nudge: [] },
    { label: "קשה מדי",       nudge: [["cat:light", 0.5], ["style:dark", -0.5]] },
  ];

  const STAR_WORDS = ["", "לא בשבילי", "ככה ככה", "היה נחמד", "ממש טוב", "מושלם!"];

  // ---------- the rating card ----------

  function open(book, { onSaved = () => {}, onSnoozed = () => {} } = {}) {
    const rec = Store.state.books[book.id] || {};
    let stars = rec.rating || 0;
    const chosen = new Set(rec.quick || []);
    const canSnooze = rec.status === "taken";

    const box = document.createElement("div");
    box.className = "install rating";
    box.innerHTML = `
      <div class="install-card return-card" role="dialog" aria-modal="true" aria-labelledby="rate-title">
        <button class="sheet-close" aria-label="סגירה">✕</button>
        <div class="card-top typed"><span>כרטיס החזרה</span><span>${new Date().toLocaleDateString("he-IL")}</span></div>
        <h2 id="rate-title">${esc(book.title)}</h2>
        <p class="card-author typed">${esc(book.author)}</p>
        <p class="rate-q">${g("איך היה?", "איך היה?", "איך היה?")}</p>
        <div class="stars" role="radiogroup" aria-label="דירוג">
          ${[1, 2, 3, 4, 5].map((n) => `<button class="star" data-n="${n}" role="radio" aria-label="${n} כוכבים">★</button>`).join("")}
        </div>
        <p class="star-word typed"></p>
        <p class="chip-title">מה ${g("הרגשת", "הרגשת", "הרגשתם")}? (לא חובה)</p>
        <div class="chips quick">
          ${QUICK.map((q) => `<button class="chip chip-add" data-q="${esc(q.label)}">${esc(q.label)}</button>`).join("")}
        </div>
        <p class="chip-title">${g("רוצה", "רוצה", "רוצים")} להוסיף עוד כמה מילים?</p>
        ${Voice.supported ? Voice.html() : ""}
        <label class="note-card">
          <textarea rows="3" placeholder="למשל: הדמויות היו מעולות אבל ההתחלה הייתה איטית">${esc(rec.comment || "")}</textarea>
        </label>
        <button class="stamp stamp-red rate-save" style="width:100%">שמירה</button>
        ${canSnooze ? `<button class="card-link rate-snooze">עוד לא ${g("סיימתי", "סיימתי", "סיימנו")}, ${g("תזכירי", "תזכירי", "תזכירי")} לי בעוד שבוע</button>` : ""}
      </div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add("show"));

    const close = () => {
      recorder?.stop();
      box.classList.remove("show");
      setTimeout(() => box.remove(), 300);
    };

    const paintStars = () => {
      box.querySelectorAll(".star").forEach((s) => {
        s.classList.toggle("on", +s.dataset.n <= stars);
        s.setAttribute("aria-checked", +s.dataset.n === stars);
      });
      box.querySelector(".star-word").textContent = STAR_WORDS[stars];
    };
    paintStars();
    box.querySelectorAll(".star").forEach((s) => s.addEventListener("click", () => {
      stars = +s.dataset.n;
      paintStars();
    }));

    box.querySelectorAll("[data-q]").forEach((c) => {
      c.classList.toggle("on", chosen.has(c.dataset.q));
      c.addEventListener("click", () => {
        chosen.has(c.dataset.q) ? chosen.delete(c.dataset.q) : chosen.add(c.dataset.q);
        c.classList.toggle("on");
      });
    });

    const textarea = box.querySelector("textarea");
    const recorder = Voice.supported ? Voice.attach(box.querySelector(".recorder"), textarea) : null;

    box.querySelector(".sheet-close").addEventListener("click", close);
    box.querySelector(".rate-save").addEventListener("click", () => {
      if (!stars) {
        const row = box.querySelector(".stars");
        row.classList.add("nudge");
        setTimeout(() => row.classList.remove("nudge"), 500);
        return;
      }
      save(book, { stars, quick: [...chosen], comment: textarea.value.trim() });
      close();
      onSaved();
    });
    box.querySelector(".rate-snooze")?.addEventListener("click", () => {
      snooze(book);
      close();
      onSnoozed();
    });
  }

  function save(book, { stars, quick, comment }) {
    const before = Store.state.books[book.id] || {};
    const profile = Store.state.profile;
    // Ratings teach more than anything else; re-rating replaces the old lesson.
    if (before.rating) Taste.learn(profile, book, -(before.rating - 3) * 0.8);
    Taste.learn(profile, book, (stars - 3) * 0.8);

    const newQuick = quick.filter((q) => !(before.quick || []).includes(q));
    newQuick.forEach((label) => {
      const q = QUICK.find((x) => x.label === label);
      if (!q) return;
      if (q.nudge === "book") Taste.learn(profile, book, -0.6);
      else q.nudge.forEach(([f, v]) => Taste.nudge(profile, [f], v * 0.8));
    });

    if (comment && comment !== before.comment) {
      const said = Taste.read(comment);
      // in a review, "איטי" is a complaint, not a wish
      const COMPLAINTS = ["קצב איטי"];
      said.likes.forEach((l) => Taste.nudge(profile, Taste.featuresOfLabel(l), COMPLAINTS.includes(l) ? -0.6 : 0.6));
      said.dislikes.forEach((l) => Taste.nudge(profile, Taste.featuresOfLabel(l), -0.6));
    }

    Store.state.books[book.id] = {
      ...before,
      status: "read",
      takenAt: before.takenAt || (before.status === "taken" ? before.date : undefined),
      date: new Date().toISOString(),
      rating: stars,
      liked: stars >= 4 ? true : stars <= 2 ? false : null,
      quick,
      comment,
    };
    delete Store.state.books[book.id].remindAfter;
    Store.save();
  }

  function snooze(book) {
    const rec = Store.state.books[book.id];
    if (!rec) return;
    rec.remindAfter = new Date(Date.now() + WEEK).toISOString();
    Store.save();
  }

  // ---------- the weekly reminder ----------

  // The oldest taken book that has waited a week (or past its snooze).
  function due() {
    const now = Date.now();
    return Object.entries(Store.state.books)
      .filter(([, r]) => r.status === "taken" && !r.rating)
      .filter(([, r]) => now >= (r.remindAfter ? Date.parse(r.remindAfter) : Date.parse(r.date) + WEEK))
      .sort((a, b) => a[1].date.localeCompare(b[1].date))
      .map(([id]) => window.BOOKS.find((b) => b.id === id))
      .find(Boolean);
  }

  function maybeRemind() {
    const book = due();
    if (!book || document.querySelector(".install")) return;
    const box = document.createElement("div");
    box.className = "install reminder";
    box.innerHTML = `
      <div class="install-card reminder-card" role="dialog" aria-modal="true" aria-labelledby="rem-title">
        <div class="pin" aria-hidden="true"></div>
        <p class="typed reminder-date">נלקח ב-${new Date(Store.state.books[book.id].takenAt || Store.state.books[book.id].date).toLocaleDateString("he-IL")}</p>
        <h2 id="rem-title">${g("סיימת", "סיימת", "סיימתם")} את "${esc(book.title)}"?<br>איך היה?</h2>
        <div class="card-stamps">
          <button class="stamp stamp-red rem-rate">כן, ${g("בואי", "בוא", "בואו")} נדרג</button>
        </div>
        <button class="card-link rem-snooze">עוד לא ${g("סיימתי", "סיימתי", "סיימנו")}</button>
      </div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add("show"));
    const close = () => { box.classList.remove("show"); setTimeout(() => box.remove(), 300); };
    box.querySelector(".rem-rate").addEventListener("click", () => {
      close();
      open(book, { onSaved: refresh, onSnoozed: refresh });
    });
    box.querySelector(".rem-snooze").addEventListener("click", () => {
      snooze(book);
      close();
      Toast.show(`בסדר, ${g("אזכיר לך", "אזכיר לך", "אזכיר לכם")} בעוד שבוע.`);
    });
  }

  // after rating from the reminder, show the result if "הספרים שלי" is open
  function refresh() {
    Toast.show("תודה! הדירוג נשמר, וההמלצות ילמדו ממנו.");
    if (document.getElementById("view").dataset.screen === "mybooks") showMyBooks();
  }

  const starsText = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  return { open, maybeRemind, due, snooze, starsText };
})();
