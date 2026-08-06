// Horário de funcionamento da barbearia.
// 0 = Domingo, 1 = Segunda, ... 6 = Sábado (mesmo padrão do Date.getDay()).
// Cada dia é uma lista de turnos ({ open, close }) — permite dias com mais de
// um turno (ex: sábado). Use "null" para dia fechado.
const SHOP_HOURS = {
  0: null, // domingo — fechado
  1: [{ open: '14:15', close: '23:00' }], // segunda
  2: [{ open: '14:15', close: '23:00' }], // terça
  3: [{ open: '14:15', close: '23:00' }], // quarta
  4: [{ open: '14:15', close: '23:00' }], // quinta
  5: null, // sexta — fechado
  6: [
    { open: '09:30', close: '11:45' },
    { open: '14:15', close: '23:00' },
  ], // sábado
};

// Intervalo entre horários disponíveis, em minutos.
const SLOT_STEP_MIN = 15;

// Quantos dias no futuro o cliente pode agendar.
const BOOKING_WINDOW_DAYS = 30;

module.exports = { SHOP_HOURS, SLOT_STEP_MIN, BOOKING_WINDOW_DAYS };
