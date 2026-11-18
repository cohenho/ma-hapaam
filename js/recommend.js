// Picks 3 books for a category: books that match your taste profile, helped by
// popularity, with a little randomness, and a mix of newer and well-known books.
// With no profile yet (you skipped the introduction), popularity leads.

const Recommend = (() => {
  const NEW_SINCE_YEARS = 8;   // "new-ish" = published in the last 8 years
  const PICK = 3;

  // Books already shown in this visit, per category, so "תציע לי אחרים" brings new ones.
  const shown = {};

  function eligible(categoryId) {
    const { books, settings } = Store.state;
    return window.BOOKS.filter((b) =>
      b.cats.includes(categoryId) &&
      !books[b.id] &&                         // not taken, read or rejected
      (settings.adult || !b.adult)            // respect the age setting
    );
  }

  function scoreBook(book, weights, hasProfile) {
    if (!hasProfile) return book.pop + Math.random() * 2;
    const match = Taste.bookFeatures(book).reduce((sum, f) => sum + (weights[f] || 0), 0);
    return match + book.pop * 0.6 + Math.random() * 1.5;
  }

  function pickMix(sorted) {
    const newSince = new Date().getFullYear() - NEW_SINCE_YEARS;
    const picks = [];
    const take = (pred) => {
      const b = sorted.find((x) => !picks.includes(x) && pred(x));
      if (b) picks.push(b);
    };
    take((b) => b.year >= newSince);          // at least one newer book
    take((b) => b.year < newSince);           // at least one well-known older book
    while (picks.length < PICK && picks.length < sorted.length) take(() => true);
    return picks.sort((a, b) => sorted.indexOf(a) - sorted.indexOf(b));
  }

  function next(categoryId, current = []) {
    const pool = eligible(categoryId);
    const seen = (shown[categoryId] ||= new Set());
    current.forEach((id) => seen.add(id));

    let fresh = pool.filter((b) => !seen.has(b.id));
    if (fresh.length < PICK) {
      // We went through everything once: start over, but keep the ones on screen out.
      seen.clear();
      current.forEach((id) => seen.add(id));
      fresh = pool.filter((b) => !seen.has(b.id));
      if (fresh.length < PICK) fresh = pool;
    }

    const profile = Store.state.profile;
    const hasProfile = !Taste.isEmpty(profile);
    const weights = hasProfile ? Taste.weights(profile) : {};
    const sorted = fresh
      .map((b) => ({ b, s: scoreBook(b, weights, hasProfile) }))
      .sort((x, y) => y.s - x.s)
      .map((x) => x.b);
    const picks = pickMix(sorted);
    picks.forEach((b) => seen.add(b.id));
    return picks;
  }

  return { next, eligible };
})();
