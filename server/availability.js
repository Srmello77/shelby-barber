const { SHOP_HOURS, SLOT_STEP_MIN } = require('./config');

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getAvailableSlots({ date, durationMin, busyRanges, now = new Date() }) {
  const dayOfWeek = parseLocalDate(date).getDay();
  const shifts = SHOP_HOURS[dayOfWeek];
  if (!shifts) return [];

  const isToday = date === formatDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const slots = [];
  for (const shift of shifts) {
    const openMin = toMinutes(shift.open);
    const closeMin = toMinutes(shift.close);

    for (let start = openMin; start + durationMin <= closeMin; start += SLOT_STEP_MIN) {
      if (isToday && start <= nowMin) continue;

      const end = start + durationMin;
      const overlaps = busyRanges.some((range) => start < range.end && end > range.start);
      if (!overlaps) slots.push(toHHMM(start));
    }
  }

  return slots;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { getAvailableSlots, toMinutes, toHHMM, formatDate, parseLocalDate };
