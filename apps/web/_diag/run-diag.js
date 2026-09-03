// Headless Edge diagnostic: loads /map, captures console, errors, layer state, and screenshot
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outDir = path.join(__dirname, "_diag");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Write the diagnostic page that loads map in an iframe? No - use direct CDP via edge headless + dump
// Simpler: use Edge headless with --dump-dom and --virtual-time-budget, plus screenshot
const url = "http://localhost:3000/map";

const args = [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--window-size=1500,950",
  "--virtual-time-budget=20000",
  `--screenshot=${path.join(outDir, "map.png")}`,
  "--enable-logging",
  "--v=0",
  url,
];

console.log("Launching headless Edge...");
try {
  execFileSync(edge, args, { timeout: 60000, stdio: "inherit" });
  console.log("Screenshot saved to", path.join(outDir, "map.png"));
} catch (e) {
  console.error("Edge failed:", e.message);
}
