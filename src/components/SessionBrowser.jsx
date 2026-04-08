import React, { useState, useEffect, useCallback } from "react";
import "./SessionBrowser.css";

const API = "";
const FILTERS = ["All", "Coding", "Personal", "Terminal"];

export default function SessionBrowser({ socket, onResumeSession, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(null);
  const [viewingSession, setViewingSession] = useState(null); // { sessionId, events }
  const [viewLoading, setViewLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, convRes] = await Promise.all([
        fetch(`${API}/api/sessions/local`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API}/api/conversations`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setSessions(Array.isArray(sessRes) ? sessRes : []);
      setConversations(Array.isArray(convRes) ? convRes : []);
    } catch {
      setSessions([]);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for session changes
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData();
    socket.on("session:created", refresh);
    socket.on("session:ended", refresh);
    return () => {
      socket.off("session:created", refresh);
      socket.off("session:ended", refresh);
    };
  }, [socket, fetchData]);

  // Classify sessions
  const classifyType = (item) => {
    if (item._source === "terminal") return "terminal";
    const path = item.projectPath || item.project_path || "";
    const lower = path.toLowerCase();
    if (lower.includes("personal") || lower.includes("christopher")) return "personal";
    return "coding";
  };

  // Build unified list
  const unified = [];

  // Local sessions from /api/sessions/local
  for (const s of sessions) {
    unified.push({
      id: s.sessionId,
      sessionId: s.sessionId,
      title: s.sessionId.slice(0, 12) + "...",
      projectPath: s.projectPath || "",
      modified: s.modified || s.updatedAt,
      sizeKb: s.sizeKb,
      type: classifyType(s),
      source: "local",
    });
  }

  // DB conversations that are terminal
  for (const c of conversations) {
    const isTerminal = c.metadata?.mode?.startsWith("terminal") || c.metadata?.terminal === true;
    if (isTerminal) {
      unified.push({
        id: `conv-${c.id}`,
        conversationId: c.id,
        sessionId: c.claude_session_id,
        title: c.title || "Terminal Session",
        projectPath: c.metadata?.projectPath || "",
        modified: c.updated_at,
        type: "terminal",
        source: "db",
      });
    }
  }

  // Sort by modified date descending
  unified.sort((a, b) => new Date(b.modified || 0) - new Date(a.modified || 0));

  // Filter
  const filtered = activeFilter === "All"
    ? unified
    : unified.filter((s) => s.type === activeFilter.toLowerCase());

  // Resume handler
  const handleResume = async (item) => {
    if (!item.sessionId) return;
    setResuming(item.id);
    try {
      if (item.source === "local") {
        const res = await fetch(`${API}/api/sessions/${item.sessionId}/import`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (onResumeSession) onResumeSession(data.conversationId || data.id, item.sessionId);
        }
      } else {
        if (onResumeSession) onResumeSession(item.conversationId, item.sessionId);
      }
    } catch {} finally {
      setResuming(null);
    }
  };

  const typeBadge = (type) => {
    const map = {
      coding: { label: "CODE", className: "badge-code" },
      personal: { label: "PERS", className: "badge-pers" },
      terminal: { label: "TERM", className: "badge-term" },
    };
    return map[type] || map.coding;
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const shortPath = (p) => {
    if (!p) return "";
    const parts = p.replace(/\\/g, "/").split("/");
    return parts.length <= 2 ? parts.join("/") : ".../" + parts.slice(-2).join("/");
  };

  const viewSession = async (sessionId) => {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/replay`);
      const events = await res.json();
      setViewingSession({ sessionId, events: Array.isArray(events) ? events : [] });
    } catch (err) {
      console.error("Failed to load session:", err);
    }
    setViewLoading(false);
  };

  if (viewingSession) {
    return (
      <div className="session-browser">
        <div className="session-browser-header">
          <h2>Session Replay</h2>
          <div style={{display:"flex",gap:6}}>
            <button className="session-refresh-btn" onClick={() => setViewingSession(null)} title="Back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            {onClose && <button className="session-refresh-btn" onClick={onClose} title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>}
          </div>
        </div>
        <div className="session-replay-scroll">
          <div className="session-replay-id">Session: {viewingSession.sessionId.slice(0,12)}...</div>
          {viewingSession.events.length === 0 && <div className="session-empty">No events found</div>}
          {viewingSession.events.map((evt, i) => {
            if (evt.type === "user" || evt.type === "human") {
              const text = typeof evt.message?.content === "string" ? evt.message.content : JSON.stringify(evt.message?.content || "");
              return <div key={i} className="replay-msg replay-user"><span className="replay-role">You:</span> {text.slice(0, 500)}</div>;
            }
            if (evt.type === "assistant") {
              const blocks = evt.message?.content || [];
              const texts = (Array.isArray(blocks) ? blocks : []).filter(b => b.type === "text").map(b => b.text).join("\n");
              const tools = (Array.isArray(blocks) ? blocks : []).filter(b => b.type === "tool_use").map(b => b.name);
              return (
                <div key={i} className="replay-msg replay-assistant">
                  {texts && <div className="replay-text">{texts.slice(0, 1000)}</div>}
                  {tools.length > 0 && <div className="replay-tools">{tools.map((t,j) => <span key={j} className="replay-tool-badge">{t}</span>)}</div>}
                </div>
              );
            }
            if (evt.type === "result") {
              return <div key={i} className="replay-msg replay-result">--- Cost: ${Number(evt.total_cost_usd || 0).toFixed(4)} ---</div>;
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="session-browser">
      <div className="session-browser-header">
        <h2>{viewingSession ? "Session Replay" : "Sessions"}</h2>
        <div style={{display:"flex",gap:6}}>
          {viewingSession && <button className="session-refresh-btn" onClick={() => setViewingSession(null)} title="Back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>}
          <button className="session-refresh-btn" onClick={fetchData} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          {onClose && <button className="session-refresh-btn" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>}
        </div>
      </div>

      <div className="session-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`session-filter-pill ${activeFilter === f ? "active" : ""}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
            {f !== "All" && (
              <span className="filter-count">
                {unified.filter((s) => f === "All" || s.type === f.toLowerCase()).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="session-list">
        {loading ? (
          <div className="session-empty">Loading sessions...</div>
        ) : filtered.length === 0 ? (
          <div className="session-empty">No sessions found</div>
        ) : (
          filtered.map((item) => {
            const badge = typeBadge(item.type);
            return (
              <div key={item.id} className="session-card">
                <div className="session-card-top">
                  <span className={`session-type-badge ${badge.className}`}>{badge.label}</span>
                  <span className="session-title">{item.title}</span>
                  <span className="session-date">{formatDate(item.modified)}</span>
                </div>
                <div className="session-card-meta">
                  {item.projectPath && (
                    <span className="session-path">{shortPath(item.projectPath)}</span>
                  )}
                  {item.sizeKb && <span className="session-size">{item.sizeKb}KB</span>}
                  {item.source === "db" && <span className="session-source">database</span>}
                </div>
                <div className="session-card-actions">
                  {item.sessionId && (
                    <button className="session-read-btn" onClick={() => viewSession(item.sessionId)} disabled={viewLoading}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      Read
                    </button>
                  )}
                  <button
                    className="session-resume-btn"
                    onClick={() => handleResume(item)}
                    disabled={resuming === item.id}
                  >
                    {resuming === item.id ? (
                      "Resuming..."
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Resume
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
