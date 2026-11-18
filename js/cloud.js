// Talking to the shared storage (Supabase): the librarian's weekly picks, and
// anonymous usage events. Everything here fails quietly: without internet or
// without configuration, the app just works on its own as before.

const Cloud = (() => {
  const cfg = window.CLOUD || {};
  const enabled = !!(cfg.url && cfg.anonKey);
  // Older projects have a JWT "anon" key that also goes in Authorization; newer
  // "publishable" keys (sb_publishable_…) go only in the apikey header.
  const headers = (token) => {
    const h = { apikey: cfg.anonKey, "Content-Type": "application/json" };
    const bearer = token || (String(cfg.anonKey).startsWith("eyJ") ? cfg.anonKey : null);
    if (bearer) h.Authorization = `Bearer ${bearer}`;
    return h;
  };

  // ---------- the librarian's picks ----------

  // The Sunday that starts the week of `date`, as YYYY-MM-DD (local time).
  function weekStart(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // The most recent week's picks (so last week's stay up if a week is skipped).
  async function fetchPicks() {
    if (!enabled) return null;
    try {
      const q = `select=week_start,position,book_id,note&week_start=lte.${weekStart()}&order=week_start.desc,position.asc&limit=6`;
      const res = await fetch(`${cfg.url}/rest/v1/picks?${q}`, { headers: headers() });
      if (!res.ok) throw new Error(res.status);
      const rows = await res.json();
      const latest = rows.length ? rows[0].week_start : null;
      const picks = rows.filter((r) => r.week_start === latest);
      Store.state.librarian = { week: latest, picks, fetchedAt: new Date().toISOString() };
      Store.save();
      return Store.state.librarian;
    } catch {
      return Store.state.librarian || null; // the last ones we saw
    }
  }

  // ---------- anonymous usage ----------

  function anonId() {
    if (!Store.state.anonId) {
      Store.state.anonId = (crypto.randomUUID && crypto.randomUUID()) ||
        "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
          (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
      Store.save();
    }
    return Store.state.anonId;
  }

  const sharing = () => enabled && Store.state.settings.share !== false && Store.state.privacySeen;

  // kind: open | taken | read | disliked | rejected | restored | rated
  function track(kind, bookId = null, rating = null) {
    if (!sharing()) return;
    const queue = (Store.state.outbox ||= []);
    const event = { user_id: anonId(), kind, book_id: bookId, rating, created_at: new Date().toISOString() };
    const name = (Store.state.settings.name || "").trim();
    if (name) event.display_name = name.slice(0, 40); // only if you chose to give it
    queue.push(event);
    if (queue.length > 200) queue.splice(0, queue.length - 200); // don't grow forever offline
    Store.save();
    flush();
  }

  // "open" at most once a day per phone: that's how we count users.
  function trackOpen() {
    const today = new Date().toDateString();
    if (Store.state.lastOpenSent === today) return;
    if (!sharing()) return;
    Store.state.lastOpenSent = today;
    track("open");
  }

  let flushing = false;
  async function flush() {
    if (flushing || !sharing() || !(Store.state.outbox || []).length || !navigator.onLine) return;
    flushing = true;
    const batch = Store.state.outbox.slice(0, 50);
    try {
      const res = await fetch(`${cfg.url}/rest/v1/events`, {
        method: "POST",
        headers: { ...headers(), Prefer: "return=minimal" },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        Store.state.outbox.splice(0, batch.length);
        Store.save();
      } else if (res.status === 400 && batch.some((e) => "display_name" in e)) {
        // the database hasn't got the name column yet: keep the events, drop the names
        batch.forEach((e) => delete e.display_name);
        Store.save();
      }
    } catch { /* try again next time */ }
    flushing = false;
    if (Store.state.outbox.length && batch.length === 50) flush();
  }
  window.addEventListener("online", flush);

  // Turning sharing off also forgets anything not sent yet.
  function setSharing(on) {
    Store.state.settings.share = on;
    if (!on) Store.state.outbox = [];
    Store.save();
  }

  return { enabled, headers, weekStart, fetchPicks, track, trackOpen, flush, setSharing, cfg };
})();
