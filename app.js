// ════════════════════════════════════════════════════════════
//  app.js — TaskFlow Application Logic
// ════════════════════════════════════════════════════════════

// ────────────────────────────────────────
//  API CONFIG
// ────────────────────────────────────────
const API = 'https://task-tracker-backend-cngz.onrender.com/api';

function getToken()        { return localStorage.getItem('tf_token'); }
function setToken(t)       { localStorage.setItem('tf_token', t); }
function removeToken()     { localStorage.removeItem('tf_token'); }
function getCurrentUser()  { try { return JSON.parse(localStorage.getItem('tf_current')); } catch { return null; } }
function setCurrentUser(u) { localStorage.setItem('tf_current', JSON.stringify(u)); }
function removeCurrentUser(){ localStorage.removeItem('tf_current'); }

// ────────────────────────────────────────
//  API HELPER
// ────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(API + endpoint, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ────────────────────────────────────────
//  UTILITIES
// ────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s / 60)  + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

// ════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════
let currentUser = null;

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) =>
    b.classList.toggle('active',
      (i === 0 && tab === 'login') ||
      (i === 1 && tab === 'register') ||
      (i === 2 && tab === 'hr-register')
    )
  );
  document.getElementById('tab-login').style.display       = tab === 'login'       ? '' : 'none';
  document.getElementById('tab-register').style.display    = tab === 'register'    ? '' : 'none';
  document.getElementById('tab-hr-register').style.display = tab === 'hr-register' ? '' : 'none';
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

async function doLogin() {
  const email = document.getElementById('l-email').value.trim().toLowerCase();
  const pass  = document.getElementById('l-pass').value;
  if (!email || !pass) return showError('login-error', 'Please enter email and password.');
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
    setToken(data.token);
    setCurrentUser(data.user);
    currentUser = data.user;
    launchApp();
  } catch (err) {
    showError('login-error', err.message);
  }
}

async function doRegisterManager() {
  const name  = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim().toLowerCase();
  const pass  = document.getElementById('r-pass').value;
  if (!name || !email || !pass) return showError('reg-error', 'Please fill all fields.');
  try {
    const data = await apiFetch('/auth/register-manager', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass })
    });
    setToken(data.token);
    setCurrentUser(data.user);
    currentUser = data.user;
    launchApp();
  } catch (err) {
    showError('reg-error', err.message);
  }
}

async function doRegisterHRAdmin() {
  const name  = document.getElementById('hr-name').value.trim();
  const email = document.getElementById('hr-email').value.trim().toLowerCase();
  const pass  = document.getElementById('hr-pass').value;
  if (!name || !email || !pass) return showError('hr-reg-error', 'Please fill all fields.');
  try {
    const data = await apiFetch('/auth/register-hr-admin', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass })
    });
    setToken(data.token);
    setCurrentUser(data.user);
    currentUser = data.user;
    launchApp();
  } catch (err) {
    showError('hr-reg-error', err.message);
  }
}

function doLogout() {
  removeToken();
  removeCurrentUser();
  currentUser = null;
  document.getElementById('app-screen').style.display   = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

// ════════════════════════════════════════
//  APP LAUNCH
// ════════════════════════════════════════
window.onload = () => {
  const saved = getCurrentUser();
  const token = getToken();
  if (saved && token) { currentUser = saved; launchApp(); }
};

function launchApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'flex';
  document.getElementById('user-avatar').textContent      = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('user-name-header').textContent = currentUser.name;
  document.getElementById('user-role-header').textContent = 
    currentUser.role === 'manager'  ? 'Manager'  :
    currentUser.role === 'hr_admin' ? 'Admin' : 'Staff';
  renderAll();
}
async function renderAll() {
  await updateNotifBadge();
  if (currentUser.role === 'manager')       await renderManagerView();
  else if (currentUser.role === 'hr_admin') await renderHRAdminView();
  else                                       await renderStaffView();
}

// ════════════════════════════════════════
//  MANAGER VIEW
// ════════════════════════════════════════
async function renderManagerView() {
  let tasks = [], staff = [];
  try {
    [tasks, staff] = await Promise.all([apiFetch('/tasks'), apiFetch('/staff')]);
  } catch (err) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">Failed to load data: ${err.message}</div>`;
    return;
  }

  // Safety filter — remove tasks with null assignedTo
tasks = tasks.filter(t => t.assignedTo != null);
  const assigned  = tasks.filter(t => t.status === 'assigned');
  const delegated = tasks.filter(t => t.status === 'delegated');
  const pending   = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status === 'completed');
  const rate      = tasks.length ? Math.round(completed.length / tasks.length * 100) : 0;

  const staffRows = staff.map(s => {
   const myTasks = tasks.filter(t => 
  t.assignedTo && (
    (t.assignedTo._id && t.assignedTo._id === s._id) || 
    t.assignedTo === s._id
  )
);
    const myDone    = myTasks.filter(t => t.status === 'completed');
    const myPending = myTasks.filter(t => t.status !== 'completed');
    const r         = myTasks.length ? Math.round(myDone.length / myTasks.length * 100) : 0;
    const lastTask  = [...myTasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return `
      <tr>
        <td>
          <div class="staff-name-cell">
            <div class="avatar" style="width:32px;height:32px;font-size:13px;">${s.name.charAt(0)}</div>
            <div>
              <div style="font-size:14px;">${s.name}</div>
              <div style="font-size:11px;color:var(--text3);">${s.email}</div>
            </div>
          </div>
        </td>
        <td style="font-weight:700;color:var(--accent)">${myTasks.length}</td>
        <td style="color:var(--yellow)">${myPending.length}</td>
        <td style="color:var(--green)">${myDone.length}</td>
        <td style="min-width:120px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-bar" style="flex:1">
              <div class="progress-fill" style="width:${r}%"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:var(--text2);width:32px">${r}%</span>
          </div>
        </td>
        <td style="color:var(--text3);font-size:12px;">${lastTask ? formatDate(lastTask.createdAt) : '—'}</td>

        <!-- Due Date -->
        <td style="font-size:12px;color:var(--accent);">
          ${myTasks.length > 0
            ? (() => {
                const latest = [...myTasks].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))[0];
                return `<div>${formatDate(latest.dueDate)}</div>`;
              })()
            : '—'}
        </td>

        <!-- Completion Date -->
        <td style="font-size:12px;color:var(--green);">
          ${myDone.length > 0
            ? (() => {
                const latest = [...myDone].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
                return `<div>${formatDate(latest.completedAt)}</div>`;
              })()
            : '—'}
        </td>

        <!-- Efficiency Rate -->
        <td style="min-width:160px;">
          ${(() => {
            const completedTasks = myTasks.filter(t => t.status === 'completed' && t.completedAt && t.dueDate);
            if (completedTasks.length === 0) return '<span style="color:var(--text3);font-size:12px;">—</span>';

            const efficiencies = completedTasks.map(t => {
              const due       = new Date(t.dueDate).getTime();
              const completed = new Date(t.completedAt).getTime();
              return Math.round((due - completed) / (1000 * 60 * 60 * 24));
            });

            const avgDiff = Math.round(efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length);

            let color, label, barWidth;
            if (avgDiff > 0) {
              color    = 'var(--green)';
              label    = avgDiff + ' days early';
              barWidth = Math.min(100, 50 + avgDiff * 5);
            } else if (avgDiff === 0) {
              color    = 'var(--yellow)';
              label    = 'On time';
              barWidth = 50;
            } else {
              color    = 'var(--red)';
              label    = Math.abs(avgDiff) + ' days late';
              barWidth = Math.max(10, 50 - Math.abs(avgDiff) * 5);
            }

            return `
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;">
                  <div style="width:${barWidth}%;height:100%;border-radius:3px;background:${color};"></div>
                </div>
                <span style="font-size:12px;font-weight:700;color:${color};white-space:nowrap;">${label}</span>
              </div>`;
          })()}
        </td>

        
      </tr>`;
  }).join('');

  const staffTable = staff.length === 0
    ? '<p style="color:var(--text3);font-size:14px;">No staff added yet.</p>'
    : `<div style="background:var(--surface);border:1px solid var(--border);
                  border-radius:14px;overflow:hidden;
                  max-height:350px;overflow-y:auto;
                  scrollbar-width:thin;scrollbar-color:var(--border) transparent;">
         <table style="width:100%;border-collapse:collapse;">
           <thead>
             <tr style="position:sticky;top:0;z-index:10;">
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Staff Member</th>
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Total Tasks</th>
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Pending</th>
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Completed</th>
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Completion Rate</th>
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Last Activity</th>
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Due Date</th>
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Completion Date</th>
               <th style="position:sticky;top:0;background:var(--surface2);z-index:10;">Efficiency Rate</th>
             </tr>
           </thead>
           <tbody>${staffRows}</tbody>
         </table>
       </div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="my-tasks-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Welcome back, ${currentUser.name} — here's your team's progress</div>
      </div>
      <div style="display:flex;gap:10px;">
  <button class="btn btn-primary btn-sm" onclick="openAddTask()">+ New Task</button>
</div>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);">
      <div class="stat-card"><div class="stat-label">Total Tasks</div><div class="stat-value blue">${tasks.length}</div><div class="stat-sub">All time</div></div>
      <div class="stat-card"><div class="stat-label">Assigned</div><div class="stat-value" style="color:var(--accent2)">${assigned.length}</div><div class="stat-sub">Not started</div></div>
      <div class="stat-card"><div class="stat-label">Delegated</div><div class="stat-value" style="color:var(--red)">${delegated.length}</div><div class="stat-sub">Passed on</div></div>
      <div class="stat-card"><div class="stat-label">In Progress</div><div class="stat-value yellow">${pending.length}</div><div class="stat-sub">Being worked on</div></div>
      <div class="stat-card"><div class="stat-label">Completed</div><div class="stat-value green">${completed.length}</div><div class="stat-sub">${rate}% completion rate</div></div>
    </div>
    <div class="kanban" style="grid-template-columns:repeat(4,1fr);">
      <div class="column">
        <div class="col-header">
          <div class="col-title-row"><div class="col-dot blue"></div><span class="col-title">Assigned</span></div>
          <span class="col-count">${assigned.length}</span>
        </div>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search tasks..."
            oninput="filterTasks(this, 'list-assigned')"
            onkeydown="if(event.key==='Escape'){this.value='';filterTasks(this,'list-assigned');}">
        </div>
        <div class="task-list" id="list-assigned">
          ${assigned.map(t => taskCardHTML(t, true)).join('') || emptyCol()}
        </div>
      </div>
      <div class="column">
        <div class="col-header">
          <div class="col-title-row"><div class="col-dot" style="background:var(--red)"></div><span class="col-title">Delegated</span></div>
          <span class="col-count">${delegated.length}</span>
        </div>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search tasks..."
            oninput="filterTasks(this, 'list-delegated')"
            onkeydown="if(event.key==='Escape'){this.value='';filterTasks(this,'list-delegated');}">
        </div>
        <div class="task-list" id="list-delegated">
          ${delegated.map(t => taskCardHTML(t, true)).join('') || emptyCol()}
        </div>
      </div>
      <div class="column">
        <div class="col-header">
          <div class="col-title-row"><div class="col-dot yellow"></div><span class="col-title">In Progress</span></div>
          <span class="col-count">${pending.length}</span>
        </div>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search tasks..."
            oninput="filterTasks(this, 'list-pending')"
            onkeydown="if(event.key==='Escape'){this.value='';filterTasks(this,'list-pending');}">
        </div>
        <div class="task-list" id="list-pending">
          ${pending.map(t => taskCardHTML(t, true)).join('') || emptyCol()}
        </div>
      </div>
      <div class="column">
        <div class="col-header">
          <div class="col-title-row"><div class="col-dot green"></div><span class="col-title">Completed</span></div>
          <span class="col-count">${completed.length}</span>
        </div>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search tasks..."
            oninput="filterTasks(this, 'list-completed')"
            onkeydown="if(event.key==='Escape'){this.value='';filterTasks(this,'list-completed');}">
        </div>
        <div class="task-list" id="list-completed">
          ${completed.map(t => taskCardHTML(t, true)).join('') || emptyCol()}
        </div>
      </div>
    </div>
    <div class="staff-section">
  <div class="section-header"><div class="section-title">👥 Staff Performance</div></div>
  ${staffTable}
</div>`;
}

// ════════════════════════════════════════
//  STAFF VIEW
// ════════════════════════════════════════
async function renderStaffView() {
  let tasks = [];
  try {
    tasks = await apiFetch('/tasks');
  } catch (err) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">Failed to load tasks: ${err.message}</div>`;
    return;
  }
  const assigned  = tasks.filter(t => t.status === 'assigned');
  const pending   = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status === 'completed');
  const delegated = tasks.filter(t => t.status === 'delegated');

document.getElementById('main-content').innerHTML = `
  <div class="my-tasks-header">
    <div>
      <div class="page-title">My Tasks</div>
      <div class="page-sub">Welcome, ${currentUser.name} — ${tasks.length} tasks assigned to you</div>
    </div>
  </div>
  <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);">
  <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value blue">${tasks.length}</div></div>
  <div class="stat-card"><div class="stat-label">New</div><div class="stat-value" style="color:var(--accent2)">${assigned.length}</div></div>
  <div class="stat-card"><div class="stat-label">Delegated</div><div class="stat-value" style="color:var(--red)">${delegated.length}</div></div>
  <div class="stat-card"><div class="stat-label">In Progress</div><div class="stat-value yellow">${pending.length}</div></div>
  <div class="stat-card"><div class="stat-label">Done</div><div class="stat-value green">${completed.length}</div></div>
</div>
  <div class="kanban" style="grid-template-columns:repeat(4,1fr);">
    <div class="column">
      <div class="col-header">
        <div class="col-title-row"><div class="col-dot blue"></div><span class="col-title">New / Assigned</span></div>
        <span class="col-count">${assigned.length}</span>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search tasks..."
          oninput="filterTasks(this, 'list-assigned-staff')"
          onkeydown="if(event.key==='Escape'){this.value='';filterTasks(this,'list-assigned-staff');}">
      </div>
      <div class="task-list" id="list-assigned-staff">
        ${assigned.map(t => taskCardHTML(t, false)).join('') || emptyCol()}
      </div>
    </div>
    <div class="column">
      <div class="col-header">
        <div class="col-title-row"><div class="col-dot" style="background:var(--red)"></div><span class="col-title">Delegated</span></div>
        <span class="col-count">${delegated.length}</span>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search tasks..."
          oninput="filterTasks(this, 'list-delegated-staff')"
          onkeydown="if(event.key==='Escape'){this.value='';filterTasks(this,'list-delegated-staff');}">
      </div>
      <div class="task-list" id="list-delegated-staff">
        ${delegated.map(t => taskCardHTML(t, false)).join('') || emptyCol()}
      </div>
    </div>
    <div class="column">
      <div class="col-header">
        <div class="col-title-row"><div class="col-dot yellow"></div><span class="col-title">In Progress</span></div>
        <span class="col-count">${pending.length}</span>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search tasks..."
          oninput="filterTasks(this, 'list-pending-staff')"
          onkeydown="if(event.key==='Escape'){this.value='';filterTasks(this,'list-pending-staff');}">
      </div>
      <div class="task-list" id="list-pending-staff">
        ${pending.map(t => taskCardHTML(t, false)).join('') || emptyCol()}
      </div>
    </div>
    <div class="column">
      <div class="col-header">
        <div class="col-title-row"><div class="col-dot green"></div><span class="col-title">Completed</span></div>
        <span class="col-count">${completed.length}</span>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search tasks..."
          oninput="filterTasks(this, 'list-completed-staff')"
          onkeydown="if(event.key==='Escape'){this.value='';filterTasks(this,'list-completed-staff');}">
      </div>
      <div class="task-list" id="list-completed-staff">
        ${completed.map(t => taskCardHTML(t, false)).join('') || emptyCol()}
      </div>
    </div>
  </div>`;
}

// ════════════════════════════════════════
//  HR ADMIN VIEW
// ════════════════════════════════════════
async function renderHRAdminView() {
  let staff = [];
  try {
    staff = await apiFetch('/staff');
  } catch (err) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">Failed to load data: ${err.message}</div>`;
    return;
  }

  const staffRows = staff.map(s => `
    <tr>
      <td>
        <div class="staff-name-cell">
          <div class="avatar" style="width:32px;height:32px;font-size:13px;">${s.name.charAt(0)}</div>
          <div>
            <div style="font-size:14px;font-weight:600;">${s.name}</div>
            <div style="font-size:11px;color:var(--text3);">${s.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span style="background:var(--surface2);border:1px solid var(--border);
                     border-radius:6px;padding:3px 10px;font-size:12px;color:var(--text2);">
          Staff
        </span>
      </td>
      <td style="color:var(--text3);font-size:12px;">
        ${new Date(s.createdAt).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}
      </td>
      <td>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm" 
            style="background:rgba(59,130,246,0.15);color:var(--accent);border:1px solid rgba(59,130,246,0.25);"
            onclick="openResetPassword('${s._id}', '${s.name}')">
            🔑 Reset Password
          </button>
          <button class="btn btn-danger btn-sm" onclick="removeStaff('${s._id}')">
            Remove
          </button>
        </div>
      </td>
    </tr>`).join('');

  const staffTable = staff.length === 0
    ? `<div class="empty-state"><div class="empty-icon">👥</div>No staff added yet.</div>`
    : `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;">
         <table>
           <thead><tr>
             <th>Staff Member</th>
             <th>Role</th>
             <th>Joined</th>
             <th>Actions</th>
           </tr></thead>
           <tbody>${staffRows}</tbody>
         </table>
       </div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="my-tasks-header">
      <div>
        <div class="page-title">Admin Dashboard</div>
        <div class="page-sub">Welcome, ${currentUser.name} — manage your team members</div>
      </div>
      <button class="btn btn-green btn-sm" onclick="openModal('modal-staff')">+ Add Staff</button>
    </div>

    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:28px;">
      <div class="stat-card">
        <div class="stat-label">Total Staff</div>
        <div class="stat-value blue">${staff.length}</div>
        <div class="stat-sub">Active members</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Recent Joins</div>
        <div class="stat-value" style="color:var(--accent2)">
          ${staff.filter(s => {
            const days = (Date.now() - new Date(s.createdAt)) / (1000*60*60*24);
            return days <= 30;
          }).length}
        </div>
        <div class="stat-sub">Last 30 days</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Department</div>
        <div class="stat-value" style="color:var(--green);font-size:20px;">Altrad</div>
        <div class="stat-sub">Procurement</div>
      </div>
    </div>

    <!-- Staff Table -->
    <div class="staff-section">
      <div class="section-header">
        <div class="section-title">👥 Staff Members</div>
      </div>
      ${staffTable}
    </div>`;
}

// ════════════════════════════════════════
//  TASK CARD HTML BUILDER
// ════════════════════════════════════════
function taskCardHTML(task, isManager) {
  const assignedUser = task.assignedTo;
  const staffName    = assignedUser?.name || 'Unknown';

  const docsHTML = (task.documents && task.documents.length > 0) ? `
    <div class="task-docs">
      <div class="task-docs-title">📎 Attachments (${task.documents.length})</div>
      ${task.documents.map(d => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;">
          <a class="doc-link" href="${d.url.startsWith('http') ? d.url : API.replace('/api','') + d.url}" 
  target="_blank" onclick="event.stopPropagation()">📄 ${d.name}</a>
          ${!isManager && task.status !== 'completed' ? `
            <button onclick="event.stopPropagation();deleteDocument('${task._id}','${d._id}')"
              style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.2);
                     color:#f87171;border-radius:5px;padding:2px 7px;cursor:pointer;
                     font-size:11px;margin-left:8px;">🗑</button>` : ''}
        </div>`).join('')}
    </div>` : '';

const staffActionsHTML = task.status === 'completed'
  ? `<div class="completed-badge">✓ Completed — ${formatDate(task.completedAt)}</div>`
  : task.status === 'delegated'
  ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);
               color:var(--red);border-radius:8px;padding:10px 12px;font-size:12px;
               font-weight:600;margin-bottom:8px;">
       <div style="margin-bottom:4px;">↔ Task Delegated</div>
       ${task.delegatedFrom?._id === currentUser.id || task.delegatedFrom === currentUser.id
         ? `<div style="font-weight:400;color:var(--text2);">
              You delegated this to 
              <strong style="color:var(--text)">${task.delegatedTo?.name || task.assignedTo?.name || 'another staff'}</strong>
            </div>`
         : `<div style="font-weight:400;color:var(--text2);">
              Delegated to you by 
              <strong style="color:var(--text)">${task.delegatedFrom?.name || 'another staff'}</strong>
            </div>
            <div style="margin-top:8px;">
              <button class="btn-action btn-start"
                onclick="event.stopPropagation();changeStatus('${task._id}','pending')">
                ▶ Start Work
              </button>
              <button class="btn-upload" title="Upload Document"
                onclick="event.stopPropagation();openUpload('${task._id}')">📎</button>
            </div>`
       }
     </div>`
  : `<button class="btn-action ${task.status === 'assigned' ? 'btn-start' : 'btn-complete'}"
      onclick="event.stopPropagation();changeStatus('${task._id}','${task.status === 'assigned' ? 'pending' : 'completed'}')">
      ${task.status === 'assigned' ? '▶ Start Work' : '✓ Mark Complete'}
     </button>
     <button class="btn-upload" title="Upload Document"
      onclick="event.stopPropagation();openUpload('${task._id}')">📎</button>
      ${!task.delegatedFrom ? `
     <button class="btn-action" style="background:rgba(239,68,68,0.15);color:var(--red);
      border:1px solid rgba(239,68,68,0.25);"
      onclick="event.stopPropagation();openDelegate('${task._id}', '${task.title}')">
      ↔ Delegate
     </button>` : ''}`;

  // Delegation info for manager
const delegationInfoHTML = task.status === 'delegated' && task.delegatedFrom
  ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);
               border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px;">
       <div style="color:var(--text2);margin-bottom:4px;">↔ <strong style="color:var(--red)">Delegation Info</strong></div>
       <div style="color:var(--text2);">
         From: <strong style="color:var(--text)">${task.delegatedFrom?.name || 'Unknown'}</strong>
       </div>
       <div style="color:var(--text2);">
         To: <strong style="color:var(--text)">${task.assignedTo?.name || 'Unknown'}</strong>
       </div>
     </div>`
  : '';

const managerActionsHTML = `
  <div class="manager-task-actions">
    <span class="manager-task-meta">Added ${formatDate(task.createdAt)}</span>
    ${task.status !== 'completed'
      ? `<button class="btn-reassign"
          onclick="event.stopPropagation();openReassign('${task._id}')">↔ Reassign</button>`
      : ''}
    <button class="btn-delete-task"
      onclick="event.stopPropagation();deleteTask('${task._id}')">🗑</button>
  </div>`;

  return `
    <div class="task-card ${task.priority}" onclick="toggleCard(this)">

    <!-- Always visible: title + priority only -->
<div class="task-top" style="margin-bottom:0">
  <div class="task-title">${task.title}</div>
  <span class="priority-badge ${task.priority}">${task.priority}</span>
</div>
<div class="task-expand-hint">▾</div>


      <!-- Expandable body -->
      <div class="task-card-body">
  <div class="task-card-divider"></div>
  <div class="task-desc" style="margin-bottom:12px">${task.description}</div>
  ${docsHTML}
  ${isManager
    ? (task.status === 'completed'
        ? `<div class="completed-badge" style="margin-bottom:0">
             ✓ Completed — ${formatDate(task.completedAt)}
           </div>${delegationInfoHTML}${managerActionsHTML}`
        : `${delegationInfoHTML}${managerActionsHTML}`)
    : `<div class="task-actions">${staffActionsHTML}</div>`}
</div>
    </div>`;
}

function emptyCol() {
  return `<div class="empty-state"><div class="empty-icon">📋</div>No tasks here</div>`;
}

// ════════════════════════════════════════
//  TASK ACTIONS
// ════════════════════════════════════════
async function openAddTask() {
  try {
    const staff = await apiFetch('/staff');
    if (staff.length === 0) { alert('Please add staff members first.'); return; }
    document.getElementById('t-staff').innerHTML =
      staff.map(s => `<option value="${s._id}">${s.name}</option>`).join('');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    document.getElementById('t-due').value = d.toISOString().split('T')[0];
    openModal('modal-task');
  } catch (err) {
    alert('Failed to load staff: ' + err.message);
  }
}

async function createTask() {
  const title    = document.getElementById('t-title').value.trim();
  const desc     = document.getElementById('t-desc').value.trim();
  const staffId  = document.getElementById('t-staff').value;
  const priority = document.getElementById('t-priority').value;
  const due      = document.getElementById('t-due').value;
  if (!title || !desc || !staffId || !due) return alert('Please fill all fields.');
  try {
    await apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, description: desc, assignedTo: staffId, priority, dueDate: due })
    });
    closeModal('modal-task');
    document.getElementById('t-title').value = '';
    document.getElementById('t-desc').value  = '';
    renderAll();
  } catch (err) {
    alert('Failed to create task: ' + err.message);
  }
}

async function changeStatus(taskId, newStatus) {
  try {
    await apiFetch(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    renderAll();
  } catch (err) {
    alert('Failed to update status: ' + err.message);
  }
}

function openUpload(taskId) {
  document.getElementById('upload-task-id').textContent = taskId;
  document.getElementById('upload-file').value = '';
  openModal('modal-upload');
}

async function confirmUpload() {
  const fileInput = document.getElementById('upload-file');
  const taskId    = document.getElementById('upload-task-id').textContent;
  const file      = fileInput.files[0];
  if (!file) { alert('Please select a file.'); return; }
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API}/tasks/${taskId}/upload`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body:    formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    closeModal('modal-upload');
    renderAll();
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }
}

async function deleteDocument(taskId, docId) {
  if (!confirm('Delete this document?')) return;
  try {
    await apiFetch(`/tasks/${taskId}/documents/${docId}`, { method: 'DELETE' });
    renderAll();
  } catch (err) {
    alert('Failed to delete document: ' + err.message);
  }
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task? This cannot be undone.')) return;
  try {
    await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
    renderAll();
  } catch (err) {
    alert('Failed to delete task: ' + err.message);
  }
}

async function openReassign(taskId) {
  try {
    const [staff, tasks] = await Promise.all([apiFetch('/staff'), apiFetch('/tasks')]);
    if (staff.length === 0) { alert('No staff members available.'); return; }
    const task = tasks.find(t => t._id === taskId);
    if (!task) return;
    document.getElementById('ra-staff').innerHTML = staff.map(s =>
      `<option value="${s._id}" ${s._id === task.assignedTo._id ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    document.getElementById('ra-task-id').textContent    = taskId;
    document.getElementById('ra-task-title').textContent = task.title;
    openModal('modal-reassign');
  } catch (err) {
    alert('Failed to load data: ' + err.message);
  }
}

async function confirmReassign() {
  const taskId     = document.getElementById('ra-task-id').textContent;
  const newStaffId = document.getElementById('ra-staff').value;
  try {
    await apiFetch(`/tasks/${taskId}/reassign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo: newStaffId })
    });
    closeModal('modal-reassign');
    renderAll();
  } catch (err) {
    alert('Failed to reassign task: ' + err.message);
  }
}

// ════════════════════════════════════════
//  STAFF MANAGEMENT
// ════════════════════════════════════════
async function addStaff() {
  const name  = document.getElementById('s-name').value.trim();
  const email = document.getElementById('s-email').value.trim().toLowerCase();
  const pass  = document.getElementById('s-pass').value;
  if (!name || !email || !pass) return showError('staff-error', 'Please fill all fields.');
  try {
    await apiFetch('/staff', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass })
    });
    closeModal('modal-staff');
    document.getElementById('s-name').value  = '';
    document.getElementById('s-email').value = '';
    document.getElementById('s-pass').value  = '';
    renderAll();
  } catch (err) {
    showError('staff-error', err.message);
  }
}

async function removeStaff(staffId) {
  if (!confirm('Remove this staff member? Their tasks will remain.')) return;
  try {
    await apiFetch(`/staff/${staffId}`, { method: 'DELETE' });
    renderAll();
  } catch (err) {
    alert('Failed to remove staff: ' + err.message);
  }
}

// ════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════
async function updateNotifBadge() {
  try {
    const { count } = await apiFetch('/notifications/unread-count');
    const badge = document.getElementById('notif-count');
    if (!badge) return;
    if (count > 0) { badge.textContent = count; badge.style.display = 'flex'; }
    else { badge.style.display = 'none'; }
  } catch {}
}

function toggleNotif() {
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderNotifPanel();
}

async function renderNotifPanel() {
  try {
    const notifs = await apiFetch('/notifications');
    const list   = document.getElementById('notif-list');
    if (notifs.length === 0) {
      list.innerHTML = '<div class="notif-empty">🔔 No notifications yet</div>';
      return;
    }
    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-icon">${n.read ? '🔔' : '🔵'}</div>
        <div>
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${timeAgo(new Date(n.createdAt).getTime())}</div>
        </div>
      </div>`).join('');
  } catch {}
}

async function markAllRead() {
  try {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    await updateNotifBadge();
    await renderNotifPanel();
  } catch {}
}

// ════════════════════════════════════════
//  MODAL HELPERS
// ════════════════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  const btn   = document.getElementById('notif-btn');
  if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target))
    panel.classList.remove('open');
});

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay'))
    e.target.classList.remove('open');
});

// ════════════════════════════════════════
//  EXPANDABLE TASK CARDS
// ════════════════════════════════════════
function toggleCard(card) {
  document.querySelectorAll('.task-card.expanded').forEach(c => {
    if (c !== card) c.classList.remove('expanded');
  });
  card.classList.toggle('expanded');
}



// ════════════════════════════════════════
//  DELEGATE TASK (Staff only)
// ════════════════════════════════════════
async function openDelegate(taskId, taskTitle) {
  try {
    const others = await apiFetch('/staff/colleagues');
    if (others.length === 0) { alert('No other staff members available.'); return; }

    document.getElementById('del-staff').innerHTML = others.map(s =>
      `<option value="${s._id}">${s.name}</option>`
    ).join('');
    document.getElementById('del-task-id').textContent    = taskId;
    document.getElementById('del-task-title').textContent = taskTitle;
    openModal('modal-delegate');
  } catch (err) {
    alert('Failed to load staff: ' + err.message);
  }
}

async function confirmDelegate() {
  const taskId     = document.getElementById('del-task-id').textContent;
  const delegateTo = document.getElementById('del-staff').value;
  try {
    await apiFetch(`/tasks/${taskId}/delegate`, {
      method: 'PATCH',
      body: JSON.stringify({ delegateTo })
    });
    closeModal('modal-delegate');
    renderAll();
  } catch (err) {
    alert('Failed to delegate task: ' + err.message);
  }
}

// ════════════════════════════════════════
//  SEARCH / FILTER TASKS
// ════════════════════════════════════════
function filterTasks(input, listId) {
  const query = input.value.toLowerCase().trim();
  const list  = document.getElementById(listId);
  if (!list) return;

  const cards = list.querySelectorAll('.task-card');
  let visible = 0;

  cards.forEach(card => {
    const title = card.querySelector('.task-title')?.textContent.toLowerCase() || '';
    const match = query === '' || title.includes(query);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  // Show/hide no results message
  let emptyEl = list.querySelector('.search-empty');
  if (visible === 0 && query !== '') {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state search-empty';
      emptyEl.innerHTML = '<div class="empty-icon">🔍</div>No tasks found';
      list.appendChild(emptyEl);
    }
    emptyEl.style.display = '';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
  }
}

// ════════════════════════════════════════
//  HR ADMIN — RESET PASSWORD
// ════════════════════════════════════════
function openResetPassword(staffId, staffName) {
  document.getElementById('rp-staff-id').textContent   = staffId;
  document.getElementById('rp-staff-name').textContent = staffName;
  document.getElementById('rp-new-pass').value         = '';
  openModal('modal-reset-password');
}

async function confirmResetPassword() {
  const staffId     = document.getElementById('rp-staff-id').textContent;
  const newPassword = document.getElementById('rp-new-pass').value;
  if (!newPassword) { alert('Please enter a new password.'); return; }
  try {
    await apiFetch(`/staff/${staffId}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword })
    });
    closeModal('modal-reset-password');
    alert('✅ Password reset successfully!');
    renderAll();
  } catch (err) {
    alert('Failed to reset password: ' + err.message);
  }
}

async function showStaffWorkload() {
  const staffId = document.getElementById('t-staff').value;
  const box = document.getElementById('staff-workload');
  if (!staffId) { box.style.display = 'none'; return; }

  try {
    const tasks = await apiFetch('/tasks');
    const staffTasks = tasks.filter(t => t.assignedTo?._id === staffId || t.assignedTo === staffId);
    const now = new Date();

    const total    = staffTasks.length;
    const done     = staffTasks.filter(t => t.status === 'completed').length;
    const pending  = staffTasks.filter(t => t.status !== 'completed').length;
    const overdue  = staffTasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < now).length;

    const upcoming = staffTasks
      .filter(t => t.status !== 'completed' && new Date(t.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const nearest = upcoming.length > 0
      ? new Date(upcoming[0].dueDate).toLocaleDateString('en-GB')
      : 'No upcoming tasks';

    document.getElementById('wl-total').textContent   = total;
    document.getElementById('wl-done').textContent    = done;
    document.getElementById('wl-pending').textContent = pending;
    document.getElementById('wl-overdue').textContent = overdue;
    document.getElementById('wl-nearest').textContent = nearest;

    // Color code overdue
    document.getElementById('wl-overdue').style.color = overdue > 0 ? '#ff4d4d' : '#aaa';

    box.style.display = 'block';
  } catch (err) {
    box.style.display = 'none';
  }
}

// Enter key support
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  
  // Login screen
  if (document.getElementById('login-screen').style.display !== 'none') {
    const activeTab = document.querySelector('.tab-btn.active')?.textContent.trim();
    if (activeTab === 'Sign In') doLogin();
    else if (activeTab === 'Manager') doRegisterManager();
    else if (activeTab === 'Admin') doRegisterHRAdmin();
    return;
  }

  // Modals
  if (document.getElementById('modal-task').classList.contains('open'))        { createTask(); return; }
  if (document.getElementById('modal-staff').classList.contains('open'))       { addStaff(); return; }
  if (document.getElementById('modal-reassign').classList.contains('open'))    { confirmReassign(); return; }
  if (document.getElementById('modal-delegate').classList.contains('open'))    { confirmDelegate(); return; }
  if (document.getElementById('modal-upload').classList.contains('open'))      { confirmUpload(); return; }
  if (document.getElementById('modal-reset-password').classList.contains('open')) { confirmResetPassword(); return; }
});