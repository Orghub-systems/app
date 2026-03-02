import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CORE_LIST_URL = process.env.CORE_LIST_URL; // np. https://.../exec?action=publicClubs

if (!CORE_LIST_URL) {
  console.error("Missing CORE_LIST_URL env");
  process.exit(1);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeIfChanged(filePath, content) {
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (prev !== content) fs.writeFileSync(filePath, content, "utf8");
}

function safeId(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function main() {
  const res = await fetch(CORE_LIST_URL, { cache: "no-store" });
  const json = await res.json();

  if (!json || json.success !== true || !Array.isArray(json.clubs)) {
    console.error("Bad response:", json);
    process.exit(1);
  }

  const manifestsDir = path.join(ROOT, "manifests");
  const installDir = path.join(ROOT, "install");
  ensureDir(manifestsDir);
  ensureDir(installDir);

  const clubs = json.clubs
    .map((c) => ({
      clubId: safeId(c.clubId),
      name: String(c.name || c.clubId || "").trim(),
      shortName: String(c.shortName || c.name || c.clubId || "").trim(),
      themeColor: String(c.themeColor || "#F47B20").trim(),
      backgroundColor: String(c.backgroundColor || "#0B1E3F").trim(),
    }))
    .filter((c) => c.clubId);

  // Czyść stare pliki klubowe, których już nie ma na liście
  const validManifestNames = new Set(clubs.map((c) => `manifest-${c.clubId}.json`));
  for (const f of fs.readdirSync(manifestsDir)) {
    if (/^manifest-[a-z0-9_-]+\.json$/i.test(f) && !validManifestNames.has(f)) {
      fs.unlinkSync(path.join(manifestsDir, f));
    }
  }

  const validInstallNames = new Set(clubs.map((c) => `${c.clubId}.html`));
  for (const f of fs.readdirSync(installDir)) {
    if (/^[a-z0-9_-]+\.html$/i.test(f) && !validInstallNames.has(f) && f !== "index.html") {
      fs.unlinkSync(path.join(installDir, f));
    }
  }

  // Generuj per klub
  for (const c of clubs) {
    const manifest = {
      id: `orghub-${c.clubId}`,
      name: `OrgHub – ${c.name || c.clubId}`,
      short_name: c.shortName || c.clubId,
      start_url: `/#clubId=${c.clubId}`,
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: c.backgroundColor,
      theme_color: c.themeColor,
      description: `Panel klubu ${c.name || c.clubId} w systemie OrgHub.`,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
      lang: "pl",
      dir: "ltr",
    };

    const manifestPath = path.join(manifestsDir, `manifest-${c.clubId}.json`);
    writeIfChanged(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const installHtml = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Instaluj: ${escHtml(c.shortName || c.clubId)}</title>
  <link rel="manifest" href="/manifests/manifest-${c.clubId}.json">
  <meta name="theme-color" content="${escHtml(c.themeColor)}">
</head>
<body style="font-family:system-ui;padding:20px;background:${escHtml(c.backgroundColor)};color:#fff;">
  <h2>OrgHub – ${escHtml(c.name || c.clubId)}</h2>
  <p>Chrome: menu ⋮ → <b>Zainstaluj aplikację</b> (lub „Dodaj do ekranu głównego”).</p>
  <p>Po instalacji ta ikona zawsze otworzy klub <b>${escHtml(c.shortName || c.clubId)}</b>.</p>
  <hr style="opacity:.25">
  <p style="opacity:.85">Link do uruchomienia bez instalacji:<br>
    <code>https://orghub-systems.github.io/#clubId=${escHtml(c.clubId)}</code>
  </p>
</body>
</html>
`;
    const installPath = path.join(installDir, `${c.clubId}.html`);
    writeIfChanged(installPath, installHtml);
  }

  // Index instalatora z listą klubów
  const listHtml = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Instalacja klubów — OrgHub</title>
</head>
<body style="font-family:system-ui;padding:20px;">
  <h2>Instalacja klubów OrgHub</h2>
  <ul>
    ${clubs.map((c) => `<li><a href="/install/${c.clubId}.html">${escHtml(c.name || c.clubId)}</a></li>`).join("\n")}
  </ul>
</body>
</html>
`;
  writeIfChanged(path.join(installDir, "index.html"), listHtml);

  console.log(`Generated: ${clubs.length} clubs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
