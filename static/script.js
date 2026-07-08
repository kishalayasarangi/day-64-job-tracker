let editingId = null;

const STATUS_COLORS = {
  'Applied': '#7c3aed',
  'OA': '#3b82f6',
  'Interview': '#f59e0b',
  'Offer': '#14b8a6',
  'Accepted': '#10b981',
  'Rejected': '#ef4444'
};

const STAT_COLORS = {
  'Applied': '#7c3aed',
  'OA': '#3b82f6',
  'Interview': '#f59e0b',
  'Offer': '#14b8a6',
  'Accepted': '#10b981',
  'Rejected': '#ef4444',
  'Total': '#a0a0b0',
  'Deadlines': '#f97316'
};

async function loadStats() {
  const res = await fetch('/api/stats');
  const s = await res.json();
  const statuses = ['Applied','OA','Interview','Offer','Accepted','Rejected'];

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card">
      <span style="color:#a0a0b0">${s.total}</span>
      <label>Total</label>
    </div>
    ${statuses.map(st => `
      <div class="stat-card">
        <span style="color:${STAT_COLORS[st]}">${s.by_status[st] || 0}</span>
        <label>${st}</label>
      </div>`).join('')}
    <div class="stat-card">
      <span style="color:#f97316">${s.upcoming_deadlines}</span>
      <label>Deadlines</label>
    </div>`;

  const pipeline = document.getElementById('pipeline');
  const total = s.total || 1;
  pipeline.innerHTML = statuses.map(st => {
    const count = s.by_status[st] || 0;
    const pct = Math.round(count / total * 100);
    return `
      <div class="pipe-stage">
        <div class="pipe-count" style="color:${STATUS_COLORS[st]}">${count}</div>
        <div class="pipe-bar-wrap">
          <div class="pipe-bar" style="width:${pct}%;background:${STATUS_COLORS[st]}"></div>
        </div>
        <div class="pipe-label">${st}</div>
      </div>`;
  }).join('');
}

async function loadApplications() {
  const search = document.getElementById('searchInput').value;
  const status = document.getElementById('statusFilter').value;
  const res = await fetch(`/api/applications?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`);
  const apps = await res.json();

  document.getElementById('appCount').textContent = `${apps.length} applications`;
  const tbody = document.getElementById('appsBody');

  if (apps.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No applications yet — add your first one!</td></tr>';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  const soonStr = soon.toISOString().split('T')[0];

  tbody.innerHTML = apps.map(a => {
    let deadlineCls = '', deadlineLabel = a.deadline || '—';
    if (a.deadline) {
      if (a.deadline < today) { deadlineCls = 'deadline-past'; deadlineLabel = '⚠️ ' + a.deadline; }
      else if (a.deadline <= soonStr) { deadlineCls = 'deadline-soon'; deadlineLabel = '⏰ ' + a.deadline; }
    }

    return `
      <tr>
        <td>
          <div class="company-name">${a.company}</div>
        </td>
        <td><div class="role-name">${a.role}</div></td>
        <td>${a.type}</td>
        <td>${a.location || '—'}</td>
        <td>
          <select class="status-badge s-${a.status.replace(' ','-')}"
                  onchange="quickUpdateStatus(${a.id}, this.value)"
                  style="border:none;cursor:pointer;font-weight:600;font-size:0.75px;padding:3px 6px;border-radius:8px;">
            ${['Applied','OA','Interview','Offer','Accepted','Rejected'].map(s =>
              `<option value="${s}" ${s === a.status ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </td>
        <td style="font-size:0.78rem;color:#606070;">${a.applied_date || '—'}</td>
        <td class="${deadlineCls}" style="font-size:0.78rem;">${deadlineLabel}</td>
        <td style="font-size:0.78rem;color:#10b981;">${a.salary || '—'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-edit" onclick="editApplication(${a.id})">✏️ Edit</button>
            ${a.notes ? `<button class="btn-notes" onclick="showNotes('${a.company} — ${a.role}', \`${a.notes.replace(/`/g, "'")}\`)">📝 Notes</button>` : ''}
            ${a.url ? `<a href="${a.url}" target="_blank" style="padding:4px 8px;border-radius:6px;border:1px solid #2a2a4a;background:#1a1a2e;color:#a0a0b0;font-size:0.72px;text-decoration:none;">🔗 Link</a>` : ''}
            <button class="btn-del" onclick="deleteApplication(${a.id})">✕</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function quickUpdateStatus(id, status) {
  await fetch(`/api/applications/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadStats();
  loadApplications();
}

async function saveApplication() {
  const company = document.getElementById('fCompany').value.trim();
  const role = document.getElementById('fRole').value.trim();
  if (!company || !role) { alert('Company and role are required!'); return; }

  const data = {
    company, role,
    location: document.getElementById('fLocation').value.trim(),
    type: document.getElementById('fType').value,
    status: document.getElementById('fStatus').value,
    applied_date: document.getElementById('fAppliedDate').value,
    deadline: document.getElementById('fDeadline').value,
    salary: document.getElementById('fSalary').value.trim(),
    url: document.getElementById('fUrl').value.trim(),
    notes: document.getElementById('fNotes').value.trim()
  };

  const url = editingId ? `/api/applications/${editingId}` : '/api/applications';
  const method = editingId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) { const d = await res.json(); alert(d.error); return; }
  hideForm();
  loadApplications();
  loadStats();
}

async function editApplication(id) {
  const res = await fetch(`/api/applications?search=`);
  const apps = await res.json();
  const a = apps.find(x => x.id === id);
  if (!a) return;

  editingId = id;
  document.getElementById('formTitle').textContent = 'Edit Application';
  document.getElementById('fCompany').value = a.company;
  document.getElementById('fRole').value = a.role;
  document.getElementById('fLocation').value = a.location;
  document.getElementById('fType').value = a.type;
  document.getElementById('fStatus').value = a.status;
  document.getElementById('fAppliedDate').value = a.applied_date;
  document.getElementById('fDeadline').value = a.deadline;
  document.getElementById('fSalary').value = a.salary;
  document.getElementById('fUrl').value = a.url;
  document.getElementById('fNotes').value = a.notes;

  document.getElementById('appForm').classList.remove('hidden');
  document.getElementById('appForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteApplication(id) {
  if (!confirm('Delete this application?')) return;
  await fetch(`/api/applications/${id}`, { method: 'DELETE' });
  loadApplications();
  loadStats();
}

function showAddForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = 'Add Application';
  ['fCompany','fRole','fLocation','fSalary','fUrl','fNotes'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('fType').value = 'Internship';
  document.getElementById('fStatus').value = 'Applied';
  document.getElementById('fAppliedDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('fDeadline').value = '';
  document.getElementById('appForm').classList.remove('hidden');
  document.getElementById('fCompany').focus();
}

function hideForm() {
  document.getElementById('appForm').classList.add('hidden');
  editingId = null;
}

function showNotes(title, notes) {
  document.getElementById('notesTitle').textContent = title;
  document.getElementById('notesContent').textContent = notes;
  document.getElementById('notesModal').classList.remove('hidden');
}

function closeNotes() {
  document.getElementById('notesModal').classList.add('hidden');
}

window.onload = () => {
  loadStats();
  loadApplications();
};