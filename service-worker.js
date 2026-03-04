/* service-worker.js — PWA dynamic manifest via SW (same-origin) */

const CORE = "https://still-shape-2aa3.orghubsystems.workers.dev";

const CACHE_NAME = "orghub-static-v2";
const STATIC_ASSETS = [
  "/app/",
  "/app/index.html",
  "/app/service-worker.js",
  "/app/icon-192.png",
  "/app/icon-512.png",
];

// install: cache minimalnych statyków
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// build manifest per clubId
async function buildManifestForClub_(clubId) {
  const base = self.location.origin + "/app/";
  const clean = String(clubId || "").trim();

  // fallback (zawsze dostępne)
  let icon192 = base + "icon-192.png";
  let icon512 = base + "icon-512.png";

  // jeśli backend zwraca dataUrl, użyj
  if (clean) {
    try {
      const infoUrl = CORE + "?action=pwaInfo&clubId=" + encodeURIComponent(clean);
      const res = await fetch(infoUrl, { cache: "no-store" });
      const info = await res.json();

      if (info && info.icon192DataUrl && String(info.icon192DataUrl).startsWith("data:image/")) {
        icon192 = String(info.icon192DataUrl);
      }
      if (info && info.icon512DataUrl && String(info.icon512DataUrl).startsWith("data:image/")) {
        icon512 = String(info.icon512DataUrl);
      }
    } catch (e) {
      // zostaje fallback
    }
  }

  return {
    id: "/app/?clubId=" + clean,
    name: clean ? ("OrgHub — " + clean) : "OrgHub Systems",
    short_name: clean ? clean.toUpperCase() : "OrgHub",

    start_url: clean
      ? (base + "?clubId=" + encodeURIComponent(clean) + "&source=pwa")
      : base,
    scope: base,

    display: "standalone",
    orientation: "portrait",
    background_color: "#0B1E3F",
    theme_color: "#F47B20",
    lang: "pl",
    dir: "ltr",

    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // ✅ Dynamic manifest (same-origin), łapie /app/manifest.webmanifest i inne warianty
  if (url.origin === self.location.origin && url.pathname.endsWith("/manifest.webmanifest")) {
    const clubId = url.searchParams.get("clubId") || "";
    e.respondWith((async () => {
      const manifest = await buildManifestForClub_(clubId);
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: {
          "Content-Type": "application/manifest+json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    })());
    return;
  }

  // Cache-first dla statyków z tego origin, network dla reszty
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;

      return fetch(e.request).then((resp) => {
        // cache tylko zasoby z tej samej domeny
        if (url.origin === self.location.origin && resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
