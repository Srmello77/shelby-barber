const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Em produção (Railway), defina DB_PATH apontando para o volume persistente,
// ex: /data/shelby.sqlite — senão o banco é apagado a cada deploy.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'db', 'shelby.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.dbPath = dbPath;

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

// Catálogo de serviços atual (2026-08-06). Se ainda não estiver aplicado,
// desativa os serviços antigos (sem apagar — preserva o histórico de
// agendamentos que os referenciam) e insere o catálogo novo.
const hasCurrentCatalog = db
  .prepare("SELECT 1 FROM services WHERE name = 'Corte' AND duration_min = 45 AND price_cents = 3000")
  .get();
if (!hasCurrentCatalog) {
  db.prepare('UPDATE services SET active = 0').run();
  const insertService = db.prepare(
    'INSERT INTO services (name, duration_min, price_cents) VALUES (?, ?, ?)'
  );
  insertService.run('Corte', 45, 3000);
  insertService.run('Sobrancelha', 15, 500);
  insertService.run('Barba', 30, 2000);
  insertService.run('Pigmentação', 10, 1500);
  insertService.run('Pigmentação na Barba', 10, 1000);
  insertService.run('Alisamento Americano', 30, 5000);
  insertService.run('Luzes', 210, 13000);
  insertService.run('Nevou', 210, 16000);
}

// Migração multi-serviço (2026-08-06): um agendamento pode ter mais de um
// serviço, com duração e preço somados. Guarda um "retrato" (snapshot) do
// nome/preço/duração de cada serviço no momento do agendamento, pra não
// depender de o catálogo continuar igual no futuro.
const hasMultiService = db
  .prepare("SELECT 1 FROM pragma_table_info('appointments') WHERE name = 'service_ids'")
  .get();
if (!hasMultiService) {
  db.exec(`
    ALTER TABLE appointments ADD COLUMN service_ids TEXT;
    ALTER TABLE appointments ADD COLUMN service_names TEXT;
    ALTER TABLE appointments ADD COLUMN total_price_cents INTEGER;
    ALTER TABLE appointments ADD COLUMN total_duration_min INTEGER;
  `);

  const getService = db.prepare('SELECT name, price_cents, duration_min FROM services WHERE id = ?');
  const updateAppt = db.prepare(
    'UPDATE appointments SET service_ids = ?, service_names = ?, total_price_cents = ?, total_duration_min = ? WHERE id = ?'
  );
  for (const row of db.prepare('SELECT id, service_id FROM appointments').all()) {
    const s = getService.get(row.service_id);
    if (s) {
      updateAppt.run(JSON.stringify([row.service_id]), s.name, s.price_cents, s.duration_min, row.id);
    }
  }
}

module.exports = db;
