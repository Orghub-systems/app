/* service-worker.js — PWA dynamic manifest via SW (same-origin) */

const CORE = "https://still-shape-2aa3.orghubsystems.workers.dev";

// Minimalny cache statyków (możesz dopisać resztę potem)
const CACHE_NAME = "orghub-static-v1";
const STATIC_ASSETS = [
  "/app/",
  "/app/index.html",
  "/app/manifest.json",     // zostaje jako fallback
  "/app/service-worker.js",
  "/app/icon-192.png",
  "/app/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Helper: zbuduj manifest JSON (ikony jako data URL, żeby nie było 403 z Drive)
async function buildManifestForClub_(clubId) {
  const base = self.location.origin + "/app/"; // https://.../app/
  const clean = String(clubId || "").trim();

  // ✅ TWARDY FALLBACK (zawsze instalowalne ikony z GitHub Pages)
  let icon192 = base + "icon-192.png";
  let icon512 = base + "icon-512.png";

  // ✅ jeśli backend zwróci dataUrl, użyj (bez Drive 403)
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
    // ✅ osobna instalacja per klub
    id: "/?clubId=" + clean,

    name: clean ? ("OrgHub — " + clean) : "OrgHub Systems",
    short_name: clean ? clean.toUpperCase() : "OrgHub",

    // ✅ pełne, poprawne URL-e (Chrome nie marudzi)
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

    // ✅ KLUCZ: purpose = "any" (żeby Installability zniknęło)
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}
