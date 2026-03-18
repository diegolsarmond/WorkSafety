import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'worksafety.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS assessment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS environment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS risk_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS ai_thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threshold_value INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY(updated_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS processing_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    user_id INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER,
    status TEXT NOT NULL,
    file_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert initial data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)').run('Admin User', 'admin@worksafety.gov', 'admin');
  db.prepare('INSERT INTO ai_thresholds (threshold_value, updated_by) VALUES (?, ?)').run(60, 1);
  
  // Sample data
  db.prepare('INSERT INTO assessment_types (name, description) VALUES (?, ?)').run('Safety Analysis', 'General safety analysis');
  db.prepare('INSERT INTO environment_types (name, description) VALUES (?, ?)').run('Construction Site', 'Outdoor construction area');
  db.prepare('INSERT INTO risk_types (name, description) VALUES (?, ?)').run('Missing PPE', 'Worker not wearing required PPE');
  
  db.prepare('INSERT INTO processing_jobs (assessment_id, status) VALUES (?, ?)').run(1, 'pending');
  db.prepare('INSERT INTO processing_jobs (assessment_id, status, error_message) VALUES (?, ?, ?)').run(2, 'failed', 'Network timeout');
  
  db.prepare('INSERT INTO reports (assessment_id, status) VALUES (?, ?)').run(1, 'ready');
}

export default db;
