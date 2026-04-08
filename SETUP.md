# Chrospher — Initial Setup

Everything needed to set up Chrospher (Christopher) on a new machine from scratch. This guide covers every dependency, every MCP server, every gotcha, and every place you'll get stuck.

---

## Quick Start (Automated)

Run the setup script and it handles everything:

```
initial-setup.bat
```

This installs all prerequisites, MCP servers, registers them with Claude Code, and sets up Chrome debugging. See below for what it does and manual steps if something fails.

---

## Prerequisites

| Tool | What for | Install | Verify |
|------|----------|---------|--------|
| **Node.js 20+** | Chrospher server, npx for MCP servers | https://nodejs.org/ or `winget install OpenJS.NodeJS.LTS` | `node --version` |
| **Python 3.13+** | Windows MCP, uv package manager | https://python.org/ or `winget install Python.Python.3.13` | `python --version` |
| **Git** | Cloning PPT MCP source | https://git-scm.com/ or `winget install Git.Git` | `git --version` |
| **.NET 10 SDK** | Excel & PPT MCP servers | https://dotnet.microsoft.com/download or `winget install Microsoft.DotNet.SDK.10` | `dotnet --version` |
| **Claude Code CLI** | AI agent CLI | `npm install -g @anthropic-ai/claude-code` | `claude --version` |
| **Google Drive** | Cross-PC sync for .claude directory | https://www.google.com/drive/download/ | Check `H:\My Drive` exists |

### Where you'll get stuck — Prerequisites

- **winget not found**: Install "App Installer" from Microsoft Store first.
- **Node.js installed but `npm` not found**: Close and reopen your terminal after installing Node.js. The PATH update needs a new shell.
- **Python installs but `python` not in PATH**: During Python install, CHECK the "Add to PATH" checkbox. If you missed it, reinstall or manually add `C:\Users\<YOU>\AppData\Local\Programs\Python\Python313\` to PATH.
- **.NET SDK installed but `dotnet` not found**: Same — close and reopen terminal. Or restart the computer.
- **Multiple Python versions**: `python` might point to Python 3.11. Use `python3` or `py -3.13` instead. Check with `python --version`.

---

## 1. Chrospher Server

### Install & Run

```bash
cd "C:\Users\<YOU>\Desktop\Github\26.React + Claude (Final)\23-03-2026(Current Use)"
npm install
npm start
```

Opens on http://localhost:3000

### Environment (.env)

```
PORT=3000
DATABASE_URL=postgresql://postgres.hpwevylzzjfzafuerbhr:<PASSWORD>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

If `DATABASE_URL` is set, Chrospher connects to Supabase (cloud). If not, it falls back to embedded PostgreSQL.

### Where you'll get stuck — Chrospher Server

- **`npm install` fails with node-gyp errors**: You need Visual Studio Build Tools. Run: `npm install -g windows-build-tools` or install "Desktop development with C++" workload from Visual Studio Installer.
- **`npm install` fails with EACCES/EPERM**: Don't run from Google Drive (`H:\`). Copy to a local path first, or close Google Drive app during install.
- **Port 3000 already in use**: Kill the existing process: `npx kill-port 3000` or change PORT in `.env`.
- **`node-pty` build fails**: Requires Python and VS Build Tools. Make sure both are in PATH.

---

## 2. MCP Servers

MCP (Model Context Protocol) servers let Claude Code control desktop apps, browsers, and system tools. The config lives in `~/.claude/settings.json` but the servers themselves must be **installed separately** on each machine.

> **IMPORTANT:** `settings.json` only stores command names (e.g., `mcp-excel`). If the command is not installed on your machine, Claude Code will **silently fail** to connect — no error shown. You won't know it's broken until you try to use the tool.

### Global settings.json

Located at `C:\Users\<YOU>\.claude\settings.json`:

```json
{
  "cleanupPeriodDays": 999999,
  "skipDangerousModePermissionPrompt": true,
  "mcpServers": {
    "chrome-devtools-mcp": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--autoConnect"]
    },
    "excel-mcp": {
      "command": "mcp-excel",
      "args": []
    },
    "ppt-mcp": {
      "command": "mcp-ppt",
      "args": []
    },
    "windows-mcp": {
      "command": "uvx",
      "args": ["windows-mcp"]
    }
  }
}
```

### Config -> Command -> Package mapping

```
Config name          Command            Source package                    Install method
-----------          -------            ---------------                  --------------
chrome-devtools-mcp  npx ...            chrome-devtools-mcp              npm (auto via npx)
excel-mcp            mcp-excel          sbroenne.excelmcp.mcpserver      dotnet tool (NuGet)
ppt-mcp              mcp-ppt            pptmcp.mcpserver                 dotnet tool (local build)
windows-mcp          uvx windows-mcp    windows-mcp                      pip/uvx (auto)
```

The **command name is NOT the package name**. Without installing the package, the command does not exist and Claude Code cannot start the server.

---

### 2.1 chrome-devtools-mcp (Browser — Your Real Chrome)

Controls your actual running Chrome browser — sees all your open tabs, logins, cookies, sessions. By Google's Chrome DevTools team.

- **Config name:** `chrome-devtools-mcp`
- **Command:** `npx chrome-devtools-mcp@latest --autoConnect`
- **Source:** https://github.com/ChromeDevTools/chrome-devtools-mcp
- **Type:** Node.js package (auto-installed via npx)
- **Requires:** Node.js, Chrome 144+

**Install:** No manual install needed — `npx` downloads it on first run.

**Setup — Chrome must have remote debugging enabled:**

**Modify the Chrome shortcut (one-time, permanent fix):**

Chrome 146+ requires BOTH `--remote-debugging-port=9222` AND `--user-data-dir` flags.
Without `--user-data-dir`, Chrome silently ignores the debug port.

1. Right-click your Chrome shortcut (Start Menu or Desktop) -> Properties
2. Set **Target** to:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\<YOU>\AppData\Local\Google\Chrome\User Data"
   ```
3. Replace `<YOU>` with your Windows username

Or run this PowerShell (updates Start Menu shortcut):
```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Google Chrome.lnk")
$s.Arguments = "--remote-debugging-port=9222 --user-data-dir=`"$env:LOCALAPPDATA\Google\Chrome\User Data`""
$s.Save()
```

This uses your **default profile** — all logins, cookies, tabs restored. Every Chrome launch now has debugging enabled automatically.

> **If your username has parentheses** (e.g., `Shubham(Code)`): Chrome won't write the
> `DevToolsActivePort` file. After Chrome starts, run this PowerShell to create it manually:
> ```powershell
> $r = (Invoke-WebRequest -Uri "http://127.0.0.1:9222/json/version" -UseBasicParsing).Content | ConvertFrom-Json
> $id = $r.webSocketDebuggerUrl -replace ".*browser/", ""
> Set-Content "$env:LOCALAPPDATA\Google\Chrome\User Data\DevToolsActivePort" "9222`n/devtools/browser/$id" -NoNewline
> ```

> **IMPORTANT:** `chrome://inspect/#remote-debugging` alone is NOT enough for Chrome 146+.

**What it can do:**
- List/switch/open/close tabs
- Click, type, scroll on any page
- Take screenshots and DOM snapshots
- Read console logs and network requests
- Run Lighthouse audits
- Performance profiling

**Where you'll get stuck — Chrome DevTools MCP:**
- **Chrome debug port not opening**: You MUST close ALL Chrome windows first, then relaunch from the modified shortcut. The `--remote-debugging-port` flag only works on the first Chrome process.
- **MCP says "failed" or no tools show up**: Chrome wasn't ready when Claude Code started. Fix: start Chrome with debugging first, THEN start Claude Code.
- **Username with parentheses**: Chrome won't create `DevToolsActivePort` file. Run the PowerShell snippet above after every Chrome launch.
- **Memory leak (~13 MB/min)**: Fixed in v0.20.3 (March 2026). Using `@latest` in npx gets the fix.
- **`npx` hangs or takes forever**: First run downloads the package. Give it 30-60 seconds. If it keeps hanging, clear npm cache: `npm cache clean --force`.

**Verify:**
```bash
# Check Chrome CDP is active
curl -s http://127.0.0.1:9222/json/version

# Check MCP is connected in Claude Code
claude mcp list
```

---

### 2.2 excel-mcp (Live COM — Microsoft Excel)

Controls a real running Excel instance via COM interop. You can see changes live.

- **Config name:** `excel-mcp`
- **Command:** `mcp-excel`
- **Source:** https://github.com/sbroenne/mcp-server-excel
- **Package:** `sbroenne.excelmcp.mcpserver` (NuGet)
- **Type:** .NET global tool
- **Requires:** .NET 10 SDK, Microsoft Excel 2016+ desktop

**Install (one command):**
```
dotnet tool install -g sbroenne.excelmcp.mcpserver
```

**Verify:**
```
dotnet tool list -g
```
Should show: `sbroenne.excelmcp.mcpserver` -> command `mcp-excel`

**Where you'll get stuck — Excel MCP:**
- **"command not found" for `mcp-excel`**: The .NET tools path (`~/.dotnet/tools`) is not in PATH. Fix: add `C:\Users\<YOU>\.dotnet\tools` to your system PATH, or register with full path in Claude Code.
- **Excel must be running**: The MCP connects via COM to a running Excel instance. Open Excel first.
- **File must be open in Excel**: Some operations need the target file already open.
- **"Access denied" or COM errors**: Don't run Claude Code as admin if Excel is running as normal user (or vice versa). Both must run at the same privilege level.

---

### 2.3 ppt-mcp (Live COM — Microsoft PowerPoint)

Controls a real running PowerPoint instance via COM interop. 33 tools, 204 operations.

- **Config name:** `ppt-mcp`
- **Command:** `mcp-ppt`
- **Source:** https://github.com/trsdn/mcp-server-ppt
- **Package:** `pptmcp.mcpserver` (NOT on NuGet — build from source)
- **Type:** .NET global tool
- **Requires:** .NET 10 SDK, Microsoft PowerPoint 2016+ desktop

**Why build from source?**
As of March 2026, this package is NOT published to NuGet. The only way to install is to clone, build, pack, and install locally. Check NuGet first: `dotnet tool search PptMcp`

**Install (5 steps):**

> **IMPORTANT:** Do NOT clone into a path containing parentheses (e.g., `%LOCALAPPDATA%`
> if your username is `Shubham(Code)`). MSBuild URL-encodes parentheses, breaking build
> task resolution. Use a clean root path like `C:\mcp-server-ppt`.

```bash
# Step 1: Clone to a CLEAN path (no parentheses/spaces)
git clone https://github.com/trsdn/mcp-server-ppt.git C:\mcp-server-ppt

# Step 2: Fix .NET version (repo targets .NET 9, we need .NET 10)
cd C:\mcp-server-ppt
# Edit global.json: change "9.0.311" to your version (run: dotnet --version)
# Edit Directory.Build.props: change LangVersion from 13 to 14
# Edit ALL .csproj files in src/ and tests/: change "net9.0" to "net10.0"
# Edit Directory.Packages.props: change Microsoft.Extensions.* from 9.0.x to 10.0.0

# Step 3: Build
dotnet build -c Release

# Step 4: Pack into .nupkg
cd src\PptMcp.McpServer
dotnet pack -c Release

# Step 5: Install as global tool (MUST specify version to avoid NuGet.org's .NET 9 build)
dotnet tool install --global --add-source bin\Release PptMcp.McpServer --version 0.1.0
```

**Build WILL FAIL without the .NET 10 fixes in Step 2.**
The repo targets .NET 9. With .NET 10 installed, you MUST update:
- `global.json` — change SDK version to your installed version (`dotnet --version`)
- `Directory.Build.props` — change `LangVersion` from 13 to 14
- ALL `.csproj` files in `src/` and `tests/` — change `net9.0-windows` to `net10.0-windows` and `net9.0` to `net10.0`
- `Directory.Packages.props` — update `Microsoft.Extensions.Hosting/Logging/Configuration/DependencyInjection/ObjectPool/Resilience` to 10.0.0

> **Why `--version 0.1.0`?** NuGet.org already has PptMcp.McpServer v1.0.3 (built for
> .NET 9). Without pinning the version, `dotnet tool install` grabs v1.0.3 from NuGet
> instead of your local .NET 10 build — and it crashes with "framework not found".

**Where you'll get stuck — PPT MCP:**
- **MSB4062 "cannot find assembly"**: You cloned into a path with parentheses. Delete and re-clone to `C:\mcp-server-ppt`.
- **Build fails with "net9.0 not found"**: You didn't apply the .NET 10 fixes in Step 2. ALL files listed must be updated.
- **`dotnet tool install` grabs v1.0.3 instead of local build**: You forgot `--version 0.1.0`. NuGet.org has v1.0.3 for .NET 9. Uninstall with `dotnet tool uninstall -g PptMcp.McpServer` and reinstall with `--version 0.1.0`.
- **MSBuild node reuse locks .dll during rebuild**: Kill MSBuild: `Stop-Process -Name dotnet -Force` or build with `-nodeReuse:false`.
- **PowerPoint files must be CLOSED**: COM needs exclusive access. Close the file in PowerPoint before opening via MCP.

**Verify:**
```
dotnet tool list -g
```
Should show: `pptmcp.mcpserver` -> command `mcp-ppt`

---

### 2.4 windows-mcp (Windows System Automation)

General Windows automation — file system, processes, clipboard, system info.

- **Config name:** `windows-mcp`
- **Command:** `uvx windows-mcp`
- **Source:** https://pypi.org/project/windows-mcp/
- **Type:** Python package (auto-installed via uvx)
- **Requires:** Python 3.13+, `uv` package manager

**Install:**
```
python -m pip install uv
```
After that, `uvx windows-mcp` auto-downloads and runs on first use.

**Where you'll get stuck — Windows MCP:**
- **`uvx` not found**: `uv` didn't install properly. Try: `pip install uv` (without `python -m`). Or check if Python Scripts folder is in PATH.
- **`python -m pip` not found**: Python installed without pip. Reinstall Python and check "pip" in the installer.

**Verify:**
```bash
uvx windows-mcp --help
```

---

### 2.5 trading-dashboard (Custom — Trading Tools)

Custom Python MCP server for trading dashboard.

- **Config name:** `trading-dashboard`
- **Command:** Python venv script
- **Source:** `C:\Users\<YOU>\Desktop\Trading\Test 1\BE\mcp_server.py`
- **Requires:** Trading project with Python venv set up

**Install:**
```bash
cd "C:\Users\<YOU>\Desktop\Trading\Test 1\BE"
python -m venv venv
venv\Scripts\pip install -r requirements.txt
```

**Config in settings.json:**
```json
"trading-dashboard": {
  "command": "C:\\Users\\<YOU>\\Desktop\\Trading\\Test 1\\BE\\venv\\Scripts\\python.exe",
  "args": ["C:\\Users\\<YOU>\\Desktop\\Trading\\Test 1\\BE\\mcp_server.py"]
}
```

---

### 2.6 Optional MCP Servers (Available to Add)

These can be added via Chrospher's Connectors panel (Settings > Connectors > + Add) or via CLI:

| Server | Command | What it does |
|--------|---------|-------------|
| **playwright-mcp** | `npx -y @playwright/mcp@latest` | Browser automation via Playwright (snapshot + vision modes) |
| **filesystem-mcp** | `npx -y @modelcontextprotocol/server-filesystem <path>` | File system access for Claude Desktop chat |
| **memory-mcp** | `npx -y @modelcontextprotocol/server-memory` | Persistent memory via knowledge graph |

**Add via CLI:**
```bash
claude mcp add playwright-mcp -- npx -y @playwright/mcp@latest
claude mcp add filesystem-mcp -- npx -y @modelcontextprotocol/server-filesystem C:\Users\<YOU>
claude mcp add memory-mcp -- npx -y @modelcontextprotocol/server-memory
```

---

## 3. Registering MCP Servers with Claude Code

Installing MCP server binaries is NOT enough. Claude Code must know about them.

### CRITICAL: Two Config Files — Don't Mix Them Up

Claude Code has TWO config files. They look similar but serve DIFFERENT purposes:

| File | Purpose | MCP servers? |
|------|---------|-------------|
| **`~/.claude.json`** | MCP server registrations, user preferences | **YES — this is where MCPs go** |
| **`~/.claude/settings.json`** | Hooks, cleanup settings, permissions | **NO — MCPs here are IGNORED** |

**The #1 mistake:** Putting `mcpServers` in `~/.claude/settings.json`. Claude Code will NOT load them. They MUST be in `~/.claude.json`. The `settings.json` `mcpServers` key exists but is only used by Christopher's server, not by Claude Code itself.

### Register via CLI (recommended)

```bash
claude mcp add --scope user chrome-devtools-mcp -- npx -y chrome-devtools-mcp@latest --autoConnect
claude mcp add --scope user excel-mcp -- mcp-excel
claude mcp add --scope user ppt-mcp -- mcp-ppt
claude mcp add --scope user windows-mcp -- uvx windows-mcp
```

This writes to `~/.claude.json` automatically.

### Verify registration

```bash
# Check what's registered
cat ~/.claude.json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));Object.keys(d.mcpServers||{}).forEach(k=>console.log(k))"

# Check what Claude Code sees (must restart after registering)
claude mcp list
```

All servers should show green checkmarks. If they show as "failed", Chrome/Excel/PowerPoint may not be running.

### Where you'll get stuck — MCP Registration:
- **MCPs in `settings.json` but not loading**: WRONG FILE. Move them to `~/.claude.json` via `claude mcp add`. This was our biggest debugging headache — wasted hours.
- **Servers installed but not in `claude mcp list`**: Not registered. Run `claude mcp add` commands above.
- **MCP tools not appearing in conversation**: MCP servers connect at Claude Code startup ONLY. Restart Claude Code after registering.
- **"command not found"**: Package not installed. Check with `dotnet tool list -g`, `npm list -g`, or `which <command>`.
- **Chrome DevTools MCP "failed"**: Chrome must be running with `--remote-debugging-port=9222` BEFORE starting Claude Code.

### What `~/.claude.json` should look like

```json
{
  "mcpServers": {
    "chrome-devtools-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--autoConnect"]
    },
    "excel-mcp": {
      "type": "stdio",
      "command": "mcp-excel",
      "args": []
    },
    "ppt-mcp": {
      "type": "stdio",
      "command": "mcp-ppt",
      "args": []
    },
    "windows-mcp": {
      "type": "stdio",
      "command": "uvx",
      "args": ["windows-mcp"]
    }
  }
}
```

### What `~/.claude/settings.json` is for (NOT MCPs)

```json
{
  "cleanupPeriodDays": 999999,
  "skipDangerousModePermissionPrompt": true,
  "hooks": {
    "SessionStart": [...],
    "Stop": [...]
  }
}
```

---

## 4. The `.claude` Directory Structure

The `~/.claude/` directory is the brain of the system. Everything lives here.

```
~/.claude/                              ← THE GLOBAL .claude DIRECTORY
│
├── .claude.json                        ← NOT inside .claude/ — lives at ~/.claude.json
│                                         MCP server registrations (Chrome, Excel, PPT, Windows)
│                                         Claude Code reads MCPs from HERE, not settings.json
│
├── settings.json                       ← Hooks, cleanup settings, permissions
│                                         Does NOT load MCP servers (common mistake)
│
├── settings.local.json                 ← Permission allowlist for commands
│
├── mode.txt                            ← Current agent mode: "coding" or "personal"
│
├── agents/                             ← MULTI-AGENT SYSTEM
│   ├── coding/                         ← Coding agent (active when mode.txt = "coding")
│   │   ├── IDENTITY.md                 ← Agent identity, role, capabilities
│   │   ├── AGENTS.md                   ← Behavior rules, memory standards
│   │   ├── HEARTBEAT.md               ← Periodic tasks to run
│   │   ├── MEMORY.md                  ← Memory index
│   │   ├── memory/                    ← DATEWISE MEMORY FILES
│   │   │   ├── 2026-03-24/
│   │   │   │   ├── always-use-chrome.md
│   │   │   │   └── run-apps-external.md
│   │   │   └── 2026-03-25/
│   │   │       └── some-learning.md
│   │   └── messages/                  ← CONVERSATION MESSAGES (local JSONL, not in DB)
│   │       ├── {conversation-uuid-1}.jsonl
│   │       └── {conversation-uuid-2}.jsonl
│   │
│   └── personal/                      ← Personal agent (active when mode.txt = "personal")
│       ├── IDENTITY.md
│       ├── AGENTS.md
│       ├── memory/                    ← Personal agent memories
│       └── messages/                  ← Personal agent messages
│
├── shared/                            ← READ BY BOTH AGENTS
│   ├── SOUL.md                        ← Core values, red lines
│   ├── USER.md                        ← Shubham's profile, tech stack
│   ├── TOOLS.md                       ← Machine setup, Chrome config, MCP info
│   └── BOOTSTRAP.md                   ← First-time setup checklist
│
├── skills/                            ← SHARED SKILLS (both agents)
│   └── ui-ux-pro-max/                ← Design intelligence skill
│       ├── SKILL.md
│       ├── data/                      ← CSV databases (styles, colors, fonts)
│       └── scripts/                   ← Python search scripts
│
├── christopher/                       ← CHRISTOPHER SERVER DATA
│   ├── config/                        ← christopher-config.json, mcp-config.json
│   ├── backups/db/                    ← Auto DB backups (embedded mode only)
│   └── browser/                       ← Chrome debug profile (legacy, unused)
│
├── hooks/                             ← SESSION LIFECYCLE HOOKS
│   ├── session-start.sh              ← Loads memories, checks Chrome, reports mode
│   └── session-stop.sh              ← Cleanup on exit
│
├── projects/                          ← CLAUDE CLI SESSION FILES (legacy)
│   ├── C--Users-Shubham-Code-/       ← Sessions from C:\Users\Shubham(Code)
│   │   ├── {uuid}.jsonl              ← Full session event streams
│   │   └── memory/                   ← Old per-project memories
│   └── C--Users-hrith/               ← Sessions from other dirs
│
├── sessions/                          ← Session metadata JSONs
├── cache/                             ← Temp data (junction to local SSD if Google Drive)
├── shell-snapshots/                   ← Machine-specific terminal state
├── file-history/                      ← File edit tracking
└── history.jsonl                      ← Global CLI command history
```

### Key Rules

| Rule | Details |
|------|---------|
| **MCP registrations** | Go in `~/.claude.json`, NOT `~/.claude/settings.json` |
| **Memory writes** | Only to `agents/{current_mode}/memory/YYYY-MM-DD/` |
| **Memory reads** | From BOTH agents + shared |
| **Messages** | Stored locally in `agents/{agent}/messages/{convo}.jsonl`, NOT in Supabase |
| **Agent lock** | Can only send messages to conversations matching current mode |
| **Google Drive sync** | Entire `~/.claude/` symlinked to Drive (except cache/shell-snapshots via junctions) |

### Multi-Agent Memory System

Christopher uses a multi-agent memory architecture. Each agent has its own memory folder with datewise entries.

### Switch agent mode

```bash
# Via Christopher API
curl -s -X POST http://localhost:3000/api/mode -H "Content-Type: application/json" -d '{"mode":"personal"}'

# Or directly
echo "personal" > ~/.claude/mode.txt
```

### Memory file format (frontmatter required)

```markdown
---
name: Fixed auth token bug
type: project
agent: coding
date: 2026-03-23
time: 14:32
---

Auth tokens were expiring because...
```

### Message storage (local, not DB)

Messages are stored as JSONL files per conversation in the agent's folder:
```
~/.claude/agents/coding/messages/3b43a78d-bd6f-4f9a-8327-7fe4cfe3f9e0.jsonl
```
Each line: `{"role":"user","content":"...","created_at":"2026-03-25T10:00:00Z"}`

This saves Supabase storage — messages are the biggest data and don't need to be in the cloud DB. Google Drive syncs them across PCs.

---

## 5. Cross-PC Sync (Google Drive)

### How it works

Symlink `~/.claude/` to Google Drive. Both PCs point to the same folder. No conflicts because each agent writes to its own folder.

### Setup (run once per PC)

```cmd
:: === STEP 1: Move .claude to Google Drive (MAIN PC only, first time) ===
robocopy "C:\Users\<YOU>\.claude" "G:\My Drive\.claude" /E /MOVE

:: === STEP 2: Create local storage for non-synced folders ===
mkdir "C:\Users\<YOU>\.claude-local\cache"
mkdir "C:\Users\<YOU>\.claude-local\shell-snapshots"

:: === STEP 3: Symlink .claude to Google Drive ===
mklink /D "C:\Users\<YOU>\.claude" "G:\My Drive\.claude"

:: === STEP 4: Junctions for local-only folders (Drive skips junctions) ===
rmdir "C:\Users\<YOU>\.claude\cache"
rmdir "C:\Users\<YOU>\.claude\shell-snapshots"

mklink /J "C:\Users\<YOU>\.claude\cache" "C:\Users\<YOU>\.claude-local\cache"
mklink /J "C:\Users\<YOU>\.claude\shell-snapshots" "C:\Users\<YOU>\.claude-local\shell-snapshots"
```

### What syncs vs stays local

| Path | Synced? | Why |
|------|---------|-----|
| agents/coding/memory/ | Yes | Agent memories |
| agents/personal/memory/ | Yes | Agent memories |
| agents/*/sessions/ | Yes | Session continuity across PCs |
| shared/ | Yes | SOUL.md, USER.md, TOOLS.md |
| skills/ | Yes | Shared skills |
| settings.json | Yes | MCP config, preferences |
| cache/ | No (junction) | Temp data, heavy I/O |
| shell-snapshots/ | No (junction) | Machine-specific paths |

### Rule for multi-PC

Close Claude Code on PC1 -> wait ~30s for Drive to sync -> open on PC2.

---

## 6. Database (Supabase)

Chrospher uses Supabase (cloud PostgreSQL) for structured data:

| Table | Purpose |
|-------|---------|
| conversations | Chat sessions with agent tag |
| messages | Chat messages per conversation |
| memory_entities | Quick index of file-based memories |
| tasks | Shared task board (both agents) |
| task_history | Task change log |
| task_attachments | Task file attachments |

### Connection

Set `DATABASE_URL` in `.env`. If not set, falls back to embedded PostgreSQL.

---

## 7. Claude Code Settings

### Session retention

```json
{
  "cleanupPeriodDays": 999999
}
```
Default is 30 days. Set to 999999 to never prune sessions. Do NOT set to 0 (known bug — deletes all sessions).

### Permissions

```json
{
  "skipDangerousModePermissionPrompt": true
}
```

---

## 8. Unified Memory System (CLI ↔ App Bridge)

Christopher's process mode and Claude Code CLI use **separate memory locations** by default. This setup unifies them so all memories are shared.

### How it works

| Interface | Saves to | Reads from |
|-----------|----------|------------|
| **CLI session** | `~/.claude/agents/coding/memory/YYYY-MM-DD/` (via CLAUDE.md override) | Christopher agent memory + old CLI project memories |
| **App terminal mode** | `~/.claude/projects/C--Users-hrith/memory/` (default) | Own project memory |
| **App process mode** | `~/.claude/agents/coding/memory/YYYY-MM-DD/` (Christopher API) | Agent memory + all CLI project memories (via `loadCliMemories()`) |

### CLAUDE.md — Memory Override

Place at `C:\Users\<YOU>\CLAUDE.md` (home directory root). This tells every CLI session to:
- **Save** memories in Christopher's format (`agents/coding/memory/YYYY-MM-DD/{slug}.md` with frontmatter)
- **Read** from both Christopher agent memory AND old CLI project memories
- **Sync** to Christopher's DB via `curl -s -X POST http://localhost:3000/api/memory/sync`
- **Never** use the default project-scoped `projects/<hash>/memory/` system

### Memory file format (frontmatter required)

```markdown
---
name: {Memory Name}
type: {project|user|feedback|reference}
agent: coding
date: {YYYY-MM-DD}
time: {HH:MM}
---

{Memory content here}
```

### Hooks

Two hooks in `~/.claude/hooks/`, configured in `~/.claude/settings.json` under `hooks.SessionStart` and `hooks.Stop`:

1. **`session-start.sh`** — Runs on every CLI session start:
   - Loads recent Christopher memories (last 3 date folders)
   - Lists installed skills
   - Loads user context from USER.md
   - **Checks Chrome CDP** on port 9222 — if not running, launches Chrome with `--remote-debugging-port=9222 --user-data-dir=ChromeDebug` (NEVER kills existing Chrome)
   - Checks Christopher server health on localhost:3000
   - Reports current agent mode
   - Outputs JSON context for Claude Code's status line

   **Why Chrome in the hook?** MCP servers connect at Claude Code startup ONLY. If Chrome isn't running when the session starts, `chrome-devtools-mcp` fails and never retries. The hook ensures Chrome is ready before MCP tries to connect.

   **CRITICAL:** The hook must NEVER run `taskkill //F //IM chrome.exe`. User may have tabs open. Just launch a new instance with the debug profile if CDP isn't responding.

2. **`session-stop.sh`** — Runs on exit/Ctrl+C. Cleanup tasks.

### Running apps in external terminals

CLAUDE.md also instructs: when user asks to run/start any app, open it in a Git Bash window:
```powershell
Start-Process "C:\Program Files\Git\bin\bash.exe" -ArgumentList '-c', 'cd "<path>" && <command>'
```

---

## 9. Claude Desktop Setup (Co-work & Chat)

Claude Desktop is the GUI app (separate from Claude Code CLI).

### Filesystem MCP for Claude Desktop Chat

Config file location:
- Windows Store install: `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\claude_desktop_config.json`
- Regular install: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "cmd",
      "args": [
        "/c", "npx", "-y",
        "@modelcontextprotocol/server-filesystem",
        "H:\\My Drive\\Feasibilities Temporary"
      ]
    }
  }
}
```

### Co-work Feature — Known Limitation

Claude Desktop's Co-work feature **cannot access folders outside your home directory** (`C:\Users\<username>\`). Google Drive paths (`H:\My Drive\`) are rejected.

**This is a known bug** (8+ open GitHub issues, March 2026). Symlinks, junctions, and `subst` drives do NOT work.

**Workarounds:**
- Use **Claude Code CLI** instead (no restriction)
- Use the **Code tab** in Claude Desktop (no folder restriction)
- Use **Filesystem MCP** above for chat-based file access

---

## Checking What's Installed

```bash
# .NET global tools (excel-mcp, ppt-mcp)
dotnet tool list -g

# Node.js packages
npm list -g

# Python packages
python -m pip list

# Chrome DevTools MCP version
npx chrome-devtools-mcp@latest --version

# MCP servers registered in Claude Code
claude mcp list

# Chrospher server health
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/mode
curl -s http://localhost:3000/api/connectors
```

---

## Complete Troubleshooting

| Problem | Solution |
|---------|----------|
| **winget not found** | Install "App Installer" from Microsoft Store |
| **PATH not updated after installs** | Close and reopen terminal, or restart computer |
| **npm install fails with node-gyp** | Install VS Build Tools: `npm install -g windows-build-tools` |
| **npm install fails on Google Drive (H:\)** | Copy project to local path, or use `initial-setup.bat` which handles this |
| **MCPs in settings.json but not loading** | WRONG FILE. MCPs go in `~/.claude.json`, not `~/.claude/settings.json`. Use `claude mcp add` |
| **Server not in `claude mcp list`** | Register: `claude mcp add --scope user <name> -- <command>` → writes to `~/.claude.json` |
| **"command not found"** | Package not installed. Follow install steps above |
| **Chrome MCP not connecting** | Chrome must be running with CDP on 9222 BEFORE starting Claude Code. session-start.sh handles this |
| **Chrome `--remote-debugging-port` ignored** | Close ALL Chrome windows first. The flag only works on first launch |
| **Chrome 146+ ignores debug port** | Must pass BOTH `--remote-debugging-port=9222` AND `--user-data-dir=...` |
| **DevToolsActivePort file not created** | Username has parentheses. Create file manually (see chrome-devtools section) |
| **chrome-devtools MCP stays "failed"** | MCP caches connection state at startup. Start Chrome first, then restart Claude Code |
| **Excel/PPT won't open via MCP** | File must be CLOSED in desktop app (COM exclusive access) |
| **Excel/PPT COM "access denied"** | Run Claude Code and Office at same privilege level (both admin or both normal) |
| **ppt-mcp build fails** | .NET version mismatch. Update ALL targets to net10.0-windows (see PPT section) |
| **ppt-mcp MSB4062 error** | Path has parentheses. Clone to `C:\mcp-server-ppt` instead |
| **ppt-mcp installs wrong v1.0.3** | NuGet.org override. Use `--version 0.1.0` flag |
| **MSBuild node reuse locks .dll** | Kill: `Stop-Process -Name dotnet -Force` or use `-nodeReuse:false` |
| **windows-mcp fails** | Run `python -m pip install uv` first |
| **`uvx` not found** | uv not in PATH. Try `pip install uv` or add Python Scripts to PATH |
| **Session pruning deletes everything** | Set `cleanupPeriodDays: 999999` (NOT 0 — known bug) |
| **Supabase connection fails** | Check DATABASE_URL in .env. Test: `curl -s http://localhost:3000/api/health` |
| **Terminal mode exits instantly** | Path with special chars (parentheses, spaces). Check quoting |
| **MCP tools not appearing in conversation** | MCP servers connect at startup only. Restart Claude Code |
| **Google Drive sync conflicts** | Each agent writes to own folder. Close Claude Code before switching PCs |
| **Claude Desktop "outside home folder"** | Known bug. Use Claude Code CLI or Code tab instead |
| **Claude Desktop filesystem MCP fails** | Use `cmd /c npx` instead of just `npx` in config |
| **.NET tools not found by Claude Code** | Register with full path: `claude mcp add --scope user excel-mcp -- "C:/Users/<USER>/.dotnet/tools/mcp-excel"` |
| **`npx` hangs on first MCP run** | First run downloads packages. Wait 30-60s. If stuck: `npm cache clean --force` |
