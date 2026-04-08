// Schema initialization is now built into db.js (runs on every startup).
// This file is kept for manual re-initialization if needed.

import { Database } from "./db.js";

const db = new Database({ port: parseInt(process.env.PG_PORT || "54329") });

async function init() {
  console.log("Initializing Christopher database...");
  try {
    await db.initialize();
    console.log("Database initialized successfully!");
  } catch (err) {
    console.error("Database init failed:", err.message);
  } finally {
    await db.close();
  }
}

init();
