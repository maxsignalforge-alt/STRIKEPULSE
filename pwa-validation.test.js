const fs = require("fs");
const assert = require("assert");

const requiredFiles = [
  "index.html",
  "strikepulse-standalone.html",
  "manifest.json",
  "service-worker.js",
  "icons/icon-192.svg",
  "icons/icon-512.svg",
  "icons/icon-maskable.svg",
  "icons/apple-touch-icon.svg"
];

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `${file} exists`);
}

const indexHtml = fs.readFileSync("index.html", "utf8");
const standaloneHtml = fs.readFileSync("strikepulse-standalone.html", "utf8");
const appJs = fs.readFileSync("app.js", "utf8");
const configJs = fs.readFileSync("config.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");

const checks = [
  ["manifest linked", indexHtml.includes('rel="manifest" href="./manifest.json"')],
  ["theme color present", indexHtml.includes('name="theme-color" content="#0B1020"')],
  ["iOS app capable", indexHtml.includes('apple-mobile-web-app-capable')],
  ["apple touch icon linked", indexHtml.includes('rel="apple-touch-icon"')],
  ["service worker registered", appJs.includes('navigator.serviceWorker.register("./service-worker.js")')],
  ["mission first helper", appJs.includes("focusMissionBriefingFirstScreen") && appJs.includes("dailyCommandCenter")],
  ["mobile css present", indexHtml.includes("@media (max-width: 640px)") && indexHtml.includes("#dailyCommandCenter")],
  ["touch targets present", indexHtml.includes("min-height: 44px")],
  ["standalone manifest linked", standaloneHtml.includes('rel="manifest" href="./manifest.json"')],
  ["standalone service worker registration", standaloneHtml.includes('navigator.serviceWorker.register("./service-worker.js")')],
  ["manifest display standalone", manifest.display === "standalone"],
  ["manifest portrait", manifest.orientation === "portrait-primary"],
  ["manifest start url", manifest.start_url.includes("index.html")],
  ["manifest shortcut targets mission", JSON.stringify(manifest).includes("#dailyCommandCenter")],
  ["manifest icons", Array.isArray(manifest.icons) && manifest.icons.length >= 3],
  ["service worker caches app shell", serviceWorker.includes("CORE_ASSETS") && serviceWorker.includes("./index.html")],
  ["service worker navigation fallback", serviceWorker.includes('request.mode === "navigate"') && serviceWorker.includes('caches.match("./index.html")')],
  ["cloud sync remains false", configJs.includes("cloudSyncEnabled: false")]
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
