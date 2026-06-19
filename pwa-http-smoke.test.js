const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const targets = [
  "/index.html",
  "/strikepulse-standalone.html",
  "/manifest.json",
  "/service-worker.js",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg",
  "/icons/apple-touch-icon.svg"
];

const contentTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/manifest+json",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const pathname = req.url === "/" ? "/index.html" : new URL(req.url, "http://localhost").pathname;
  const file = path.join(root, pathname.replace(/^\/+/, ""));
  fs.readFile(file, (error, body) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("missing");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  });
});

function request(port, target) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: target }, response => {
      response.resume();
      response.on("end", () => resolve({ target, status: response.statusCode }));
    }).on("error", reject);
  });
}

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  try {
    const results = await Promise.all(targets.map(target => request(port, target)));
    let failed = false;
    for (const result of results) {
      const ok = result.status === 200;
      console.log(`${ok ? "PASS" : "FAIL"} ${result.target} ${result.status}`);
      if (!ok) failed = true;
    }
    server.close(() => process.exit(failed ? 1 : 0));
  } catch (error) {
    console.error(error.message);
    server.close(() => process.exit(1));
  }
});
