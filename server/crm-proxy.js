import { Router } from "express";

// Helper: make authenticated request to CRM backend
async function crmFetch(req, path, options = {}) {
  const url = req.headers["x-crm-url"];
  const token = req.headers["x-crm-token"];
  if (!url || !token) {
    const err = new Error("CRM not connected");
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    const err = new Error("CRM token expired — please reconnect");
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(body || `CRM returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Normalize CRM task → Claude Manager shape
function normalizeTask(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description || "",
    status: t.status,
    priority: t.priority || "medium",
    deadline: t.dueDate || null,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    parent_task_id: t.parentId || null,
    conversation_id: null,
    tags: [],
    category: "crm",
    // CRM extras
    assigneeName: t.assigneeName || null,
    assignorName: t.assignorName || null,
    creatorName: t.creatorName || null,
    projectName: t.projectName || null,
    projectId: t.projectId || null,
    labels: t.labels || [],
    sortOrder: t.sortOrder || 0,
    subtask_count: t.subtaskCount ?? t.subtask_count ?? 0,
    subtask_completed: t.subtaskCompleted ?? t.subtask_completed ?? 0,
    _source: "crm",
  };
}

// Reverse: Claude Manager fields → CRM fields
function toCrmPayload(body) {
  const payload = {};
  if (body.title !== undefined) payload.title = body.title;
  if (body.description !== undefined) payload.description = body.description;
  if (body.priority !== undefined) payload.priority = body.priority;
  if (body.status !== undefined) payload.status = body.status;
  if (body.deadline !== undefined) payload.dueDate = body.deadline;
  if (body.parent_task_id !== undefined) payload.parentId = body.parent_task_id;
  return payload;
}

export function createCrmProxyRouter() {
  const router = Router();

  // --- Connection ---

  // Login to CRM, return token to browser (not stored server-side)
  router.post("/connect", async (req, res) => {
    try {
      const { url, email, password } = req.body;
      if (!url || !email || !password) return res.status(400).json({ error: "url, email, and password required" });

      const loginRes = await fetch(`${url}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) {
        const body = await loginRes.text();
        return res.status(loginRes.status).json({ error: body || "Login failed" });
      }
      const data = await loginRes.json();
      res.json({ ok: true, token: data.token, user: data.user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Validate token
  router.get("/status", async (req, res) => {
    try {
      const user = await crmFetch(req, "/auth/me");
      res.json({ connected: true, user });
    } catch (err) {
      res.json({ connected: false, error: err.message });
    }
  });

  // --- Tasks CRUD ---

  // List tasks
  router.get("/tasks", async (req, res) => {
    try {
      const params = new URLSearchParams();
      if (req.query.status) params.set("status", req.query.status);
      if (req.query.priority) params.set("priority", req.query.priority);
      if (req.query.search) params.set("search", req.query.search);
      const qs = params.toString();
      const data = await crmFetch(req, `/org/tasks${qs ? `?${qs}` : ""}`);
      const tasks = Array.isArray(data) ? data : (data.tasks || data.data || []);
      res.json(tasks.map(normalizeTask));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Get single task with details
  router.get("/tasks/:id", async (req, res) => {
    try {
      const data = await crmFetch(req, `/org/tasks/${req.params.id}`);
      const task = data.task || data;
      const normalized = normalizeTask(task);
      normalized.subtasks = (task.subtasks || data.subtasks || []).map(normalizeTask);
      normalized.comments = task.comments || data.comments || [];
      normalized.history = (task.activity || data.activity || data.history || []).map(h => ({
        id: h.id,
        action: h.action,
        previous_value: h.oldValue || h.previous_value || h.previousValue,
        new_value: h.newValue || h.new_value || h.newValue,
        created_at: h.createdAt || h.created_at,
      }));
      res.json(normalized);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Create task
  router.post("/tasks", async (req, res) => {
    try {
      const payload = toCrmPayload(req.body);
      const data = await crmFetch(req, "/org/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const task = data.task || data;
      res.json(normalizeTask(task));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Update task
  router.put("/tasks/:id", async (req, res) => {
    try {
      const payload = toCrmPayload(req.body);
      const data = await crmFetch(req, `/org/tasks/${req.params.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const task = data.task || data;
      res.json(normalizeTask(task));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Also support PATCH
  router.patch("/tasks/:id", async (req, res) => {
    try {
      const payload = toCrmPayload(req.body);
      const data = await crmFetch(req, `/org/tasks/${req.params.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const task = data.task || data;
      res.json(normalizeTask(task));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Complete task
  router.post("/tasks/:id/complete", async (req, res) => {
    try {
      const data = await crmFetch(req, `/org/tasks/${req.params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      const task = data.task || data;
      res.json(normalizeTask(task));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Delete task
  router.delete("/tasks/:id", async (req, res) => {
    try {
      await crmFetch(req, `/org/tasks/${req.params.id}`, { method: "DELETE" });
      res.json({ ok: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // --- Subtasks ---

  router.get("/tasks/:id/subtasks", async (req, res) => {
    try {
      const data = await crmFetch(req, `/org/tasks/${req.params.id}/subtasks`);
      const subtasks = Array.isArray(data) ? data : (data.subtasks || []);
      res.json(subtasks.map(normalizeTask));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  router.post("/tasks/:id/subtasks", async (req, res) => {
    try {
      const payload = toCrmPayload(req.body);
      const data = await crmFetch(req, `/org/tasks/${req.params.id}/subtasks`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      res.json(normalizeTask(data.task || data));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // --- Comments ---

  router.get("/tasks/:id/comments", async (req, res) => {
    try {
      const data = await crmFetch(req, `/org/tasks/${req.params.id}/comments`);
      res.json(Array.isArray(data) ? data : (data.comments || []));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  router.post("/tasks/:id/comments", async (req, res) => {
    try {
      const data = await crmFetch(req, `/org/tasks/${req.params.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: req.body.content }),
      });
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // --- Activity ---

  router.get("/tasks/:id/activity", async (req, res) => {
    try {
      const data = await crmFetch(req, `/org/tasks/${req.params.id}/activity`);
      const activity = Array.isArray(data) ? data : (data.activity || []);
      res.json(activity.map(h => ({
        id: h.id,
        action: h.action,
        previous_value: h.oldValue || h.previousValue || h.previous_value,
        new_value: h.newValue || h.new_value,
        created_at: h.createdAt || h.created_at,
      })));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // --- Analytics (computed) ---

  router.get("/tasks/analytics/summary", async (req, res) => {
    try {
      const data = await crmFetch(req, "/org/tasks");
      const tasks = Array.isArray(data) ? data : (data.tasks || data.data || []);
      const now = new Date();
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

      const byStatus = { todo: 0, "in-progress": 0, review: 0, done: 0 };
      const byPriority = { urgent: 0, high: 0, medium: 0, low: 0 };
      let completedThisWeek = 0;
      let overdue = 0;

      for (const t of tasks) {
        if (byStatus[t.status] !== undefined) byStatus[t.status]++;
        if (t.status !== "done" && byPriority[t.priority] !== undefined) byPriority[t.priority]++;
        if (t.status === "done" && new Date(t.updatedAt) >= weekAgo) completedThisWeek++;
        if (t.dueDate && new Date(t.dueDate) < now && t.status !== "done") overdue++;
      }

      res.json({ byStatus, byPriority, completedThisWeek, overdue });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  return router;
}
