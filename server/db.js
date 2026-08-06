const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Em produção (Railway), defina DB_PATH apontando para o volume persistente,
// ex: /data/shelby.sqlite — senão o banco é apagado a cada deploy.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'db', 'shelby.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS barbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    barber_id INTEGER NOT NULL REFERENCES barbers(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmado',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barber_id INTEGER NOT NULL REFERENCES barbers(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    reason TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_barber_date ON appointments(barber_id, date);
  CREATE INDEX IF NOT EXISTS idx_blocks_barber_date ON blocks(barber_id, date);
`);

const barberCount = db.prepare('SELECT COUNT(*) AS n FROM barbers').get().n;
if (barberCount === 0) {
  const insertBarber = db.prepare('INSERT INTO barbers (name, pin) VALUES (?, ?)');
  insertBarber.run('Shelby', '1234');
}

const serviceCount = db.prepare('SELECT COUNT(*) AS n FROM services').get().n;
if (serviceCount === 0) {
  const insertService = db.prepare(
    'INSERT INTO services (name, duration_min, price_cents) VALUES (?, ?, ?)'
  );
  insertService.run('Corte Básico', 30, 3000);
  insertService.run('Corte Degrade', 45, 3500);
  insertService.run('Sobrancelha', 20, 2000);
  insertService.run('Barba', 30, 3000);
  insertService.run('Combo 1 (Corte Degrade + Barba)', 80, 5500);
  insertService.run('Combo 2 (Corte Degrade + Barba + Sobrancelha)', 90, 7500);
}

module.exports = db;
