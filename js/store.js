// Everything the app remembers lives in one object, saved in the phone's browser
// storage (localStorage). Later stages add the taste profile and backups on top of it.

const Store = (() => {
  const KEY = "mahapaam";
  const VERSION = 1;

  function fresh() {
    return {
      version: VERSION,
      settings: {
        adult: true,      // over 18? (the age question arrives in stage 3)
        gender: "f",      // "f" | "m" | "x" — how the app talks to you (stage 3)
      },
      // bookId -> { status: "taken" | "read" | "rejected", date: ISO string,
      //            liked: false when "קראתי ולא התחברתי" }
      books: {},
      seenInstallHelp: false,
    };
  }

  let state = fresh();

  function load() {
    state = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state = { ...fresh(), ...saved, settings: { ...fresh().settings, ...saved.settings } };
      }
    } catch (err) {
      console.warn("Could not read saved data; starting fresh.", err);
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Could not save data.", err);
    }
  }

  function setBookStatus(bookId, status, extra = {}) {
    state.books[bookId] = { status, date: new Date().toISOString(), ...extra };
    save();
  }

  // Put back an exact earlier record (used by "ביטול").
  function restoreBook(bookId, record) {
    if (record) state.books[bookId] = record;
    else delete state.books[bookId];
    save();
  }

  function clearBookStatus(bookId) {
    delete state.books[bookId];
    save();
  }

  return {
    load,
    save,
    get state() { return state; },
    setBookStatus,
    clearBookStatus,
    restoreBook,
  };
})();

// Gendered text: g("בחרי", "בחר", "בחרו") picks the form that matches the setting.
function g(female, male, neutral) {
  const gender = Store.state.settings.gender;
  if (gender === "m") return male;
  if (gender === "x") return neutral ?? male;
  return female;
}
