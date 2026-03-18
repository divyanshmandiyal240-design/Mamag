// ── STATE ──────────────────────────────────────────────────────────────────
let tickets = JSON.parse(localStorage.getItem('tf_tickets') || '[]');
let currentFilter = 'all';
let currentPriorityFilter = 'all';
let searchQuery = '';
let editingId = null;
let currentModalId = null;
let selectedPriority = 'medium';

// ── HELPERS ────────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('tf_tickets', JSON.stringify(tickets));
}

function genId() {
  return 'TF-' + String(Date.now()).slice(-5);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function priorityColor(p) {
  return { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' }[p] || '#888';
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ── VIEWS ──────────────────────────────────────────────────────────────────
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('view-' + name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');

  if (name === 'dashboard') renderDashboard();
  if (name === 'tickets') renderTable();
  if (name === 'create') {
    document.getElementById('form-title').textContent = editingId ? 'Edit Ticket' : 'Create New Ticket';
    document.getElementById('submit-btn').textContent = editingId ? 'Save Changes' : 'Create Ticket';
    if (!editingId) resetForm();
  }

  // close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function renderDashboard() {
  const open = tickets.filter(t => t.status === 'open').length;
  const prog = tickets.filter(t => t.status === 'in-progress').length;
  const closed = tickets.filter(t => t.status === 'closed').length;
  const total = tickets.length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-open').textContent = open;
  document.getElementById('stat-progress').textContent = prog;
  document.getElementById('stat-closed').textContent = closed;

  // recent tickets
  const recent = [...tickets].reverse().slice(0, 5);
  const recentEl = document.getElementById('recent-list');
  if (recent.length === 0) {
    recentEl.innerHTML = '<p style="color:var(--gray);font-size:.875rem;padding:.5rem 0">No tickets yet.</p>';
  } else {
    recentEl.innerHTML = recent.map(t => `
      <div class="recent-item" onclick="openModal('${t.id}')">
        <div class="recent-dot" style="background:${priorityColor(t.priority)}"></div>
        <div class="recent-info">
          <div class="recent-title">${escHtml(t.title)}</div>
          <div class="recent-meta">${t.id} · ${formatDate(t.createdAt)}</div>
        </div>
        <span class="badge badge-${t.status}">${statusLabel(t.status)}</span>
      </div>
    `).join('');
  }

  // priority chart
  const priorities = ['critical','high','medium','low'];
  const maxCount = Math.max(...priorities.map(p => tickets.filter(t => t.priority === p).length), 1);
  const chartEl = document.getElementById('chart-bars');
  chartEl.innerHTML = priorities.map(p => {
    const count = tickets.filter(t => t.priority === p).length;
    const pct = Math.round((count / maxCount) * 100);
    const color = priorityColor(p);
    return `
      <div class="chart-bar-row">
        <div class="chart-label">${p.charAt(0).toUpperCase() + p.slice(1)}</div>
        <div class="chart-track"><div class="chart-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="chart-count" style="color:${color}">${count}</div>
      </div>
    `;
  }).join('');
}

// ── TABLE ──────────────────────────────────────────────────────────────────
function getFiltered() {
  return tickets.filter(t => {
    const statusOk = currentFilter === 'all' || t.status === currentFilter;
    const prioOk = currentPriorityFilter === 'all' || t.priority === currentPriorityFilter;
    const searchOk = !searchQuery || t.title.toLowerCase().includes(searchQuery) || t.id.toLowerCase().includes(searchQuery);
    return statusOk && prioOk && searchOk;
  });
}

function statusLabel(s) {
  return { open: 'Open', 'in-progress': 'In Progress', closed: 'Closed' }[s] || s;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderTable() {
  const filtered = getFiltered();
  const tbody = document.getElementById('tickets-tbody');
  const empty = document.getElementById('empty-state');

  document.getElementById('nav-count').textContent = tickets.length;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = filtered.slice().reverse().map(t => `
      <tr onclick="openModal('${t.id}')">
        <td><span class="ticket-id">${t.id}</span></td>
        <td><span class="ticket-title-cell">${escHtml(t.title)}</span></td>
        <td><span class="badge badge-${t.priority}">${t.priority.charAt(0).toUpperCase()+t.priority.slice(1)}</span></td>
        <td><span class="badge badge-${t.status}">${statusLabel(t.status)}</span></td>
        <td style="color:var(--gray);font-size:.8rem">${escHtml(t.category)}</td>
        <td style="color:var(--gray);font-size:.8rem">${formatDate(t.createdAt)}</td>
        <td onclick="event.stopPropagation()">
          <div class="action-btns">
            <button class="btn-icon" onclick="startEdit('${t.id}')">Edit</button>
            <button class="btn-icon del" onclick="deleteTicket('${t.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

// ── MODAL ─────────────────────────────────────────────────────────────────
function openModal(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  currentModalId = id;

  document.getElementById('modal-id').textContent = t.id;
  document.getElementById('modal-title').textContent = t.title;
  document.getElementById('modal-desc').textContent = t.description;
  document.getElementById('modal-cat').textContent = t.category;
  document.getElementById('modal-assignee').textContent = t.assignee || '—';
  document.getElementById('modal-date').textContent = formatDate(t.createdAt);

  const mp = document.getElementById('modal-priority');
  mp.className = 'badge badge-' + t.priority;
  mp.textContent = t.priority.charAt(0).toUpperCase() + t.priority.slice(1);

  const ms = document.getElementById('modal-status');
  ms.className = 'badge badge-' + t.status;
  ms.textContent = statusLabel(t.status);

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === t.status);
  });

  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentModalId = null;
}

// ── FORM ───────────────────────────────────────────────────────────────────
function resetForm() {
  document.getElementById('ticket-form').reset();
  document.getElementById('edit-id').value = '';
  editingId = null;
  selectedPriority = 'medium';
  document.querySelectorAll('.prio-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === 'medium');
  });
}

function startEdit(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  editingId = id;
  selectedPriority = t.priority;

  document.getElementById('edit-id').value = id;
  document.getElementById('f-title').value = t.title;
  document.getElementById('f-desc').value = t.description;
  document.getElementById('f-category').value = t.category;
  document.getElementById('f-assignee').value = t.assignee || '';

  document.querySelectorAll('.prio-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === t.priority);
  });

  closeModal();
  switchView('create');
}

function deleteTicket(id) {
  if (!confirm('Delete this ticket?')) return;
  tickets = tickets.filter(t => t.id !== id);
  save();
  closeModal();
  renderTable();
  showToast('Ticket deleted', 'error');
}

// ── EVENTS ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    switchView(item.dataset.view);
  });
});

document.querySelectorAll('[data-view]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    switchView(el.dataset.view);
  });
});

document.getElementById('ticket-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('f-title').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  const category = document.getElementById('f-category').value;
  const assignee = document.getElementById('f-assignee').value.trim();

  if (editingId) {
    const idx = tickets.findIndex(t => t.id === editingId);
    tickets[idx] = { ...tickets[idx], title, description: desc, category, assignee, priority: selectedPriority };
    save();
    editingId = null;
    showToast('Ticket updated');
  } else {
    const ticket = {
      id: genId(),
      title,
      description: desc,
      category,
      assignee,
      priority: selectedPriority,
      status: 'open',
      createdAt: new Date().toISOString()
    };
    tickets.push(ticket);
    save();
    showToast('Ticket created!');
  }

  switchView('tickets');
});

document.getElementById('priority-selector').addEventListener('click', e => {
  const btn = e.target.closest('.prio-btn');
  if (!btn) return;
  selectedPriority = btn.dataset.value;
  document.querySelectorAll('.prio-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTable();
  });
});

document.getElementById('priority-filter').addEventListener('change', e => {
  currentPriorityFilter = e.target.value;
  renderTable();
});

document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value.toLowerCase().trim();
  if (document.getElementById('view-tickets').classList.contains('active')) renderTable();
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.querySelectorAll('.status-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!currentModalId) return;
    const idx = tickets.findIndex(t => t.id === currentModalId);
    tickets[idx].status = btn.dataset.status;
    save();
    openModal(currentModalId);
    renderTable();
    showToast('Status updated');
  });
});

document.getElementById('modal-delete').addEventListener('click', () => {
  if (currentModalId) deleteTicket(currentModalId);
});

document.getElementById('modal-edit').addEventListener('click', () => {
  if (currentModalId) startEdit(currentModalId);
});

document.getElementById('new-ticket-btn').addEventListener('click', () => {
  editingId = null;
  switchView('create');
});

document.getElementById('empty-create-btn').addEventListener('click', () => {
  editingId = null;
  switchView('create');
});

document.getElementById('cancel-form').addEventListener('click', () => {
  editingId = null;
  switchView('tickets');
});

document.getElementById('menu-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── SEED DATA ──────────────────────────────────────────────────────────────
if (tickets.length === 0) {
  tickets = [
    { id:'TF-00001', title:'Login page not loading on Safari', description:'Users on Safari 16+ report the login page fails to load. Console shows a CORS error from auth endpoint.', category:'Bug', priority:'critical', status:'open', assignee:'Divyansh M.', createdAt: new Date(Date.now()-86400000*3).toISOString() },
    { id:'TF-00002', title:'Add dark mode toggle to settings', description:'Users have requested a dark/light mode toggle in the account settings panel. Should persist across sessions.', category:'Feature Request', priority:'medium', status:'in-progress', assignee:'Divyansh M.', createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'TF-00003', title:'Dashboard charts load slowly', description:'The analytics charts on the dashboard take 6-8 seconds to render. Suspected issue with unoptimized queries.', category:'Performance', priority:'high', status:'open', assignee:'', createdAt: new Date(Date.now()-86400000*1).toISOString() },
    { id:'TF-00004', title:'Update logo and brand colors', description:'Rebrand rollout requires updating logo, primary color from #6c47ff to #5533ee, and all button styles.', category:'Design', priority:'low', status:'closed', assignee:'Divyansh M.', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'TF-00005', title:'Password reset email not sending', description:'Several users report the forgot-password flow sends no email. SMTP logs show 550 errors on certain domains.', category:'Bug', priority:'high', status:'in-progress', assignee:'', createdAt: new Date(Date.now()-86400000*4).toISOString() },
  ];
  save();
}

// ── INIT ───────────────────────────────────────────────────────────────────
renderDashboard();
document.getElementById('nav-count').textContent = tickets.length;
