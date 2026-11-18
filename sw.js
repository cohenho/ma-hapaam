// Lets the app open without internet (e.g. in the library basement).
// App files: try the network first so updates arrive, fall back to the saved copy.
// Covers and fonts: use the saved copy first, they never change.

const VERSION = "v13";
const APP_CACHE = `app-${VERSION}`;
const EXTRA_CACHE = "covers-fonts";

const APP_FILES = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/store.js", "js/taste.js", "js/recommend.js", "js/shelf.js", "js/install.js", "js/voice.js", "js/onboarding.js", "js/rating.js", "js/me.js", "js/backup.js", "js/cloud.js", "js/scan.js", "js/app.js",
  "js/config.js", "data/categories.js", "data/books.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith("app-") && k !== APP_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname.endsWith("supabase.co")) return; // live data, never cached

  if (url.origin === location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || caches.match("index.html"))));
    return;
  }

  const isExtra = /covers\.openlibrary\.org|archive\.org|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (isExtra) {
    event.respondWith(
      caches.open(EXTRA_CACHE).then((c) => c.match(req).then((hit) => hit ||
        fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") c.put(req, res.clone());
          return res;
        }))));
  }
});
