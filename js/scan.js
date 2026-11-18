// "צילמת ספר בספרייה?": photograph a cover, read its text on the phone
// (Tesseract, free, nothing is uploaded), find the book in our list, and say
// whether it suits your taste.

const Scan = (() => {
  const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

  // ---------- reading the cover ----------

  let loading = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    loading ||= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = TESSERACT;
      s.onload = resolve;
      s.onerror = () => { loading = null; reject(new Error("offline")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  // Shrink big phone photos and make them grey: faster and reads better.
  function prepare(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        ctx.filter = "grayscale(1) contrast(1.3)";
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function readCover(file) {
    await loadTesseract();
    const canvas = await prepare(file);
    const worker = await Tesseract.createWorker(["heb", "eng"]);
    try {
      const { data } = await worker.recognize(canvas);
      return data.text || "";
    } finally {
      worker.terminate();
    }
  }

  // ---------- finding the book ----------

  // Compare Hebrew loosely: no vowel marks, final letters as regular ones.
  const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
  const norm = (s) => s.toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^א-תa-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();

  const bigrams = (s) => {
    const t = s.replace(/ /g, "");
    const out = new Map();
    for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) || 0) + 1);
    return out;
  };
  function dice(a, b) {
    if (a.replace(/ /g, "").length < 2 || b.replace(/ /g, "").length < 2) return a === b ? 1 : 0;
    const A = bigrams(a), B = bigrams(b);
    let both = 0, total = 0;
    A.forEach((n, k) => { both += Math.min(n, B.get(k) || 0); total += n; });
    B.forEach((n) => { total += n; });
    return (2 * both) / total;
  }

  // How well does a title appear somewhere in the text? (best window of words)
  function titleScore(words, title) {
    const t = norm(title);
    const k = t.split(" ").length;
    let best = 0;
    for (let size = Math.max(1, k - 1); size <= k + 1; size++) {
      for (let i = 0; i + size <= words.length; i++) {
        best = Math.max(best, dice(words.slice(i, i + size).join(" "), t));
      }
    }
    return best;
  }

  // Our books, best match first, with a score from 0 to 1.
  function match(text) {
    const words = norm(text).split(" ").filter(Boolean);
    if (!words.length) return [];
    const flat = " " + words.join(" ") + " ";
    return window.BOOKS.map((b) => {
      let s = Math.max(titleScore(words, b.title), titleScore(words, b.en) * 0.95);
      // the author's surname on the cover makes us surer
      const surname = norm(b.author.split(" ו")[0]).split(" ").pop();
      if (surname.length >= 3 && flat.includes(" " + surname + " ")) s = Math.min(1, s + 0.15);
      // very short titles ("זה", "זר") match by chance: be stricter
      if (norm(b.title).replace(/ /g, "").length < 4) s *= 0.7;
      return { book: b, score: s };
    }).sort((x, y) => y.score - x.score).slice(0, 5);
  }

  // ---------- would you connect with it? ----------

  function verdict(book) {
    const profile = Store.state.profile;
    const rec = Store.state.books[book.id];
    const lines = [];
    if (rec) {
      lines.push({ taken: "הספר הזה כבר אצלך ברשימה.", read: "כבר קראת את הספר הזה.", rejected: "פעם החזרת את הספר הזה לערימה." }[rec.status] || "");
    }
    if (Taste.isEmpty(profile)) {
      return {
        level: "unknown",
        title: "עוד לא מכירה את הטעם שלך",
        lines: [...lines, book.pop >= 4 ? "אבל זה ספר מוכר ואהוב מאוד על קוראים." : `${g("ספרי", "ספר", "ספרו")} לי מה ${g("את אוהבת", "אתה אוהב", "אתם אוהבים")} ב"הטעם שלי", ואדע להגיד.`],
      };
    }
    const w = Taste.weights(profile);
    const parts = Taste.bookFeatures(book).map((f) => [f, w[f] || 0]);
    const score = parts.reduce((s, [, v]) => s + v, 0);
    const named = (list) => [...new Set(list.map(([f]) => featureName(f) || (f.startsWith("author:") ? f.slice(7) : null)).filter(Boolean))];
    const good = named(parts.filter(([, v]) => v > 0.6).sort((a, b) => b[1] - a[1])).slice(0, 3);
    const bad = named(parts.filter(([, v]) => v < -0.6).sort((a, b) => a[1] - b[1])).slice(0, 2);

    let level, title;
    if (score >= 3) { level = "yes"; title = `נראה לי ${g("שתתחברי", "שתתחבר", "שתתחברו")} מאוד!`; }
    else if (score >= 1) { level = "maybe-yes"; title = "יש סיכוי טוב שזה בשבילך"; }
    else if (score > -1) { level = "unsure"; title = "קשה לי לדעת"; }
    else { level = "no"; title = `נראה לי שזה פחות ${g("בשבילך", "בשבילך", "בשבילכם")}`; }

    if (good.length) lines.push(`יש בו ${good.join(", ")}, כמו ${g("שאת אוהבת", "שאתה אוהב", "שאתם אוהבים")}.`);
    if (bad.length && level !== "yes") lines.push(`אבל יש בו גם ${bad.join(", ")}.`);
    if (!good.length && !bad.length) lines.push(book.pop >= 4 ? "הוא לא ממש דומה למה שאני מכירה עליך, אבל קוראים מאוד אוהבים אותו." : "הוא לא דומה במיוחד למה שאני מכירה עליך.");
    return { level, title, lines: lines.filter(Boolean) };
  }

  function showVerdict(book) {
    const v = verdict(book);
    const rec = Store.state.books[book.id];
    Shelf.open(book, {
      actions: rec ? [{ id: "close", label: "סגירה", kind: "link" }] : PICK_ACTIONS,
      note: `<span class="verdict verdict-${v.level}"><b>${esc(v.title)}</b>${v.lines.map((l) => `<br>${esc(l)}`).join("")}</span>`,
      onAction: (actionId) => {
        if (actionId === "close") return;
        const result = PICK_RESULT[actionId];
        const undo = applyChoice(book, result.status, result.extra);
        Toast.show(result.toast(), () => undo());
      },
    });
  }

  // ---------- the screens ----------

  function overlay(html) {
    document.querySelector(".scan")?.remove();
    const box = document.createElement("div");
    box.className = "install scan";
    box.innerHTML = `<div class="install-card scan-card" role="dialog" aria-modal="true">
      <button class="sheet-close" aria-label="סגירה">✕</button>${html}</div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add("show"));
    const close = () => { box.classList.remove("show"); setTimeout(() => box.remove(), 300); };
    box.querySelector(".sheet-close").addEventListener("click", close);
    return { box, close };
  }

  // Not recognised (or not sure): let the reader type the title.
  function typeInstead(message, candidates = []) {
    const { box, close } = overlay(`
      <h2>${esc(message)}</h2>
      ${candidates.length ? `<p class="install-intro">אולי זה אחד מאלה?</p>
        <div class="scan-hits">${candidates.map((c) => `<button class="hit" data-id="${esc(c.book.id)}"><b>${esc(c.book.title)}</b> · ${esc(c.book.author)}</button>`).join("")}</div>` : ""}
      <label class="field scan-field"><span>או ${g("הקלידי", "הקלד", "הקלידו")} את שם הספר</span>
        <input class="scan-search" placeholder="למשל: עוזרת הבית"></label>
      <div class="scan-hits typed-hits"></div>
      <button class="card-link scan-again">לצלם שוב</button>`);
    const pick = (id) => { close(); setTimeout(() => showVerdict(window.BOOKS.find((b) => b.id === id)), 320); };
    box.querySelectorAll(".scan-hits .hit").forEach((h) => h.addEventListener("click", () => pick(h.dataset.id)));
    const input = box.querySelector(".scan-search");
    const hits = box.querySelector(".typed-hits");
    input.addEventListener("input", () => {
      const q = input.value.trim();
      const found = q.length < 2 ? [] : window.BOOKS.filter((b) => b.title.includes(q) || b.author.includes(q)).slice(0, 6);
      hits.innerHTML = found.map((b) => `<button class="hit" data-id="${esc(b.id)}"><b>${esc(b.title)}</b> · ${esc(b.author)}</button>`).join("") ||
        (q.length >= 2 ? `<p class="set-note">הספר הזה עוד לא ברשימה שלי (יש בה ${window.BOOKS.length} ספרים). אני מוסיפה עוד כל הזמן.</p>` : "");
      hits.querySelectorAll(".hit").forEach((h) => h.addEventListener("click", () => pick(h.dataset.id)));
    });
    box.querySelector(".scan-again").addEventListener("click", () => { close(); start(); });
  }

  async function handle(file) {
    const thumb = URL.createObjectURL(file);
    const { close } = overlay(`
      <div class="scan-photo"><img src="${thumb}" alt="התמונה שצילמת"><span class="scan-beam" aria-hidden="true"></span></div>
      <h2>קוראת את הכריכה…</h2>
      <p class="install-intro">זה לוקח כמה שניות. התמונה לא נשלחת לשום מקום, הכול קורה בטלפון.</p>`);
    let text;
    try {
      text = await readCover(file);
    } catch (err) {
      close();
      setTimeout(() => typeInstead(err.message === "offline"
        ? "כדי לקרוא כריכה בפעם הראשונה צריך אינטרנט"
        : "לא הצלחתי לקרוא את התמונה"), 320);
      return;
    } finally {
      URL.revokeObjectURL(thumb);
    }
    const found = match(text);
    close();
    setTimeout(() => {
      const [best, second] = found;
      if (best && best.score >= 0.62 && (!second || best.score - second.score >= 0.1)) showVerdict(best.book);
      else typeInstead("לא הייתי בטוחה איזה ספר זה", found.filter((c) => c.score >= 0.35).slice(0, 3));
    }, 320);
  }

  function start() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*"; // on iPhone: take a photo or choose one
    input.addEventListener("change", () => input.files && input.files[0] && handle(input.files[0]));
    input.click();
  }

  return { start, match, verdict, norm };
})();
