// Backup to a file and restore from it, plus the gentle monthly reminder.
// The backup is one JSON file with everything: books, ratings, taste, settings.

const Backup = (() => {
  const MONTH = 30 * 24 * 60 * 60 * 1000;
  const APP_ID = "by-the-book";

  function fileName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `by-the-book-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
  }

  // Must be called straight from a tap: the iPhone's share sheet needs it.
  async function exportNow() {
    const payload = { app: APP_ID, format: 1, exportedAt: new Date().toISOString(), state: Store.state };
    const json = JSON.stringify(payload, null, 1);
    const name = fileName();
    const file = new File([json], name, { type: "application/json" });

    let done = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "גיבוי By the Book" });
        done = true;
      } catch (err) {
        if (err.name === "AbortError") return false; // closed the share sheet
      }
    }
    if (!done) {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    Store.state.lastBackup = new Date().toISOString();
    Store.state.backupNagAt = Store.state.lastBackup;
    Store.save();
    return true;
  }

  // Read a backup file; resolves to its state, or throws with a friendly message.
  async function readFile(file) {
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { throw new Error("הקובץ הזה לא נראה כמו גיבוי של By the Book."); }
    if (!data || data.app !== APP_ID || !data.state || typeof data.state.books !== "object") {
      throw new Error("הקובץ הזה לא נראה כמו גיבוי של By the Book.");
    }
    return data;
  }

  // Ask for a file, warn that current data will be replaced, then restore.
  function pickAndRestore() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const data = await readFile(file);
        const theirs = Object.keys(data.state.books).length;
        const mine = Object.keys(Store.state.books).length;
        const when = new Date(data.exportedAt).toLocaleDateString("he-IL");
        const ok = confirm(
          `הגיבוי מ-${when}, עם ${theirs} ספרים.\n\n` +
          `שימו לב: כל המידע שיש עכשיו באפליקציה (${mine} ספרים, הדירוגים, הטעם וההגדרות) יוחלף במידע מהגיבוי.\n\nלשחזר?`);
        if (!ok) return;
        Store.replaceAll(data.state);
        location.reload();
      } catch (err) {
        alert(err.message);
      }
    });
    input.click();
  }

  // Once a month, if you have books and haven't backed up for a month.
  function shouldNag() {
    const st = Store.state;
    if (st.forceBackupNag) return true;
    if (!Object.keys(st.books).length) return false;
    const now = Date.now();
    const since = Date.parse(st.lastBackup || st.createdAt || 0);
    const nagged = Date.parse(st.backupNagAt || 0);
    return now - since > MONTH && now - nagged > MONTH;
  }

  function markNagged() {
    Store.state.backupNagAt = new Date().toISOString();
    delete Store.state.forceBackupNag;
    Store.save();
  }

  return { exportNow, pickAndRestore, readFile, shouldNag, markNagged };
})();
