let currentBarber = JSON.parse(sessionStorage.getItem('barber') || 'null');

function money(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDatePt(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

async function init() {
  const barbers = await fetch('/api/barbers').then((r) => r.json());
  document.getElementById('barberSelect').innerHTML = barbers
    .map((b) => `<option value="${b.id}">${b.name}</option>`)
    .join('');

  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('panelDate').addEventListener('change', loadAppointments);
  document.getElementById('addBlockBtn').addEventListener('click', addBlock);
  document.getElementById('changePinBtn').addEventListener('click', changePin);

  const dateInput = document.getElementById('panelDate');
  dateInput.value = new Date().toISOString().slice(0, 10);

  if (currentBarber) {
    showPanel();
  }
}

async function login() {
  const barberId = document.getElementById('barberSelect').value;
  const pin = document.getElementById('pinInput').value.trim();
  const errorEl = document.getElementById('loginError');
  errorEl.innerHTML = '';

  const res = await fetch('/api/barber/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barberId, pin }),
  });
  const data = await res.json();

  if (!res.ok) {
    errorEl.innerHTML = `<div class="error-msg">${data.error}</div>`;
    return;
  }

  currentBarber = data;
  sessionStorage.setItem('barber', JSON.stringify(data));
  showPanel();
}

function logout() {
  sessionStorage.removeItem('barber');
  currentBarber = null;
  document.getElementById('panel').style.display = 'none';
  document.getElementById('loginCard').style.display = 'block';
  document.getElementById('pinInput').value = '';
}

function showPanel() {
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('panel').style.display = 'block';
  document.getElementById('welcomeMsg').textContent = `Olá, ${currentBarber.name}`;
  loadAppointments();
}

async function loadAppointments() {
  const date = document.getElementById('panelDate').value;
  const res = await fetch(`/api/barber/${currentBarber.id}/appointments?date=${date}`);
  const data = await res.json();

  const list = document.getElementById('apptList');
  const emptyMsg = document.getElementById('emptyMsg');

  const items = [
    ...data.appointments.map((a) => ({ type: 'appt', ...a })),
    ...data.blocks.map((b) => ({ type: 'block', ...b })),
  ].sort((a, b) => a.start_time.localeCompare(b.start_time));

  if (items.length === 0) {
    list.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  list.innerHTML = items
    .map((item) => {
      if (item.type === 'block') {
        return `
          <div class="appt-row">
            <span class="appt-time">${item.start_time}</span>
            <span class="appt-info muted">Bloqueado${item.reason ? ' — ' + item.reason : ''}</span>
            <span class="appt-actions">
              <button class="btn-small danger" data-block-id="${item.id}">Remover</button>
            </span>
          </div>`;
      }
      return `
        <div class="appt-row">
          <span class="appt-time">${item.start_time}</span>
          <span class="appt-info">
            <strong>${item.client_name}</strong> — ${item.service_names} (${money(item.total_price_cents)})<br>
            <span class="muted">${item.client_phone}</span>
            <span class="status-badge status-${item.status}">${item.status}</span>
          </span>
          <span class="appt-actions">
            ${
              item.status === 'confirmado'
                ? `<button class="btn-small success" data-done-id="${item.id}">Concluir</button>
                   <button class="btn-small danger" data-cancel-id="${item.id}">Cancelar</button>`
                : ''
            }
          </span>
        </div>`;
    })
    .join('');

  list.querySelectorAll('[data-done-id]').forEach((btn) =>
    btn.addEventListener('click', () => updateStatus(btn.dataset.doneId, 'concluido'))
  );
  list.querySelectorAll('[data-cancel-id]').forEach((btn) =>
    btn.addEventListener('click', () => updateStatus(btn.dataset.cancelId, 'cancelado'))
  );
  list.querySelectorAll('[data-block-id]').forEach((btn) =>
    btn.addEventListener('click', () => removeBlock(btn.dataset.blockId))
  );
}

async function updateStatus(id, status) {
  await fetch(`/api/barber/appointments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  loadAppointments();
}

async function addBlock() {
  const startTime = document.getElementById('blockStart').value;
  const endTime = document.getElementById('blockEnd').value;
  const reason = document.getElementById('blockReason').value.trim();
  const date = document.getElementById('panelDate').value;
  const errorEl = document.getElementById('blockError');
  errorEl.innerHTML = '';

  if (!startTime || !endTime) {
    errorEl.innerHTML = '<div class="error-msg">Informe início e fim.</div>';
    return;
  }
  if (endTime <= startTime) {
    errorEl.innerHTML = '<div class="error-msg">Horário de fim deve ser depois do início.</div>';
    return;
  }

  const res = await fetch('/api/barber/blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barberId: currentBarber.id, date, startTime, endTime, reason }),
  });

  if (!res.ok) {
    const data = await res.json();
    errorEl.innerHTML = `<div class="error-msg">${data.error}</div>`;
    return;
  }

  document.getElementById('blockStart').value = '';
  document.getElementById('blockEnd').value = '';
  document.getElementById('blockReason').value = '';
  loadAppointments();
}

async function removeBlock(id) {
  await fetch(`/api/barber/blocks/${id}`, { method: 'DELETE' });
  loadAppointments();
}

async function changePin() {
  const currentPin = document.getElementById('currentPinInput').value.trim();
  const newPin = document.getElementById('newPinInput').value.trim();
  const confirmPin = document.getElementById('confirmPinInput').value.trim();
  const msgEl = document.getElementById('changePinMsg');
  msgEl.innerHTML = '';

  if (!currentPin || !newPin || !confirmPin) {
    msgEl.innerHTML = '<div class="error-msg">Preencha todos os campos.</div>';
    return;
  }
  if (newPin !== confirmPin) {
    msgEl.innerHTML = '<div class="error-msg">Os novos PINs não coincidem.</div>';
    return;
  }

  const res = await fetch('/api/barber/change-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barberId: currentBarber.id, currentPin, newPin }),
  });
  const data = await res.json();

  if (!res.ok) {
    msgEl.innerHTML = `<div class="error-msg">${data.error}</div>`;
    return;
  }

  msgEl.innerHTML = '<p class="muted" style="color:var(--success)">PIN alterado com sucesso.</p>';
  document.getElementById('currentPinInput').value = '';
  document.getElementById('newPinInput').value = '';
  document.getElementById('confirmPinInput').value = '';
}

init();
