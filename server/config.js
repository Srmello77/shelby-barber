// Horário de funcionamento da barbearia.
// 0 = Domingo, 1 = Segunda, ... 6 = Sábado (mesmo padrão do Date.getDay()).
// Use "null" para dia fechado.
const SHOP_HOURS = {
  0: null,
  1: null,
  2: { open: '09:00', close: '19:00' },
  3: { open: '09:00', close: '19:00' },
  4: { open: '09:00', close: '19:00' },
  5: { open: '09:00', close: '19:00' },
  6: { open: '09:00', close: '18:00' },
};

// Intervalo entre horários disponíveis, em minutos.
const SLOT_STEP_MIN = 15;

// Quantos dias no futuro o cliente pode agendar.
const BOOKING_WINDOW_DAYS = 30;

module.exports = { SHOP_HOURS, SLOT_STEP_MIN, BOOKING_WINDOW_DAYS };
