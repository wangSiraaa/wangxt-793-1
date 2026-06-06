const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'exhibitor.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
});

function run(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.run(sql, ...params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.get(sql, ...params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.all(sql, ...params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function prepare(sql) {
  const stmt = db.prepare(sql);
  
  return {
    run: function(...params) {
      return new Promise((resolve, reject) => {
        stmt.run(...params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get: function(...params) {
      return new Promise((resolve, reject) => {
        stmt.get(...params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    all: function(...params) {
      return new Promise((resolve, reject) => {
        stmt.all(...params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    },
    finalize: function() {
      return new Promise((resolve, reject) => {
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
}

const initTables = async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('exhibitor', 'organizer', 'printer', 'security')),
      real_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exhibitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      company_code TEXT UNIQUE NOT NULL,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      contact_email TEXT,
      address TEXT,
      business_license TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      reject_reason TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS personnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exhibitor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      id_card TEXT NOT NULL,
      phone TEXT,
      gender TEXT CHECK(gender IN ('male', 'female', 'other')),
      position TEXT,
      credential_type TEXT NOT NULL DEFAULT 'exhibitor' CHECK(credential_type IN ('exhibitor', 'worker', 'vip', 'media')),
      photo_path TEXT,
      photo_status TEXT DEFAULT 'pending' CHECK(photo_status IN ('pending', 'approved', 'rejected')),
      photo_reject_reason TEXT,
      audit_status TEXT DEFAULT 'pending' CHECK(audit_status IN ('pending', 'approved', 'rejected')),
      audit_reject_reason TEXT,
      credential_status TEXT DEFAULT 'draft' CHECK(credential_status IN ('draft', 'printed', 'issued', 'lost', 'cancelled')),
      batch_id INTEGER,
      is_locked INTEGER DEFAULT 0,
      import_conflict INTEGER DEFAULT 0,
      conflict_note TEXT,
      company_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exhibitor_id) REFERENCES exhibitors(id),
      FOREIGN KEY (batch_id) REFERENCES print_batches(id)
    );

    CREATE TABLE IF NOT EXISTS print_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      batch_name TEXT,
      total_count INTEGER DEFAULT 0,
      printed_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'printing', 'completed', 'cancelled')),
      created_by INTEGER,
      creator_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS verify_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL,
      credential_id TEXT NOT NULL,
      verify_result TEXT NOT NULL CHECK(verify_result IN ('success', 'failed')),
      fail_reason TEXT,
      verify_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified_by INTEGER,
      location TEXT,
      personnel_name TEXT,
      verify_note TEXT,
      operator_name TEXT,
      FOREIGN KEY (personnel_id) REFERENCES personnel(id),
      FOREIGN KEY (verified_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS issue_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL,
      issued_by INTEGER,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      receiver_name TEXT,
      receiver_signature TEXT,
      notes TEXT,
      FOREIGN KEY (personnel_id) REFERENCES personnel(id),
      FOREIGN KEY (issued_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_personnel_id_card ON personnel(id_card);
    CREATE INDEX IF NOT EXISTS idx_personnel_exhibitor ON personnel(exhibitor_id);
    CREATE INDEX IF NOT EXISTS idx_personnel_audit ON personnel(audit_status);
    CREATE INDEX IF NOT EXISTS idx_verify_logs_personnel ON verify_logs(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_verify_logs_time ON verify_logs(verify_time);
  `);

  const userRow = await get('SELECT COUNT(*) as count FROM users');
  if (userRow.count === 0) {
    const bcrypt = require('bcryptjs');
    
    await run(`INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)`, 
      ['admin', bcrypt.hashSync('admin123', 10), 'organizer', '系统管理员']);
    await run(`INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)`, 
      ['organizer', bcrypt.hashSync('organizer', 10), 'organizer', '主办方']);
    await run(`INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)`, 
      ['printer', bcrypt.hashSync('printer', 10), 'printer', '制证员']);
    await run(`INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)`, 
      ['security', bcrypt.hashSync('security', 10), 'security', '安保人员']);
    await run(`INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)`, 
      ['exhibitor1', bcrypt.hashSync('exhibitor', 10), 'exhibitor', '展商用户']);
  }
  
  const exhibitorRow = await get('SELECT COUNT(*) as count FROM exhibitors');
  if (exhibitorRow.count === 0) {
    await run(`INSERT INTO exhibitors (company_name, company_code, contact_name, contact_phone, status, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      ['默认展商公司', 'EX001', '张三', '13800138000', 'approved', 5]);
  }
};

(async () => {
  try {
    await initTables();
    console.log('数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err);
  }
})();

module.exports = {
  db,
  run,
  get,
  all,
  exec,
  prepare
};
