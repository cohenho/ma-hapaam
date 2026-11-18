// חדר הספרנית: sign in, choose the week's three picks with handwritten notes,
// and see how many people use the app and what they take and rate.
// Only works for the librarian account (see tools/supabase-setup.sql).

(() => {
  const view = document.getElementById("view");
  const cfg = window.CLOUD || {};
  const BOOKS = window.BOOKS;
  const bookById = (id) => BOOKS.find((b) => b.id === id);
  const SESSION_KEY = "bythebook-librarian";
  let session = null;

  // ---------- small helpers ----------

  const toastEl = document.querySelector(".toast");
  let toastTimer;
  function toast(text) {
    clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    toastTimer = setTimeout(() => { toastEl.classList.remove("show"); setTimeout(() => (toastEl.hidden = true), 250); }, 3500);
  }

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sunday = (offsetWeeks = 0) => {
    const t = new Date();
    return ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() - t.getDay() + offsetWeeks * 7));
  };
  const niceDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long" });
  const coverUrl = (b, size = "S") => `https://covers.openlibrary.org/b/id/${b.cover}-${size}.jpg?default=false`;

  async function api(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { signOut(); throw new Error("צריך להתחבר שוב."); }
    if (!res.ok) throw new Error(`השמירה לא הצליחה (${res.status}).`);
    return res.status === 204 || method !== "GET" ? null : res.json();
  }

  // ---------- sign in ----------

  function loadSession() {
    try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { session = null; }
    if (session && session.expires_at * 1000 < Date.now() + 60000) session = null;
  }

  function signOut() {
    session = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
    showLogin();
  }

  function showLogin(message = "") {
    if (!cfg.url || !cfg.anonKey) {
      view.innerHTML = `<header class="hero"><h1>חדר<br>הספרנית</h1></header>
        <section class="set-card"><p>עוד לא חיברנו את האחסון המשותף. אחרי ההגדרה ב-Supabase והוספת הפרטים ל-js/config.js, העמוד הזה יתחיל לעבוד.</p></section>`;
      return;
    }
    view.innerHTML = `
      <header class="hero">
        <div class="brand-stamp" aria-hidden="true">By the<br>Book</div>
        <h1>חדר<br>הספרנית</h1>
        <p class="hero-sub">הכניסה לצוות בלבד</p>
      </header>
      <form class="set-card login-card">
        <h3>כניסה</h3>
        <label class="field"><span>אימייל</span><input type="email" name="email" autocomplete="username" required dir="ltr"></label>
        <label class="field"><span>סיסמה</span><input type="password" name="password" autocomplete="current-password" required dir="ltr"></label>
        ${message ? `<p class="set-note err">${esc(message)}</p>` : ""}
        <button class="stamp stamp-red" style="width:100%;margin-top:14px">כניסה</button>
      </form>`;
    view.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
        });
        const data = await res.json();
        if (!res.ok || !data.access_token) throw new Error();
        session = { access_token: data.access_token, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + 3600 };
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* private mode */ }
        showRoom();
      } catch {
        showLogin("האימייל או הסיסמה לא נכונים.");
      }
    });
  }

  // ---------- the room ----------

  let tab = "picks";

  function showRoom() {
    view.innerHTML = `
      <header class="page-head">
        <h2 class="page-title">חדר הספרנית</h2>
        <button class="card-link sign-out">יציאה</button>
      </header>
      <nav class="admin-tabs">
        <button data-tab="picks" class="${tab === "picks" ? "on" : ""}">ההמלצות שלי</button>
        <button data-tab="stats" class="${tab === "stats" ? "on" : ""}">מספרים</button>
      </nav>
      <div class="admin-body"><p class="set-note">רגע…</p></div>`;
    view.querySelector(".sign-out").addEventListener("click", signOut);
    view.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; showRoom(); }));
    (tab === "picks" ? showPicks : showStats)().catch((err) => {
      view.querySelector(".admin-body").innerHTML = `<p class="set-note err">${esc(err.message)}</p>`;
    });
  }

  // ---------- the week's picks ----------

  let week = sunday(0);

  async function showPicks() {
    const body = view.querySelector(".admin-body");
    const rows = await api(`/rest/v1/picks?select=position,book_id,note&week_start=eq.${week}&order=position.asc`);
    const slots = [1, 2, 3].map((p) => {
      const r = rows.find((x) => x.position === p);
      return { book_id: r ? r.book_id : null, note: r ? r.note || "" : "" };
    });

    const paint = () => {
      body.innerHTML = `
        <div class="opts week-pick">
          <button class="opt ${week === sunday(0) ? "on" : ""}" data-week="${sunday(0)}">השבוע (${niceDate(sunday(0))})</button>
          <button class="opt ${week === sunday(1) ? "on" : ""}" data-week="${sunday(1)}">שבוע הבא (${niceDate(sunday(1))})</button>
        </div>
        <p class="set-note">${g("בחרי")} עד 3 ספרים ${g("וכתבי")} לכל אחד פתק קצר בכתב יד. הם יופיעו לכולם במסך הבית.</p>
        ${slots.map((s, i) => slotHtml(s, i)).join("")}
        <button class="stamp stamp-red publish" style="width:100%;margin-top:6px">פרסום ההמלצות</button>`;

      body.querySelectorAll("[data-week]").forEach((b) => b.addEventListener("click", () => { week = b.dataset.week; showPicks(); }));
      body.querySelectorAll(".slot").forEach((el) => {
        const i = +el.dataset.i;
        const search = el.querySelector(".book-search");
        const results = el.querySelector(".results");
        search?.addEventListener("input", () => {
          const q = search.value.trim();
          const hits = q.length < 2 ? [] : BOOKS.filter((b) => b.title.includes(q) || b.author.includes(q) || b.en.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
          results.innerHTML = hits.map((b) => `<button class="hit" data-id="${esc(b.id)}"><b>${esc(b.title)}</b> · ${esc(b.author)}</button>`).join("") ||
            (q.length >= 2 ? `<p class="set-note">לא מצאתי ברשימה. (כרגע אפשר לבחור רק מתוך ${BOOKS.length} הספרים שבאפליקציה)</p>` : "");
          results.querySelectorAll(".hit").forEach((h) => h.addEventListener("click", () => { slots[i].book_id = h.dataset.id; paint(); }));
        });
        el.querySelector(".swap")?.addEventListener("click", () => { slots[i].book_id = null; paint(); });
        const note = el.querySelector(".note-input");
        note?.addEventListener("input", () => {
          slots[i].note = note.value;
          el.querySelector(".lib-note").textContent = note.value || " ";
        });
      });
      body.querySelector(".publish").addEventListener("click", () => publish(slots));
    };
    paint();
  }

  function slotHtml(s, i) {
    const b = s.book_id && bookById(s.book_id);
    return `
      <section class="set-card slot" data-i="${i}">
        <h3>ספר ${i + 1}</h3>
        ${b ? `
          <div class="slot-book">
            ${b.cover ? `<img src="${coverUrl(b, "M")}" alt="">` : `<span class="slot-drawn">${esc(b.title)}</span>`}
            <div>
              <p class="slot-title">${esc(b.title)}</p>
              <p class="card-author typed">${esc(b.author)}</p>
              <button class="card-link swap">להחליף ספר</button>
            </div>
          </div>
          <label class="field"><span>הפתק שלך (עד 60 תווים)</span>
            <input class="note-input" maxlength="60" value="${esc(s.note)}" placeholder="למשל: נבלע בערב אחד!"></label>
          <p class="set-note">ככה הפתק ייראה:</p>
          <p class="lib-note hand preview">${esc(s.note) || " "}</p>
        ` : `
          <label class="field"><span>חיפוש לפי שם הספר או הסופר</span>
            <input class="book-search" placeholder="למשל: עוזרת הבית"></label>
          <div class="results"></div>
        `}
      </section>`;
  }

  async function publish(slots) {
    const chosen = slots.map((s, i) => ({ ...s, position: i + 1 })).filter((s) => s.book_id);
    const empty = slots.map((s, i) => (!s.book_id ? i + 1 : null)).filter(Boolean);
    try {
      if (chosen.length) {
        await api(`/rest/v1/picks?on_conflict=week_start,position`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: chosen.map((s) => ({ week_start: week, position: s.position, book_id: s.book_id, note: s.note.trim() || null })),
        });
      }
      if (empty.length) {
        await api(`/rest/v1/picks?week_start=eq.${week}&position=in.(${empty.join(",")})`, { method: "DELETE" });
      }
      toast(week === sunday(0) ? "פורסם! ההמלצות יופיעו לכולם בפתיחה הבאה של האפליקציה." : "נשמר! ההמלצות יופיעו ביום ראשון הקרוב.");
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- numbers ----------

  let withNames = true; // until the database has the display_name column
  async function fetchEvents(days) {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const all = [];
    for (let from = 0; from < 50000; from += 1000) {
      const cols = "user_id,kind,book_id,rating,created_at" + (withNames ? ",display_name" : "");
      const res = await fetch(`${cfg.url}/rest/v1/events?select=${cols}&created_at=gte.${since}&order=created_at.asc`, {
        headers: { apikey: cfg.anonKey, Authorization: `Bearer ${session.access_token}`, Range: `${from}-${from + 999}`, "Range-Unit": "items" },
      });
      if (res.status === 401) { signOut(); throw new Error("צריך להתחבר שוב."); }
      if (res.status === 400 && withNames) { withNames = false; return fetchEvents(days); }
      if (!res.ok && res.status !== 206) throw new Error(`לא הצלחתי לקרוא את המספרים (${res.status}).`);
      const rows = await res.json();
      all.push(...rows);
      if (rows.length < 1000) break;
    }
    return all;
  }

  async function showStats() {
    const body = view.querySelector(".admin-body");
    const ev = await fetchEvents(90);
    const now = Date.now();
    const within = (e, days) => now - Date.parse(e.created_at) <= days * 864e5;

    const firstSeen = {};
    ev.forEach((e) => { if (!(e.user_id in firstSeen)) firstSeen[e.user_id] = e.created_at; });
    const users = Object.keys(firstSeen).length;
    const active7 = new Set(ev.filter((e) => within(e, 7)).map((e) => e.user_id)).size;
    const new7 = Object.values(firstSeen).filter((t) => now - Date.parse(t) <= 7 * 864e5).length;
    const taken30 = ev.filter((e) => e.kind === "taken" && within(e, 30));

    // people per day, last 14 days
    const days = [...Array(14)].map((_, i) => {
      const d = new Date(now - (13 - i) * 864e5);
      const key = d.toDateString();
      return { label: `${d.getDate()}.${d.getMonth() + 1}`, n: new Set(ev.filter((e) => new Date(e.created_at).toDateString() === key).map((e) => e.user_id)).size };
    });
    const max = Math.max(1, ...days.map((d) => d.n));

    const count = (list) => Object.entries(list.reduce((m, e) => ((m[e.book_id] = (m[e.book_id] || 0) + 1), m), {}))
      .sort((a, b) => b[1] - a[1]);
    const topTaken = count(taken30).slice(0, 10);

    const ratings = {};
    ev.filter((e) => e.kind === "rated" && e.rating).forEach((e) => (ratings[e.book_id] ||= []).push(e.rating));
    const topRated = Object.entries(ratings)
      .map(([id, rs]) => [id, rs.reduce((a, b) => a + b, 0) / rs.length, rs.length])
      .sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 10);

    // how this week's picks are doing
    const picks = await api(`/rest/v1/picks?select=position,book_id&week_start=eq.${sunday(0)}&order=position.asc`);
    const sinceSunday = Date.parse(sunday(0) + "T00:00:00");
    const pickRows = picks.map((p) => ({
      book: bookById(p.book_id),
      taken: ev.filter((e) => e.kind === "taken" && e.book_id === p.book_id && Date.parse(e.created_at) >= sinceSunday).length,
    }));

    const title = (id) => (bookById(id) || { title: id }).title;

    // one row per phone: its latest name (if given), what it took and read, last visit
    const readers = {};
    let anonNo = 0;
    ev.forEach((e) => {
      const r = (readers[e.user_id] ||= { name: null, taken: new Set(), read: new Set(), ratings: [], last: e.created_at });
      if (e.display_name) r.name = e.display_name;
      if (e.kind === "taken") r.taken.add(e.book_id);
      if (e.kind === "read" || e.kind === "rated" || e.kind === "disliked") r.read.add(e.book_id);
      if (e.kind === "rated" && e.rating) r.ratings.push(e.rating);
      if (e.created_at > r.last) r.last = e.created_at;
    });
    const readerRows = Object.values(readers)
      .sort((a, b) => b.last.localeCompare(a.last))
      .map((r) => ({ ...r, label: r.name || `אנונימי/ת ${++anonNo}` }));
    body.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><b>${active7}</b><span>${active7 === 1 ? "קוראת/קורא" : "אנשים"} השבוע</span></div>
        <div class="stat"><b>${new7}</b><span>חדשים השבוע</span></div>
        <div class="stat"><b>${users}</b><span>בסך הכול (90 יום)</span></div>
        <div class="stat"><b>${taken30.length}</b><span>ספרים נלקחו (30 יום)</span></div>
      </div>

      <section class="set-card">
        <h3>כמה אנשים פתחו את האפליקציה</h3>
        <div class="bars">${days.map((d, i) => `
          <div class="bar"><span class="bar-n typed">${d.n || ""}</span><i style="height:${(d.n / max) * 100}%"></i><span class="bar-d typed">${i % 2 ? "" : d.label}</span></div>`).join("")}</div>
      </section>

      <section class="set-card">
        <h3>הקוראים</h3>
        ${!withNames ? `<p class="set-note err">כדי לראות שמות, צריך להריץ פעם אחת ב-Supabase את הקובץ tools/supabase-add-name.sql.</p>` : ""}
        ${readerRows.length ? `<div class="readers">${readerRows.map((r) => `
          <details class="reader">
            <summary><b>${esc(r.label)}</b><span class="typed">${r.taken.size} נלקחו · ${r.read.size} נקראו · ${new Date(r.last).toLocaleDateString("he-IL")}</span></summary>
            ${r.taken.size ? `<p class="set-note"><b>לקח/ה:</b> ${[...r.taken].map((id) => esc(title(id))).join(", ")}</p>` : ""}
            ${r.read.size ? `<p class="set-note"><b>קרא/ה:</b> ${[...r.read].map((id) => esc(title(id))).join(", ")}</p>` : ""}
            ${r.ratings.length ? `<p class="set-note"><b>דירוג ממוצע:</b> ★${(r.ratings.reduce((a, b) => a + b, 0) / r.ratings.length).toFixed(1)}</p>` : ""}
          </details>`).join("")}</div>` : `<p class="set-note">עוד אין קוראים.</p>`}
      </section>

      ${pickRows.length ? `<section class="set-card">
        <h3>ההמלצות שלך השבוע</h3>
        <ol class="rank-list">${pickRows.map((r) => `<li><span>${esc(r.book ? r.book.title : "")}</span><span class="typed">נלקח ${r.taken}</span></li>`).join("")}</ol>
      </section>` : ""}

      <section class="set-card">
        <h3>הכי נלקחו (30 יום)</h3>
        ${topTaken.length ? `<ol class="rank-list">${topTaken.map(([id, n]) => `<li><span>${esc(title(id))}</span><span class="typed">${n}</span></li>`).join("")}</ol>`
          : `<p class="set-note">עוד אין נתונים.</p>`}
      </section>

      <section class="set-card">
        <h3>הדירוגים הכי גבוהים</h3>
        ${topRated.length ? `<ol class="rank-list">${topRated.map(([id, avg, n]) => `<li><span>${esc(title(id))}</span><span class="typed">★${avg.toFixed(1)} · ${n} ${n === 1 ? "דירוג" : "דירוגים"}</span></li>`).join("")}</ol>`
          : `<p class="set-note">עוד אין דירוגים.</p>`}
      </section>
      <p class="set-note">לכל טלפון יש מספר אקראי. שם מופיע רק אצל מי שבחר/ה לתת אותו.</p>`;
  }

  // ---------- start ----------

  loadSession();
  if (session) showRoom(); else showLogin();
})();
