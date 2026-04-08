import React, { useState, useEffect, useCallback } from "react";

export default function ConnectorsPage({ onClose }) {
  const [connectors, setConnectors] = useState({ installed: [], available: [] });
  const [loading, setLoading] = useState({});

  // CRM connection state
  const [crmUrl, setCrmUrl] = useState(() => localStorage.getItem("crm_url") || "");
  const [crmEmail, setCrmEmail] = useState("");
  const [crmPassword, setCrmPassword] = useState("");
  const [crmConnected, setCrmConnected] = useState(false);
  const [crmUser, setCrmUser] = useState(null);
  const [crmError, setCrmError] = useState(null);
  const [crmLoading, setCrmLoading] = useState(false);

  // Check CRM status on mount
  useEffect(() => {
    const token = localStorage.getItem("crm_token");
    const url = localStorage.getItem("crm_url");
    if (token && url) {
      fetch("/api/crm/status", { headers: { "x-crm-url": url, "x-crm-token": token } })
        .then(r => r.json())
        .then(data => {
          if (data.connected) { setCrmConnected(true); setCrmUser(data.user); setCrmUrl(url); }
          else { localStorage.removeItem("crm_token"); localStorage.removeItem("crm_user"); setCrmConnected(false); }
        }).catch(() => {});
    }
  }, []);

  const connectCrm = async () => {
    setCrmError(null);
    setCrmLoading(true);
    try {
      const res = await fetch("/api/crm/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crmUrl, email: crmEmail, password: crmPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setCrmError(data.error || "Connection failed"); return; }
      localStorage.setItem("crm_url", crmUrl);
      localStorage.setItem("crm_token", data.token);
      localStorage.setItem("crm_user", JSON.stringify(data.user));
      setCrmConnected(true);
      setCrmUser(data.user);
      setCrmPassword("");
    } catch (err) { setCrmError(err.message); }
    finally { setCrmLoading(false); }
  };

  const disconnectCrm = () => {
    localStorage.removeItem("crm_url");
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    setCrmConnected(false);
    setCrmUser(null);
  };

  const fetchConnectors = useCallback(async () => {
    try { const r = await fetch("/api/connectors"); if (r.ok) setConnectors(await r.json()); } catch {}
  }, []);

  useEffect(() => { fetchConnectors(); }, [fetchConnectors]);

  const handleAdd = async (name) => {
    setLoading(p => ({ ...p, [name]: "adding" }));
    try { await fetch("/api/connectors/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); await fetchConnectors(); }
    catch {} finally { setLoading(p => ({ ...p, [name]: null })); }
  };

  const handleRemove = async (name) => {
    setLoading(p => ({ ...p, [name]: "removing" }));
    try { await fetch(`/api/connectors/${encodeURIComponent(name)}`, { method: "DELETE" }); await fetchConnectors(); }
    catch {} finally { setLoading(p => ({ ...p, [name]: null })); }
  };

  return (
    <div className="cp-root">
      <div className="cp-header">
        <h2 className="cp-title">Connectors</h2>
        <button className="cp-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="cp-scroll">
        {/* Installed */}
        {connectors.installed.length > 0 && (
          <div className="cp-section">
            <div className="cp-label">Installed ({connectors.installed.length})</div>
            {connectors.installed.map(c => (
              <div key={c.name} className="cp-card cp-installed">
                <div className="cp-card-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
                <div className="cp-card-info">
                  <span className="cp-card-name">{c.name}</span>
                  {c.description && <span className="cp-card-desc">{c.description}</span>}
                  <span className="cp-card-cmd">{c.command} {(c.args || []).join(" ")}</span>
                </div>
                <button className="cp-remove-btn" onClick={() => handleRemove(c.name)} disabled={!!loading[c.name]}>
                  {loading[c.name] === "removing" ? "..." : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Available */}
        {connectors.available.length > 0 && (
          <div className="cp-section">
            <div className="cp-label">Available ({connectors.available.length})</div>
            {connectors.available.map(c => (
              <div key={c.name} className="cp-card cp-available">
                <div className="cp-card-icon cp-icon-dim">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
                <div className="cp-card-info">
                  <span className="cp-card-name">{c.name}</span>
                  {c.description && <span className="cp-card-desc">{c.description}</span>}
                  {c.install && <span className="cp-card-install"><code>{c.install}</code></span>}
                </div>
                <button className="cp-add-btn" onClick={() => handleAdd(c.name)} disabled={!!loading[c.name]} title="Register in Claude Code">
                  {loading[c.name] === "adding" ? "..." : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* CRM Integration */}
        <div className="cp-section">
          <div className="cp-label">Integrations</div>
          <div className="cp-card" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="cp-card-icon" style={{ background: crmConnected ? "rgba(34,197,94,0.15)" : "var(--bg-tertiary)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={crmConnected ? "var(--success)" : "currentColor"} strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="cp-card-name">AIO CRM</div>
                <div className="cp-card-desc">
                  {crmConnected
                    ? <span style={{ color: "var(--success)" }}>Connected as {crmUser?.name || crmUser?.username || crmUser?.email || "user"}</span>
                    : "Connect to your company's CRM for tasks, contacts, and more"}
                </div>
              </div>
              {crmConnected && (
                <button className="cp-remove-btn" onClick={disconnectCrm} title="Disconnect">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
            {crmConnected && (
              <div className="crm-modules">
                <div className="crm-modules-label">Connected Modules</div>
                <div className="crm-modules-list">
                  <div className="crm-module active">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                    Tasks
                    <span className="crm-module-status">Active</span>
                  </div>
                  <div className="crm-module upcoming">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                    Contacts
                    <span className="crm-module-status">Coming Soon</span>
                  </div>
                  <div className="crm-module upcoming">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                    Projects
                    <span className="crm-module-status">Coming Soon</span>
                  </div>
                  <div className="crm-module upcoming">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Calendar
                    <span className="crm-module-status">Coming Soon</span>
                  </div>
                </div>

                <div className="crm-endpoints">
                  <div className="crm-endpoints-label">API Endpoints</div>
                  <div className="crm-endpoints-info">
                    All data flows through your CRM's role-based access control. You only see what your CRM account has permission to access.
                  </div>
                  <div className="crm-endpoint-group">
                    <div className="crm-endpoint-title">Tasks (Active)</div>
                    <div className="crm-endpoint"><span className="crm-method get">GET</span><code>/org/tasks</code><span className="crm-endpoint-desc">List tasks</span></div>
                    <div className="crm-endpoint"><span className="crm-method post">POST</span><code>/org/tasks</code><span className="crm-endpoint-desc">Create task</span></div>
                    <div className="crm-endpoint"><span className="crm-method patch">PATCH</span><code>/org/tasks/:id</code><span className="crm-endpoint-desc">Update task</span></div>
                    <div className="crm-endpoint"><span className="crm-method delete">DEL</span><code>/org/tasks/:id</code><span className="crm-endpoint-desc">Delete task</span></div>
                    <div className="crm-endpoint"><span className="crm-method get">GET</span><code>/org/tasks/:id/subtasks</code><span className="crm-endpoint-desc">Subtasks</span></div>
                    <div className="crm-endpoint"><span className="crm-method get">GET</span><code>/org/tasks/:id/comments</code><span className="crm-endpoint-desc">Comments</span></div>
                    <div className="crm-endpoint"><span className="crm-method get">GET</span><code>/org/tasks/:id/activity</code><span className="crm-endpoint-desc">Activity log</span></div>
                  </div>
                  <div className="crm-endpoint-group upcoming">
                    <div className="crm-endpoint-title">Contacts (Coming Soon)</div>
                    <div className="crm-endpoint"><span className="crm-method get">GET</span><code>/org/contacts</code></div>
                  </div>
                  <div className="crm-endpoint-group upcoming">
                    <div className="crm-endpoint-title">Projects (Coming Soon)</div>
                    <div className="crm-endpoint"><span className="crm-method get">GET</span><code>/org/projects</code></div>
                  </div>
                </div>
              </div>
            )}
            {!crmConnected && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                <input className="crm-input" placeholder="CRM API URL (e.g. http://localhost:8000)" value={crmUrl} onChange={e => setCrmUrl(e.target.value)} />
                <input className="crm-input" placeholder="Email" value={crmEmail} onChange={e => setCrmEmail(e.target.value)} />
                <input className="crm-input" type="password" placeholder="Password" value={crmPassword} onChange={e => setCrmPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") connectCrm(); }} />
                {crmError && <div style={{ color: "var(--danger)", fontSize: 11 }}>{crmError}</div>}
                <button className="crm-connect-btn" onClick={connectCrm} disabled={crmLoading || !crmUrl || !crmEmail || !crmPassword}>
                  {crmLoading ? "Connecting..." : "Connect"}
                </button>
              </div>
            )}
          </div>
        </div>

        {connectors.installed.length === 0 && connectors.available.length === 0 && (
          <div className="cp-empty">No MCP connectors found</div>
        )}
      </div>

      <style>{`
        .cp-root { flex:1; display:flex; flex-direction:column; overflow:hidden; font-family:var(--font-sans); }
        .cp-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid var(--border); background:var(--bg-secondary); flex-shrink:0; }
        .cp-title { font-size:15px; font-weight:600; color:var(--text-primary); margin:0; }
        .cp-close { background:none; border:1px solid var(--border); border-radius:var(--radius-md); color:var(--text-muted); width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; }
        .cp-close:hover { color:var(--text-primary); border-color:var(--border-secondary); }
        .cp-scroll { flex:1; overflow-y:auto; padding:20px; }

        .cp-section { margin-bottom:28px; }
        .cp-label { font-size:11px; font-weight:500; color:var(--text-muted); margin-bottom:12px; letter-spacing:.3px; }

        .cp-card { display:flex; align-items:center; gap:14px; padding:14px 16px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:var(--radius-lg); margin-bottom:8px; transition:border-color .15s; }
        .cp-card:hover { border-color:var(--border-secondary); }

        .cp-installed { border-left:3px solid var(--accent); }
        .cp-available { opacity:.65; }
        .cp-available:hover { opacity:1; }

        .cp-card-icon { width:36px; height:36px; border-radius:var(--radius-md); background:var(--accent-muted); display:flex; align-items:center; justify-content:center; color:var(--accent-light); flex-shrink:0; }
        .cp-icon-dim { background:var(--bg-tertiary); color:var(--text-muted); }

        .cp-card-info { flex:1; display:flex; flex-direction:column; gap:2px; min-width:0; }
        .cp-card-name { font-size:13px; font-weight:600; color:var(--text-primary); }
        .cp-card-cmd { font-size:10px; color:var(--text-muted); font-family:var(--font-mono); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cp-card-desc { font-size:11px; color:var(--text-muted); }
        .cp-card-install { font-size:10px; color:var(--text-muted); margin-top:2px; }
        .cp-card-install code { font-size:10px; background:var(--bg-tertiary); padding:1px 4px; border-radius:3px; font-family:var(--font-mono); color:var(--accent-light); }

        .cp-remove-btn { background:none; border:1px solid transparent; color:var(--text-muted); cursor:pointer; padding:8px; border-radius:var(--radius-md); flex-shrink:0; transition:all .15s; }
        .cp-remove-btn:hover { color:var(--danger); background:var(--danger-bg); }
        .cp-remove-btn:disabled { opacity:.4; cursor:default; }

        .cp-add-btn { background:none; border:1px solid transparent; color:var(--text-muted); cursor:pointer; padding:8px; border-radius:var(--radius-md); flex-shrink:0; transition:all .15s; }
        .cp-add-btn:hover { color:var(--accent-light); background:var(--accent-muted); }
        .cp-add-btn:disabled { opacity:.4; cursor:default; }

        .cp-empty { text-align:center; padding:60px; color:var(--text-muted); font-size:14px; }

        .crm-input { padding:7px 10px; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:var(--radius-md); color:var(--text-primary); font-size:12px; font-family:var(--font-sans); outline:none; }
        .crm-input:focus { border-color:var(--accent); }
        .crm-input::placeholder { color:var(--text-muted); }
        .crm-connect-btn { padding:8px 16px; background:var(--accent); color:#fff; border:none; border-radius:var(--radius-md); font-size:12px; font-weight:600; cursor:pointer; font-family:var(--font-sans); }
        .crm-connect-btn:hover { opacity:.9; }
        .crm-connect-btn:disabled { opacity:.4; cursor:default; }

        .crm-modules { border-top:1px solid var(--border); padding-top:8px; }
        .crm-modules-label { font-size:10px; font-weight:500; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; letter-spacing:.3px; }
        .crm-modules-list { display:flex; flex-wrap:wrap; gap:6px; }
        .crm-module { display:flex; align-items:center; gap:5px; padding:5px 10px; border-radius:6px; font-size:11px; border:1px solid var(--border); background:var(--bg-tertiary); color:var(--text-secondary); }
        .crm-module.active { border-color:rgba(34,197,94,0.3); background:rgba(34,197,94,0.06); color:var(--text-primary); }
        .crm-module.upcoming { opacity:.5; }
        .crm-module-status { font-size:9px; padding:1px 5px; border-radius:3px; margin-left:4px; }
        .crm-module.active .crm-module-status { background:rgba(34,197,94,0.15); color:var(--success); }
        .crm-module.upcoming .crm-module-status { background:rgba(255,255,255,0.05); color:var(--text-muted); }

        .crm-endpoints { margin-top:10px; border-top:1px solid var(--border); padding-top:8px; }
        .crm-endpoints-label { font-size:10px; font-weight:500; color:var(--text-muted); text-transform:uppercase; letter-spacing:.3px; margin-bottom:4px; }
        .crm-endpoints-info { font-size:10px; color:var(--text-muted); margin-bottom:8px; line-height:1.5; padding:6px 8px; background:rgba(34,197,94,0.04); border:1px solid rgba(34,197,94,0.1); border-radius:4px; }
        .crm-endpoint-group { margin-bottom:8px; }
        .crm-endpoint-group.upcoming { opacity:.4; }
        .crm-endpoint-title { font-size:11px; font-weight:600; color:var(--text-primary); margin-bottom:3px; }
        .crm-endpoint { display:flex; align-items:center; gap:6px; padding:2px 0; font-size:10px; }
        .crm-endpoint code { font-family:var(--font-mono); color:var(--text-secondary); font-size:10px; }
        .crm-endpoint-desc { color:var(--text-muted); margin-left:auto; font-size:9px; }
        .crm-method { font-size:8px; font-weight:700; padding:1px 4px; border-radius:2px; font-family:var(--font-mono); min-width:28px; text-align:center; }
        .crm-method.get { background:rgba(34,197,94,0.12); color:var(--success); }
        .crm-method.post { background:rgba(234,179,8,0.12); color:var(--warning); }
        .crm-method.patch { background:rgba(88,166,255,0.12); color:#58a6ff; }
        .crm-method.delete { background:rgba(239,68,68,0.12); color:var(--danger); }
      `}</style>
    </div>
  );
}
