import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import db from './src/db';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  app.use(express.json());

  // --- Assessment Types ---
  app.get('/api/admin/assessment-types', (req, res) => {
    const types = db.prepare('SELECT * FROM assessment_types').all();
    res.json(types);
  });

  app.post('/api/admin/assessment-types', (req, res) => {
    const { name, description } = req.body;
    const result = db.prepare('INSERT INTO assessment_types (name, description) VALUES (?, ?)').run(name, description);
    res.json({ id: result.lastInsertRowid, name, description, active: 1 });
  });

  app.patch('/api/admin/assessment-types/:id', (req, res) => {
    const { name, description } = req.body;
    db.prepare('UPDATE assessment_types SET name = ?, description = ? WHERE id = ?').run(name, description, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/admin/assessment-types/:id/deactivate', (req, res) => {
    db.prepare('UPDATE assessment_types SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // --- Environment Types ---
  app.get('/api/admin/environment-types', (req, res) => {
    const types = db.prepare('SELECT * FROM environment_types').all();
    res.json(types);
  });

  app.post('/api/admin/environment-types', (req, res) => {
    const { name, description } = req.body;
    const result = db.prepare('INSERT INTO environment_types (name, description) VALUES (?, ?)').run(name, description);
    res.json({ id: result.lastInsertRowid, name, description, active: 1 });
  });

  app.patch('/api/admin/environment-types/:id', (req, res) => {
    const { name, description } = req.body;
    db.prepare('UPDATE environment_types SET name = ?, description = ? WHERE id = ?').run(name, description, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/admin/environment-types/:id/deactivate', (req, res) => {
    db.prepare('UPDATE environment_types SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // --- Risk Types ---
  app.get('/api/admin/risk-types', (req, res) => {
    const types = db.prepare('SELECT * FROM risk_types').all();
    res.json(types);
  });

  app.post('/api/admin/risk-types', (req, res) => {
    const { name, description } = req.body;
    const result = db.prepare('INSERT INTO risk_types (name, description) VALUES (?, ?)').run(name, description);
    res.json({ id: result.lastInsertRowid, name, description, active: 1 });
  });

  app.patch('/api/admin/risk-types/:id', (req, res) => {
    const { name, description } = req.body;
    db.prepare('UPDATE risk_types SET name = ?, description = ? WHERE id = ?').run(name, description, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/admin/risk-types/:id/deactivate', (req, res) => {
    db.prepare('UPDATE risk_types SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // --- AI Thresholds ---
  app.get('/api/admin/ai-thresholds', (req, res) => {
    const thresholds = db.prepare('SELECT * FROM ai_thresholds ORDER BY updated_at DESC LIMIT 10').all();
    res.json(thresholds);
  });

  app.put('/api/admin/ai-thresholds', (req, res) => {
    const { threshold_value } = req.body;
    db.prepare('INSERT INTO ai_thresholds (threshold_value, updated_by) VALUES (?, ?)').run(threshold_value, 1);
    
    db.prepare('INSERT INTO audit_logs (entity, action, user_id, details) VALUES (?, ?, ?, ?)').run(
      'ai_thresholds', 'UPDATE', 1, JSON.stringify({ new_value: threshold_value })
    );
    
    res.json({ success: true });
  });

  // --- Processing Jobs ---
  app.get('/api/admin/processing-jobs', (req, res) => {
    const status = req.query.status as string;
    let jobs;
    if (status) {
      jobs = db.prepare('SELECT * FROM processing_jobs WHERE status = ? ORDER BY created_at DESC').all(status);
    } else {
      jobs = db.prepare('SELECT * FROM processing_jobs ORDER BY created_at DESC').all();
    }
    res.json(jobs);
  });

  app.post('/api/admin/processing-jobs/:id/reprocess', (req, res) => {
    db.prepare('UPDATE processing_jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('pending', req.params.id);
    res.json({ success: true });
  });

  // --- Audit Logs ---
  app.get('/api/admin/audit-logs', (req, res) => {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json(logs);
  });

  // --- Reports ---
  app.get('/api/admin/reports', (req, res) => {
    const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
    res.json(reports);
  });

  app.post('/api/admin/assessments/:id/generate-report', (req, res) => {
    db.prepare('INSERT INTO reports (assessment_id, status) VALUES (?, ?)').run(req.params.id, 'generating');
    res.json({ success: true });
  });

  // --- Users ---
  app.get('/api/admin/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json(users);
  });

  app.post('/api/admin/users', (req, res) => {
    const { name, email, role } = req.body;
    const result = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)').run(name, email, role);
    res.json({ id: result.lastInsertRowid, name, email, role, active: 1 });
  });

  app.patch('/api/admin/users/:id', (req, res) => {
    const { name, email, role } = req.body;
    db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(name, email, role, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/admin/users/:id/deactivate', (req, res) => {
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
