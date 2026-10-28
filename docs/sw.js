// Bull Planner service worker. Network-first for everything same-origin
// (so a new deploy always shows up), cache as offline fallback only.
const CACHE = "bull-v9";
const SHELL = ["./", "./index.html", "./manifest.json", "./css/app.css", "./js/app.js",
  "./fonts/outfit-latin-wght-normal.woff2", "./img/bull-laptop.jpg", "./img/bull-rest.jpg",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return fetch(new Request(u, { cache: "reload" })).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\.(mp4|webm)$/.test(url.pathname)) return; // iOS plays video with byte-range requests
  e.respondWith(fetch(req, { cache: "no-cache" }).then(function (r) {
    if (r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { return c.put(req, cp); }); }
    return r;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("./index.html"); });
  }));
});
