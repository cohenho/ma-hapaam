// הקטגוריות במסך הפתיחה.
// כדי להוסיף קטגוריה: מעתיקים שורה, משנים את id (באנגלית, בלי רווחים), את השם, האייקון והתיאור,
// ומוסיפים את ה-id הזה לשדה "cats" של הספרים המתאימים ב-tools/books_source.json.
// adultOnly: true = הקטגוריה מוצגת רק למי שמעל גיל 18.

window.CATEGORIES = [
  { id: "light",    name: "קליל",           icon: "☕", desc: "רומן קל וזורם, בלי מאמץ" },
  { id: "trendy",   name: "טרנדי",          icon: "✨", desc: "מה שכולם קוראים" },
  { id: "thriller", name: "מותחן",          icon: "🔍", desc: "לא תצליחו להניח" },
  { id: "horror",   name: "אימה",           icon: "🕯️", desc: "רק לא לפני השינה" },
  { id: "ya",       name: "נוער",           icon: "🎒", desc: "לבני נוער, וגם למי שמרגיש כזה" },
  { id: "classic",  name: "קלאסיקה",        icon: "🏛️", desc: "ספרים לקרוא פעם בחיים" },
  { id: "romance",  name: "רומנטי/אירוטי",  icon: "🌹", desc: "אהבה, תשוקה ולב", adultOnly: true },
];
