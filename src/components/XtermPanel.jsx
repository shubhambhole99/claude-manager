import React, { useRef, useEffect, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import "./XtermPanel.css";

export default function XtermPanel({ socket, conversationId, mode, config, onExit, autoConnect, sessionId }) {
  const termContainerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const connectedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [exited, setExited] = useState(false);
  const [checking, setChecking] = useState(!autoConnect);

  // Initialize xterm.js on mount
  useEffect(() => {
    if (!termContainerRef.current) return;
    const container = termContainerRef.current;

    const term = new Terminal({
      theme: {
        background: "#0d1117", foreground: "#c9d1d9", cursor: "#0d1117",
        cursorAccent: "#0d1117", selectionBackground: "#264f78",
        black: "#0d1117", red: "#ff7b72", green: "#7ee787", yellow: "#d29922",
        blue: "#58a6ff", magenta: "#bc8cff", cyan: "#39c5cf", white: "#c9d1d9",
        brightBlack: "#484f58", brightRed: "#ffa198", brightGreen: "#56d364",
        brightYellow: "#e3b341", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
      },
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      fontSize: 14, lineHeight: 1.2, cursorBlink: false, cursorStyle: "bar",
      scrollback: 5000, allowTransparency: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    termRef.current = term;
    fitRef.current = fit;

    // Scroll protection: prevent viewport jumping to top on focus loss,
    // fit.fit() recalculations, or xterm _innerRefresh resets.
    const vpEl = container.querySelector('.xterm-viewport');
    let cleanupFocusListeners = null;
    if (vpEl) {
      let isAtBottom = true;
      let savedScrollTop = 0;
      let savedAtBottom = true;

      // Track scroll position — detect "at bottom" from actual scroll state
      vpEl.addEventListener('scroll', () => {
        const cur = vpEl.scrollTop;
        const gap = vpEl.scrollHeight - cur - vpEl.clientHeight;
        isAtBottom = gap < 10;

        // Guard: jump from non-zero to 0 while not at bottom = xterm viewport reset
        if (!isAtBottom && savedScrollTop > 50 && cur === 0) {
          vpEl.scrollTop = savedScrollTop;
          return;
        }
        savedScrollTop = cur;
      }, { passive: true });

      // Save scroll state when window loses focus
      const onBlur = () => {
        savedScrollTop = vpEl.scrollTop;
        savedAtBottom = isAtBottom;
      };

      // Restore scroll state when window regains focus
      const onFocus = () => {
        try { fit.fit(); } catch {}
        requestAnimationFrame(() => {
          if (savedAtBottom) {
            term.scrollToBottom();
          } else {
            vpEl.scrollTop = savedScrollTop;
          }
        });
      };

      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);
      cleanupFocusListeners = () => {
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
      };
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => { try { fit.fit(); } catch {} });
    });

    // Only call fit.fit() when the container ACTUALLY changed size (>5px threshold)
    // Skip when document is hidden to prevent scroll jumps during focus loss
    let lastW = container.clientWidth;
    let lastH = container.clientHeight;
    let resizeTimeout = null;
    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (Math.abs(w - lastW) < 5 && Math.abs(h - lastH) < 5) return;
      lastW = w;
      lastH = h;
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (document.hidden) return;
        try { fit.fit(); } catch {}
      }, 100);
    });
    observer.observe(container);

    return () => {
      clearTimeout(resizeTimeout);
      observer.disconnect();
      if (cleanupFocusListeners) cleanupFocusListeners();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // Wire socket events to receive PTY output (always, even before "connecting")
  useEffect(() => {
    const term = termRef.current;
    if (!term || !socket || !conversationId) return;

    // Strip escape sequences that cause xterm.js to reset viewport to top:
    // - \x1b[?1049h/l  — alternate screen buffer switch (main cause)
    // - \x1b[?47h/l    — older alt screen variant
    // These cause xterm's internal viewportY to reset to 0, jumping scroll to top.
    const ALT_SCREEN_RE = /\x1b\[\?(?:1049|47)[hl]/g;

    const handleOutput = ({ conversationId: cid, data }) => {
      if (cid !== conversationId) return;
      term.write(typeof data === 'string' ? data.replace(ALT_SCREEN_RE, '') : data);
    };
    const handleExit = ({ conversationId: cid, code }) => {
      if (cid !== conversationId) return;
      term.write(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
      setExited(true);
      connectedRef.current = false;
      setConnected(false);
      if (onExit) onExit(code);
    };
    const handleReady = ({ conversationId: cid }) => {
      if (cid !== conversationId) return;
      try { fitRef.current?.fit(); } catch {}
    };

    // Shift+Enter = newline attempt
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === "keydown" && e.key === "Enter" && e.shiftKey) {
        socket.emit("pty:input", { conversationId, data: "\n" });
        return false;
      }
      return true;
    });

    // Wire input: user types in xterm -> send to server
    const dataDisposable = term.onData((data) => {
      socket.emit("pty:input", { conversationId, data });
    });
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      socket.emit("pty:resize", { conversationId, cols, rows });
    });

    socket.on("pty:output", handleOutput);
    socket.on("pty:exit", handleExit);
    socket.on("pty:ready", handleReady);

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      socket.off("pty:output", handleOutput);
      socket.off("pty:exit", handleExit);
      socket.off("pty:ready", handleReady);
    };
  }, [socket, conversationId, onExit]);

  // On mount: check if PTY is already running on server (for old conversations)
  useEffect(() => {
    if (!socket || !conversationId || autoConnect) return;

    const handleActive = ({ conversationId: cid }) => {
      if (cid !== conversationId) return;
      setChecking(false);
      setConnected(true);
      connectedRef.current = true;
    };
    const handleInactive = ({ conversationId: cid }) => {
      if (cid !== conversationId) return;
      setChecking(false);
    };

    socket.on("pty:active", handleActive);
    socket.on("pty:inactive", handleInactive);

    socket.emit("pty:check", { conversationId });

    return () => {
      socket.off("pty:active", handleActive);
      socket.off("pty:inactive", handleInactive);
    };
  }, [socket, conversationId, autoConnect]);

  // Create a new PTY on the server
  const createPty = useCallback(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !socket || !conversationId) return;

    setConnected(true);
    setExited(false);
    connectedRef.current = true;

    try { fit.fit(); } catch {}

    socket.emit("pty:create", {
      conversationId,
      mode,
      cols: term.cols,
      rows: term.rows,
      config: { ...(config || {}), sessionId: sessionId || undefined },
    });
  }, [socket, conversationId, mode, config, sessionId]);

  // Auto-connect for new conversations
  useEffect(() => {
    if (autoConnect && termRef.current && socket && conversationId && !connectedRef.current) {
      const timer = setTimeout(createPty, 150);
      return () => clearTimeout(timer);
    }
  }, [autoConnect, socket, conversationId, createPty]);

  const handleResume = () => {
    const term = termRef.current;
    if (term) {
      term.clear();
      term.write("\x1b[90mResuming session...\x1b[0m\r\n");
    }
    createPty();
  };

  const showOverlay = !autoConnect && !connected && !exited && !checking;
  const showExitOverlay = exited && !connected;

  return (
    <div className="xterm-panel">
      <div className="xterm-container" ref={termContainerRef} />
      {checking && (
        <div className="xterm-overlay">
          <div className="xterm-resume-card">
            <div className="xterm-resume-desc">Checking session...</div>
          </div>
        </div>
      )}
      {showOverlay && (
        <div className="xterm-overlay">
          <div className="xterm-resume-card">
            <div className="xterm-resume-title">Terminal Session</div>
            {sessionId && <div className="xterm-resume-session">session: {sessionId.slice(0, 12)}</div>}
            <div className="xterm-resume-desc">
              {sessionId ? "Resume this conversation with --resume" : "Start a new terminal session"}
            </div>
            <button className="xterm-resume-btn" onClick={handleResume}>
              {sessionId ? "Resume Session" : "Connect"}
            </button>
          </div>
        </div>
      )}
      {showExitOverlay && (
        <div className="xterm-overlay">
          <div className="xterm-resume-card">
            <div className="xterm-resume-title">Session Ended</div>
            <button className="xterm-resume-btn" onClick={handleResume}>Reconnect</button>
          </div>
        </div>
      )}
    </div>
  );
}
