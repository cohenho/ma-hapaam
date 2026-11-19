// Everything the app remembers lives in one object, saved in the phone's browser
// storage (localStorage). Later stages add the taste profile and backups on top of it.

// "סטיבן לויצקי ודניאל זיבלט" → ["סטיבן לויצקי", "דניאל זיבלט"]. The "ו" counts as "and"
// only between two full names, so surnames like "ויילד", "וונגוט" or "ווטרס" stay whole.
function splitAuthors(author) {
  const names = [];
  let rest = author.replace(/\s+ואחרים$/, "");
  for (;;) {
    const m = rest.match(/^(\S+(?:\s+\S+)+?)\s+ו(?!ו)(\S+\s+\S.*)$/);
    if (!m) break;
    names.push(m[1]);
    rest = m[2];
  }
  names.push(rest);
  return names;
}

const Store = (() => {
  const KEY = "mahapaam";
  const VERSION = 1;

  function fresh() {
    return {
      version: VERSION,
      createdAt: new Date().toISOString(), // when you started using the app
      settings: {
        adult: true,      // over 18?
        gender: "f",      // "f" | "m" | "x" — how the app talks to you
        hiddenCats: [],   // drawers you chose to hide from the catalogue
        name: "",         // optional; shown to the librarian with your choices
      },
      // bookId -> { status: "taken" | "read" | "rejected", date: ISO string,
      //            liked: false when "קראתי ולא התחברתי" }
      books: {},
      seenInstallHelp: false,
      micExplained: false, // we explained why the microphone is needed
      onboarded: false,   // finished (or skipped) the first-time introduction
      // what the app knows about your taste (see js/taste.js)
      profile: { text: "", likes: [], dislikes: [], books: [], authors: [], learned: {}, updatedAt: null },
    };
  }

  let state = fresh();

  // Fill in anything missing (older saves and backups lack newer fields).
  function complete(saved) {
    return {
      ...fresh(),
      ...saved,
      settings: { ...fresh().settings, ...saved.settings },
      profile: { ...fresh().profile, ...saved.profile },
    };
  }

  function load() {
    state = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = complete(JSON.parse(raw));
    } catch (err) {
      console.warn("Could not read saved data; starting fresh.", err);
    }
    return state;
  }

  // Restore from a backup: everything here is replaced.
  function replaceAll(saved) {
    state = complete(saved);
    save();
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
    replaceAll,
  };
})();

// Gendered text: g("בחרי", "בחר", "בחרו") picks the form that matches the setting.
function g(female, male, neutral) {
  const gender = Store.state.settings.gender;
  if (gender === "m") return male;
  if (gender === "x") return neutral ?? male;
  return female;
}
