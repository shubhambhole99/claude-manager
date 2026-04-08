import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CLAUDE_HOME = path.join(process.env.USERPROFILE || process.env.HOME, ".claude");
const AGENTS_DIR = path.join(CLAUDE_HOME, "agents");
const SHARED_DIR = path.join(CLAUDE_HOME, "shared");
const MODE_FILE = path.join(CLAUDE_HOME, "mode.txt");

export class MemoryManager {
  constructor(db) {
    this.db = db;
  }

  // --- Mode Management ---

  // Get list of all agents (directories in agents folder)
  getAgents() {
    try {
      if (!fs.existsSync(AGENTS_DIR)) return [];
      return fs.readdirSync(AGENTS_DIR).filter(d => {
        try { return fs.statSync(path.join(AGENTS_DIR, d)).isDirectory(); } catch { return false; }
      });
    } catch { return []; }
  }

  getMode() {
    try {
      if (fs.existsSync(MODE_FILE)) {
        const mode = fs.readFileSync(MODE_FILE, "utf-8").trim();
        if (mode) return mode;
      }
    } catch {}
    // Default to first available agent, or "default"
    const agents = this.getAgents();
    return agents.length > 0 ? agents[0] : "default";
  }

  setMode(mode) {
    fs.writeFileSync(MODE_FILE, mode);
    return mode;
  }

  // --- Shared Context (SOUL.md, USER.md, TOOLS.md, IDENTITY.md, AGENTS.md) ---

  loadFullContext() {
    const ctx = { identity: "", agents: "", soul: "", user: "", tools: "" };
    const mode = this.getMode();

    // Shared files
    for (const [key, file] of [["soul", "SOUL.md"], ["user", "USER.md"], ["tools", "TOOLS.md"]]) {
      const p = path.join(SHARED_DIR, file);
      try { if (fs.existsSync(p)) ctx[key] = fs.readFileSync(p, "utf-8"); } catch {}
    }

    // Agent-specific files
    const agentDir = path.join(AGENTS_DIR, mode);
    for (const [key, file] of [["identity", "IDENTITY.md"], ["agents", "AGENTS.md"]]) {
      const p = path.join(agentDir, file);
      try { if (fs.existsSync(p)) ctx[key] = fs.readFileSync(p, "utf-8"); } catch {}
    }

    return ctx;
  }

  // --- Memory Operations (datewise, agent-scoped) ---

  getMemoryDir(agent) {
    return path.join(AGENTS_DIR, agent || this.getMode(), "memory");
  }

  saveMemory({ name, type, content, agent, date, time }) {
    const mode = agent || this.getMode();
    const dateStr = date || new Date().toISOString().split("T")[0];
    const timeStr = time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const dir = path.join(AGENTS_DIR, mode, "memory", dateStr);
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${slug}.md`);
    const frontmatter = `---\nname: ${name}\ntype: ${type || "project"}\nagent: ${mode}\ndate: ${dateStr}\ntime: ${timeStr}\n---\n\n${content}`;
    fs.writeFileSync(filePath, frontmatter, "utf-8");

    return { filePath, agent: mode, date: dateStr, slug };
  }

  listMemories(agent, date) {
    const memDir = this.getMemoryDir(agent);
    if (!fs.existsSync(memDir)) return [];

    if (date) {
      const dateDir = path.join(memDir, date);
      if (!fs.existsSync(dateDir)) return [];
      return fs.readdirSync(dateDir).filter(f => f.endsWith(".md")).map(f => {
        const content = fs.readFileSync(path.join(dateDir, f), "utf-8");
        const meta = this._parseFrontmatter(content);
        return { file: f, date, ...meta };
      });
    }

    // List all date folders
    const dates = fs.readdirSync(memDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
    const memories = [];
    for (const d of dates) {
      const dateDir = path.join(memDir, d);
      const files = fs.readdirSync(dateDir).filter(f => f.endsWith(".md"));
      for (const f of files) {
        const content = fs.readFileSync(path.join(dateDir, f), "utf-8");
        const meta = this._parseFrontmatter(content);
        memories.push({ file: f, date: d, ...meta });
      }
    }
    return memories;
  }

  // Load recent memories for context injection (last N days, current agent + cross-agent)
  loadRecentMemories(days = 3) {
    const mode = this.getMode();
    const otherMode = mode === "coding" ? "personal" : "coding";
    const today = new Date();
    const parts = [];

    for (const agent of [mode, otherMode]) {
      const memDir = this.getMemoryDir(agent);
      if (!fs.existsSync(memDir)) continue;

      const dates = fs.readdirSync(memDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
      const recentDates = dates.slice(0, days);

      for (const d of recentDates) {
        const dateDir = path.join(memDir, d);
        const files = fs.readdirSync(dateDir).filter(f => f.endsWith(".md"));
        for (const f of files) {
          try {
            const content = fs.readFileSync(path.join(dateDir, f), "utf-8");
            const meta = this._parseFrontmatter(content);
            const body = content.replace(/^---[\s\S]*?---\n*/, "").trim();
            parts.push(`[${agent}/${d}] ${meta.name || f}: ${body.slice(0, 300)}`);
          } catch {}
        }
      }
    }

    return parts.join("\n");
  }

  // --- Daily Notes ---

  getDailyNotePath(date) {
    const mode = this.getMode();
    return path.join(AGENTS_DIR, mode, "memory", "daily", `${date}.md`);
  }

  loadDailyNote(date) {
    const filePath = this.getDailyNotePath(date);
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf-8");
    return null;
  }

  saveDailyNote(date, content) {
    const filePath = this.getDailyNotePath(date);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf-8");
  }

  appendToDailyNote(date, entry) {
    const existing = this.loadDailyNote(date);
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (existing) {
      this.saveDailyNote(date, existing.trimEnd() + `\n- ${time}: ${entry}\n`);
    } else {
      this.saveDailyNote(date, `# ${date}\n\n## Events\n- ${time}: ${entry}\n`);
    }
  }

  // --- Message Storage (local JSONL files, agent-scoped) ---

  getMessagesDir(agent) {
    return path.join(AGENTS_DIR, agent || this.getMode(), "messages");
  }

  getMessagesPath(conversationId, agent) {
    const dir = this.getMessagesDir(agent);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${conversationId}.jsonl`);
  }

  appendMessage(conversationId, role, content, agent, metadata) {
    const filePath = this.getMessagesPath(conversationId, agent);
    const line = JSON.stringify({
      role,
      content,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    }) + "\n";
    fs.appendFileSync(filePath, line, "utf-8");
  }

  getMessages(conversationId, agent) {
    // Try current agent first, then the other
    const agents = agent ? [agent] : [this.getMode(), ...this.getAgents().filter(a => a !== this.getMode())];
    for (const a of agents) {
      const filePath = path.join(AGENTS_DIR, a, "messages", `${conversationId}.jsonl`);
      if (fs.existsSync(filePath)) {
        const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
        return lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
      }
    }
    return [];
  }

  getMessagesPaginated(conversationId, { limit = 50, offset = 0, maxContentLen = 0 } = {}, agent) {
    const agents = agent ? [agent] : [this.getMode(), ...this.getAgents().filter(a => a !== this.getMode())];
    for (const a of agents) {
      const filePath = path.join(AGENTS_DIR, a, "messages", `${conversationId}.jsonl`);
      if (!fs.existsSync(filePath)) continue;

      const stat = fs.statSync(filePath);
      if (stat.size === 0) return { messages: [], total: 0, hasMore: false };

      // For files > 5MB, use tail-read: read from end to avoid loading entire file
      // We still need total line count, so count newlines in the raw buffer first
      let lines, total;
      if (stat.size > 5 * 1024 * 1024 && offset === 0) {
        // Count total newlines (fast — scan raw bytes without string conversion)
        const buf = fs.readFileSync(filePath);
        total = 0;
        for (let i = 0; i < buf.length; i++) {
          if (buf[i] === 0x0a) total++;
        }

        // Read only the tail portion — estimate bytes needed for last `limit` messages
        // Use generous estimate: read last 20% of file or 2MB min for 50 messages
        const tailBytes = Math.min(stat.size, Math.max(2 * 1024 * 1024, Math.ceil(stat.size * 0.2)));
        const tailStr = buf.toString("utf-8", stat.size - tailBytes);
        const tailLines = tailStr.split("\n").filter(Boolean);
        // First line may be partial — drop it
        if (tailBytes < stat.size) tailLines.shift();
        lines = tailLines;
      } else {
        const raw = fs.readFileSync(filePath, "utf-8");
        lines = raw.trim().split("\n").filter(Boolean);
        total = lines.length;
      }

      // offset = how many to skip from the end, limit = how many to return
      const end = Math.max(0, lines.length - offset);
      const start = Math.max(0, end - limit);
      const selected = lines.slice(start, end);

      const messages = selected.map(line => {
        try {
          const msg = JSON.parse(line);
          // Truncate large content to keep response fast
          if (maxContentLen > 0 && typeof msg.content === "string" && msg.content.length > maxContentLen) {
            msg.content = msg.content.slice(-maxContentLen);
            msg.truncated = true;
          }
          return msg;
        } catch { return null; }
      }).filter(Boolean);

      const hasMore = offset === 0 ? (total - limit > 0) : (start > 0);
      return { messages, total, hasMore };
    }
    return { messages: [], total: 0, hasMore: false };
  }

  deleteMessages(conversationId) {
    // Delete from both agents
    for (const agent of this.getAgents()) {
      const filePath = path.join(AGENTS_DIR, agent, "messages", `${conversationId}.jsonl`);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }
  }

  // --- Entity Operations (DB-backed) ---

  async loadEntity(entityId) {
    const dbResult = await this.db.query("SELECT * FROM memory_entities WHERE entity_id = $1", [entityId]);
    return dbResult.rows[0] || null;
  }

  async saveEntity(entityId, data) {
    const { type, filePath, summary, content, agent } = data;
    const mode = agent || this.getMode();

    if (filePath && content) {
      const fullPath = path.join(AGENTS_DIR, mode, "memory", filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf-8");
    }

    await this.db.query(
      `INSERT INTO memory_entities (entity_id, file_path, entity_type, summary, agent, last_updated)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (entity_id) DO UPDATE SET
         file_path = $2, entity_type = $3, summary = $4, agent = $5, last_updated = NOW()`,
      [entityId, filePath || "", type, summary || "", mode]
    );
  }

  async appendToTimeline(entityId, event) {
    const entity = await this.loadEntity(entityId);
    if (!entity?.file_path) return false;

    const mode = entity.agent || this.getMode();
    const fullPath = path.join(AGENTS_DIR, mode, "memory", entity.file_path);
    if (!fs.existsSync(fullPath)) return false;

    let content = fs.readFileSync(fullPath, "utf-8");
    const date = new Date().toISOString().split("T")[0];
    const entry = `- ${date}: ${event}`;

    if (content.includes("## Timeline")) {
      content = content.trimEnd() + "\n" + entry + "\n";
    } else {
      content = content.trimEnd() + "\n\n## Timeline\n" + entry + "\n";
    }

    fs.writeFileSync(fullPath, content, "utf-8");
    await this.db.query("UPDATE memory_entities SET last_updated = NOW() WHERE entity_id = $1", [entityId]);
    return true;
  }

  // --- Connections ---

  async addConnection(from, to, type, context) {
    await this.db.query(
      `INSERT INTO memory_connections (from_entity, to_entity, relationship_type, context) VALUES ($1, $2, $3, $4)`,
      [from, to, type, context || ""]
    );
  }

  async getConnections(entityId) {
    const result = await this.db.query(
      `SELECT * FROM memory_connections WHERE from_entity = $1 OR to_entity = $1 ORDER BY created_at DESC`,
      [entityId]
    );
    return result.rows;
  }

  // --- Context Building (for system prompt injection) ---

  async buildMemoryContext() {
    const mode = this.getMode();
    const parts = [];

    // Recent memories from current + other agent
    const recent = this.loadRecentMemories(3);
    if (recent) parts.push("Recent Memories:\n" + recent);

    // Key entities from DB
    try {
      const entities = await this.db.query(
        "SELECT entity_id, entity_type, summary, agent FROM memory_entities ORDER BY last_updated DESC LIMIT 10"
      );
      if (entities.rows.length > 0) {
        parts.push("Known Entities:\n" + entities.rows.map(e =>
          `- [${e.agent}] ${e.entity_id} (${e.entity_type}): ${e.summary || ""}`
        ).join("\n"));
      }
    } catch {}

    return parts.join("\n\n");
  }

  // --- Sync: Agent memory files → Database ---

  async syncFromFiles() {
    let synced = 0;
    for (const agent of this.getAgents()) {
      const memDir = this.getMemoryDir(agent);
      if (!fs.existsSync(memDir)) continue;

      const dates = fs.readdirSync(memDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
      for (const date of dates) {
        const dateDir = path.join(memDir, date);
        const files = fs.readdirSync(dateDir).filter(f => f.endsWith(".md"));
        for (const f of files) {
          try {
            const content = fs.readFileSync(path.join(dateDir, f), "utf-8");
            const meta = this._parseFrontmatter(content);
            const entityId = `${agent}/${date}/${f.replace(".md", "")}`;
            const body = content.replace(/^---[\s\S]*?---\n*/, "").trim();

            await this.db.query(
              `INSERT INTO memory_entities (entity_id, file_path, entity_type, summary, agent, last_updated)
               VALUES ($1, $2, $3, $4, $5, NOW())
               ON CONFLICT (entity_id) DO UPDATE SET
                 file_path = $2, entity_type = $3, summary = $4, agent = $5, last_updated = NOW()`,
              [entityId, `${date}/${f}`, meta.type || "project", (meta.name || f) + ": " + body.slice(0, 200), agent]
            );
            synced++;
          } catch {}
        }
      }
    }
    if (synced > 0) console.log(`[Memory] Synced ${synced} entities from agent files to DB`);
    return synced;
  }

  // --- CLI Memory Loading (legacy project memories) ---

  loadCliMemories() {
    const projectsDir = path.join(CLAUDE_HOME, "projects");
    let memoryContext = "";
    try {
      if (!fs.existsSync(projectsDir)) return "";
      const projects = fs.readdirSync(projectsDir);
      for (const proj of projects) {
        const memDir = path.join(projectsDir, proj, "memory");
        if (!fs.existsSync(memDir)) continue;
        const mdFiles = fs.readdirSync(memDir).filter(f => f.endsWith(".md") && f !== "MEMORY.md");
        for (const mdFile of mdFiles) {
          try {
            const content = fs.readFileSync(path.join(memDir, mdFile), "utf-8").trim();
            if (content) memoryContext += `\n[CLI/${proj}] ${mdFile}: ${content.slice(0, 300)}\n`;
          } catch {}
        }
      }
    } catch {}
    return memoryContext;
  }

  // --- Private ---

  _parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const meta = {};
    for (const line of match[1].split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
    return meta;
  }
}
