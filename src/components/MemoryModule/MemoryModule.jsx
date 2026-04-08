import React, { useState, useEffect, useCallback } from "react";
import "./MemoryModule.css";

const TYPE_COLORS = { project: "#7c6aef", feedback: "#eab308", user: "#22c55e", reference: "#58a6ff" };
const TYPE_ICONS = { project: "\u{1F4CB}", feedback: "\u{1F4AC}", user: "\u{1F464}", reference: "\u{1F517}" };

export default function MemoryModule({ onClose }) {
  const [entities, setEntities] = useState([]);
  const [localFiles, setLocalFiles] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("entities"); // "entities" | "files" | "daily"
  const [dailyNotes, setDailyNotes] = useState(null);
  const [dailyDate, setDailyDate] = useState("");
  const [dailyMemories, setDailyMemories] = useState([]);
  const [agentFilter, setAgentFilter] = useState("all");
  const [agentsList, setAgentsList] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch("/api/memory/entities");
      setEntities(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchLocalFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/memory/list?agent=coding");
      const data = await res.json();
      setLocalFiles(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const fetchDaily = useCallback(async () => {
    // Fetch daily notes only if date is selected
    if (dailyDate) {
      try {
        const res = await fetch(`/api/memory/daily/${dailyDate}`);
        const data = await res.json();
        setDailyNotes(data?.content || null);
      } catch { setDailyNotes(null); }
    } else {
      setDailyNotes(null);
    }
    // Fetch memories from all agents — filter by date if selected
    try {
      const allMems = [];
      const agents = agentsList.length > 0 ? agentsList : [{ name: "coding" }];
      for (const a of agents) {
        const dateParam = dailyDate ? `&date=${dailyDate}` : "";
        const res = await fetch(`/api/memory/list?agent=${a.name}${dateParam}`);
        const mems = await res.json();
        if (Array.isArray(mems)) allMems.push(...mems);
      }
      // Sort by date descending
      allMems.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setDailyMemories(allMems);
    } catch { setDailyMemories([]); }
  }, [dailyDate, agentsList]);

  const fetchSharedFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/memory/shared");
      setSharedFiles(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchEntities(); fetchLocalFiles(); fetchSharedFiles(); }, [fetchEntities, fetchLocalFiles, fetchSharedFiles]);
  useEffect(() => { if (view === "daily") fetchDaily(); }, [view, fetchDaily]);
  useEffect(() => { fetch("/api/agents").then(r => r.json()).then(setAgentsList).catch(() => {}); }, []);

  const loadEntityContent = async (entity) => {
    setSelectedEntity(entity);
    setSelectedContent(null);
    if (entity.file_path) {
      try {
        const agent = entity.entity_id?.startsWith("personal") ? "personal" : "coding";
        const res = await fetch(`/api/memory/file?agent=${agent}&path=${encodeURIComponent(entity.file_path)}`);
        const data = await res.json();
        setSelectedContent(data?.content || entity.summary || "No content available");
      } catch {
        setSelectedContent(entity.summary || "No content available");
      }
    } else {
      setSelectedContent(entity.summary || "No content available");
    }
  };

  const syncMemories = async () => {
    try {
      await fetch("/api/memory/sync", { method: "POST" });
      fetchEntities();
      fetchLocalFiles();
    } catch {}
  };

  const filtered = entities.filter(e => {
    if (filter !== "all" && e.entity_type !== filter) return false;
    if (agentFilter !== "all" && e.agent !== agentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (e.entity_id || "").toLowerCase().includes(q) ||
        (e.summary || "").toLowerCase().includes(q) ||
        (e.entity_type || "").toLowerCase().includes(q);
    }
    return true;
  });

  const grouped = {};
  for (const e of filtered) {
    const date = e.entity_id?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "undated";
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  }
  const sortedDates = Object.keys(grouped).sort().reverse();

  const stats = {
    total: entities.length,
    project: entities.filter(e => e.entity_type === "project").length,
    feedback: entities.filter(e => e.entity_type === "feedback").length,
    user: entities.filter(e => e.entity_type === "user").length,
    reference: entities.filter(e => e.entity_type === "reference").length,
  };

  return (
    <div className="memory-module">
      <div className="memory-header">
        <div className="memory-header-left">
          <h2>Memories</h2>
          <div className="memory-stats">
            <span className="stat">{stats.total} total</span>
            <span className="stat" style={{ color: TYPE_COLORS.project }}>{stats.project} project</span>
            <span className="stat" style={{ color: TYPE_COLORS.feedback }}>{stats.feedback} feedback</span>
            <span className="stat" style={{ color: TYPE_COLORS.user }}>{stats.user} user</span>
          </div>
        </div>
        <div className="memory-header-right">
          <div className="memory-views">
            {["entities", "files", "daily", "shared"].map(v => (
              <button key={v} className={`view-btn ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
                {v === "entities" ? "DB" : v === "files" ? "Files" : v === "daily" ? "Daily" : "Shared"}
              </button>
            ))}
          </div>
          <button className="memory-close-btn" onClick={onClose}>&times;</button>
        </div>
      </div>

      <div className="memory-body">
        <div className="memory-sidebar">
          <input className="memory-search" placeholder="Search memories..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="memory-filter-row">
            <select className="memory-agent-select" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              <option value="all">All Agents</option>
              {agentsList.map(a => <option key={a.name} value={a.name}>{a.name.charAt(0).toUpperCase() + a.name.slice(1)}</option>)}
            </select>
            <div className="memory-type-filters">
              {["all", "project", "feedback", "user", "reference"].map(t => (
                <button key={t} className={`memory-type-btn ${filter === t ? "active" : ""}`}
                  style={t !== "all" ? { "--type-color": TYPE_COLORS[t] } : {}}
                  onClick={() => setFilter(t)}>
                  {t !== "all" && <span className="type-dot" style={{ background: TYPE_COLORS[t] }} />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {view === "entities" && (
            <div className="memory-list">
              {loading && <div className="memory-empty">Loading...</div>}
              {!loading && filtered.length === 0 && <div className="memory-empty">No memories found</div>}
              {sortedDates.map(date => (
                <div key={date} className="memory-date-group">
                  <div className="memory-date-header">{date}</div>
                  {grouped[date].map(e => (
                    <div key={e.id} className={`memory-item ${selectedEntity?.id === e.id ? "selected" : ""}`}
                      onClick={() => loadEntityContent(e)}>
                      <span className="memory-item-icon">{TYPE_ICONS[e.entity_type] || "\u{1F4C4}"}</span>
                      <div className="memory-item-info">
                        <div className="memory-item-name">{e.entity_id?.split("/").pop()?.replace(/-/g, " ") || "Untitled"}</div>
                        <div className="memory-item-type" style={{ color: TYPE_COLORS[e.entity_type] }}>{e.entity_type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {view === "files" && (
            <div className="memory-list">
              {(agentFilter === "all" ? localFiles : localFiles.filter(f => f.agent === agentFilter)).length === 0 && <div className="memory-empty">No files{agentFilter !== "all" ? ` for ${agentFilter}` : ""}</div>}
              {(agentFilter === "all" ? localFiles : localFiles.filter(f => f.agent === agentFilter)).map((f, i) => {
                const filePath = `${f.date}/${f.file}`;
                const isSelected = selectedEntity?.file_path === filePath;
                return (
                  <div key={i} className={`memory-item ${isSelected ? "selected" : ""}`} onClick={async () => {
                    setSelectedEntity({ entity_id: f.name, entity_type: f.type, agent: f.agent, file_path: filePath });
                    setSelectedContent("Loading...");
                    try {
                      const res = await fetch(`/api/memory/file?agent=${f.agent || "coding"}&path=${encodeURIComponent(filePath)}`);
                      const data = await res.json();
                      setSelectedContent(data?.content || "No content");
                    } catch { setSelectedContent("Failed to load file content."); }
                  }}>
                    <span className="memory-item-icon">{TYPE_ICONS[f.type] || "\u{1F4C4}"}</span>
                    <div className="memory-item-info">
                      <div className="memory-item-name">{(f.name || f.file || "").replace(/-/g, " ")}</div>
                      <div className="memory-item-type" style={{ color: TYPE_COLORS[f.type] }}>{f.type} — {f.date}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "shared" && (
            <div className="memory-list">
              {sharedFiles.length === 0 && <div className="memory-empty">No shared files</div>}
              {sharedFiles.map((f, i) => {
                const isSelected = selectedEntity?.file_path === `shared/${f.name}`;
                return (
                  <div key={i} className={`memory-item ${isSelected ? "selected" : ""}`} onClick={async () => {
                    setSelectedEntity({ entity_id: f.name, entity_type: "shared", file_path: `shared/${f.name}` });
                    setSelectedContent("Loading...");
                    try {
                      const res = await fetch(`/api/memory/shared/${encodeURIComponent(f.name)}`);
                      const data = await res.json();
                      setSelectedContent(data?.content || "No content");
                    } catch { setSelectedContent("Failed to load."); }
                  }}>
                    <span className="memory-item-icon">{"\u{1F4E2}"}</span>
                    <div className="memory-item-info">
                      <div className="memory-item-name">{f.name.replace(/\.md$/, "")}</div>
                      <div className="memory-item-type" style={{ color: "#58a6ff" }}>{f.size ? `${(f.size / 1024).toFixed(1)}KB` : "shared"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "daily" && (() => {
            // Filter by agent, then group by date
            const filteredDaily = agentFilter === "all" ? dailyMemories : dailyMemories.filter(f => f.agent === agentFilter);
            const grouped = {};
            for (const f of filteredDaily) {
              const d = f.date || "undated";
              if (!grouped[d]) grouped[d] = [];
              grouped[d].push(f);
            }
            const dates = Object.keys(grouped).sort().reverse();
            return (
              <div className="memory-list">
                <div style={{ padding: "6px 10px", display: "flex", gap: 4 }}>
                  <input type="date" className="memory-date-picker" value={dailyDate} onChange={e => setDailyDate(e.target.value)} style={{ flex: 1 }} />
                  {dailyDate && <button className="memory-date-clear" onClick={() => setDailyDate("")}>&times;</button>}
                </div>
                {filteredDaily.length === 0 && <div className="memory-empty">{dailyDate ? `No memories for ${dailyDate}` : "No memories found"}</div>}
                {dates.map(date => (
                  <div key={date} className="memory-date-group">
                    <div className="memory-date-header">{date}</div>
                    {grouped[date].map((f, i) => {
                      const filePath = `${f.date}/${f.file}`;
                      const isSelected = selectedEntity?.file_path === filePath;
                      return (
                        <div key={i} className={`memory-item ${isSelected ? "selected" : ""}`} onClick={async () => {
                          setSelectedEntity({ entity_id: f.name, entity_type: f.type, agent: f.agent, file_path: filePath });
                          setSelectedContent("Loading...");
                          try {
                            const res = await fetch(`/api/memory/file?agent=${f.agent || "coding"}&path=${encodeURIComponent(filePath)}`);
                            const data = await res.json();
                            setSelectedContent(data?.content || "No content");
                          } catch { setSelectedContent("Failed to load."); }
                        }}>
                          <span className="memory-item-icon">{TYPE_ICONS[f.type] || "\u{1F4C4}"}</span>
                          <div className="memory-item-info">
                            <div className="memory-item-name">{(f.name || f.file || "").replace(/-/g, " ")}</div>
                            <div className="memory-item-type" style={{ color: TYPE_COLORS[f.type] }}>{f.type} — {f.agent}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="memory-detail">
          {view === "daily" && selectedEntity ? (
            <div className="memory-detail-content">
              <div className="memory-detail-header">
                <h3>{selectedEntity.entity_id?.replace(/-/g, " ") || "Memory"}</h3>
                <div className="memory-detail-meta">
                  {selectedEntity.entity_type && <span className="memory-detail-type" style={{ color: TYPE_COLORS[selectedEntity.entity_type], borderColor: TYPE_COLORS[selectedEntity.entity_type] }}>{selectedEntity.entity_type}</span>}
                  {selectedEntity.agent && <span className="memory-detail-agent">{selectedEntity.agent}</span>}
                </div>
              </div>
              <pre className="memory-content-text">{selectedContent || "Select a memory..."}</pre>
            </div>
          ) : view === "daily" ? (
            <div className="memory-detail-content">
              <div className="memory-detail-header">
                <h3>Daily Notes — {dailyDate}</h3>
              </div>
              <pre className="memory-content-text">{dailyNotes || "No daily notes. Select a memory from the left."}</pre>
            </div>
          ) : selectedEntity ? (
            <div className="memory-detail-content">
              <div className="memory-detail-header">
                <h3>{selectedEntity.entity_id?.split("/").pop()?.replace(/-/g, " ") || "Memory"}</h3>
                <div className="memory-detail-meta">
                  {selectedEntity.entity_type && <span className="memory-detail-type" style={{ color: TYPE_COLORS[selectedEntity.entity_type], borderColor: TYPE_COLORS[selectedEntity.entity_type] }}>{selectedEntity.entity_type}</span>}
                  {selectedEntity.agent && <span className="memory-detail-agent">{selectedEntity.agent}</span>}
                  {selectedEntity.file_path && <span className="memory-detail-path">{selectedEntity.file_path}</span>}
                </div>
              </div>
              <pre className="memory-content-text">{selectedContent || "Loading..."}</pre>
            </div>
          ) : (
            <div className="memory-empty-detail">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
              <p>Select a memory to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
