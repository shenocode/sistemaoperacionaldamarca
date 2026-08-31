import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const DURATION = 17.998313;
const FRAMES = Math.round(DURATION * FPS);
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const html = path.join(__dirname, "composition.html");
const audio = path.join(__dirname, "audio", "LOC0.mp3");
const framesDir = path.join(__dirname, "frames");
const outDir = path.join(__dirname, "out");
const outFile = path.join(outDir, "SOM_LOC0.mp4");

await mkdir(framesDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--allow-file-access-from-files",
    "--disable-web-security",
    "--hide-scrollbars",
    `--window-size=${WIDTH},${HEIGHT}`,
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
await page.goto(`file://${html}?render=1`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForSelector("#stage");

console.log(`Capturing ${FRAMES} frames at ${FPS} fps…`);
const t0 = Date.now();

for (let i = 0; i < FRAMES; i++) {
  const t = Math.min((i + 0.5) / FPS, DURATION);
  await page.evaluate((time) => window.__setTime(time), t);
  const file = path.join(framesDir, `frame_${String(i).padStart(4, "0")}.png`);
  await page.screenshot({
    path: file,
    type: "png",
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
  if (i % 30 === 0 || i === FRAMES - 1) {
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ${i + 1}/${FRAMES} (${sec}s)`);
  }
}

await browser.close();

console.log("Encoding MP4…");

const ffmpeg = spawn(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    path.join(framesDir, "frame_%04d.png"),
    "-i",
    audio,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "17",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-shortest",
    "-movflags",
    "+faststart",
    "-t",
    DURATION.toFixed(6),
    outFile,
  ],
  { stdio: "inherit" },
);

const code = await new Promise((resolve, reject) => {
  ffmpeg.on("error", reject);
  ffmpeg.on("close", resolve);
});

if (code !== 0) {
  process.exit(code ?? 1);
}

await rm(framesDir, { recursive: true, force: true });
console.log(`Done: ${outFile}`);
