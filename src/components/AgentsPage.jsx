import React, { useState, useEffect } from "react";

export default function AgentsPage({ onClose }) {
  const [agents, setAgents] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      setAgents(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAgents(); }, []);

  const createAgent = async () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return;
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setNewName("");
      fetchAgents();
    } catch (e) { setError(e.message); }
  };

  const deleteAgent = async (name) => {
    try {
      await fetch(`/api/agents/${name}`, { method: "DELETE" });
      setConfirmDelete(null);
      fetchAgents();
    } catch {}
  };

  const isBuiltIn = (name) => name === "coding" || name === "personal";

  return (
    <div className="agents-page">
      <style>{`
        .agents-page { flex:1; display:flex; flex-direction:column; overflow:hidden; font-family:var(--font-sans); background:var(--bg-primary); }
        .agents-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid var(--border); background:var(--bg-secondary); flex-shrink:0; }
        .agents-header h2 { font-size:15px; font-weight:600; color:var(--text-primary); margin:0; }
        .agents-body { flex:1; overflow-y:auto; padding:16px 20px; }
        .agents-create { display:flex; gap:8px; margin-bottom:20px; }
        .agents-input { flex:1; padding:8px 12px; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:var(--radius-md); color:var(--text-primary); font-size:13px; font-family:var(--font-mono); outline:none; }
        .agents-input:focus { border-color:var(--accent); }
        .agents-input::placeholder { color:var(--text-muted); }
        .agents-create-btn { padding:8px 16px; background:var(--accent); color:#fff; border:none; border-radius:var(--radius-md); font-size:12px; font-weight:600; cursor:pointer; }
        .agents-create-btn:hover { opacity:0.9; }
        .agents-error { color:var(--danger); font-size:12px; margin-bottom:12px; }
        .agents-list { display:flex; flex-direction:column; gap:8px; }
        .agent-card { display:flex; align-items:center; gap:14px; padding:14px 16px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:var(--radius-lg); }
        .agent-card:hover { border-color:var(--border-secondary, rgba(255,255,255,0.12)); }
        .agent-icon { width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
        .agent-icon.coding { background:rgba(124,106,239,0.15); }
        .agent-icon.personal { background:rgba(34,197,94,0.15); }
        .agent-icon.custom { background:rgba(234,179,8,0.15); }
        .agent-info { flex:1; min-width:0; }
        .agent-name { font-size:14px; font-weight:600; color:var(--text-primary); text-transform:capitalize; }
        .agent-desc { font-size:11px; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .agent-badges { display:flex; gap:4px; margin-top:4px; }
        .agent-badge { font-size:9px; padding:1px 5px; border-radius:3px; background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid rgba(255,255,255,0.06); }
        .agent-badge.built-in { background:rgba(124,106,239,0.1); color:var(--accent-light); border-color:rgba(124,106,239,0.2); }
        .agent-delete { background:none; border:none; color:var(--text-muted); cursor:pointer; padding:6px; border-radius:4px; }
        .agent-delete:hover { background:rgba(239,68,68,0.1); color:var(--danger); }
        .agents-confirm { display:flex; align-items:center; gap:6px; }
        .agents-confirm-btn { padding:4px 10px; border:none; border-radius:4px; font-size:11px; cursor:pointer; }
        .agents-confirm-yes { background:var(--danger); color:#fff; }
        .agents-confirm-no { background:var(--bg-tertiary); color:var(--text-secondary); }
        .agents-info-box { background:var(--bg-secondary); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px 16px; margin-bottom:16px; }
        .agents-info-title { font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:6px; }
        .agents-info-text { font-size:12px; color:var(--text-secondary); line-height:1.5; }
        .agents-info-list { margin:8px 0 0; padding-left:18px; font-size:11px; color:var(--text-secondary); line-height:1.8; }
        .agents-info-list li { margin-bottom:2px; }
        .agents-info-list strong { color:var(--text-primary); }
        .agents-info-list code { font-size:10px; background:var(--bg-tertiary); padding:1px 4px; border-radius:3px; font-family:var(--font-mono); color:var(--accent-light); }
      `}</style>

      <div className="agents-header">
        <h2>Agents</h2>
        <button className="btn-icon" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="agents-body">
        <div className="agents-info-box">
          <div className="agents-info-title">How agents work</div>
          <div className="agents-info-text">
            Each agent is an isolated workspace. When a conversation is assigned to an agent:
          </div>
          <ul className="agents-info-list">
            <li><strong>Messages</strong> — saved to that agent's folder only (<code>~/.claude/agents/{'<name>'}/messages/</code>)</li>
            <li><strong>Memories</strong> — written to that agent's memory folder, not shared with others</li>
            <li><strong>Identity</strong> — each agent has its own <code>IDENTITY.md</code> for system prompt / persona</li>
            <li><strong>Read access</strong> — agents can read memories from all other agents (cross-agent awareness)</li>
            <li><strong>Write lock</strong> — conversations can only write to the agent they're assigned to</li>
            <li><strong>Filter</strong> — the sidebar dropdown filters conversations by agent</li>
          </ul>
          <div className="agents-info-text" style={{marginTop: 6, color: "var(--text-muted)", fontSize: 11}}>
            Change a conversation's agent via right-click → Settings → Agent.
          </div>
        </div>

        <div className="agents-create">
          <input className="agents-input" placeholder="New agent name..." value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") createAgent(); }} />
          <button className="agents-create-btn" onClick={createAgent}>Create Agent</button>
        </div>
        {error && <div className="agents-error">{error}</div>}

        <div className="agents-list">
          {loading && <div style={{ color: "var(--text-muted)", padding: 20 }}>Loading...</div>}
          {agents.map(agent => (
            <div key={agent.name} className="agent-card">
              <div className={`agent-icon ${isBuiltIn(agent.name) ? agent.name : "custom"}`}>
                {agent.name === "coding" ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg> :
                 agent.name === "personal" ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> :
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>}
              </div>
              <div className="agent-info">
                <div className="agent-name">{agent.name}</div>
                {agent.description && <div className="agent-desc">{agent.description.replace(/^#.*\n*/m, "").trim().slice(0, 100)}</div>}
                <div className="agent-badges">
                  {isBuiltIn(agent.name) && <span className="agent-badge built-in">built-in</span>}
                  {agent.hasIdentity && <span className="agent-badge">IDENTITY.md</span>}
                  {agent.hasMemory && <span className="agent-badge">memory</span>}
                  {agent.hasMessages && <span className="agent-badge">messages</span>}
                </div>
              </div>
              {!isBuiltIn(agent.name) && (
                confirmDelete === agent.name ? (
                  <div className="agents-confirm">
                    <button className="agents-confirm-btn agents-confirm-yes" onClick={() => deleteAgent(agent.name)}>Delete</button>
                    <button className="agents-confirm-btn agents-confirm-no" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="agent-delete" onClick={() => setConfirmDelete(agent.name)} title="Delete agent">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
