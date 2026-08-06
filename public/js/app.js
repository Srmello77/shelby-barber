const state = {
  selectedServices: [],
  serviceStepDone: false,
  barber: null,
  date: null,
  time: null,
  allServices: [],
  barbers: [],
  singleBarber: false,
};

const steps = ['service', 'barber', 'date', 'time', 'contact', 'done'];

function money(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDuration(min) {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

function totalDuration() {
  return state.selectedServices.reduce((sum, s) => sum + s.duration_min, 0);
}

function totalPrice() {
  return state.selectedServices.reduce((sum, s) => sum + s.price_cents, 0);
}

function renderStepIndicator() {
  const indicatorSteps = state.singleBarber
    ? ['service', 'date', 'time', 'contact']
    : ['service', 'barber', 'date', 'time', 'contact'];
  const current = currentVisibleStep();
  const activeIndex = indicatorSteps.indexOf(current);
  const el = document.getElementById('stepIndicator');
  el.innerHTML = indicatorSteps
    .map((s, i) => {
      let cls = 'step-dot';
      if (i < activeIndex) cls += ' done';
      if (i === activeIndex) cls += ' active';
      return `<span class="${cls}"></span>`;
    })
    .join('');
}

function currentVisibleStep() {
  if (!state.serviceStepDone) return 'service';
  if (!state.barber) return 'barber';
  if (!state.date) return 'date';
  if (!state.time) return 'time';
  return 'contact';
}

function showStep() {
  const pastBarberStep = state.singleBarber ? state.serviceStepDone : !!state.barber;

  document.getElementById('step-service').style.display = 'block';
  document.getElementById('step-barber').style.display =
    !state.singleBarber && state.serviceStepDone ? 'block' : 'none';
  document.getElementById('step-date').style.display = pastBarberStep ? 'block' : 'none';
  document.getElementById('step-time').style.display = state.date ? 'block' : 'none';
  document.getElementById('step-contact').style.display = state.time ? 'block' : 'none';

  const n = state.singleBarber ? { date: 2, time: 3, contact: 4 } : { date: 3, time: 4, contact: 5 };
  document.getElementById('dateStepTitle').textContent = `${n.date}. Escolha a data`;
  document.getElementById('timeStepTitle').textContent = `${n.time}. Escolha o horário`;
  document.getElementById('contactStepTitle').textContent = `${n.contact}. Seus dados`;

  renderStepIndicator();
}

function updateServiceSummary() {
  const summaryEl = document.getElementById('serviceSummary');
  const continueBtn = document.getElementById('continueServiceBtn');

  if (state.selectedServices.length === 0) {
    summaryEl.textContent = '';
    continueBtn.disabled = true;
    return;
  }

  const names = state.selectedServices.map((s) => s.name).join(' + ');
  summaryEl.textContent = `${names} — ${formatDuration(totalDuration())} · ${money(totalPrice())}`;
  continueBtn.disabled = false;
}

async function init() {
  const [services, barbers] = await Promise.all([
    fetch('/api/services').then((r) => r.json()),
    fetch('/api/barbers').then((r) => r.json()),
  ]);
  state.allServices = services;
  state.barbers = barbers;
  state.singleBarber = barbers.length === 1;
  if (state.singleBarber) state.barber = barbers[0];

  document.getElementById('serviceOptions').innerHTML = services
    .map(
      (s) => `
      <button class="option-btn" data-id="${s.id}">
        <span>${s.name}<small>${formatDuration(s.duration_min)}</small></span>
        <span class="price">${money(s.price_cents)}</span>
      </button>`
    )
    .join('');

  document.getElementById('barberOptions').innerHTML = barbers
    .map((b) => `<button class="option-btn" data-id="${b.id}"><span>${b.name}</span></button>`)
    .join('');

  const dateInput = document.getElementById('dateInput');
  const today = new Date();
  const max = new Date();
  max.setDate(max.getDate() + 30);
  dateInput.min = today.toISOString().slice(0, 10);
  dateInput.max = max.toISOString().slice(0, 10);

  document.getElementById('serviceOptions').addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    const service = services.find((s) => s.id == btn.dataset.id);

    const idx = state.selectedServices.findIndex((s) => s.id === service.id);
    if (idx >= 0) {
      state.selectedServices.splice(idx, 1);
      btn.classList.remove('selected');
    } else {
      state.selectedServices.push(service);
      btn.classList.add('selected');
    }

    updateServiceSummary();

    // Se o cliente já tinha avançado e volta a mexer nos serviços, refaz o
    // fluxo a partir da data (duração pode ter mudado).
    if (state.serviceStepDone) {
      state.serviceStepDone = false;
      resetFrom('barber');
      showStep();
    }
  });

  document.getElementById('continueServiceBtn').addEventListener('click', () => {
    if (state.selectedServices.length === 0) return;
    state.serviceStepDone = true;
    showStep();
  });

  document.getElementById('barberOptions').addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    state.barber = barbers.find((b) => b.id == btn.dataset.id);
    markSelected('barberOptions', btn);
    resetFrom('date');
    showStep();
  });

  dateInput.addEventListener('change', () => {
    state.date = dateInput.value;
    resetFrom('time');
    showStep();
    if (state.date) loadSlots();
  });

  document.getElementById('confirmBtn').addEventListener('click', submitBooking);
  document.getElementById('lookupBtn').addEventListener('click', lookupAppointment);

  showStep();
}

function markSelected(containerId, btn) {
  document.getElementById(containerId).querySelectorAll('.option-btn').forEach((b) => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function resetFrom(step) {
  if (!state.singleBarber && steps.indexOf(step) <= steps.indexOf('barber')) state.barber = null;
  if (steps.indexOf(step) <= steps.indexOf('date')) state.date = null;
  if (steps.indexOf(step) <= steps.indexOf('time')) state.time = null;
}

async function loadSlots() {
  const grid = document.getElementById('slotsGrid');
  grid.innerHTML = '<p class="muted">Carregando horários...</p>';
  document.getElementById('noSlotsMsg').style.display = 'none';

  const params = new URLSearchParams({
    barberId: state.barber.id,
    date: state.date,
    serviceIds: state.selectedServices.map((s) => s.id).join(','),
  });
  const { slots } = await fetch(`/api/availability?${params}`).then((r) => r.json());

  if (slots.length === 0) {
    grid.innerHTML = '';
    document.getElementById('noSlotsMsg').style.display = 'block';
    return;
  }

  grid.innerHTML = slots.map((t) => `<button class="slot-btn" data-time="${t}">${t}</button>`).join('');
  grid.querySelectorAll('.slot-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.time = btn.dataset.time;
      grid.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      showStep();
    });
  });
}

async function submitBooking() {
  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const errorEl = document.getElementById('formError');
  errorEl.innerHTML = '';

  if (!name || !phone) {
    errorEl.innerHTML = '<div class="error-msg">Preencha nome e telefone.</div>';
    return;
  }

  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'Agendando...';

  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barberId: state.barber.id,
        serviceIds: state.selectedServices.map((s) => s.id),
        date: state.date,
        startTime: state.time,
        clientName: name,
        clientPhone: phone,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao agendar');

    document.getElementById('step-service').style.display = 'none';
    document.getElementById('step-barber').style.display = 'none';
    document.getElementById('step-date').style.display = 'none';
    document.getElementById('step-time').style.display = 'none';
    document.getElementById('step-contact').style.display = 'none';
    document.getElementById('lookupCard').style.display = 'none';
    document.getElementById('stepIndicator').style.display = 'none';

    document.getElementById('step-done').style.display = 'block';
    document.getElementById('confirmCode').textContent = data.code;
    document.getElementById('confirmDetails').textContent =
      `${data.service} com ${data.barber} em ${formatDatePt(data.date)} às ${data.startTime}`;
  } catch (err) {
    errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    if (String(err.message).includes('reservado')) {
      loadSlots();
      state.time = null;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar agendamento';
  }
}

function formatDatePt(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

async function lookupAppointment() {
  const code = document.getElementById('lookupCode').value.trim().toUpperCase();
  const resultEl = document.getElementById('lookupResult');
  if (!code) return;

  resultEl.innerHTML = '<p class="muted">Buscando...</p>';
  const res = await fetch(`/api/appointments/${code}`);
  const data = await res.json();

  if (!res.ok) {
    resultEl.innerHTML = `<div class="error-msg">${data.error}</div>`;
    return;
  }

  const statusClass = `status-${data.status}`;
  resultEl.innerHTML = `
    <div style="margin-top:14px">
      <p><strong>${data.service_names}</strong> com ${data.barber_name}</p>
      <p class="muted">${formatDatePt(data.date)} às ${data.start_time} · ${money(data.total_price_cents)}</p>
      <span class="status-badge ${statusClass}">${data.status}</span>
      ${
        data.status === 'confirmado'
          ? `<button class="btn-small danger" style="margin-top:12px" id="cancelBtn">Cancelar agendamento</button>`
          : ''
      }
    </div>`;

  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
      await fetch(`/api/appointments/${code}`, { method: 'DELETE' });
      lookupAppointment();
    });
  }
}

init();
