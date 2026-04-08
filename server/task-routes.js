import { Router } from "express";

export function createTaskRouter(db, io, memoryManager) {
  const router = Router();

  // Helper: log task history
  async function logHistory(taskId, action, prev, next, reason) {
    await db.query(
      "INSERT INTO task_history (task_id, action, previous_value, new_value, reason) VALUES ($1,$2,$3,$4,$5)",
      [taskId, action, prev || null, next || null, reason || null]
    );
  }

  // GET /api/tasks — list with filters
  router.get("/", async (req, res) => {
    try {
      const { status, priority, search, parent_id, date_from, date_to, limit } = req.query;
      let where = [];
      let params = [];
      let i = 1;

      if (status) { where.push(`status = $${i++}`); params.push(status); }
      if (priority) { where.push(`priority = $${i++}`); params.push(priority); }
      if (search) { where.push(`(title ILIKE $${i} OR description ILIKE $${i})`); params.push(`%${search}%`); i++; }
      if (parent_id) { where.push(`parent_task_id = $${i++}`); params.push(parseInt(parent_id)); }
      else if (!req.query.all) { where.push("parent_task_id IS NULL"); } // top-level only by default
      if (date_from) { where.push(`created_at >= $${i++}`); params.push(date_from); }
      if (date_to) { where.push(`created_at <= $${i++}`); params.push(date_to); }

      const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
      const limitClause = limit ? `LIMIT ${parseInt(limit)}` : "LIMIT 100";

      const result = await db.query(
        `SELECT t.*,
          (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id) as subtask_count,
          (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id AND st.status = 'completed') as subtask_completed
         FROM tasks t ${whereClause}
         ORDER BY
           CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
           created_at DESC
         ${limitClause}`,
        params
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/tasks — create (+ PARA memory linking)
  router.post("/", async (req, res) => {
    try {
      const { title, description, priority, deadline, parent_task_id, conversation_id, tags, estimated_duration, category } = req.body;
      if (!title) return res.status(400).json({ error: "title required" });

      const result = await db.query(
        `INSERT INTO tasks (title, description, priority, deadline, parent_task_id, conversation_id, tags, estimated_duration, category)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [title, description || null, priority || "medium", deadline || null,
         parent_task_id || null, conversation_id || null, tags || [], estimated_duration || null, category || "personal"]
      );
      const task = result.rows[0];
      await logHistory(task.id, "created", null, title);

      // Write to PARA daily note
      if (memoryManager) {
        try {
          const today = new Date().toISOString().split("T")[0];
          const pri = (priority || "medium").toUpperCase();
          memoryManager.appendToDailyNote(today, `[Task #${task.id}] ${title} (${pri})`);
        } catch {}
      }

      io.emit("task:created", task);
      res.json(task);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/tasks/:id — get with history
  router.get("/:id", async (req, res) => {
    try {
      const task = await db.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
      if (task.rows.length === 0) return res.status(404).json({ error: "Not found" });

      const subtasks = await db.query(
        "SELECT * FROM tasks WHERE parent_task_id = $1 ORDER BY created_at", [req.params.id]
      );
      const history = await db.query(
        "SELECT * FROM task_history WHERE task_id = $1 ORDER BY created_at DESC LIMIT 20", [req.params.id]
      );
      const attachments = await db.query(
        "SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at", [req.params.id]
      );

      res.json({
        ...task.rows[0],
        subtasks: subtasks.rows,
        history: history.rows,
        attachments: attachments.rows,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PUT /api/tasks/:id — update
  router.put("/:id", async (req, res) => {
    try {
      const { title, description, priority, status, deadline, tags, estimated_duration, actual_duration } = req.body;
      const old = await db.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
      if (old.rows.length === 0) return res.status(404).json({ error: "Not found" });
      const prev = old.rows[0];

      const result = await db.query(
        `UPDATE tasks SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          priority = COALESCE($3, priority),
          status = COALESCE($4, status),
          deadline = COALESCE($5, deadline),
          tags = COALESCE($6, tags),
          estimated_duration = COALESCE($7, estimated_duration),
          actual_duration = COALESCE($8, actual_duration),
          updated_at = NOW()
         WHERE id = $9 RETURNING *`,
        [title, description, priority, status, deadline, tags, estimated_duration, actual_duration, req.params.id]
      );
      const task = result.rows[0];

      // Log changes
      if (status && status !== prev.status) await logHistory(task.id, "status_changed", prev.status, status);
      if (priority && priority !== prev.priority) await logHistory(task.id, "priority_changed", prev.priority, priority);
      if (title && title !== prev.title) await logHistory(task.id, "renamed", prev.title, title);

      io.emit("task:updated", task);
      res.json(task);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/tasks/:id/complete — quick complete (+ PARA note)
  router.post("/:id/complete", async (req, res) => {
    try {
      const result = await db.query(
        "UPDATE tasks SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *",
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
      const task = result.rows[0];
      await logHistory(task.id, "completed", "incomplete", "completed");

      if (memoryManager) {
        try {
          const today = new Date().toISOString().split("T")[0];
          memoryManager.appendToDailyNote(today, `[Completed #${task.id}] ${task.title}`);
        } catch {}
      }

      io.emit("task:updated", task);
      res.json(task);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/tasks/:id
  router.delete("/:id", async (req, res) => {
    try {
      await db.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
      io.emit("task:deleted", { id: parseInt(req.params.id) });
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/tasks/:id/subtasks
  router.get("/:id/subtasks", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT * FROM tasks WHERE parent_task_id = $1 ORDER BY created_at", [req.params.id]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/tasks/:id/history
  router.get("/:id/history", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT * FROM task_history WHERE task_id = $1 ORDER BY created_at DESC", [req.params.id]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/tasks/:id/attachments
  router.post("/:id/attachments", async (req, res) => {
    try {
      const { file_path, url, attachment_type, description } = req.body;
      const result = await db.query(
        "INSERT INTO task_attachments (task_id, file_path, url, attachment_type, description) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [req.params.id, file_path || null, url || null, attachment_type || "link", description || null]
      );
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/tasks/calendar/:date — tasks for a date
  router.get("/calendar/:date", async (req, res) => {
    try {
      const result = await db.query(
        `SELECT * FROM tasks WHERE
          (deadline::date = $1::date) OR
          (created_at::date = $1::date AND deadline IS NULL)
         ORDER BY priority, created_at`,
        [req.params.date]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/tasks/analytics/summary
  router.get("/analytics/summary", async (req, res) => {
    try {
      const counts = await db.query(`
        SELECT status, COUNT(*) as count FROM tasks GROUP BY status
      `);
      const byPriority = await db.query(`
        SELECT priority, COUNT(*) as count FROM tasks WHERE status != 'completed' GROUP BY priority
      `);
      const recentCompleted = await db.query(`
        SELECT COUNT(*) as count FROM tasks WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '7 days'
      `);
      const overdue = await db.query(`
        SELECT COUNT(*) as count FROM tasks WHERE deadline < NOW() AND status NOT IN ('completed', 'cancelled')
      `);

      res.json({
        byStatus: Object.fromEntries(counts.rows.map(r => [r.status, parseInt(r.count)])),
        byPriority: Object.fromEntries(byPriority.rows.map(r => [r.priority, parseInt(r.count)])),
        completedThisWeek: parseInt(recentCompleted.rows[0]?.count || 0),
        overdue: parseInt(overdue.rows[0]?.count || 0),
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
