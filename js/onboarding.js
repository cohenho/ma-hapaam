// First-time introduction: how to talk to you → age → your taste → "הבנתי ש…".
// The taste part (Onboarding.taste) can also be run again later on its own.

const Onboarding = (() => {
  const view = document.getElementById("view");
  let draft = "";        // the text you wrote, kept if you go back to fix it
  let afterTaste = null; // where to go when the taste part is done

  function screen(html, step) {
    document.body.classList.add("onboarding");
    view.innerHTML = `
      ${step ? `<p class="ob-step typed">שלב ${step} מתוך 4</p>` : ""}
      ${html}`;
    view.dataset.screen = "onboarding";
    window.scrollTo(0, 0);
  }

  function finish() {
    document.body.classList.remove("onboarding");
    Store.state.onboarded = true;
    Store.save();
    showHome();
  }

  // ---------- 1. how should we talk to you ----------

  const GENDERS = [
    { id: "m", name: "גבר על",     desc: "פנו אליי בלשון זכר" },
    { id: "f", name: "אשת חיל",    desc: "פנו אליי בלשון נקבה" },
    { id: "x", name: "חתול סיני",  desc: "פנו אליי בלשון רבים, כמו לבני מלוכה" },
  ];

  function start() {
    screen(`
      <header class="ob-head">
        <div class="brand-stamp small" aria-hidden="true">By the<br>Book</div>
        <h1>נעים להכיר!</h1>
        <p class="ob-sub">רגע לפני שמתחילים: איך לפנות אליך?</p>
      </header>
      <div class="catalogue">
        ${GENDERS.map((x, i) => `
          <button class="index-card" data-gender="${x.id}" style="--tab:${[30, 150, 250][i]}px">
            <span class="ic-tab typed">${["♂", "♀", "∞"][i]}</span>
            <span class="ic-name">${x.name}</span>
            <span class="ic-desc">${x.desc}</span>
          </button>`).join("")}
      </div>
      <button class="card-link ob-restore">יש לי גיבוי מטלפון קודם, לשחזר אותו</button>`, 1);
    view.querySelector(".ob-restore").addEventListener("click", () => Backup.pickAndRestore());
    view.querySelectorAll("[data-gender]").forEach((b) => b.addEventListener("click", () => {
      Store.state.settings.gender = b.dataset.gender;
      Store.save();
      b.classList.add("pulling");
      setTimeout(age, 240);
    }));
  }

  // ---------- 2. age ----------

  function age() {
    screen(`
      <header class="ob-head">
        <h1>${g("את מעל", "אתה מעל", "אתם מעל")}<br>גיל 18?</h1>
        <p class="ob-sub">ככה אדע אם להציע גם ספרים עם תוכן למבוגרים בלבד.
          אפשר לשנות את זה בהמשך בהגדרות.</p>
      </header>
      <div class="ob-stamps">
        <button class="stamp stamp-blue" data-adult="1">כן</button>
        <button class="stamp stamp-red" data-adult="0">לא</button>
      </div>`, 2);
    view.querySelectorAll("[data-adult]").forEach((b) => b.addEventListener("click", () => {
      Store.state.settings.adult = b.dataset.adult === "1";
      Store.save();
      taste({ then: finish, step: 3 });
    }));
  }

  // ---------- 3. tell me about your taste ----------

  let thenOriginal = finish;
  function taste({ then = finish, step = null, text = null } = {}) {
    thenOriginal = then;
    afterTaste = () => { document.body.classList.remove("onboarding"); then(); };
    if (text !== null) draft = text;
    screen(`
      <header class="ob-head">
        <h1>מה הפעם?</h1>
        <p class="ob-sub">${g(
          "ספרי לי על ספר שממש תפס אותך, או איזה סוג ספרים את הכי אוהבת",
          "ספר לי על ספר שממש תפס אותך, או איזה סוג ספרים אתה הכי אוהב",
          "ספרו לי על ספר שממש תפס אתכם, או איזה סוג ספרים אתם הכי אוהבים")}</p>
      </header>
      ${Voice.supported ? Voice.html() : ""}
      <label class="note-card" ${Voice.supported && !draft ? "hidden" : ""}>
        <span class="note-card-head typed">כרטיס קורא/ת · טעם אישי</span>
        <textarea rows="6" placeholder="${g(
          "למשל: אהבתי מאוד את נעלמת, אני אוהבת מותחנים עם טוויסטים, ופחות אימה",
          "למשל: אהבתי מאוד את נעלמת, אני אוהב מותחנים עם טוויסטים, ופחות אימה",
          "למשל: אהבנו מאוד את נעלמת, אנחנו אוהבים מותחנים עם טוויסטים, ופחות אימה")}">${esc(draft)}</textarea>
      </label>
      <button class="stamp stamp-red ob-go" ${Voice.supported && !draft ? "hidden" : ""}>המשך</button>
      ${Voice.supported ? `<button class="card-link ob-type">${g("אני מעדיפה להקליד", "אני מעדיף להקליד", "אנחנו מעדיפים להקליד")}</button>` : ""}
      <button class="card-link ob-skip">${g("דלגי", "דלג", "דלגו")}, ${g("אספר", "אספר", "נספר")} בפעם אחרת</button>
    `, step);

    const box = view.querySelector("textarea");
    const card = view.querySelector(".note-card");
    const go = view.querySelector(".ob-go");
    const showText = () => { card.hidden = false; go.hidden = false; };
    box.addEventListener("input", () => { draft = box.value; if (draft.trim()) showText(); });

    let recorder = null;
    if (Voice.supported) {
      recorder = Voice.attach(view.querySelector(".recorder"), box, (state) => {
        if (state === "listening") showText();
        if (state === "failed") {
          // keep the explanation visible, but drop the button that can't work here
          view.querySelector(".rec-btn")?.remove();
          view.querySelector(".ob-type")?.remove();
          showText();
        }
      });
    }
    // Switch to typing: hide the recorder and open the keyboard.
    const typeInstead = (focus = true) => {
      recorder?.stop();
      view.querySelector(".recorder")?.remove();
      view.querySelector(".ob-type")?.remove();
      showText();
      if (focus) box.focus();
    };
    view.querySelector(".ob-type")?.addEventListener("click", () => typeInstead());

    go.addEventListener("click", () => {
      recorder?.stop();
      draft = box.value.trim();
      if (!draft) { box.focus(); box.classList.add("nudge"); setTimeout(() => box.classList.remove("nudge"), 500); return; }
      confirm(Taste.read(draft), step ? step + 1 : null);
    });
    view.querySelector(".ob-skip").addEventListener("click", () => { recorder?.stop(); draft = ""; afterTaste(); });
  }

  // ---------- 4. "הבנתי ש…" ----------

  function confirm(found, step) {
    const state = {
      likes: [...found.likes],
      dislikes: [...found.dislikes],
      authors: [...found.authors],
      books: [...found.books],
    };

    const paint = (openPicker = false) => {
      const nothing = !state.likes.length && !state.dislikes.length && !state.authors.length && !state.books.length;
      const chips = (items, kind, label) => items.length ? `
        <div class="chip-group">
          <p class="chip-title">${label}</p>
          <div class="chips">${items.map((it, i) => `
            <button class="chip chip-${kind}" data-kind="${kind}" data-i="${i}" aria-label="להסיר">
              ${esc(typeof it === "string" ? it : it.name || bookById(it.id).title)} <span aria-hidden="true">✕</span>
            </button>`).join("")}</div>
        </div>` : "";

      const pos = (arr) => arr.filter((x) => x.sign > 0);
      const neg = (arr) => arr.filter((x) => x.sign < 0);
      const unused = Taste.LABELS.filter((l) => !state.likes.includes(l) && !state.dislikes.includes(l));

      screen(`
        <header class="ob-head">
          <h1>${nothing ? "עוד קצת עליך" : `הבנתי ש${g("את אוהבת", "אתה אוהב", "אתם אוהבים")}…`}</h1>
          <p class="ob-sub">${nothing
            ? `לא הצלחתי להבין מספיק מהטקסט. ${g("בחרי", "בחר", "בחרו")} כמה דברים ${g("שאת אוהבת", "שאתה אוהב", "שאתם אוהבים")}:`
            : `${g("געי", "גע", "געו")} במשהו כדי להוריד אותו, או ${g("הוסיפי", "הוסף", "הוסיפו")} עוד.`}</p>
        </header>
        <section class="catalog-card">
          ${chips(state.likes, "like", g("אוהבת", "אוהב", "אוהבים"))}
          ${chips(pos(state.authors), "author", "סופרים")}
          ${chips(pos(state.books), "book", "ספרים שכבר קראת ואהבת")}
          ${chips(state.dislikes, "dislike", "פחות")}
          ${chips(neg(state.authors), "author-neg", "סופרים שפחות")}
          ${chips(neg(state.books), "book-neg", "ספרים שלא התחברת אליהם")}
          <button class="card-link add-more" ${openPicker || nothing ? "hidden" : ""}>+ להוסיף עוד</button>
          <div class="picker" ${openPicker || nothing ? "" : "hidden"}>
            ${unused.map((l) => `<button class="chip chip-add" data-add="${esc(l)}">+ ${esc(l)}</button>`).join("")}
          </div>
        </section>
        <button class="stamp stamp-red ob-go">${g("נכון, בואי נתחיל", "נכון, בוא נתחיל", "נכון, בואו נתחיל")}</button>
        <button class="card-link ob-back">לתקן את מה ${g("שכתבתי", "שכתבתי", "שכתבנו")}</button>
      `, step);

      // chips: tap to remove
      view.querySelectorAll(".chip[data-kind]").forEach((c) => c.addEventListener("click", () => {
        const i = +c.dataset.i, kind = c.dataset.kind;
        if (kind === "like") state.likes.splice(i, 1);
        if (kind === "dislike") state.dislikes.splice(i, 1);
        if (kind === "author") state.authors.splice(state.authors.indexOf(pos(state.authors)[i]), 1);
        if (kind === "author-neg") state.authors.splice(state.authors.indexOf(neg(state.authors)[i]), 1);
        if (kind === "book") state.books.splice(state.books.indexOf(pos(state.books)[i]), 1);
        if (kind === "book-neg") state.books.splice(state.books.indexOf(neg(state.books)[i]), 1);
        paint(!view.querySelector(".picker").hidden);
      }));
      const add = view.querySelector(".add-more");
      add.addEventListener("click", () => paint(true));
      view.querySelectorAll("[data-add]").forEach((c) => c.addEventListener("click", () => {
        state.likes.push(c.dataset.add);
        paint(true);
      }));

      view.querySelector(".ob-go").addEventListener("click", () => save(state));
      view.querySelector(".ob-back").addEventListener("click", () => taste({ then: thenOriginal, step: step ? step - 1 : null }));
    };
    paint();
  }

  function save(found) {
    const p = Store.state.profile;
    Object.assign(p, {
      text: draft,
      likes: found.likes,
      dislikes: found.dislikes,
      authors: found.authors,
      books: found.books,
      updatedAt: new Date().toISOString(),
    });
    // books you told us about are already read, so we won't suggest them
    found.books.forEach(({ id, sign }) => {
      if (!Store.state.books[id]) Store.setBookStatus(id, "read", { liked: sign > 0, from: "intro" });
    });
    Store.save();
    afterTaste();
  }

  return { start, taste };
})();
