// Standalone Next.js dev server — programmatic API, no child spawn.
// Works around Windows sandbox EPERM on child_process spawn (piped stdio).
const path = require("path");
const http = require("http");

const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = true;

async function main() {
  const app = next({ dev, dir: __dirname });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http
    .createServer((req, res) => {
      handle(req, res).catch((err) => {
        console.error("[request error]", err);
        res.statusCode = 500;
        res.end("internal error");
      });
    })
    .on("error", (err) => {
      console.error("[server error]", err);
      process.exit(1);
    });
  server.listen({ port, host: "127.0.0.1" }, () => {
    console.log(`> Next dev ready on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
