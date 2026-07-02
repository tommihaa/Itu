// Itu service worker — kaksi tehtävää:
//  1) Tekee sovelluksesta desktop-asennettavan (vaatii fetch-käsittelijän).
//  2) Antaa aidon offline-pelin: appishell + sanasto välimuistissa.
//
// Strategia:
//  - navigointi (HTML): network-first → offline-fallback välimuistin '/'.
//  - muut same-origin GET (assetit, sanasto, ikonit): cache-first, täydennä
//    välimuistia onnistuneilla vastauksilla. Kestää hashatut tiedostonimet.
//
// CACHE-versio bumpataan kun offline-logiikka muuttuu → vanhat puhdistetaan.
const CACHE = "itu-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigointi → network-first, offline-fallback appishelliin.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Sanasto (/dict/*) → network-first: tiedostonimi ei kanna versiota (sanasto-fi-v1.dawg
  // pysyy samana kun sanasto regeneroidaan), joten cache-first jättäisi asennetun PWA:n
  // pysyvästi vanhaan sanastoon eikä dv-haastelinkkitarkistus huomaisi eroa. Offline-fallback
  // vanhaan välimuistiin, jotta peli toimii silti ilman verkkoa.
  if (url.pathname.startsWith("/dict/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Muut resurssit → cache-first (hashatut tiedostonimet, turvallista pitää pysyvästi).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
