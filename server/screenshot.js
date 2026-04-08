import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PS_SCRIPT = path.join(__dirname, "screen-capture.ps1");

function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    execFile("powershell", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS_SCRIPT, ...args,
    ], { timeout: 10000, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

export class ScreenshotService {
  constructor() {
    this.tmpDir = path.join(os.tmpdir(), "christopher-screenshots");
    fs.mkdirSync(this.tmpDir, { recursive: true });
    this._displayCache = null;
    this._displayCacheTime = 0;
  }

  async listDisplays() {
    if (this._displayCache && Date.now() - this._displayCacheTime < 30000) {
      return this._displayCache;
    }
    try {
      const result = await runPowerShell(["-Action", "list"]);
      const displays = JSON.parse(result);
      this._displayCache = Array.isArray(displays) ? displays : [displays];
      this._displayCacheTime = Date.now();
      return this._displayCache;
    } catch (err) {
      console.error("[Screenshot] Failed to list displays:", err.message);
      return [{ id: 0, name: "Primary Display", nativeWidth: 1920, nativeHeight: 1080, logicalWidth: 1920, logicalHeight: 1080, primary: true }];
    }
  }

  async capture(displayIndex) {
    try {
      const b64 = await runPowerShell(["-Action", "capture", "-DisplayIndex", String(displayIndex), "-Quality", "80"]);
      return { displayId: displayIndex, image: b64, format: "jpeg", timestamp: Date.now() };
    } catch (err) {
      throw new Error(`Failed to capture display ${displayIndex}: ${err.message}`);
    }
  }

  async captureAll() {
    const displays = await this.listDisplays();
    const results = [];
    for (let i = 0; i < displays.length; i++) {
      try {
        const result = await this.capture(i);
        result.name = displays[i].name || `Display ${i}`;
        results.push(result);
      } catch (err) {
        console.error(`[Screenshot] Failed display ${i}:`, err.message);
      }
    }
    if (results.length === 0) {
      const result = await this.capture(0);
      result.name = "Primary Display";
      results.push(result);
    }
    return results;
  }

  async captureJpeg(displayIndex, quality = 50, resizeW = 0, resizeH = 0) {
    const args = ["-Action", "capture", "-DisplayIndex", String(displayIndex), "-Quality", String(quality)];
    if (resizeW > 0 && resizeH > 0) {
      args.push("-ResizeW", String(resizeW), "-ResizeH", String(resizeH));
    }
    try {
      return await runPowerShell(args);
    } catch (err) {
      return await runPowerShell(["-Action", "capture", "-DisplayIndex", "0", "-Quality", String(quality)]);
    }
  }
}
