import pkg from "node-edge-tts";
const { EdgeTTS } = pkg;
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuid } from "uuid";

export class TTSService {
  constructor() {
    this.voice = "en-US-GuyNeural";
    this.tmpDir = path.join(os.tmpdir(), "christopher-tts");
    fs.mkdirSync(this.tmpDir, { recursive: true });
  }

  async synthesize(text) {
    const cleanText = this.cleanForSpeech(text);
    if (!cleanText.trim()) {
      throw new Error("No speakable text");
    }

    const outputFile = path.join(this.tmpDir, `${uuid()}.mp3`);

    const tts = new EdgeTTS({
      voice: this.voice,
      lang: "en-US",
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
    });

    await tts.ttsPromise(cleanText, outputFile);

    const buffer = fs.readFileSync(outputFile);
    try { fs.unlinkSync(outputFile); } catch {}
    return buffer;
  }

  cleanForSpeech(text) {
    return text
      .replace(/```[\s\S]*?```/g, "... code block omitted ...")
      .replace(/`[^`]+`/g, (match) => match.slice(1, -1))
      .replace(/^#{1,6}\s/gm, "")
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[\s]*[-*+]\s/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  setVoice(voice) {
    this.voice = voice;
  }
}
