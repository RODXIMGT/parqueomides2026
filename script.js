/* ═══════════════════════════════════════════════════════
   MIDES — Sistema de Parqueos
   Firebase Compat Mode | Versión limpia
═══════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyA9wqTn1rACxIDJaLH2Y3PxfRh9TZdhp1M",
  authDomain: "mides-parqueos.firebaseapp.com",
  projectId: "mides-parqueos",
  storageBucket: "mides-parqueos.firebasestorage.app",
  messagingSenderId: "621080309770",
  appId: "1:621080309770:web:76038014acc00f93a4aff3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ── ESTADO GLOBAL ── */
let employees = [], photos = {}, users = [], solicitudes = [], historial = [], pendingData = [];
let currentEmployee = null, currentView = 'cards', currentUser = null;
let currentRejectId = null, selectedPhotos = new Set(), mapaCurrentSotano = 's1';

/* ── ROLES ── */
const ROLE_LABELS = { superadmin:'⭐ Super Admin', admin:'🔧 Admin', reporter:'📊 Reportes', viewer:'👁 Visualizador' };
const ROLE_CLASS  = { superadmin:'role-superadmin', admin:'role-admin', reporter:'role-reporter', viewer:'role-viewer' };
const CAN_UPLOAD  = r => ['superadmin','admin'].includes(r);
const CAN_MANAGE  = r => r === 'superadmin';
const CAN_EXPORT  = r => ['superadmin','admin','reporter'].includes(r);
const CAN_APPROVE = r => ['superadmin','admin'].includes(r);

/* ═══════════════════════════════════════════════════════
   INICIO
═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindAllEvents();
  auth.onAuthStateChanged(async fbUser => {
    try {
      if (fbUser) {
        const pd = await db.collection('usuarios').doc(fbUser.uid).get();
        if (!pd.exists) { await auth.signOut(); showLogin(); showToast('Usuario no configurado.'); }
        else {
          const p = pd.data();
          currentUser = { uid: fbUser.uid, email: fbUser.email, name: p.nombre, role: p.rol, aprobador: p.aprobador === 'si' };
          await loadAll();
          showApp();
        }
      } else {
        currentUser = null;
        showLogin();
      }
    } catch(err) {
      console.error('Auth error:', err);
      showLogin();
      showToast('Error de conexión. Recarga la página.');
    }
    hideFbLoading();
  });
});

function hideFbLoading() {
  const el = document.getElementById('fbLoading');
  if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }
}
function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}
function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  buildNav();
  const av = document.getElementById('userAvatar');
  if (av) av.textContent = (currentUser.name || currentUser.email || '?')[0].toUpperCase();
  const dn = document.getElementById('userDisplayName');
  if (dn) dn.textContent = currentUser.name || currentUser.email;
  const rb = document.getElementById('userRoleBadge');
  if (rb) rb.innerHTML = `<span class="role-badge ${ROLE_CLASS[currentUser.role]}">${ROLE_LABELS[currentUser.role]}</span>`;
  showSection('dashboard', document.querySelector('.nav-item'));
  refreshDashboard();
}

/* ═══════════════════════════════════════════════════════
   CARGAR DATOS
═══════════════════════════════════════════════════════ */
async function loadAll() {
  await Promise.all([loadEmployees(), loadPhotos(), loadUsers(), loadSolicitudes(), loadHistorial()]);
}
async function loadEmployees() {
  try { const s = await db.collection('empleados').orderBy('nombre').get(); employees = s.docs.map(d => ({_docId:d.id,...d.data()})); }
  catch(e) { console.error('employees:', e); }
}
async function loadPhotos() {
  try { const s = await db.collection('fotos').get(); s.forEach(d => { photos[d.id] = d.data().foto; }); }
  catch(e) { console.warn('photos:', e); }
}
async function loadUsers() {
  try { const s = await db.collection('usuarios').get(); users = s.docs.map(d => ({uid:d.id,...d.data()})); }
  catch(e) { console.error('users:', e); }
}
async function loadSolicitudes() {
  try { const s = await db.collection('solicitudes').orderBy('fecha','desc').get(); solicitudes = s.docs.map(d => ({id:d.id,...d.data()})); }
  catch(e) { console.error('solicitudes:', e); }
}
async function loadHistorial() {
  try { const s = await db.collection('historial').orderBy('fecha','desc').get(); historial = s.docs.map(d => ({id:d.id,...d.data()})); }
  catch(e) { console.error('historial:', e); }
}
async function registrarHistorial(data) {
  try { await db.collection('historial').add({...data, fecha: new Date().toISOString()}); await loadHistorial(); }
  catch(e) { console.error('registrarHistorial:', e); }
}

/* ═══════════════════════════════════════════════════════
   NAV
═══════════════════════════════════════════════════════ */
function buildNav() {
  const r = currentUser.role;
  const items = [
    { id:'dashboard',     label:'Inicio',           always:true,  icon:'<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>' },
    { id:'search',        label:'Buscar Persona',   always:true,  icon:'<path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>' },
    { id:'solicitudes',   label:'Solicitudes',      always:true,  icon:'<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>' },
    { id:'historial',     label:'Historial',        always:true,  icon:'<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>' },
    { id:'mapa',          label:'Mapa de Parqueos', always:true,  icon:'<path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>' },
    { id:'stats',         label:'Estadísticas',     always:true,  icon:'<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>' },
    { id:'reports',       label:'Reportes',         roles:['superadmin','admin','reporter'], icon:'<path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clip-rule="evenodd"/>' },
    { id:'upload-csv',    label:'Cargar Datos',     roles:['superadmin','admin'], icon:'<path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>' },
    { id:'upload-photos', label:'Fotografías',      always:true,  icon:'<path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>' },
    { id:'users',         label:'Usuarios',         roles:['superadmin'], icon:'<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zm-4.07 11c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 17h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>' },
    { id:'config',        label:'Configuración',    always:true,  icon:'<path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>' },
  ];
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = items
    .filter(it => it.always || (it.roles && it.roles.includes(r)))
    .map((it, i) => `<button class="nav-item${i===0?' active':''}" data-section="${it.id}">
      <svg viewBox="0 0 20 20" fill="currentColor">${it.icon}</svg><span>${it.label}</span></button>`)
    .join('');
  nav.querySelectorAll('.nav-item').forEach(btn =>
    btn.addEventListener('click', () => showSection(btn.dataset.section, btn)));
}

/* ═══════════════════════════════════════════════════════
   NAVEGACIÓN
═══════════════════════════════════════════════════════ */
const SECTION_TITLES = {
  dashboard:'Panel Principal', search:'Buscar Persona', solicitudes:'Solicitudes de Parqueo',
  historial:'Historial de Parqueos', mapa:'Mapa de Parqueos', stats:'Estadísticas',
  reports:'Reportes', 'upload-csv':'Cargar Datos', 'upload-photos':'Fotografías',
  users:'Usuarios', config:'Configuración'
};
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('sec-' + id);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  const tt = document.getElementById('topbarTitle');
  if (tt) tt.textContent = SECTION_TITLES[id] || 'MIDES';
  if (id === 'dashboard')      refreshDashboard();
  if (id === 'search')         { populateFilterDir(); mainSearch(''); }
  if (id === 'solicitudes')    { buildAprobadoresSelect(); renderSolicitudes('todos'); }
  if (id === 'historial')      renderHistorial('', '');
  if (id === 'mapa')           initMapa();
  if (id === 'stats')          refreshStats();
  if (id === 'upload-photos')  refreshPhotoGrid();
  if (id === 'users')          loadUsersTable();
  if (id === 'config')         refreshConfig();
  if (window.innerWidth <= 768) closeSidebar();
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  let ov = document.getElementById('sidebarOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id='sidebarOverlay'; ov.className='sidebar-overlay'; ov.onclick=closeSidebar; document.body.appendChild(ov); }
  ov.classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const ov = document.getElementById('sidebarOverlay');
  if (ov) ov.classList.remove('active');
}

/* ═══════════════════════════════════════════════════════
   EVENTOS
═══════════════════════════════════════════════════════ */
function bindAllEvents() {
  /* Login */
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('togglePassBtn').addEventListener('click', () => {
    const i = document.getElementById('loginPass'); i.type = i.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('forgotPassBtn').addEventListener('click', handleForgotPass);
  document.getElementById('logoutBtn').addEventListener('click', () => { auth.signOut(); employees=[]; photos={}; });

  /* Layout */
  document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebarCloseBtn').addEventListener('click', closeSidebar);
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
  document.getElementById('darkSwitch').addEventListener('change', toggleTheme);
  document.querySelectorAll('.color-opt').forEach(btn => btn.addEventListener('click', () => {
    setAccent(btn.dataset.primary, btn.dataset.dark);
    document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }));

  /* Dashboard */
  document.getElementById('dashVerTodosBtn').addEventListener('click', () =>
    showSection('search', document.querySelector('[data-section="search"]')));
  document.getElementById('quickSearchInput').addEventListener('input', e => quickSearch(e.target.value));

  /* Search */
  document.getElementById('mainSearchInput').addEventListener('input', e => {
    document.getElementById('clearBtn').style.display = e.target.value ? 'flex' : 'none';
    mainSearch(e.target.value);
  });
  document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('mainSearchInput').value = '';
    document.getElementById('clearBtn').style.display = 'none';
    mainSearch('');
  });
  document.getElementById('filterDir').addEventListener('change', () => mainSearch(document.getElementById('mainSearchInput').value));
  document.getElementById('filterStatus').addEventListener('change', () => mainSearch(document.getElementById('mainSearchInput').value));
  document.getElementById('viewCards').addEventListener('click', function() { setView('cards', this); });
  document.getElementById('viewTable').addEventListener('click', function() { setView('table', this); });

  /* CSV Upload */
  const dz = document.getElementById('dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); if(e.dataTransfer.files[0]) processCSVFile(e.dataTransfer.files[0]); });
  document.getElementById('csvInput').addEventListener('change', e => { if(e.target.files[0]) processCSVFile(e.target.files[0]); });
  document.getElementById('confirmImportBtn').addEventListener('click', confirmImport);
  document.getElementById('cancelImportBtn').addEventListener('click', () => { document.getElementById('csvPreview').style.display='none'; pendingData=[]; });
  document.getElementById('downloadSampleBtn').addEventListener('click', downloadSampleCSV);

  /* Photos */
  const pdz = document.getElementById('photoDropZone');
  pdz.addEventListener('dragover', e => { e.preventDefault(); pdz.classList.add('drag-over'); });
  pdz.addEventListener('dragleave', () => pdz.classList.remove('drag-over'));
  pdz.addEventListener('drop', e => { e.preventDefault(); pdz.classList.remove('drag-over'); handlePhotoFiles(Array.from(e.dataTransfer.files)); });
  document.getElementById('photoInput').addEventListener('change', e => handlePhotoFiles(Array.from(e.target.files)));
  document.getElementById('selectAllPhotosBtn').addEventListener('click', toggleSelectAllPhotos);
  document.getElementById('deleteSelectedPhotosBtn').addEventListener('click', deleteSelectedPhotos);

  /* Employee Modal */
  document.getElementById('empModal').addEventListener('click', e => { if(e.target===document.getElementById('empModal')) closeModal(); });
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('modalCloseBtnFooter').addEventListener('click', closeModal);
  document.getElementById('printCardBtn').addEventListener('click', () => window.print());
  document.getElementById('exportPDFBtn').addEventListener('click', exportPDF);

  /* Edit User Modal */
  document.getElementById('editUserCloseBtn').addEventListener('click', () => document.getElementById('editUserModal').classList.add('hidden'));
  document.getElementById('cancelEditUserBtn').addEventListener('click', () => document.getElementById('editUserModal').classList.add('hidden'));
  document.getElementById('saveEditUserBtn').addEventListener('click', saveEditUser);

  /* Reject Modal */
  document.getElementById('cancelRejectBtn').addEventListener('click', () => document.getElementById('rejectModal').classList.add('hidden'));
  document.getElementById('confirmRejectBtn').addEventListener('click', confirmReject);

  /* Solicitudes */
  document.getElementById('toggleSolicitudForm').addEventListener('click', () => {
    const f = document.getElementById('solicitudForm'); f.style.display = f.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('cancelarSolicitudBtn').addEventListener('click', () => { document.getElementById('solicitudForm').style.display = 'none'; });
  document.getElementById('enviarSolicitudBtn').addEventListener('click', enviarSolicitud);
  document.getElementById('solEmpInput').addEventListener('input', e => searchEmpleadoAutocomplete(e.target.value));
  document.querySelectorAll('.sol-tab').forEach(tab => tab.addEventListener('click', function() {
    document.querySelectorAll('.sol-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    renderSolicitudes(this.dataset.estado);
  }));

  /* Nuevo Empleado en Solicitudes */
  document.getElementById('toggleNuevoEmpForm').addEventListener('click', () => {
    const f = document.getElementById('nuevoEmpForm'); f.style.display = f.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('cancelarNuevoEmpBtn').addEventListener('click', () => { document.getElementById('nuevoEmpForm').style.display = 'none'; });
  document.getElementById('guardarNuevoEmpBtn').addEventListener('click', guardarNuevoEmpleado);

  /* Historial */
  document.getElementById('histSearchInput').addEventListener('input', e => renderHistorial(e.target.value, document.getElementById('histFilterType').value));
  document.getElementById('histFilterType').addEventListener('change', e => renderHistorial(document.getElementById('histSearchInput').value, e.target.value));
  document.getElementById('exportHistorialBtn').addEventListener('click', exportHistorialCSV);

  /* Mapa */
  document.getElementById('mapaInfoClose').addEventListener('click', () => document.getElementById('mapaInfoCard').classList.add('hidden'));
  // Mapa tabs — delegated since tabs are static in HTML
  document.querySelectorAll('.mapa-tab').forEach(tab => tab.addEventListener('click', function() {
    mapaCurrentSotano = this.dataset.sotano;
    renderMapa(mapaCurrentSotano);
  }));
  // Mapa tabs and zone buttons use onclick attributes directly in HTML

  /* Users */
  document.getElementById('createUserBtn').addEventListener('click', createUser);
  document.getElementById('refreshUsersBtn').addEventListener('click', () => loadUsers().then(() => loadUsersTable()));

  /* Reports */
  document.getElementById('rpt-all').addEventListener('click', () => exportCSV('all'));
  document.getElementById('rpt-parking').addEventListener('click', () => exportCSV('parking'));
  document.getElementById('rpt-area').addEventListener('click', () => exportCSV('area'));
  document.getElementById('rpt-noparking').addEventListener('click', () => exportCSV('noparking'));
  document.getElementById('rpt-historial').addEventListener('click', exportHistorialCSV);
  document.getElementById('rpt-solicitudes').addEventListener('click', () => exportCSV('solicitudes'));

  /* Config */
  document.getElementById('savePassBtn').addEventListener('click', savePassword);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
}

/* ═══════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════ */
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginUser').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const btn   = document.querySelector('.btn-login');
  btn.disabled = true; btn.querySelector('span').textContent = 'Ingresando…';
  try { await auth.signInWithEmailAndPassword(email, pass); }
  catch {
    document.getElementById('loginError').classList.remove('hidden');
    setTimeout(() => document.getElementById('loginError').classList.add('hidden'), 3500);
    document.getElementById('loginPass').value = '';
    btn.disabled = false; btn.querySelector('span').textContent = 'Iniciar Sesión';
  }
}
async function handleForgotPass() {
  const email = document.getElementById('loginUser').value.trim();
  const msgEl = document.getElementById('forgotMsg');
  if (!email) { msgEl.textContent = 'Escribe tu correo arriba primero.'; msgEl.className = 'forgot-msg error'; msgEl.classList.remove('hidden'); return; }
  try {
    await auth.sendPasswordResetEmail(email);
    msgEl.textContent = '✓ Correo enviado a ' + email + '. Revisa tu bandeja.';
    msgEl.className = 'forgot-msg success';
  } catch(e) {
    msgEl.textContent = 'Error: ' + (e.code === 'auth/user-not-found' ? 'No existe cuenta con ese correo.' : e.message);
    msgEl.className = 'forgot-msg error';
  }
  msgEl.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════ */
function refreshDashboard() {
  animateCount('statTotal',    employees.length);
  animateCount('statAssigned', employees.filter(e => e.num_parqueo && e.num_parqueo.trim()).length);
  animateCount('statPending',  solicitudes.filter(s => s.estado === 'pendiente').length);
  animateCount('statAreas',    new Set(employees.map(e => e.area).filter(Boolean)).size);
  const list = document.getElementById('recentList');
  if (!employees.length) { list.innerHTML = '<div class="empty-state"><p>Sin datos cargados.</p></div>'; return; }
  list.innerHTML = employees.slice(0, 8).map(emp => `
    <div class="recent-item" data-id="${emp.id}" style="cursor:pointer">
      <div class="recent-avatar">${photos[emp.id?.toUpperCase()] ? `<img src="${photos[emp.id.toUpperCase()]}" alt="">` : getInitials(emp.nombre)}</div>
      <div class="recent-info"><div class="recent-name">${emp.nombre}</div><div class="recent-detail">${emp.puesto||'—'} · ${emp.area||'—'}</div></div>
      <div class="recent-parking">${emp.num_parqueo||'—'}</div>
    </div>`).join('');
  list.querySelectorAll('.recent-item').forEach(item => item.addEventListener('click', () => openEmployee(item.dataset.id)));
}
function animateCount(id, target) {
  const el = document.getElementById(id); if (!el) return;
  let start = 0;
  const step = ts => { if (!start) start = ts; const p = Math.min((ts-start)/600,1); el.textContent = Math.floor(p*target); if(p<1) requestAnimationFrame(step); else el.textContent = target; };
  requestAnimationFrame(step);
}
function quickSearch(q) {
  const res = document.getElementById('quickResults');
  if (!q.trim()) { res.innerHTML = ''; return; }
  const f = filterEmployees(q).slice(0, 6);
  res.innerHTML = f.length ? f.map(emp => `
    <div class="quick-result-item" data-id="${emp.id}" style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border)">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--primary);overflow:hidden">
        ${photos[emp.id?.toUpperCase()] ? `<img src="${photos[emp.id.toUpperCase()]}" style="width:100%;height:100%;object-fit:cover">` : getInitials(emp.nombre)}
      </div>
      <div><div style="font-size:13px;font-weight:600">${emp.nombre}</div><div style="font-size:11px;color:var(--text-muted)">ID:${emp.id} · Parqueo:${emp.num_parqueo||'—'}</div></div>
    </div>`).join('') : '<p style="padding:10px;font-size:13px;color:var(--text-muted)">Sin resultados</p>';
  res.querySelectorAll('.quick-result-item').forEach(item => item.addEventListener('click', () => openEmployee(item.dataset.id)));
}

/* ═══════════════════════════════════════════════════════
   BUSCAR
═══════════════════════════════════════════════════════ */
function filterEmployees(q) {
  if (!q.trim()) return [...employees];
  const qq = q.toLowerCase();
  return employees.filter(e =>
    (e.nombre||'').toLowerCase().includes(qq) || (e.id||'').toLowerCase().includes(qq) ||
    (e.num_parqueo||'').toLowerCase().includes(qq) || (e.area||'').toLowerCase().includes(qq) ||
    (e.puesto||'').toLowerCase().includes(qq) || (e.placa||'').toLowerCase().includes(qq));
}
function mainSearch(q) {
  const container = document.getElementById('searchResults');
  const dirF   = document.getElementById('filterDir')?.value || '';
  const statF  = document.getElementById('filterStatus')?.value || '';
  let f = filterEmployees(q);
  if (dirF)  f = f.filter(e => e.area === dirF);
  if (statF) f = f.filter(e => e.estado === statF);
  if (!f.length) {
    container.className = 'results-container';
    container.innerHTML = `<div class="empty-state"><p>${employees.length ? 'Sin resultados.' : 'Sin datos cargados.'}</p></div>`;
    return;
  }
  if (currentView === 'cards') { container.className = 'results-container cards-view'; container.innerHTML = f.map(renderEmpCard).join(''); }
  else { container.className = 'results-container table-view'; container.innerHTML = renderTable(f); }
  container.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => openEmployee(el.dataset.id)));
}
function populateFilterDir() {
  const s = document.getElementById('filterDir'); if (!s) return;
  const areas = [...new Set(employees.map(e => e.area).filter(Boolean))].sort();
  s.innerHTML = '<option value="">Todas las Áreas</option>' + areas.map(a => `<option value="${a}">${a}</option>`).join('');
}
function setView(view, btn) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  mainSearch(document.getElementById('mainSearchInput').value);
}
function renderEmpCard(emp) {
  const isActive = (emp.estado||'').toLowerCase() === 'activo';
  const photo    = photos[emp.id?.toUpperCase()];
  const isSA     = currentUser?.role === 'superadmin';
  const delBtn   = isSA ? `<button class="emp-card-delete-btn" onclick="event.stopPropagation();eliminarEmpleado('${emp._docId||''}','${(emp.nombre||'').replace(/'/g,"\\'")}')">🗑</button>` : '';
  return `<div class="emp-card" data-id="${emp.id}">${delBtn}
    <div class="emp-card-photo">${photo ? `<img src="${photo}" alt="">` : `<div class="emp-avatar-fallback">${getInitials(emp.nombre)}</div>`}<span class="emp-card-status ${isActive?'active':'inactive'}"></span></div>
    <div class="emp-card-info"><div class="emp-card-name">${emp.nombre}</div><div class="emp-card-puesto">${emp.puesto||'—'}</div><div class="emp-card-area">${emp.area||'—'}</div>
    <div class="emp-card-parking">🚗 ${emp.num_parqueo||'Sin parqueo'}${emp.placa?` · <strong>${emp.placa}</strong>`:''}</div></div>
    <div class="emp-card-id">ID ${emp.id}</div></div>`;
}
function renderTable(data) {
  return `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Nombre</th><th>Puesto</th><th>Área</th><th>Parqueo</th><th>Placa</th><th>Teléfono</th><th>Estado</th></tr></thead><tbody>
    ${data.map(emp => `<tr data-id="${emp.id}" style="cursor:pointer"><td>${emp.id}</td><td><strong>${emp.nombre}</strong></td><td>${emp.puesto||'—'}</td><td>${emp.area||'—'}</td><td>${emp.num_parqueo||'—'}</td><td>${emp.placa||'—'}</td><td>${emp.telefono||'—'}</td>
    <td><span class="status-badge ${(emp.estado||'').toLowerCase()==='activo'?'active':'inactive'}">${emp.estado||'—'}</span></td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ═══════════════════════════════════════════════════════
   MODAL EMPLEADO
═══════════════════════════════════════════════════════ */
function openEmployee(id) {
  const emp = employees.find(e => e.id == id); if (!emp) return;
  currentEmployee = emp;
  const photo    = photos[emp.id?.toUpperCase()];
  const photoSrc = photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nombre)}&size=300&background=1a56db&color=fff&bold=true`;
  const isSA     = currentUser?.role === 'superadmin';
  const isActive = (emp.estado||'activo').toLowerCase() === 'activo';

  document.getElementById('empParking').textContent = emp.num_parqueo || '—';
  document.getElementById('empStatus').className = 'emp-status-badge ' + (isActive ? 'active' : 'inactive');

  const histRows = historial.filter(h => h.empleadoId == emp.id).slice(0, 8).map(h => {
    const fecha = h.fecha ? new Date(h.fecha).toLocaleDateString('es-GT', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const ico = h.tipo==='solicitud'?'✅':h.tipo==='cambio'?'🔄':h.tipo==='revocacion'?'🚫':h.tipo==='edicion'?'✏️':'🚗';
    return `<div class="emp-hist-row"><span class="emp-hist-icono">${ico}</span><span class="emp-hist-fecha">${fecha}</span><span class="emp-hist-desc">${h.descripcion||''}${h.parqueoAnterior&&h.parqueoNuevo?' ('+h.parqueoAnterior+'→'+h.parqueoNuevo+')':''}</span></div>`;
  }).join('') || '<p style="font-size:12px;color:var(--text-muted)">Sin historial.</p>';

  const editFields = isSA ? `
    <div class="emp-edit-grid">
      <div class="form-group"><label>Nombre</label><input id="editEmpNombre" value="${emp.nombre||''}" type="text"></div>
      <div class="form-group"><label>Puesto</label><input id="editEmpPuesto" value="${emp.puesto||''}" type="text"></div>
      <div class="form-group"><label>Área</label><input id="editEmpArea" value="${emp.area||''}" type="text"></div>
      <div class="form-group"><label>No. Parqueo</label><input id="editEmpParqueo" value="${emp.num_parqueo||''}" type="text"></div>
      <div class="form-group"><label>Placa</label><input id="editEmpPlaca" value="${emp.placa||''}" type="text"></div>
      <div class="form-group"><label>Teléfono</label><input id="editEmpTel" value="${emp.telefono||''}" type="text"></div>
      <div class="form-group"><label>Correo</label><input id="editEmpCorreo" value="${emp.correo||''}" type="email"></div>
      <div class="form-group"><label>Estado</label>
        <button class="status-toggle-btn ${isActive?'btn-activo':'btn-inactivo'}" id="statusToggleBtn" onclick="toggleEmpStatus()">
          ${isActive?'✅ ACTIVO':'❌ INACTIVO'}
        </button>
        <input type="hidden" id="editEmpEstado" value="${emp.estado||'Activo'}">
      </div>
    </div>
    <div style="margin-top:14px;display:flex;gap:8px">
      <button class="btn-primary" onclick="saveEmpEdit()">💾 Guardar cambios</button>
      <button class="btn-danger" onclick="eliminarEmpleado('${emp._docId||''}','${(emp.nombre||'').replace(/'/g,"\\'")}')">🗑 Eliminar</button>
    </div>` :
    `<h2 class="emp-modal-name">${emp.nombre}</h2><p class="emp-modal-puesto">${emp.puesto||'—'}</p>
    <div class="emp-details-grid">
      <div class="emp-detail"><span>ID</span><strong>${emp.id}</strong></div>
      <div class="emp-detail"><span>Área</span><strong>${emp.area||'—'}</strong></div>
      <div class="emp-detail"><span>Parqueo</span><strong>${emp.num_parqueo||'—'}</strong></div>
      <div class="emp-detail"><span>Placa</span><strong>${emp.placa||'—'}</strong></div>
      <div class="emp-detail"><span>Teléfono</span><strong>${emp.telefono||'—'}</strong></div>
      <div class="emp-detail"><span>Correo</span><strong>${emp.correo||'—'}</strong></div>
      <div class="emp-detail"><span>Estado</span><strong style="color:${isActive?'#10b981':'#ef4444'}">${emp.estado||'Activo'}</strong></div>
    </div>`;

  document.getElementById('empModalBody').innerHTML = `
    <div class="emp-modal-top">
      <div class="emp-photo-wrap" style="flex-shrink:0">
        <img src="${photoSrc}" alt="${emp.nombre}" onclick="expandPhoto(this.src)" style="width:140px;height:140px;object-fit:cover;border-radius:12px;cursor:zoom-in;border:2px solid var(--border)">
        <div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:4px">🔍 Click para ampliar</div>
      </div>
      <div style="flex:1;min-width:0">${editFields}</div>
    </div>
    <div class="emp-historial-section"><h4>📋 Historial de Parqueo</h4><div class="emp-historial-list">${histRows}</div></div>
    <div class="qr-section"><div id="qrCode" class="qr-box"></div></div>`;

  const qrBox = document.getElementById('qrCode');
  try { new QRCode(qrBox, {text:`MIDES ID:${emp.id} ${emp.nombre} Parqueo:${emp.num_parqueo||'N/A'}`,width:90,height:90,colorDark:'#000',colorLight:'transparent',correctLevel:QRCode.CorrectLevel.M}); }
  catch(e) { qrBox.innerHTML = ''; }
  document.getElementById('empModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal() { document.getElementById('empModal').classList.add('hidden'); document.body.style.overflow = ''; currentEmployee = null; }

window.toggleEmpStatus = function() {
  const btn = document.getElementById('statusToggleBtn');
  const inp = document.getElementById('editEmpEstado');
  const isActive = inp.value.toLowerCase() === 'activo';
  inp.value = isActive ? 'Inactivo' : 'Activo';
  btn.textContent = isActive ? '❌ INACTIVO' : '✅ ACTIVO';
  btn.className = 'status-toggle-btn ' + (isActive ? 'btn-inactivo' : 'btn-activo');
};
window.saveEmpEdit = async function() {
  if (!currentEmployee?._docId) { showToast('Error: documento no encontrado'); return; }
  const updates = {
    nombre:   document.getElementById('editEmpNombre').value.trim(),
    puesto:   document.getElementById('editEmpPuesto').value.trim(),
    area:     document.getElementById('editEmpArea').value.trim(),
    placa:    document.getElementById('editEmpPlaca').value.trim(),
    telefono: document.getElementById('editEmpTel').value.trim(),
    correo:   document.getElementById('editEmpCorreo').value.trim(),
    estado:   document.getElementById('editEmpEstado').value
  };
  const newParqueo = document.getElementById('editEmpParqueo').value.trim();
  const oldParqueo = currentEmployee.num_parqueo || '';
  const campos = {nombre:'Nombre',puesto:'Puesto',area:'Área',placa:'Placa',telefono:'Teléfono',correo:'Correo',estado:'Estado'};
  const cambios = Object.keys(campos)
    .filter(k => (currentEmployee[k]||'').toString().trim() !== (updates[k]||'').toString().trim())
    .map(k => `${campos[k]}: "${currentEmployee[k]||''}" → "${updates[k]||''}"`);
  if (newParqueo !== oldParqueo) { updates.num_parqueo = newParqueo; cambios.push(`Parqueo: "${oldParqueo||'—'}" → "${newParqueo||'—'}"`); }
  try {
    await db.collection('empleados').doc(currentEmployee._docId).update(updates);
    if (cambios.length) await registrarHistorial({ tipo: newParqueo!==oldParqueo?'cambio':'edicion', empleadoId:currentEmployee.id, empleadoNombre:updates.nombre, parqueoAnterior:oldParqueo||'—', parqueoNuevo:newParqueo||oldParqueo||'—', descripcion:'Edición: '+cambios.join(' | '), realizadoPor:currentUser.name||currentUser.email });
    showToast(`✓ Empleado actualizado (${cambios.length} cambio${cambios.length!==1?'s':''})`);
    await loadEmployees(); closeModal();
    if (document.getElementById('sec-mapa')?.classList.contains('active')) renderMapa(mapaCurrentSotano);
  } catch(e) { showToast('Error: ' + e.message); }
};
window.eliminarEmpleado = async function(docId, nombre) {
  if (!CAN_MANAGE(currentUser?.role)) { showToast('Sin permiso'); return; }
  if (!confirm(`¿Eliminar a ${nombre} permanentemente?`)) return;
  try {
    await db.collection('empleados').doc(docId).delete();
    await registrarHistorial({tipo:'revocacion',empleadoId:docId,empleadoNombre:nombre,parqueoAnterior:'—',parqueoNuevo:'—',descripcion:'Empleado eliminado del sistema',realizadoPor:currentUser.name||currentUser.email});
    showToast(`✓ ${nombre} eliminado`);
    await loadEmployees(); closeModal();
    mainSearch(document.getElementById('mainSearchInput')?.value || '');
    refreshDashboard();
  } catch(e) { showToast('Error: ' + e.message); }
};
window.expandPhoto = function(src) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  ov.innerHTML = `<img src="${src}" style="max-width:88vw;max-height:88vh;border-radius:16px;box-shadow:0 0 80px rgba(0,0,0,.9);object-fit:contain"><button onclick="this.parentElement.remove()" style="position:fixed;top:20px;right:24px;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:22px;width:40px;height:40px;border-radius:50%;cursor:pointer">✕</button>`;
  ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
};

/* ═══════════════════════════════════════════════════════
   SOLICITUDES
═══════════════════════════════════════════════════════ */
function buildAprobadoresSelect() {
  const el = document.getElementById('aprobadoresSelect');
  const aprobadores = users.filter(u => u.aprobador === 'si' && u.uid !== currentUser.uid);
  el.innerHTML = aprobadores.length
    ? aprobadores.map(u => `<div class="aprobador-chip" data-uid="${u.uid}" data-nombre="${u.nombre}" onclick="this.classList.toggle('selected')">${u.nombre} <span style="font-size:10px;opacity:.7">${ROLE_LABELS[u.rol]||u.rol}</span></div>`).join('')
    : '<span style="font-size:13px;color:var(--text-muted)">No hay aprobadores. Configúralos en Usuarios.</span>';
}
async function enviarSolicitud() {
  const inp = document.getElementById('solEmpInput');
  const empId = inp.dataset.selectedId, empNombre = inp.dataset.selectedNombre;
  const parqueo = document.getElementById('solParqueo').value.trim();
  const just    = document.getElementById('solJustificacion').value.trim();
  const selApro = [...document.querySelectorAll('.aprobador-chip.selected')].map(c => ({uid:c.dataset.uid,nombre:c.dataset.nombre}));
  if (!empId)        { showToast('Selecciona un empleado'); return; }
  if (!parqueo)      { showToast('Indica el número de parqueo'); return; }
  if (!selApro.length){ showToast('Selecciona al menos 1 aprobador'); return; }
  const votos = {}; selApro.forEach(a => { votos[a.uid] = {nombre:a.nombre,voto:'pendiente'}; });
  try {
    await db.collection('solicitudes').add({empleadoId:empId,empleadoNombre:empNombre,parqueoSolicitado:parqueo,justificacion:just,estado:'pendiente',aprobadores:votos,solicitadoPor:currentUser.name||currentUser.email,solicitadoPorUid:currentUser.uid,fecha:new Date().toISOString(),fechaActualizacion:new Date().toISOString()});
    showToast('✓ Solicitud enviada');
    document.getElementById('solicitudForm').style.display = 'none';
    inp.value=''; inp.dataset.selectedId=''; inp.dataset.selectedNombre='';
    document.getElementById('solParqueo').value=''; document.getElementById('solJustificacion').value='';
    await loadSolicitudes(); renderSolicitudes('todos'); refreshDashboard();
  } catch(e) { showToast('Error: ' + e.message); }
}
window.votarSolicitud = async (solId, voto) => {
  if (voto === 'rechazado') { currentRejectId = solId; document.getElementById('rejectMotivo').value=''; document.getElementById('rejectModal').classList.remove('hidden'); return; }
  await procesarVoto(solId, 'aprobado', '');
};
async function confirmReject() {
  const motivo = document.getElementById('rejectMotivo').value.trim();
  if (!motivo) { showToast('Escribe el motivo'); return; }
  await procesarVoto(currentRejectId, 'rechazado', motivo);
  document.getElementById('rejectModal').classList.add('hidden'); currentRejectId = null;
}
async function procesarVoto(solId, voto, motivo) {
  const sol = solicitudes.find(s => s.id === solId); if (!sol) return;
  const votos = {...sol.aprobadores};
  if (votos[currentUser.uid]) { votos[currentUser.uid].voto=voto; if(motivo) votos[currentUser.uid].motivo=motivo; }
  else votos[currentUser.uid] = {nombre:currentUser.name||currentUser.email,voto,motivo:motivo||''};
  const total=Object.values(votos).length, apro=Object.values(votos).filter(v=>v.voto==='aprobado').length, rech=Object.values(votos).filter(v=>v.voto==='rechazado').length;
  let estado = 'pendiente';
  if (rech > 0) estado = 'rechazado';
  else if (currentUser.role === 'superadmin') estado = voto;
  else if (apro === total) estado = 'aprobado';
  try {
    await db.collection('solicitudes').doc(solId).update({aprobadores:votos,estado,motivoRechazo:motivo||'',fechaActualizacion:new Date().toISOString()});
    if (estado === 'aprobado') {
      const emp = employees.find(e => e.id == sol.empleadoId);
      if (emp?._docId) {
        const prev = emp.num_parqueo || '—';
        await db.collection('empleados').doc(emp._docId).update({num_parqueo:sol.parqueoSolicitado});
        await registrarHistorial({tipo:'solicitud',empleadoId:sol.empleadoId,empleadoNombre:sol.empleadoNombre,parqueoAnterior:prev,parqueoNuevo:sol.parqueoSolicitado,descripcion:'Solicitud aprobada. Parqueo: '+sol.parqueoSolicitado,realizadoPor:currentUser.name||currentUser.email});
        await loadEmployees();
      }
    }
    showToast(voto==='aprobado'?'✓ Aprobado':'✓ Rechazado');
    await loadSolicitudes(); renderSolicitudes('todos'); refreshDashboard();
  } catch(e) { showToast('Error: '+e.message); }
}
function renderSolicitudes(filtro='todos') {
  const list = document.getElementById('solicitudesList');
  const filtered = filtro==='todos' ? solicitudes : solicitudes.filter(s => s.estado===filtro);
  if (!filtered.length) { list.innerHTML='<div style="padding:40px;text-align:center;color:var(--text-muted)"><p>No hay solicitudes en esta categoría.</p></div>'; return; }
  list.innerHTML = filtered.map(sol => {
    const esAprobador = sol.aprobadores?.[currentUser.uid]?.voto === 'pendiente';
    const puedoVotar  = sol.estado==='pendiente' && (esAprobador || currentUser.role==='superadmin');
    const votos = Object.entries(sol.aprobadores||{}).map(([uid,v]) =>
      `<span class="aprobador-voto voto-${v.voto}">${v.nombre}: ${v.voto==='pendiente'?'⏳':v.voto==='aprobado'?'✅':'❌'}${v.motivo?' — '+v.motivo:''}</span>`).join('');
    const fecha = sol.fecha ? new Date(sol.fecha).toLocaleDateString('es-GT',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const estadoLabel = sol.estado==='pendiente'?'⏳ Pendiente':sol.estado==='aprobado'?'✅ Aprobado':'❌ Rechazado';
    return `<div class="solicitud-card estado-${sol.estado}">
      <div class="solicitud-inner">
        <div class="solicitud-header">
          <span class="solicitud-estado estado-${sol.estado}">${estadoLabel}</span>
          <span class="solicitud-nombre">${sol.empleadoNombre}</span>
          <span class="solicitud-parqueo-badge">🚗 Parqueo ${sol.parqueoSolicitado}</span>
        </div>
        <div class="solicitud-meta">📅 ${fecha} · Por: <strong>${sol.solicitadoPor}</strong>${sol.justificacion?'<br>💬 '+sol.justificacion:''}${sol.motivoRechazo?'<br>❌ Motivo: <strong>'+sol.motivoRechazo+'</strong>':''}</div>
        ${votos?`<div class="aprobadores-status">${votos}</div>`:''}
      </div>
      <div class="solicitud-footer">
        <div class="solicitud-actions">
          ${puedoVotar?`<button class="btn-aprobar" onclick="votarSolicitud('${sol.id}','aprobado')">✅ Aprobar</button><button class="btn-rechazar" onclick="votarSolicitud('${sol.id}','rechazado')">❌ Rechazar</button>`:''}
        </div>
        ${CAN_MANAGE(currentUser.role)?`<button class="btn-eliminar-sol" onclick="eliminarSolicitud('${sol.id}')">🗑 Eliminar</button>`:''}
      </div>
    </div>`;
  }).join('');
}
window.eliminarSolicitud = async solId => {
  if (!confirm('¿Eliminar esta solicitud?')) return;
  try { await db.collection('solicitudes').doc(solId).delete(); showToast('✓ Eliminada'); await loadSolicitudes(); renderSolicitudes('todos'); refreshDashboard(); }
  catch(e) { showToast('Error: '+e.message); }
};
function searchEmpleadoAutocomplete(q) {
  const res = document.getElementById('solEmpResults');
  if (!q.trim()) { res.innerHTML=''; return; }
  const m = filterEmployees(q).slice(0, 6);
  res.innerHTML = m.length ? m.map(e => `<div class="autocomplete-item" onclick="selectEmpleado('${e.id}','${(e.nombre||'').replace(/'/g,"\\'")}')"><strong>${e.nombre}</strong> <span style="color:var(--text-muted)">ID:${e.id}</span></div>`).join('') : '<div class="autocomplete-item" style="color:var(--text-muted)">Sin resultados</div>';
}
window.selectEmpleado = (id, nombre) => {
  const i = document.getElementById('solEmpInput'); i.value=nombre; i.dataset.selectedId=id; i.dataset.selectedNombre=nombre;
  document.getElementById('solEmpResults').innerHTML='';
};
async function guardarNuevoEmpleado() {
  const id=document.getElementById('newEmpId').value.trim(), nombre=document.getElementById('newEmpNombre').value.trim(), parqueo=document.getElementById('newEmpParqueo').value.trim();
  if (!id||!nombre) { showToast('ID y Nombre son requeridos'); return; }
  const taken = employees.find(e => e.num_parqueo&&e.num_parqueo.trim()===parqueo&&parqueo);
  if (taken&&parqueo&&!confirm(`El parqueo ${parqueo} está asignado a ${taken.nombre}. ¿Reasignar?`)) return;
  if (taken&&taken._docId) { await db.collection('empleados').doc(taken._docId).update({num_parqueo:''}); await registrarHistorial({tipo:'revocacion',empleadoId:taken.id,empleadoNombre:taken.nombre,parqueoAnterior:parqueo,parqueoNuevo:'—',descripcion:'Parqueo reasignado a '+nombre,realizadoPor:currentUser.name||currentUser.email}); }
  const newEmp = {id,nombre,puesto:document.getElementById('newEmpPuesto').value.trim(),area:document.getElementById('newEmpArea').value.trim(),num_parqueo:parqueo,placa:document.getElementById('newEmpPlaca').value.trim(),telefono:document.getElementById('newEmpTel').value.trim(),correo:document.getElementById('newEmpCorreo').value.trim(),estado:'Activo',fecha_registro:new Date().toLocaleDateString('es-GT')};
  try {
    await db.collection('empleados').add(newEmp);
    if (parqueo) await registrarHistorial({tipo:'asignacion',empleadoId:id,empleadoNombre:nombre,parqueoAnterior:'—',parqueoNuevo:parqueo,descripcion:'Nuevo empleado con parqueo '+parqueo,realizadoPor:currentUser.name||currentUser.email});
    showToast(`✓ ${nombre} agregado`);
    ['newEmpId','newEmpNombre','newEmpPuesto','newEmpArea','newEmpParqueo','newEmpPlaca','newEmpTel','newEmpCorreo'].forEach(fid => { document.getElementById(fid).value=''; });
    document.getElementById('nuevoEmpForm').style.display='none';
    await loadEmployees(); refreshDashboard();
  } catch(e) { showToast('Error: '+e.message); }
}

/* ═══════════════════════════════════════════════════════
   HISTORIAL
═══════════════════════════════════════════════════════ */
function renderHistorial(q='', tipo='') {
  const list = document.getElementById('historialList'); if (!list) return;
  let f = historial;
  if (q.trim()) { const qq=q.toLowerCase(); f=f.filter(h=>(h.empleadoNombre||'').toLowerCase().includes(qq)||(h.descripcion||'').toLowerCase().includes(qq)||(h.realizadoPor||'').toLowerCase().includes(qq)); }
  if (tipo) f = f.filter(h => h.tipo===tipo);
  if (!f.length) { list.innerHTML='<div style="padding:40px;text-align:center;color:var(--text-muted)"><p>No hay registros.</p></div>'; return; }
  const colores = {asignacion:'#3b82f6',cambio:'#f59e0b',revocacion:'#ef4444',solicitud:'#10b981',edicion:'#8b5cf6'};
  const iconos  = {asignacion:'🚗',cambio:'🔄',revocacion:'🚫',solicitud:'✅',edicion:'✏️'};
  list.innerHTML = '<div class="hist-timeline">' + f.map(h => {
    const fecha = h.fecha ? new Date(h.fecha).toLocaleDateString('es-GT',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const hora  = h.fecha ? new Date(h.fecha).toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'}) : '';
    const color = colores[h.tipo]||'#6366f1', ico=iconos[h.tipo]||'📋';
    const cambioP = h.parqueoAnterior&&h.parqueoNuevo ? `<span class="hist-parqueo-change"><span class="hist-p-old">${h.parqueoAnterior}</span> → <span class="hist-p-new">${h.parqueoNuevo}</span></span>` : '';
    return `<div class="hist-item"><div class="hist-dot" style="background:${color}">${ico}</div>
      <div class="hist-content"><div class="hist-header"><span class="hist-nombre">${h.empleadoNombre||'—'}</span>${cambioP}</div>
      <div class="hist-desc">${h.descripcion||''}</div>
      <div class="hist-meta"><span class="hist-por">👤 ${h.realizadoPor||'—'}</span><span class="hist-fecha">📅 ${fecha}${hora?' · '+hora:''}</span></div>
      </div></div>`;
  }).join('') + '</div>';
}
function exportHistorialCSV() {
  if (!CAN_EXPORT(currentUser?.role)) { showToast('Sin permiso'); return; }
  const header=['Fecha','Tipo','Empleado','Parqueo Anterior','Parqueo Nuevo','Descripción','Realizado Por'];
  const rows=historial.map(h=>[h.fecha?new Date(h.fecha).toLocaleDateString('es-GT'):'—',h.tipo,h.empleadoNombre,h.parqueoAnterior||'—',h.parqueoNuevo||'—',h.descripcion,h.realizadoPor].map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`));
  const csv=[header.join(','),...rows.map(r=>r.join(','))].join('\n');
  Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})),download:`historial_${new Date().toISOString().slice(0,10)}.csv`}).click();
  showToast('✓ Historial exportado');
}

/* ═══════════════════════════════════════════════════════
   MAPA DE PARQUEOS
   Distribución:
   1-6:    Despacho Superior
   7-10:   Inhabilitados
   11:     CCTV
   12-17:  Despacho Superior
   18-56:  Visitas
   57-116: Sótano 1 (60 espacios)
   117-176: Sótano 2 (60 espacios)
   177-236: Sótano 3 (60 espacios)
   237-296: Sótano 4 (60 espacios)
   297-359: Sótano 5 (63 espacios)
═══════════════════════════════════════════════════════ */

// Vista actual del mapa
var mapaVistaActual = 'sotano'; // 'sotano' | 'despacho' | 'inhabilitados' | 'visitas'

function getEspacioTipo(num) {
  if ((num >= 1 && num <= 6) || (num >= 12 && num <= 17)) return 'despacho';
  if (num >= 7  && num <= 10) return 'inhabilitado';
  if (num === 11)              return 'cctv';
  if (num >= 18 && num <= 56) return 'visitas';
  if (num >= 360 && num <= 425) return 'moto';
  return 'empleado';
}

function getEspaciosPorVista(vista) {
  // Sótano 1 (1-56): zona especial completa
  //   1-6:   Despacho Superior
  //   7-10:  Inhabilitados
  //   11:    CCTV
  //   12-17: Despacho Superior
  //   18-56: Visitas
  // Sótano 2 (57-116):  Empleados 60 espacios
  // Sótano 3 (117-176): Empleados 60 espacios
  // Sótano 4 (177-236): Empleados 60 espacios
  // Sótano 5 (237-299): Empleados 63 espacios
  // Motos  (300-365):   66 espacios
  if (vista === 's1')    return Array.from({length:56}, (_,i) => i+1);
  if (vista === 's2')    return Array.from({length:60}, (_,i) => i+57);
  if (vista === 's3')    return Array.from({length:60}, (_,i) => i+117);
  if (vista === 's4')    return Array.from({length:60}, (_,i) => i+177);
  if (vista === 's5')    return Array.from({length:63}, (_,i) => i+237);
  if (vista === 'motos') return Array.from({length:66}, (_,i) => i+300);
  return [];
}

function getOcupante(num) {
  return employees.find(e => e.num_parqueo && String(e.num_parqueo).trim() === String(num).trim());
}

const TIPO_LABELS = {
  despacho:    '🏛 Despacho Superior',
  inhabilitado:'🚫 Inhabilitado',
  cctv:        '📷 CCTV',
  visitas:     '👥 Visitas',
  empleado:    '🟢 Empleado',
  moto:        '🏍 Moto'
};

function initMapa() { mapaCurrentSotano = mapaCurrentSotano || 's1'; renderMapa(mapaCurrentSotano); }

function renderMapa(vista) {
  mapaCurrentSotano = vista;
  document.querySelectorAll('.mapa-tab').forEach(t => t.classList.toggle('active', t.dataset.sotano === String(vista)));
  const container = document.getElementById('mapaContainer');
  const espacios  = getEspaciosPorVista(vista);
  const cols      = vista === 'especiales' ? 8 : 10;
  const libres    = espacios.filter(n => !getOcupante(n) && ['empleado','moto'].includes(getEspacioTipo(n))).length;
  const ocupados  = espacios.filter(n => !!getOcupante(n)).length;

  let html = '';

  if (vista === 's1') {
    // Sótano 1: muestra zonas especiales con etiquetas
    const secciones = [
      { label:'🏛 Despacho Superior — Espacios 1 al 6', nums:[1,2,3,4,5,6] },
      { label:'🚫 Inhabilitados (7-10) &nbsp;·&nbsp; 📷 CCTV (11)', nums:[7,8,9,10,11] },
      { label:'🏛 Despacho Superior — Espacios 12 al 17', nums:[12,13,14,15,16,17] },
      { label:'👥 Visitas — Espacios 18 al 56', nums:Array.from({length:39},(_,i)=>i+18) },
    ];
    html = `<div class="mapa-grid" style="grid-template-columns:repeat(8,1fr)">`;
    secciones.forEach(sec => {
      html += `<div class="mapa-seccion-label" style="grid-column:1/-1">${sec.label}</div>`;
      sec.nums.forEach((num,i) => {
        html += buildEspacioHTML(num);
        if (sec.nums.length > 10 && (i+1) % 8 === 0 && i < sec.nums.length-1)
          html += `<div class="mapa-pasillo" style="grid-column:1/-1"></div>`;
      });
      html += `<div class="mapa-pasillo" style="grid-column:1/-1;margin-bottom:6px"></div>`;
    });
    html += '</div>';
  } else {
    html = `<div class="mapa-grid" style="grid-template-columns:repeat(10,1fr)">`;
    espacios.forEach((num,i) => {
      html += buildEspacioHTML(num);
      if ((i+1) % 10 === 0 && i < espacios.length-1)
        html += `<div class="mapa-pasillo" style="grid-column:1/-1"></div>`;
    });
    html += '</div>';
  }

  const vistaLabels = {s1:'Sótano 1: 56 espacios',s2:'Sótano 2: 60 espacios',s3:'Sótano 3: 60 espacios',s4:'Sótano 4: 60 espacios',s5:'Sótano 5: 63 espacios',motos:'Zona de Motos: 66 espacios'};
  const totalLabel = vistaLabels[vista] || `${espacios.length} espacios`;
  html += `<div class="mapa-summary">
    <span class="mapa-stat">🔴 Ocupados: <strong>${ocupados}</strong></span>
    <span class="mapa-stat">🟢 Libres: <strong>${libres}</strong></span>
    <span class="mapa-stat">📊 ${totalLabel}</span>
  </div>`;
  container.innerHTML = html;
}

function buildEspacioHTML(num) {
  const tipo = getEspacioTipo(num);
  const ocup = getOcupante(num);
  const cls  = ocup ? 'ocupado' : tipo;
  const title = `${num} · ${ocup ? ocup.nombre : TIPO_LABELS[tipo]||tipo}`;
  return `<div class="mapa-espacio ${cls}" onclick="mapaClickEspacio(${num})" title="${title}">
    <span class="mapa-num">${num}</span>
    ${ocup ? `<span class="mapa-ocupante">${(ocup.nombre||'').split(' ')[0]}</span>` : ''}
  </div>`;
}

window.mapaClickEspacio = function(num) {
  const tipo = getEspacioTipo(num);
  const ocup = getOcupante(num);
  const foto = ocup ? photos[ocup.id?.toUpperCase()] : null;
  let html = `<div class="mapa-info-num">Espacio ${num}</div>
    <div class="mapa-info-tipo">${TIPO_LABELS[tipo]||tipo}${ocup?' — <span style="color:#ef4444;font-weight:700">Ocupado</span>':tipo==='empleado'||tipo==='moto'?' — <span style="color:#10b981;font-weight:700">Disponible</span>':''}</div>`;

  if (tipo === 'inhabilitado') {
    html += `<div class="mapa-aviso gris">⚠️ Este espacio está fuera de servicio.</div>`;
  } else if (tipo === 'cctv') {
    html += `<div class="mapa-aviso azul">📷 Área reservada para el sistema de CCTV.</div>`;
  } else if (tipo === 'despacho') {
    html += `<div class="mapa-aviso morado">🏛 Reservado para el Despacho Superior.</div>`;
  } else if (tipo === 'visitas') {
    html += `<div class="mapa-aviso amarillo">👥 Espacio de visitas — no asignable a empleados.</div>`;
  } else if (ocup) {
    html += `<div class="mapa-info-empleado">
      ${foto?`<img src="${foto}" class="mapa-info-foto">`:`<div class="mapa-info-avatar">${getInitials(ocup.nombre)}</div>`}
      <div class="mapa-info-datos"><strong>${ocup.nombre}</strong><span>${ocup.puesto||'—'}</span><span>${ocup.area||'—'}</span><span>Placa: ${ocup.placa||'—'}</span></div>
    </div>`;
    if (CAN_MANAGE(currentUser?.role))
      html += `<button class="btn-primary" style="margin-top:10px;width:100%" onclick="document.getElementById('mapaInfoCard').classList.add('hidden');openEmployee('${ocup.id}')">Ver ficha completa</button>`;
  } else if ((tipo==='empleado'||tipo==='moto') && CAN_MANAGE(currentUser?.role)) {
    html += `<div class="mapa-aviso verde">🟢 Espacio disponible para asignar.</div>
    <button class="btn-secondary" style="margin-top:8px;width:100%" onclick="document.getElementById('mapaInfoCard').classList.add('hidden');showSection('solicitudes',document.querySelector('[data-section=\'solicitudes\']'))">Crear solicitud</button>`;
  }

  document.getElementById('mapaInfoContent').innerHTML = html;
  document.getElementById('mapaInfoCard').classList.remove('hidden');
};


/* ═══════════════════════════════════════════════════════
   FOTOS
═══════════════════════════════════════════════════════ */
function handlePhotoFiles(files) {
  const images = files.filter(f => f.type.startsWith('image/')); if (!images.length) return;
  showToast('Subiendo fotos…'); let done=0;
  images.forEach(file => {
    const empId = file.name.replace(/\.[^.]+$/, '').toUpperCase();
    const reader = new FileReader();
    reader.onload = async ev => { try { const b=await resizeImage(ev.target.result,300,.75); photos[empId]=b; await db.collection('fotos').doc(empId).set({foto:b,id:empId,updatedAt:new Date().toISOString()}); done++; if(done===images.length){refreshPhotoGrid();showToast(`✓ ${done} foto(s) guardadas`);} } catch(err){showToast('Error: '+err.message);} };
    reader.readAsDataURL(file);
  });
}
function resizeImage(dataUrl, maxSize, quality) {
  return new Promise(resolve => { const img=new Image(); img.onload=()=>{const c=document.createElement('canvas');let w=img.width,h=img.height;if(w>maxSize||h>maxSize){if(w>h){h=Math.round(h*maxSize/w);w=maxSize;}else{w=Math.round(w*maxSize/h);h=maxSize;}}c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality));};img.src=dataUrl; });
}
function refreshPhotoGrid() {
  const grid=document.getElementById('photoGrid'); const keys=Object.keys(photos);
  if (!keys.length) { grid.innerHTML='<p style="padding:16px;color:var(--text-muted)">No hay fotografías</p>'; return; }
  grid.innerHTML = keys.map(id => `<div class="photo-item${selectedPhotos.has(id)?' selected':''}" onclick="togglePhotoSelect('${id}')"><div class="photo-check">✓</div><img src="${photos[id]}" alt="${id}" loading="lazy"><div class="photo-id">${id}</div></div>`).join('');
}
window.togglePhotoSelect = id => { if(selectedPhotos.has(id))selectedPhotos.delete(id);else selectedPhotos.add(id); refreshPhotoGrid(); document.getElementById('deleteSelectedPhotosBtn').textContent=selectedPhotos.size?`🗑 Eliminar (${selectedPhotos.size})`:'🗑 Eliminar seleccionadas'; };
function toggleSelectAllPhotos() { const keys=Object.keys(photos); if(selectedPhotos.size===keys.length)selectedPhotos.clear();else keys.forEach(k=>selectedPhotos.add(k)); refreshPhotoGrid(); }
async function deleteSelectedPhotos() {
  if (!selectedPhotos.size){showToast('Selecciona fotos');return;} if(!confirm(`¿Eliminar ${selectedPhotos.size} foto(s)?`))return;
  try { for(const id of selectedPhotos){await db.collection('fotos').doc(id).delete();delete photos[id];} selectedPhotos.clear(); refreshPhotoGrid(); showToast('✓ Fotos eliminadas'); }
  catch(e){showToast('Error: '+e.message);}
}

/* ═══════════════════════════════════════════════════════
   USUARIOS
═══════════════════════════════════════════════════════ */
function loadUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!users.length) { tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px">No hay usuarios</td></tr>'; return; }
  tbody.innerHTML = users.map(u => `<tr><td><strong>${u.nombre||'—'}</strong></td><td>${u.email||'—'}</td><td><span class="role-badge ${ROLE_CLASS[u.rol]||''}">${ROLE_LABELS[u.rol]||u.rol||'—'}</span></td><td>${u.aprobador==='si'?'<span class="badge-aprobador">✓ Aprobador</span>':'—'}</td><td><span class="status-badge ${u.activo===false?'inactive':'active'}">${u.activo===false?'Inactivo':'Activo'}</span></td><td><div class="user-actions"><button class="btn-edit" onclick="openEditUser('${u.uid}')">✏️ Editar</button>${u.uid!==currentUser.uid?`<button class="btn-del" onclick="deleteUserRecord('${u.uid}')">🗑</button>`:''}</div></td></tr>`).join('');
}
window.openEditUser = uid => {
  const u=users.find(x=>x.uid===uid); if(!u)return;
  document.getElementById('editUserId').value=uid; document.getElementById('editUserName').value=u.nombre||''; document.getElementById('editUserRole').value=u.rol||'viewer'; document.getElementById('editUserAprobador').value=u.aprobador||'no'; document.getElementById('editUserPass').value='';
  document.getElementById('editUserModal').classList.remove('hidden');
};
async function saveEditUser() {
  const uid=document.getElementById('editUserId').value, name=document.getElementById('editUserName').value.trim(), role=document.getElementById('editUserRole').value, apro=document.getElementById('editUserAprobador').value;
  if (!name){showToast('Escribe el nombre');return;}
  try { await db.collection('usuarios').doc(uid).set({nombre:name,rol:role,aprobador:apro},{merge:true}); showToast('✓ Usuario actualizado'); document.getElementById('editUserModal').classList.add('hidden'); await loadUsers(); loadUsersTable(); }
  catch(e){showToast('Error: '+e.message);}
}
async function createUser() {
  const name=document.getElementById('newUserName').value.trim(), email=document.getElementById('newUserEmail').value.trim(), pass=document.getElementById('newUserPass').value, role=document.getElementById('newUserRole').value, apro=document.getElementById('newUserAprobador').value;
  if (!name||!email||!pass){showToast('Completa todos los campos');return;} if(pass.length<6){showToast('Contraseña mínimo 6 caracteres');return;}
  const btn=document.getElementById('createUserBtn'); btn.disabled=true; btn.textContent='Creando…';
  try { const cred=await auth.createUserWithEmailAndPassword(email,pass); await db.collection('usuarios').doc(cred.user.uid).set({nombre:name,email,rol:role,aprobador:apro,activo:true}); showToast(`✓ Usuario ${name} creado`); ['newUserName','newUserEmail','newUserPass'].forEach(id=>document.getElementById(id).value=''); await loadUsers(); loadUsersTable(); }
  catch(e){showToast('Error: '+(e.code==='auth/email-already-in-use'?'Correo ya existe':e.message));}
  finally{btn.disabled=false;btn.textContent='+ Crear usuario';}
}
window.deleteUserRecord = async uid => { if(!confirm('¿Eliminar usuario?'))return; await db.collection('usuarios').doc(uid).delete(); showToast('Eliminado'); await loadUsers(); loadUsersTable(); };

/* ═══════════════════════════════════════════════════════
   CSV IMPORT
═══════════════════════════════════════════════════════ */
function processCSVFile(file) {
  if (!CAN_UPLOAD(currentUser?.role)){showToast('Sin permiso');return;}
  const ext=file.name.split('.').pop().toLowerCase();
  if (!['csv','xlsx','xls'].includes(ext)){showToast('Usa CSV o Excel');return;}
  if (ext==='csv') Papa.parse(file,{header:true,skipEmptyLines:true,complete:r=>{if(r.errors.length){showToast('Error CSV: '+r.errors[0].message);return;}showCsvPreview(normalizeData(r.data));}});
  else { const reader=new FileReader(); reader.onload=ev=>{try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows.length){showToast('Archivo vacío');return;}showCsvPreview(normalizeData(rows));}catch(err){showToast('Error Excel: '+err.message);}};reader.readAsArrayBuffer(file);}
}
function normalizeData(raw) {
  return raw.map((row,i) => { const n={}; for(const k in row)n[k.toLowerCase().trim().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')]=(row[k]||'').toString().trim(); return {id:n.id||'EMP'+String(i+1).padStart(3,'0'),nombre:n.nombre||'',puesto:n.servicio_yo_puesto||n.puesto||n.servicio_y_o_puesto||n.cargo||'',area:n.area||n.direccion||'',num_parqueo:n.parqueo||n.num_parqueo||'',placa:n.placa||'',correo:n.correo||n.email||'',telefono:n.telefono||n.tel||'',estado:n.estado||'Activo',fecha_registro:new Date().toLocaleDateString('es-GT')}; });
}
function showCsvPreview(data) {
  pendingData=data;
  document.getElementById('csvPreview').style.display='block';
  document.getElementById('previewCount').textContent=`(${data.length} registros)`;
  const statsEl=document.getElementById('importPreviewStats');
  if (statsEl&&employees.length>0) {
    const newIds=new Set(data.map(e=>String(e.id).trim())), existIds=new Set(employees.map(e=>String(e.id).trim()));
    const toAdd=[...newIds].filter(id=>!existIds.has(id)).length, toUpd=[...newIds].filter(id=>existIds.has(id)).length, toDel=[...existIds].filter(id=>!newIds.has(id)).length;
    statsEl.innerHTML=`<div class="import-preview-stats"><span class="ips-add">➕ ${toAdd} nuevos</span><span class="ips-upd">🔄 ${toUpd} a actualizar</span><span class="ips-del">🗑 ${toDel} a eliminar</span></div>`;
  }
  const cols=['id','nombre','puesto','area','num_parqueo','placa','estado'],labels=['ID','Nombre','Puesto','Área','Parqueo','Placa','Estado'];
  let html=`<thead><tr>${labels.map(l=>`<th>${l}</th>`).join('')}</tr></thead><tbody>`;
  data.slice(0,20).forEach(r=>{html+=`<tr>${cols.map(c=>`<td>${r[c]||'—'}</td>`).join('')}</tr>`;});
  if (data.length>20) html+=`<tr><td colspan="${cols.length}" style="text-align:center;color:var(--text-muted);font-size:13px">… y ${data.length-20} más</td></tr>`;
  html+='</tbody>';
  document.getElementById('previewTable').innerHTML=html;
}
async function confirmImport() {
  if (!pendingData.length)return;
  const btn=document.getElementById('confirmImportBtn'); btn.disabled=true; btn.textContent='Procesando…';
  const modeEl=document.querySelector('input[name="importMode"]:checked');
  const isMerge=!modeEl||modeEl.value==='merge';
  try {
    let result;
    if (!isMerge) {
      const batch=db.batch(),col=db.collection('empleados');
      (await col.get()).forEach(d=>batch.delete(d.ref));
      pendingData.forEach(emp=>batch.set(col.doc(),emp));
      await batch.commit();
      result={added:pendingData.length,updated:0,removed:0};
    } else {
      const existSnap=await db.collection('empleados').get();
      const existDocs={};
      existSnap.forEach(d=>{const dat=d.data();if(dat.id)existDocs[String(dat.id).trim()]={docId:d.id,data:dat};});
      const newIds=new Set(pendingData.map(e=>String(e.id).trim()));
      const batch=db.batch(); let added=0,updated=0,removed=0;
      pendingData.forEach(emp=>{const eid=String(emp.id).trim();if(existDocs[eid]){batch.update(db.collection('empleados').doc(existDocs[eid].docId),emp);updated++;}else{batch.set(db.collection('empleados').doc(),emp);added++;}});
      Object.keys(existDocs).forEach(eid=>{if(!newIds.has(eid)){batch.delete(db.collection('empleados').doc(existDocs[eid].docId));removed++;}});
      await batch.commit();
      result={added,updated,removed};
    }
    await loadEmployees(); pendingData=[];
    document.getElementById('csvPreview').style.display='none';
    const s=document.getElementById('importSuccess'); s.style.display='block';
    document.getElementById('importMsg').innerHTML=isMerge?`✅ <strong>${result.added}</strong> agregados · <strong>${result.updated}</strong> actualizados · <strong>${result.removed}</strong> eliminados`:`✅ ${result.added} registros cargados`;
    refreshDashboard(); populateFilterDir(); showToast('✓ Importación completada');
    setTimeout(()=>{s.style.display='none';},8000);
  } catch(e){showToast('Error: '+e.message);}
  finally{btn.disabled=false;btn.textContent='✓ Aplicar importación';}
}
function downloadSampleCSV(){const h='ID,Nombre,Servicio y/o Puesto,Área,Parqueo,Placa,Correo,Teléfono,Estado';const r=['603,Juan López,Servicios Profesionales,Despacho Superior,88,P-1234,juan@mides.gob.gt,22345678,Activo'];Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([[h,...r].join('\n')],{type:'text/csv;charset=utf-8;'})),download:'plantilla_mides.csv'}).click();showToast('Plantilla descargada');}

/* ═══════════════════════════════════════════════════════
   ESTADÍSTICAS
═══════════════════════════════════════════════════════ */
function refreshStats() {
  animateCount('s2Total',employees.length); animateCount('s2Parking',employees.filter(e=>e.num_parqueo?.trim()).length);
  animateCount('s2Pending',solicitudes.filter(s=>s.estado==='pendiente').length); animateCount('s2Areas',new Set(employees.map(e=>e.area).filter(Boolean)).size);
  const counts={}; employees.forEach(e=>{const a=e.area||'Sin área';counts[a]=(counts[a]||0)+1;});
  const max=Math.max(...Object.values(counts),1);
  document.getElementById('dirChart').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([area,count])=>`<div class="bar-item"><div class="bar-label"><span>${area}</span><strong>${count}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${(count/max*100).toFixed(1)}%"></div></div></div>`).join('');
  const assigned=employees.filter(e=>e.num_parqueo?.trim()).sort((a,b)=>String(a.num_parqueo).localeCompare(String(b.num_parqueo)));
  document.getElementById('parkingTable').innerHTML=assigned.slice(0,20).map(e=>`<div class="parking-row"><span class="p-num">${e.num_parqueo}</span><span class="p-name">${e.nombre}</span><span class="p-placa">${e.placa||'—'}</span><span class="p-status taken">Asignado</span></div>`).join('')||'<p style="padding:20px;color:var(--text-muted)">Ningún parqueo asignado</p>';
}

/* ═══════════════════════════════════════════════════════
   REPORTES
═══════════════════════════════════════════════════════ */
function exportCSV(type) {
  if (!CAN_EXPORT(currentUser?.role)){showToast('Sin permiso');return;}
  if (type==='solicitudes'){const h=['Fecha','Estado','Empleado','Parqueo','Justificación','Por','Motivo'];const r=solicitudes.map(s=>[s.fecha?new Date(s.fecha).toLocaleDateString('es-GT'):'—',s.estado,s.empleadoNombre,s.parqueoSolicitado,s.justificacion,s.solicitadoPor,s.motivoRechazo||''].map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`));const csv=[h.join(','),...r.map(x=>x.join(','))].join('\n');Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})),download:`solicitudes_${new Date().toISOString().slice(0,10)}.csv`}).click();showToast('✓ Exportado');return;}
  let data=[...employees],fn='reporte_mides';
  if(type==='parking'){data=data.filter(e=>e.num_parqueo?.trim());fn='con_parqueo';}
  if(type==='noparking'){data=data.filter(e=>!e.num_parqueo?.trim());fn='sin_parqueo';}
  if(type==='area'){data.sort((a,b)=>(a.area||'').localeCompare(b.area||''));fn='por_area';}
  const h=['ID','Nombre','Puesto','Área','Parqueo','Placa','Correo','Teléfono','Estado'];
  const r=data.map(e=>[e.id,e.nombre,e.puesto,e.area,e.num_parqueo,e.placa,e.correo,e.telefono,e.estado].map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`));
  const csv=[h.join(','),...r.map(x=>x.join(','))].join('\n');
  Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})),download:`${fn}_${new Date().toISOString().slice(0,10)}.csv`}).click();
  showToast(`✓ Exportado (${data.length} registros)`);
}

/* ═══════════════════════════════════════════════════════
   PDF
═══════════════════════════════════════════════════════ */
function exportPDF() {
  if (!currentEmployee)return;
  const emp=currentEmployee;
  try {
    const {jsPDF}=window.jspdf; const pdf=new jsPDF({unit:'mm',format:'a5'});
    pdf.setFillColor(26,86,219); pdf.rect(0,0,148,40,'F');
    const logoImg=document.querySelector('.login-logo-img');
    if(logoImg&&logoImg.complete&&logoImg.naturalWidth>0){try{pdf.addImage(logoImg,'JPEG',8,8,24,24);}catch(e){}}
    pdf.setTextColor(255,255,255); pdf.setFontSize(7); pdf.setFont('helvetica','bold');
    pdf.text('MINISTERIO DE DESARROLLO SOCIAL — MIDES',36,14);
    pdf.setFontSize(13); pdf.text('FICHA DE PARQUEO',36,22);
    pdf.setFontSize(22); pdf.setFont('helvetica','bold'); pdf.text(emp.num_parqueo||'—',128,24,{align:'center'});
    pdf.setFontSize(7); pdf.text('PARQUEO',128,32,{align:'center'});
    pdf.setTextColor(15,23,42);
    const fields=[['ID',emp.id],['Nombre',emp.nombre],['Puesto',emp.puesto||'—'],['Área',emp.area||'—'],['Placa',emp.placa||'—'],['Teléfono',emp.telefono||'—'],['Correo',emp.correo||'—'],['Estado',emp.estado||'—']];
    let y=52; fields.forEach(([label,value])=>{pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.setTextColor(100,116,139);pdf.text(label.toUpperCase(),10,y);pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.setTextColor(15,23,42);pdf.text(String(value),10,y+5);y+=14;});
    pdf.setFillColor(240,244,248);pdf.rect(0,188,148,12,'F');pdf.setFontSize(7);pdf.setTextColor(100,116,139);pdf.text('Generado: '+new Date().toLocaleDateString('es-GT')+' — MIDES',10,195);
    pdf.save(`ficha_${emp.id}.pdf`); showToast('PDF generado ✓');
  } catch(e){showToast('Error PDF: '+e.message);}
}

/* ═══════════════════════════════════════════════════════
   CONFIGURACIÓN
═══════════════════════════════════════════════════════ */
function refreshConfig() {
  document.getElementById('cfgTotal').textContent=employees.length;
  document.getElementById('cfgRole').textContent=ROLE_LABELS[currentUser?.role]||'—';
  document.getElementById('cfgEmail').textContent=currentUser?.email||'—';
  const adm=document.getElementById('cfgAdminActions');
  if(adm) adm.style.display=CAN_MANAGE(currentUser?.role)?'flex':'none';
}
async function savePassword() {
  const p=document.getElementById('newPass').value;
  if(p.length<6){showToast('Mínimo 6 caracteres');return;}
  try{await auth.currentUser.updatePassword(p);document.getElementById('newPass').value='';showToast('✓ Contraseña actualizada');}
  catch(e){showToast('Error: '+(e.code==='auth/requires-recent-login'?'Re-inicia sesión primero':e.message));}
}
async function clearAllData() {
  if(!CAN_MANAGE(currentUser?.role)){showToast('Sin permiso');return;}
  if(!confirm('¿Eliminar TODOS los empleados?'))return;
  const batch=db.batch();(await db.collection('empleados').get()).forEach(d=>batch.delete(d.ref));
  await batch.commit();employees=[];refreshDashboard();showToast('Datos eliminados');
}

/* ═══════════════════════════════════════════════════════
   TEMA / COLORES
═══════════════════════════════════════════════════════ */
function initTheme() {
  const saved=localStorage.getItem('mides_theme')||'light';
  document.documentElement.setAttribute('data-theme',saved);
  const sw=document.getElementById('darkSwitch'); if(sw) sw.checked=saved==='dark';
  updateThemeLabel(saved==='dark');
}
function toggleTheme() {
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const next=isDark?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('mides_theme',next);
  const sw=document.getElementById('darkSwitch'); if(sw) sw.checked=!isDark;
  updateThemeLabel(!isDark);
}
function updateThemeLabel(isDark) { const lbl=document.getElementById('themeLabel'); if(lbl) lbl.textContent=isDark?'Modo Claro':'Modo Oscuro'; }
function setAccent(primary,dark) { document.documentElement.style.setProperty('--primary',primary); document.documentElement.style.setProperty('--primary-dark',dark); showToast('Color actualizado'); }

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function getInitials(nombre='') { const p=nombre.trim().split(' '); return ((p[0]?.[0]||'')+(p[1]?.[0]||'')).toUpperCase()||'?'; }
function showToast(msg) { const t=document.getElementById('toast'); if(!t)return; t.textContent=msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.add('hidden'),3500); }
