const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const { SHOP_HOURS, BOOKING_WINDOW_DAYS } = require('./config');
const { getAvailableSlots, toMinutes, formatDate } = require('./availability');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

// ---------- Serviços ----------
app.get('/api/services', (req, res) => {
  const services = db
    .prepare('SELECT id, name, duration_min, price_cents FROM services WHERE active = 1 ORDER BY id')
    .all();
  res.json(services);
});

// ---------- Barbeiros ----------
app.get('/api/barbers', (req, res) => {
  const barbers = db.prepare('SELECT id, name FROM barbers WHERE active = 1 ORDER BY id').all();
  res.json(barbers);
});

// ---------- Horário de funcionamento ----------
app.get('/api/shop-hours', (req, res) => {
  res.json({ hours: SHOP_HOURS, bookingWindowDays: BOOKING_WINDOW_DAYS });
});

function getServicesByIds(serviceIds) {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) return [];
  const placeholders = serviceIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT * FROM services WHERE id IN (${placeholders}) AND active = 1`)
    .all(...serviceIds);
}

// ---------- Disponibilidade ----------
app.get('/api/availability', (req, res) => {
  const { barberId, date, serviceIds } = req.query;
  if (!barberId || !date || !serviceIds) {
    return res.status(400).json({ error: 'barberId, date e serviceIds são obrigatórios' });
  }

  const ids = String(serviceIds)
    .split(',')
    .map((id) => Number(id.trim()))
    .filter(Boolean);
  const services = getServicesByIds(ids);
  if (services.length !== ids.length) {
    return res.status(404).json({ error: 'Um ou mais serviços não foram encontrados' });
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration_min, 0);

  const appointments = db
    .prepare(
      "SELECT start_time, end_time FROM appointments WHERE barber_id = ? AND date = ? AND status != 'cancelado'"
    )
    .all(barberId, date);

  const blocks = db
    .prepare('SELECT start_time, end_time FROM blocks WHERE barber_id = ? AND date = ?')
    .all(barberId, date);

  const busyRanges = [...appointments, ...blocks].map((r) => ({
    start: toMinutes(r.start_time),
    end: toMinutes(r.end_time),
  }));

  const slots = getAvailableSlots({
    date,
    durationMin: totalDuration,
    busyRanges,
  });

  res.json({ slots });
});

// ---------- Criar agendamento ----------
app.post('/api/appointments', (req, res) => {
  const { barberId, serviceIds, date, startTime, clientName, clientPhone } = req.body || {};

  if (
    !barberId ||
    !Array.isArray(serviceIds) ||
    serviceIds.length === 0 ||
    !date ||
    !startTime ||
    !clientName ||
    !clientPhone
  ) {
    return res.status(400).json({ error: 'Preencha todos os campos e escolha pelo menos um serviço' });
  }

  const barber = db.prepare('SELECT * FROM barbers WHERE id = ? AND active = 1').get(barberId);
  if (!barber) return res.status(404).json({ error: 'Barbeiro não encontrado' });

  const services = getServicesByIds(serviceIds);
  if (services.length !== serviceIds.length) {
    return res.status(404).json({ error: 'Um ou mais serviços não foram encontrados' });
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration_min, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.price_cents, 0);
  const serviceNames = services.map((s) => s.name).join(', ');

  const startMin = toMinutes(startTime);
  const endMin = startMin + totalDuration;
  const endTime = `${Math.floor(endMin / 60)
    .toString()
    .padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;

  // Revalida disponibilidade no servidor para evitar conflitos de concorrência
  const appointments = db
    .prepare(
      "SELECT start_time, end_time FROM appointments WHERE barber_id = ? AND date = ? AND status != 'cancelado'"
    )
    .all(barberId, date);
  const blocks = db
    .prepare('SELECT start_time, end_time FROM blocks WHERE barber_id = ? AND date = ?')
    .all(barberId, date);

  const busy = [...appointments, ...blocks].some((r) => {
    const rs = toMinutes(r.start_time);
    const re = toMinutes(r.end_time);
    return startMin < re && endMin > rs;
  });

  if (busy) {
    return res.status(409).json({ error: 'Esse horário acabou de ser reservado. Escolha outro.' });
  }

  let code;
  do {
    code = generateCode();
  } while (db.prepare('SELECT 1 FROM appointments WHERE code = ?').get(code));

  db.prepare(
    `INSERT INTO appointments
       (code, barber_id, service_id, service_ids, service_names, total_price_cents, total_duration_min,
        date, start_time, end_time, client_name, client_phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    code,
    barberId,
    serviceIds[0],
    JSON.stringify(serviceIds),
    serviceNames,
    totalPrice,
    totalDuration,
    date,
    startTime,
    endTime,
    clientName,
    clientPhone
  );

  res.status(201).json({
    code,
    barber: barber.name,
    service: serviceNames,
    date,
    startTime,
    endTime,
  });
});

// ---------- Consultar / cancelar agendamento pelo código ----------
app.get('/api/appointments/:code', (req, res) => {
  const appt = db
    .prepare(
      `SELECT a.code, a.date, a.start_time, a.end_time, a.status, a.client_name,
              a.service_names, a.total_price_cents,
              b.name AS barber_name
       FROM appointments a
       JOIN barbers b ON b.id = a.barber_id
       WHERE a.code = ?`
    )
    .get(req.params.code.toUpperCase());

  if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });
  res.json(appt);
});

app.delete('/api/appointments/:code', (req, res) => {
  const result = db
    .prepare("UPDATE appointments SET status = 'cancelado' WHERE code = ? AND status != 'cancelado'")
    .run(req.params.code.toUpperCase());

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Agendamento não encontrado ou já cancelado' });
  }
  res.json({ ok: true });
});

// ---------- Painel do barbeiro ----------
app.post('/api/barber/login', (req, res) => {
  const { barberId, pin } = req.body || {};
  const barber = db.prepare('SELECT * FROM barbers WHERE id = ? AND active = 1').get(barberId);
  if (!barber || barber.pin !== String(pin || '')) {
    return res.status(401).json({ error: 'PIN inválido' });
  }
  res.json({ id: barber.id, name: barber.name });
});

app.post('/api/barber/change-pin', (req, res) => {
  const { barberId, currentPin, newPin } = req.body || {};
  if (!newPin || !/^\d{4,6}$/.test(String(newPin))) {
    return res.status(400).json({ error: 'O novo PIN deve ter de 4 a 6 números' });
  }

  const barber = db.prepare('SELECT * FROM barbers WHERE id = ? AND active = 1').get(barberId);
  if (!barber || barber.pin !== String(currentPin || '')) {
    return res.status(401).json({ error: 'PIN atual incorreto' });
  }

  db.prepare('UPDATE barbers SET pin = ? WHERE id = ?').run(String(newPin), barberId);
  res.json({ ok: true });
});

app.get('/api/barber/:barberId/appointments', (req, res) => {
  const { date } = req.query;
  const { barberId } = req.params;
  if (!date) return res.status(400).json({ error: 'date é obrigatório' });

  const appts = db
    .prepare(
      `SELECT a.id, a.code, a.start_time, a.end_time, a.status, a.client_name, a.client_phone,
              a.service_names, a.total_price_cents
       FROM appointments a
       WHERE a.barber_id = ? AND a.date = ?
       ORDER BY a.start_time`
    )
    .all(barberId, date);

  const blocks = db
    .prepare('SELECT id, start_time, end_time, reason FROM blocks WHERE barber_id = ? AND date = ? ORDER BY start_time')
    .all(barberId, date);

  res.json({ appointments: appts, blocks });
});

app.patch('/api/barber/appointments/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!['confirmado', 'concluido', 'cancelado'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  const result = db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
  res.json({ ok: true });
});

app.post('/api/barber/blocks', (req, res) => {
  const { barberId, date, startTime, endTime, reason } = req.body || {};
  if (!barberId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  }
  const result = db
    .prepare('INSERT INTO blocks (barber_id, date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)')
    .run(barberId, date, startTime, endTime, reason || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete('/api/barber/blocks/:id', (req, res) => {
  const result = db.prepare('DELETE FROM blocks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Bloqueio não encontrado' });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Shelby Barber rodando em http://localhost:${PORT}`);
});
