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
      
      if (info) {
        const d192 = info.icon192DataUrl ? String(info.icon192DataUrl) : "";
        const d512 = info.icon512DataUrl ? String(info.icon512DataUrl) : "";
        const u192 = info.icon192Url ? String(info.icon192Url) : "";
        const u512 = info.icon512Url ? String(info.icon512Url) : "";
      
        if (d192.startsWith("data:image/")) icon192 = d192;
        else if (u192) icon192 = u192;
      
        if (d512.startsWith("data:image/")) icon512 = d512;
        else if (u512) icon512 = u512;
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


/******************** PUSH: odbiór i kliknięcie ********************/

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    // payload: { title, body, icon, badge, url, tag, data }
    let payload = null;

    try {
      payload = event.data ? await event.data.json() : null;
    } catch (e) {
      try {
        payload = { body: event.data ? await event.data.text() : "" };
      } catch (e2) {
        payload = null;
      }
    }

    const title = (payload && payload.title) ? String(payload.title) : "OrgHub";
    const body  = (payload && payload.body)  ? String(payload.body)  : "Push dotarł (brak/nieczytelny payload)";

    const url = (payload && payload.url)
      ? String(payload.url)
      : (self.location.origin + "/app/");

    const options = {
      body,
      icon: (payload && payload.icon) ? String(payload.icon) : (self.location.origin + "/app/icon-192.png"),
      badge: (payload && payload.badge) ? String(payload.badge) : (self.location.origin + "/app/icon-192.png"),
      tag: (payload && payload.tag) ? String(payload.tag) : "orghub",
      data: {
        url,
        ...((payload && payload.data) ? payload.data : {})
      },
      renotify: true
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification && event.notification.data && event.notification.data.url)
    ? String(event.notification.data.url)
    : (self.location.origin + "/app/");

  event.waitUntil((async () => {
    // jeśli już jest otwarta karta z apką, to ją aktywuj
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const c of allClients) {
      if (c.url && c.url.startsWith(self.location.origin + "/app/")) {
        await c.focus();
        await c.navigate(url); // ✅ DODAJ TO
        return;
      }
    }

    // inaczej otwórz nową kartę / okno
    await clients.openWindow(url);
  })());
});
