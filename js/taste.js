// Reading taste from free Hebrew text, and keeping the taste profile.
//
// A book is described by "features": its genre tags (tag:מותחן), style marks
// (style:fast), drawers (cat:light) and author (author:סטיבן קינג).
// The profile is a weight per feature: positive = likes, negative = not for me.

const Taste = (() => {
  // Words people use, and the features they point to. Each pattern is a whole
  // word, which may start with ו/ה/ב/ל/מ/ש/כ (so "ומותחנים" and "באימה" match).
  const WORDS = [
    { label: "מותחנים",       re: "מותחנ(?:ים|ות)?|מותחן|מתח|מותח(?:ים|ות)?|מורט(?:י)? עצבים", f: ["tag:מותחן", "tag:מתח"] },
    { label: "תעלומות",       re: "תעלומ(?:ה|ות)|בלש(?:י|ים|יות|ית)?|רצח|רציחות", f: ["tag:תעלומה", "tag:בלשי", "style:mystery"] },
    { label: "אימה",          re: "אימה|מפחיד(?:ים|ות|ה)?|מצמרר(?:ים|ות|ת)?|מבהיל(?:ים)?", f: ["tag:אימה", "style:scary"] },
    { label: "על-טבעי",       re: "על[- ]?טבעי(?:ים|ות)?|רוחות|ערפד(?:ים)?|זומבי(?:ם)?|מכשפ(?:ות|ה)", f: ["tag:על-טבעי", "tag:רוחות", "tag:ערפדים"] },
    { label: "רומנטי",        re: "רומנטי(?:ים|ות|ת)?|רומנטיקה|סיפור(?:י)? אהבה|אהבה", f: ["tag:רומנטי", "style:romantic"] },
    { label: "אירוטי",        re: "אירוטי(?:ים|ות|ת)?|אירוטיקה|סקסי(?:ים)?|חושני(?:ים|ות)?", f: ["tag:אירוטי"] },
    { label: "פסיכולוגי",     re: "פסיכולוגי(?:ים|ות|ת)?", f: ["tag:פסיכולוגי"] },
    { label: "קליל",          re: "קליל(?:ים|ות|ה)?|קל(?:ים|ות)? לקריאה|קל לקרוא|לא כבד(?:ים)?|ספר(?:י)? חוף", f: ["cat:light", "style:warm"] },
    { label: "מצחיק",         re: "מצחיק(?:ים|ות|ה)?|הומור|הומוריסטי(?:ים)?|צחקתי", f: ["tag:הומור", "style:funny"] },
    { label: "מרגש",          re: "מרגש(?:ים|ות|ת)?|בכיתי|דמעות|נוגע ללב|שובר(?: את)? הלב|מרסק", f: ["tag:מרגש", "style:emotional"] },
    { label: "מחמם לב",       re: "מחמם לב|מחממ(?:י|ת|ות|ים) לב|מחמם את הלב|חמים|אופטימי(?:ים)?", f: ["style:warm"] },
    { label: "קצב מהיר",      re: "קצב מהיר|קצבי(?:ים|ות)?|סוחפ(?:ים|ות)?|סוחף|לא יכולתי להניח(?: אותו)?|לא הצלחתי להניח(?: אותו)?|לא יכולתי להפסיק|בנשימה אחת|בלעתי(?: אותו)?|זורם(?:ים)?", f: ["style:fast"] },
    { label: "קצב איטי",      re: "קצב איטי|איטי(?:ים|ות|ת)?|שקט(?:ים|ה)?|מדיטטיבי(?:ים)?", f: ["style:slow"] },
    { label: "טוויסטים",      re: "טוויסט(?:ים)?|הפתע(?:ה|ות)|מפתיע(?:ים|ה)?|סוף מפתיע|תפנית|לא ציפיתי", f: ["style:twists"] },
    { label: "אפל",           re: "אפל(?:ים|ות|ה)?|קודר(?:ים|ת)?|חשוך|מדכא(?:ים)?", f: ["style:dark"] },
    { label: "דמויות טובות",  re: "דמויות|דמות|גיבור(?:ה|ים|ות)?", f: ["style:character"] },
    { label: "מעמיק",         re: "מעמיק(?:ים|ה)?|מחכים|גורם לחשוב|פילוסופי(?:ה|ים)?", f: ["style:smart", "tag:פילוסופיה"] },
    { label: "היסטורי",       re: "היסטורי(?:ים|ות|ה)?|היסטוריה|מלחמת העולם|שואה", f: ["tag:היסטורי", "tag:רומן היסטורי", "style:historical"] },
    { label: "ספרים קצרים",   re: "קצר(?:ים|ות)?|דק(?:ים|יקים)|לא ארוכ(?:ים)?", f: ["style:short", "tag:קצר"] },
    { label: "פנטזיה",        re: "פנטזי(?:ה|ות)|קסמים|קוסמ(?:ים|ות)?|דרקונ(?:ים)?", f: ["tag:פנטזיה"] },
    { label: "מדע בדיוני",    re: "מדע בדיוני|חלל|חייזר(?:ים)?|מד\"ב", f: ["tag:מדע בדיוני"] },
    { label: "דיסטופיה",      re: "דיסטופי(?:ה|ות|י|ים)|אפוקליפס(?:ה)?|פוסט[- ]אפוקליפטי", f: ["tag:דיסטופיה"] },
    { label: "ספרי נוער",     re: "נוער|ספרי נוער|תיכון|מתבגר(?:ים|ות)?", f: ["tag:נוער"] },
    { label: "קלאסיקות",      re: "קלאסיק(?:ה|ות)|קלאסי(?:ים|ות)?", f: ["tag:קלאסיקה", "cat:classic"] },
    { label: "ספרות ישראלית", re: "ישראלי(?:ת|ים|ות)?|עברית מקורית", f: ["tag:ספרות ישראלית"] },
    { label: "משפחה",         re: "משפח(?:ה|ות|תי|תיים)|דרמה משפחתית", f: ["tag:משפחה"] },
    { label: "חברות",         re: "חברות נשית|חברות בין|חברה הכי טובה|חברים הכי טובים", f: ["tag:חברות"] },
    { label: "דרמה",          re: "דרמ(?:ה|ות|טי|טיים)", f: ["tag:דרמה"] },
    { label: "רבי מכר",       re: "טרנדי(?:ים|ות)?|רבי מכר|רב מכר|כולם קוראים|בוקטוק|טיקטוק", f: ["cat:trendy"] },
    { label: "הרפתקאות",      re: "הרפתק(?:ה|אות|אה)", f: ["tag:הרפתקאות"] },
    { label: "בית משפט",      re: "משפטי(?:ים)?|בית משפט|עורכ(?:י)? דין", f: ["tag:משפטי"] },
  ];

  // Words that turn "likes" into "not for me" when they come just before…
  const NEG_BEFORE = /(?:^|\s)ו?(?:לא|פחות|שונא(?:ת|ים)?|ממש לא|אף פעם לא|בלי|נמאס לי מ?|אין לי סבלנות ל?|לא סובל(?:ת)?|לא מתחבר(?:ת)? ל?|לא אוהב(?:ת|ים)?|לא בקטע של)(?=\s|$)/;
  // …or just after.
  const NEG_AFTER = /^(?:\s*(?:זה|הם|הן))?\s*(?:משעמם|משעממים|לא בשבילי|לא מתאים לי|מעצבן|מעצבנים|לא עושה לי)/;

  const PREFIX = "[והבלמשכ]{0,2}";
  const EDGE_L = "(?:^|[\\s,.!?…:;\"'״׳()\\-])";
  const EDGE_R = "(?=$|[\\s,.!?…:;\"'״׳()\\-])";
  const compiled = WORDS.map((w) => ({ ...w, rx: new RegExp(EDGE_L + PREFIX + "(?:" + w.re + ")" + EDGE_R, "g") }));

  const clean = (s) => s.replace(/[֑-ׇ]/g, "").replace(/[״“”]/g, '"').replace(/[׳’`]/g, "'");

  // Is the match at [start, end) negated by the words around it (same sentence)?
  function negated(text, start, end) {
    const sentenceStart = Math.max(text.lastIndexOf(".", start), text.lastIndexOf("!", start),
      text.lastIndexOf("?", start), text.lastIndexOf("\n", start), text.lastIndexOf(",", start), -1) + 1;
    // praise that happens to contain "לא" ("לא יכולתי להניח") is not a negation
    const before = text.slice(sentenceStart, start)
      .replace(/לא (?:יכולתי|הצלחתי) ל\S+(?: אותו| אותה)?|לא ציפיתי|לא כבד\S*|לא ארוכ\S*/g, " ")
      .trim().split(/\s+/).slice(-3).join(" ");
    const after = text.slice(end, end + 30);
    return NEG_BEFORE.test(" " + before) || NEG_AFTER.test(after);
  }

  // Books and authors from our list that appear in the text.
  function findBooksAndAuthors(text) {
    const books = [], authors = [];
    const norm = (s) => clean(s).replace(/[^א-ת0-9a-zA-Z' ]/g, " ").replace(/\s+/g, " ").trim();
    const hay = " " + norm(text) + " ";
    for (const b of window.BOOKS) {
      const t = norm(b.title);
      const short = t.replace(/ /g, "").length < 5;
      // short titles like "זה" or "זר" count only when written as "הספר X" or in quotes
      const found = short
        ? new RegExp(`(?:הספר ${t}(?= )|"${t}")`).test(" " + clean(text) + " ")
        : new RegExp(`(?:^| )[והבלמשכ]{0,2}${t}(?= )`).test(hay);
      if (found) books.push(b);
    }
    const seen = new Set();
    for (const b of window.BOOKS) {
      for (const name of b.author.split(" ו")) {
        const full = norm(name);
        if (seen.has(full)) continue;
        const surname = full.split(" ").pop();
        const hit = hay.includes(` ${full} `) ||
          (surname.length >= 4 && new RegExp(`(?:^| )[והבלמשכ]{0,2}${surname}(?= )`).test(hay));
        if (hit) { seen.add(full); authors.push(name.trim()); }
      }
    }
    return { books, authors };
  }

  // Free text → what we understood.
  function read(text) {
    const t = clean(text || "");
    const { books, authors } = findBooksAndAuthors(t);
    // Book titles are names, not descriptions: "המטופלת השקטה" doesn't mean a slow
    // pace, so blank them out before looking for style words.
    let words = t;
    books.forEach((b) => { words = words.split(clean(b.title)).join(" ".repeat(b.title.length)); });

    const likes = [], dislikes = [];
    for (const w of compiled) {
      w.rx.lastIndex = 0;
      let m, verdict = 0;
      while ((m = w.rx.exec(words))) {
        verdict += negated(words, m.index, m.index + m[0].length) ? -1 : 1;
      }
      if (verdict > 0) likes.push(w.label);
      if (verdict < 0) dislikes.push(w.label);
    }
    const signOf = (name) => {
      let i = t.indexOf(name), len = name.length;
      if (i < 0) { const last = name.split(" ").pop(); i = t.indexOf(last); len = last.length; }
      return i >= 0 && negated(t, i, i + len) ? -1 : 1;
    };
    return {
      likes,
      dislikes,
      books: books.map((b) => ({ id: b.id, sign: signOf(b.title) })),
      // an author counts on their own only if none of their books was named
      authors: authors
        .filter((a) => !books.some((b) => b.author.includes(a)))
        .map((a) => ({ name: a, sign: signOf(a) })),
    };
  }

  // ---------- the profile ----------

  const LABELS = WORDS.map((w) => w.label);
  const featuresOfLabel = (label) => (WORDS.find((w) => w.label === label) || { f: [] }).f;

  function bookFeatures(book) {
    return [
      ...book.tags.map((t) => "tag:" + t),
      ...book.style.map((s) => "style:" + s),
      ...book.cats.map((c) => "cat:" + c),
      ...book.author.split(" ו").map((a) => "author:" + a.trim()),
    ];
  }

  function empty() {
    return { text: "", likes: [], dislikes: [], books: [], authors: [], forgetBefore: null, updatedAt: null };
  }

  // ---------- learning from your books (statistics, not single books) ----------
  //
  // Every book you took, read, rated or returned is one "observation" for each of
  // its features (author, genres, style). A feature's score is the average of its
  // observations, pulled towards neutral by PRIOR imaginary neutral books, so one
  // book never decides much. Negative conclusions need at least two books.

  const PRIOR = 3;
  const STRENGTH = { author: 3, other: 2.5 };

  // Quick tags on a rating: what each one says about the features it touches.
  const QUICK_TAGS = {
    "דמויות מעולות": [["style:character", 1]],
    "סוף מפתיע":     [["style:twists", 1]],
    "קצב סוחף":      [["style:fast", 1]],
    "כתיבה יפה":     [["style:smart", 0.6]],
    "מצחיק":         [["style:funny", 1]],
    "מרגש":          [["style:emotional", 1]],
    "קצב איטי":      [["style:slow", -1]],
    "צפוי מראש":     [["style:twists", 0.6]],
    "ארוך מדי":      [["style:short", 0.6]],
    "קשה מדי":       [["cat:light", 0.5], ["style:dark", -0.5]],
  };

  // How much one book record says: +1 loved … −1 not for me.
  function signalOf(r) {
    if (r.rating) return (r.rating - 3) / 2;
    if (r.liked === false) return -0.8;
    if (r.status === "rejected") return -0.3;
    if (r.status === "taken") return 0.4;
    if (r.status === "read") return 0.3;
    return 0;
  }

  const commentCache = new Map();
  function commentFeatures(text) {
    if (!commentCache.has(text)) {
      const said = read(text);
      const out = [];
      // in a review "איטי" is a complaint, not a wish
      said.likes.forEach((l) => featuresOfLabel(l).forEach((f) => out.push([f, l === "קצב איטי" ? -0.6 : 0.6])));
      said.dislikes.forEach((l) => featuresOfLabel(l).forEach((f) => out.push([f, -0.6])));
      commentCache.set(text, out);
    }
    return commentCache.get(text);
  }

  function learned(books, since) {
    const sum = {}, count = {};
    const observe = (f, v) => { sum[f] = (sum[f] || 0) + v; count[f] = (count[f] || 0) + 1; };
    for (const [id, r] of Object.entries(books || {})) {
      if (r.from === "intro") continue;                 // counted in what you told us
      if (since && r.date && r.date < since) continue;  // "לשכוח את מה שלמדתי"
      const book = window.BOOKS.find((b) => b.id === id);
      if (!book) continue;
      const v = signalOf(r);
      if (v) bookFeatures(book).forEach((f) => observe(f, v));
      (r.quick || []).forEach((q) => (QUICK_TAGS[q] || []).forEach(([f, x]) => observe(f, x)));
      if (r.comment) commentFeatures(r.comment).forEach(([f, x]) => observe(f, x));
    }
    const out = {};
    for (const f of Object.keys(sum)) {
      let score = sum[f] / (count[f] + PRIOR);
      if (score < 0 && count[f] < 2) score *= 0.3;     // one book is not a pattern
      out[f] = score * (f.startsWith("author:") ? STRENGTH.author : STRENGTH.other);
    }
    return out;
  }

  // Weight per feature: what you told us, plus what your books show.
  function weights(profile, books = Store.state.books) {
    const w = {};
    const add = (f, v) => { w[f] = (w[f] || 0) + v; };
    profile.likes.forEach((l) => featuresOfLabel(l).forEach((f) => add(f, 2)));
    profile.dislikes.forEach((l) => featuresOfLabel(l).forEach((f) => add(f, -2.5)));
    profile.authors.forEach((a) => add("author:" + a.name, a.sign * 3));
    profile.books.forEach(({ id, sign }) => {
      const b = window.BOOKS.find((x) => x.id === id);
      if (b) bookFeatures(b).forEach((f) => add(f, f.startsWith("author:") ? sign * 2 : sign * 0.8));
    });
    Object.entries(learned(books, profile.forgetBefore)).forEach(([f, v]) => add(f, v));
    return w;
  }

  function isEmpty(profile, books = Store.state.books) {
    const told = profile && (profile.likes.length || profile.dislikes.length ||
      profile.books.length || profile.authors.length);
    return !told && !Object.keys(learned(books, profile && profile.forgetBefore)).length;
  }

  return { read, weights, isEmpty, learned, empty, bookFeatures, featuresOfLabel, LABELS, QUICK_TAGS: Object.keys(QUICK_TAGS) };
})();
