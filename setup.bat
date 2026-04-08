@echo off
setlocal enabledelayedexpansion
title Claude Manager - Setup
color 0A

echo.
echo  =====================================================
echo.
echo     ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
echo    ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
echo    ██║     ██║     ███████║██║   ██║██║  ██║█████╗
echo    ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
echo    ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
echo     ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝
echo              M A N A G E R
echo.
echo  =====================================================
echo.
echo   A web-based manager for Claude Code CLI sessions.
echo   Create agents, manage conversations, search history,
echo   resume terminal sessions, and view structured chat logs.
echo.
echo   Features:
echo     - Multi-agent system (create custom agents)
echo     - Terminal ^& process conversation modes
echo     - Session resume across working directories
echo     - Full-text search across all chats and sessions
echo     - Starred conversations, message pagination
echo     - Memory system with Supabase sync
echo.
echo  =====================================================
echo.

:: -----------------------------------------------
:: 1. Check prerequisites
:: -----------------------------------------------

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found. Install from https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo  [WARN] Git not found. Terminal mode requires Git Bash.
    echo         Install from https://git-scm.com
) else (
    echo  [OK] Git found
)

where claude >nul 2>nul
if %errorlevel% neq 0 (
    echo  [WARN] Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code
) else (
    echo  [OK] Claude CLI found
)

echo.

:: -----------------------------------------------
:: 2. Prompt for app name
:: -----------------------------------------------

set "APP_NAME="
set /p "APP_NAME=  Name your instance (e.g. Jarvis, Atlas, Claude Manager): "

if "!APP_NAME!"=="" (
    set "APP_NAME=Claude Manager"
    echo  [INFO] Using default name: Claude Manager
)

echo.
set "DB_URL="
echo.
echo  Supabase connects your assistant to a cloud PostgreSQL database.
echo  Get your connection string from: https://supabase.com/dashboard ^> Settings ^> Database
echo  Format: postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
echo.
set /p "DB_URL=  Supabase DATABASE_URL (leave blank to use local embedded DB): "
echo.
echo  Setting up "!APP_NAME!"...
echo.

:: -----------------------------------------------
:: 3. Install dependencies
:: -----------------------------------------------

echo  [1/6] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
)
echo  [OK] Dependencies installed
echo.

:: -----------------------------------------------
:: 4. Create .env file
:: -----------------------------------------------

echo  [2/6] Creating .env file...
if not exist ".env" (
    echo PORT=3000> .env
    echo PG_PORT=5433>> .env
    if "!DB_URL!"=="" (
        echo # DATABASE_URL=postgres://user:pass@host:port/db>> .env
        echo  [OK] .env created (no Supabase — will use embedded PostgreSQL)
    ) else (
        echo DATABASE_URL=!DB_URL!>> .env
        echo  [OK] .env created with Supabase connection
    )
    echo APP_NAME=!APP_NAME!>> .env
) else (
    echo  [SKIP] .env already exists
    :: Update APP_NAME and DATABASE_URL in existing .env
    findstr /v "APP_NAME DATABASE_URL" .env > .env.tmp
    if not "!DB_URL!"=="" (
        echo DATABASE_URL=!DB_URL!>> .env.tmp
    )
    echo APP_NAME=!APP_NAME!>> .env.tmp
    move /y .env.tmp .env >nul
    echo  [OK] .env updated
)
echo.

:: -----------------------------------------------
:: 5. Create .claude directory structure
:: -----------------------------------------------

echo  [3/6] Creating .claude directory structure...

set "CLAUDE_DIR=%USERPROFILE%\.claude"

if not exist "%CLAUDE_DIR%" mkdir "%CLAUDE_DIR%"
if not exist "%CLAUDE_DIR%\agents" mkdir "%CLAUDE_DIR%\agents"
if not exist "%CLAUDE_DIR%\shared" mkdir "%CLAUDE_DIR%\shared"
if not exist "%CLAUDE_DIR%\skills" mkdir "%CLAUDE_DIR%\skills"

:: Create config file with app name
echo { > "%CLAUDE_DIR%\app-config.json"
echo   "appName": "!APP_NAME!", >> "%CLAUDE_DIR%\app-config.json"
echo   "version": "3.0.0", >> "%CLAUDE_DIR%\app-config.json"
echo   "createdAt": "%date% %time%" >> "%CLAUDE_DIR%\app-config.json"
echo } >> "%CLAUDE_DIR%\app-config.json"

echo  [OK] .claude directory ready (no built-in agents)
echo       Agents dir: %CLAUDE_DIR%\agents\
echo       Create agents via Settings ^> Agents in the app
echo.

:: -----------------------------------------------
:: 6. Update app name in source files
:: -----------------------------------------------

echo  [4/6] Configuring app name...

:: Update index.html title
powershell -Command "(Get-Content 'index.html') -replace 'Christopher - AI Voice Assistant', '!APP_NAME! - AI Assistant' | Set-Content 'index.html'"

:: Update server health endpoint name
powershell -Command "(Get-Content 'server\index.js') -replace 'Christopher v3', '!APP_NAME!' | Set-Content 'server\index.js'"

:: Update frontend references
powershell -Command "(Get-Content 'src\App.jsx') -replace 'Christopher', '!APP_NAME!' | Set-Content 'src\App.jsx'"
powershell -Command "(Get-Content 'src\components\Sidebar.jsx') -replace 'Christopher', '!APP_NAME!' | Set-Content 'src\components\Sidebar.jsx'"
powershell -Command "(Get-Content 'src\components\CliPanel.jsx') -replace 'Christopher CLI', '!APP_NAME! CLI' | Set-Content 'src\components\CliPanel.jsx'"

echo  [OK] App name set to "!APP_NAME!"
echo.

:: -----------------------------------------------
:: 7. Build frontend
:: -----------------------------------------------

echo  [5/6] Building frontend...
call npx vite build
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed.
    pause
    exit /b 1
)
echo  [OK] Frontend built
echo.

:: -----------------------------------------------
:: 8. Done
:: -----------------------------------------------

echo  [6/6] Setup complete!
echo.
echo  =====================================================
echo   !APP_NAME! is ready!
echo  =====================================================
echo.
echo   Start:       npm start
echo   URL:         http://localhost:3000
echo.
echo   Getting started:
echo   1. Run "npm start" to launch the server
echo   2. Open http://localhost:3000 in your browser
echo   3. Go to Settings ^> Agents to create your first agent
echo   4. Click "+ New Conversation" to start chatting
echo.
echo   How it works:
echo   - Single click a chat    = open terminal session
echo   - Double click a chat    = view message history
echo   - Right click a chat     = star, rename, change agent/status
echo   - Search bar             = search across all chats + sessions
echo   - Sessions on Computer   = browse local Claude CLI sessions
echo.
echo   Requires Claude Code CLI: npm install -g @anthropic-ai/claude-code
echo.

pause
