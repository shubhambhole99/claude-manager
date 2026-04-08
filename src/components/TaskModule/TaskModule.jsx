import React, { useState, useEffect, useCallback } from "react";
import "./TaskModule.css";

export default function TaskModule({ socket, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filters, setFilters] = useState({ status: "", priority: "", search: "" });
  const [view, setView] = useState("list");
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Task source: "local" or "crm"
  const [taskSource, setTaskSource] = useState(() => {
    const token = localStorage.getItem("crm_token");
    const url = localStorage.getItem("crm_url");
    return (token && url) ? "crm" : "local";
  });

  const isCrm = taskSource === "crm";
  const apiBase = isCrm ? "/api/crm" : "/api";
  const crmHeaders = isCrm ? { "x-crm-url": localStorage.getItem("crm_url") || "", "x-crm-token": localStorage.getItem("crm_token") || "" } : {};

  const apiFetch = useCallback((path, options = {}) => {
    return fetch(`${apiBase}${path}`, { ...options, headers: { "Content-Type": "application/json", ...crmHeaders, ...(options.headers || {}) } });
  }, [apiBase, taskSource]);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.search) params.set("search", filters.search);
      const res = await apiFetch(`/tasks?${params}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : (data.tasks || []));
    } catch {} finally { setLoading(false); }
  }, [filters, apiFetch]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await apiFetch("/tasks/analytics/summary");
      setAnalytics(await res.json());
    } catch {}
  }, [apiFetch]);

  useEffect(() => { fetchTasks(); fetchAnalytics(); }, [fetchTasks, fetchAnalytics]);

  // Real-time updates (local only — CRM doesn't push via sockets)
  useEffect(() => {
    if (!socket || isCrm) return;
    const onCreated = (task) => { setTasks(p => [task, ...p]); fetchAnalytics(); };
    const onUpdated = (task) => { setTasks(p => p.map(t => t.id === task.id ? { ...t, ...task } : t)); fetchAnalytics(); };
    const onDeleted = ({ id }) => { setTasks(p => p.filter(t => t.id !== id)); fetchAnalytics(); };
    socket.on("task:created", onCreated);
    socket.on("task:updated", onUpdated);
    socket.on("task:deleted", onDeleted);
    return () => { socket.off("task:created", onCreated); socket.off("task:updated", onUpdated); socket.off("task:deleted", onDeleted); };
  }, [socket, isCrm, fetchAnalytics]);

  const createTask = async (data) => {
    const res = await apiFetch("/tasks", { method: "POST", body: JSON.stringify(data) });
    const task = await res.json();
    setShowModal(false);
    setEditingTask(null);
    if (isCrm) fetchTasks();
    return task;
  };

  const updateTask = async (id, data) => {
    await apiFetch(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) });
    if (isCrm) fetchTasks();
  };

  const deleteTask = async (id) => {
    await apiFetch(`/tasks/${id}`, { method: "DELETE" });
    if (selectedTask?.id === id) setSelectedTask(null);
    if (isCrm) fetchTasks();
  };

  const completeTask = async (id) => {
    await apiFetch(`/tasks/${id}/complete`, { method: "POST" });
    if (isCrm) fetchTasks();
  };

  const switchSource = (src) => {
    setTaskSource(src);
    setTasks([]);
    setSelectedTask(null);
    setAnalytics(null);
    setLoading(true);
  };

  return (
    <div className="task-module">
      <div className="task-header">
        <div className="task-header-left">
          <h2>Tasks</h2>
          {analytics && (
            <div className="task-stats">
              {isCrm ? (
                <>
                  <span className="stat">{(analytics.byStatus?.todo || 0) + (analytics.byStatus?.["in-progress"] || 0)} open</span>
                  <span className="stat stat-progress">{analytics.byStatus?.["in-progress"] || 0} active</span>
                  <span className="stat stat-done">{analytics.completedThisWeek} done this week</span>
                </>
              ) : (
                <>
                  <span className="stat">{analytics.byStatus?.incomplete || 0} open</span>
                  <span className="stat stat-progress">{analytics.byStatus?.in_progress || 0} active</span>
                  <span className="stat stat-done">{analytics.completedThisWeek} done this week</span>
                </>
              )}
              {analytics.overdue > 0 && <span className="stat stat-overdue">{analytics.overdue} overdue</span>}
            </div>
          )}
        </div>
        <div className="task-header-right">
          <div className="task-views">
            {localStorage.getItem("crm_token") && (
              <>
                <button className={`view-btn ${taskSource === "local" ? "active" : ""}`} onClick={() => switchSource("local")}>Local</button>
                <button className={`view-btn ${taskSource === "crm" ? "active" : ""}`} onClick={() => switchSource("crm")}>CRM</button>
                <span style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />
              </>
            )}
            {["list", "timeline"].map(v => (
              <button key={v} className={`view-btn ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
                {v === "list" ? "List" : "Timeline"}
              </button>
            ))}
          </div>
          <button className="task-add-btn" onClick={() => { setEditingTask(null); setShowModal(true); }}>+ New Task</button>
          <button className="task-close-btn" onClick={onClose}>x</button>
        </div>
      </div>

      <div className="task-body">
        <div className="task-filters">
          <input
            className="task-search"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
          />
          <div className="filter-group">
            <label>Status</label>
            <select value={filters.status} onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))}>
              <option value="">All</option>
              {isCrm ? (
                <>
                  <option value="todo">Todo</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </>
              ) : (
                <>
                  <option value="incomplete">Incomplete</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </>
              )}
            </select>
          </div>
          <div className="filter-group">
            <label>Priority</label>
            <select value={filters.priority} onChange={(e) => setFilters(p => ({ ...p, priority: e.target.value }))}>
              <option value="">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="task-content">
          {loading ? (
            <div className="task-loading">Loading tasks...</div>
          ) : view === "list" ? (
            <TaskList
              tasks={tasks}
              selectedId={selectedTask?.id}
              onSelect={async (t) => {
                const res = await apiFetch(`/tasks/${t.id}`);
                setSelectedTask(await res.json());
              }}
              onComplete={completeTask}
              onDelete={deleteTask}
              onEdit={(t) => { setEditingTask(t); setShowModal(true); }}
            />
          ) : (
            <TaskTimeline tasks={tasks} />
          )}

          {selectedTask && (
            <TaskDetails
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onUpdate={updateTask}
              onAddSubtask={async (title) => {
                if (isCrm) {
                  await apiFetch(`/tasks/${selectedTask.id}/subtasks`, { method: "POST", body: JSON.stringify({ title }) });
                } else {
                  await createTask({ title, parent_task_id: selectedTask.id });
                }
                const res = await apiFetch(`/tasks/${selectedTask.id}`);
                setSelectedTask(await res.json());
              }}
              onCompleteSubtask={async (id) => {
                await completeTask(id);
                const res = await apiFetch(`/tasks/${selectedTask.id}`);
                setSelectedTask(await res.json());
              }}
              isCrm={isCrm}
            />
          )}
        </div>
      </div>

      {showModal && (
        <TaskModal
          task={editingTask}
          onSave={(data) => editingTask ? updateTask(editingTask.id, data).then(() => { setShowModal(false); fetchTasks(); }) : createTask(data)}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}
    </div>
  );
}

// --- Task List ---
function TaskList({ tasks, selectedId, onSelect, onComplete, onDelete, onEdit }) {
  if (tasks.length === 0) return <div className="task-empty">No tasks yet. Create one!</div>;

  return (
    <div className="task-list">
      {tasks.map(task => (
        <div
          key={task.id}
          className={`task-item ${task.status} ${task.id === selectedId ? "selected" : ""}`}
          onClick={() => onSelect(task)}
        >
          <button
            className={`task-check ${(task.status === "completed" || task.status === "done") ? "checked" : ""}`}
            onClick={(e) => { e.stopPropagation(); if (task.status !== "completed" && task.status !== "done") onComplete(task.id); }}
          >
            {(task.status === "completed" || task.status === "done") ? "\u2713" : ""}
          </button>
          <div className="task-item-body">
            <div className="task-item-title">{task.title}</div>
            {task.description && <div className="task-item-desc">{task.description.slice(0, 80)}</div>}
            <div className="task-item-meta">
              {task.deadline && <span className="task-deadline">{new Date(task.deadline).toLocaleDateString()}</span>}
              {task.subtask_count > 0 && (
                <span className="task-subtasks">{task.subtask_completed}/{task.subtask_count} subtasks</span>
              )}
              {task.tags?.length > 0 && task.tags.map(t => <span key={t} className="task-tag">{t}</span>)}
            </div>
          </div>
          <span className={`task-priority-badge p-${task.priority}`}>{task.priority}</span>
          <div className="task-item-actions">
            <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} title="Edit">e</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} title="Delete">x</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Task Timeline ---
function TaskTimeline({ tasks }) {
  const grouped = {};
  for (const t of tasks) {
    const d = new Date(t.created_at).toLocaleDateString();
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  }

  return (
    <div className="task-timeline">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date} className="timeline-group">
          <div className="timeline-date">{date}</div>
          {items.map(t => (
            <div key={t.id} className={`timeline-item ${t.status}`}>
              <span className={`timeline-dot p-${t.priority}`} />
              <span className="timeline-title">{t.title}</span>
              <span className={`timeline-status s-${t.status}`}>{t.status}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Task Details Panel ---
function TaskDetails({ task, onClose, onUpdate, onAddSubtask, onCompleteSubtask, isCrm }) {
  const [subtaskTitle, setSubtaskTitle] = useState("");

  return (
    <div className="task-details">
      <div className="task-details-header">
        <h3>{task.title}</h3>
        <button onClick={onClose}>x</button>
      </div>
      {task.description && <p className="task-details-desc">{task.description}</p>}
      <div className="task-details-meta">
        <div><strong>Status:</strong> <span className={`s-${task.status}`}>{task.status}</span></div>
        <div><strong>Priority:</strong> <span className={`p-${task.priority}`}>{task.priority}</span></div>
        {task.deadline && <div><strong>Deadline:</strong> {new Date(task.deadline).toLocaleString()}</div>}
        {isCrm && task.assigneeName && <div><strong>Assignee:</strong> {task.assigneeName}</div>}
        {isCrm && task.projectName && <div><strong>Project:</strong> {task.projectName}</div>}
        {isCrm && task.creatorName && <div><strong>Created by:</strong> {task.creatorName}</div>}
        <div><strong>Created:</strong> {new Date(task.created_at).toLocaleString()}</div>
        <div><strong>Updated:</strong> {new Date(task.updated_at).toLocaleString()}</div>
        {isCrm && task.labels?.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
            {task.labels.map(l => (
              <span key={l.id} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: l.color || "var(--accent-muted)", color: "#fff" }}>{l.name}</span>
            ))}
          </div>
        )}
      </div>

      {/* Subtasks */}
      <div className="task-subtasks-section">
        <h4>Subtasks</h4>
        {task.subtasks?.map(st => (
          <div key={st.id} className={`subtask-item ${st.status}`}>
            <button className={`task-check ${(st.status === "completed" || st.status === "done") ? "checked" : ""}`}
              onClick={() => onCompleteSubtask(st.id)}>
              {(st.status === "completed" || st.status === "done") ? "\u2713" : ""}
            </button>
            <span>{st.title}</span>
          </div>
        ))}
        <form className="subtask-add" onSubmit={(e) => {
          e.preventDefault();
          if (subtaskTitle.trim()) { onAddSubtask(subtaskTitle.trim()); setSubtaskTitle(""); }
        }}>
          <input placeholder="Add subtask..." value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} />
          <button type="submit">+</button>
        </form>
      </div>

      {/* History */}
      {task.history?.length > 0 && (
        <div className="task-history-section">
          <h4>History</h4>
          {task.history.map(h => (
            <div key={h.id} className="history-item">
              <span className="history-action">{h.action}</span>
              {h.previous_value && <span className="history-prev">{h.previous_value}</span>}
              {h.new_value && <span className="history-next">{h.new_value}</span>}
              <span className="history-time">{new Date(h.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Task Modal ---
function TaskModal({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [deadline, setDeadline] = useState(task?.deadline ? task.deadline.slice(0, 16) : "");
  const [tags, setTags] = useState(task?.tags?.join(", ") || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      deadline: deadline || null,
      tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{task ? "Edit Task" : "New Task"}</h3>
        <form onSubmit={handleSubmit}>
          <input className="modal-input" placeholder="Task title..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea className="modal-textarea" placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <div className="modal-row">
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <input className="modal-input" placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-save">{task ? "Update" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
