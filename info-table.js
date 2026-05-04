// info-table.js — Tabla de Información (UI Redesign v2)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, push } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';

const FB_CONFIG = {
    apiKey:            "AIzaSyCr1bcF_Lc1lKNoTmVYqIduwDqZIxK-mrM",
    authDomain:        "cerberusai-87db2.firebaseapp.com",
    projectId:         "cerberusai-87db2",
    storageBucket:     "cerberusai-87db2.firebasestorage.app",
    messagingSenderId: "942100846980",
    appId:             "1:942100846980:web:b1437acb40fc973a0d25d1",
    databaseURL:       "https://cerberusai-87db2-default-rtdb.firebaseio.com"
};

const $el   = id  => document.getElementById(id);
const toast = msg => { try { window.showToast?.(msg); } catch(_){} };
const nav   = view => { try { window.Navigation?.switchView(view); } catch(_){} };
const esc   = s   => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

let _db = null, _auth = null;
try {
    const existing = getApps().find(a => a.name === 'animesao-pro');
    const app = existing ? getApp('animesao-pro') : initializeApp(FB_CONFIG, 'animesao-pro');
    _db   = getDatabase(app);
    _auth = getAuth(app);
} catch(e) { console.warn('[InfoTable] Firebase init error:', e.message); }

// ── Static defaults ────────────────────────────────────────────────────
function defInfo()   { return { nombre: 'AniBot', version: 'X0.7', ultimaActualizacion: '—', proximaActualizacion: '—' }; }
function defNotas()  { return { items: [] }; }
function defFooter() { return { devName: 'Jimmy', devSub: 'Gracias por apoyar el proyecto. Tu apoyo hace posible que AniBot siga creciendo.', avatarUrl: '', visitUrl: 'https://animesao.replit.app', githubUrl: '', twitterUrl: '', discordUrl: '' }; }

// ── Live status checks ─────────────────────────────────────────────────
async function checkServerStatus() {
    try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 5000);
        const res  = await fetch('/api/health', { signal: ctrl.signal });
        clearTimeout(tid);
        return res.ok ? 'Online' : 'Error';
    } catch { return 'Offline'; }
}

function checkGeminiStatus() {
    const key = (localStorage.getItem('gemini_api_key') || '').trim();
    if (!key || key.length < 20 || key.length > 60) return 'Desactivada';
    if (!/^[A-Za-z0-9\-_]+$/.test(key)) return 'Desactivada';
    return 'Conectada';
}

// ── Render: stat cards (called by renderInfo + live checks) ────────────
async function renderStatCards(info) {
    // Fecha de próxima actualización
    const fechaEl = $el('it-stat-fecha-val');
    if (fechaEl) fechaEl.textContent = info?.proximaActualizacion || '—';

    // Live server check → estado del sistema
    const serverSt = await checkServerStatus();
    const sysValEl = $el('it-stat-sistema-val');
    const sysSubEl = $el('it-stat-sistema-sub');
    if (sysValEl) {
        if (serverSt === 'Online') {
            sysValEl.textContent = 'Estable';
            sysValEl.className   = 'it-stat-val it-stat-val--green';
            if (sysSubEl) sysSubEl.textContent = 'Todo funcionando';
        } else if (serverSt === 'Offline') {
            sysValEl.textContent = 'Offline';
            sysValEl.className   = 'it-stat-val it-stat-val--red';
            if (sysSubEl) sysSubEl.textContent = 'Sin conexión al servidor';
        } else {
            sysValEl.textContent = 'Degradado';
            sysValEl.className   = 'it-stat-val it-stat-val--orange';
            if (sysSubEl) sysSubEl.textContent = 'Respuesta con errores';
        }
    }
}

// ── Render: board (kept for compatibility, no visible elements now) ─────
function renderBoard(b) { /* Hero card removed in redesign */ }

// ── Render: info general ───────────────────────────────────────────────
async function renderInfo(info) {
    // Update stat card fecha
    const fechaEl = $el('it-stat-fecha-val');
    if (fechaEl) fechaEl.textContent = info?.proximaActualizacion || '—';

    // Live checks → update stat card
    await renderStatCards(info);
}

// ── Render: errores ────────────────────────────────────────────────────
let _showAllErrores = false;
let _allErrores     = [];

function renderErrores(errores) {
    if (!errores) {
        _allErrores = [];
    } else if (Array.isArray(errores.items)) {
        _allErrores = errores.items;
    } else if (typeof errores === 'object' && !errores.items) {
        _allErrores = Object.values(errores).filter(v => v && typeof v === 'object' && v.tipo);
    } else {
        _allErrores = [];
    }
    _renderErroresList();
}

function _renderErroresList() {
    const list         = $el('it-errores-list');
    const emptyEl      = $el('it-errores-empty');
    const historialEl  = $el('it-errores-historial');
    const countEl      = $el('it-stat-errores-count');
    const subEl        = $el('it-stat-errores-sub');

    const active = _allErrores.filter(e => e.estado !== 'resuelto');

    // Update stat card
    if (countEl) {
        countEl.textContent = active.length;
        countEl.className = active.length > 0 ? 'it-stat-val it-stat-val--orange' : 'it-stat-val';
    }
    if (subEl) {
        subEl.textContent = active.length === 0
            ? 'Sin errores críticos'
            : `${active.length} activo${active.length !== 1 ? 's' : ''}`;
    }

    // Show/hide empty state vs historial
    const hasAny = _allErrores.length > 0;
    if (emptyEl)     emptyEl.style.display     = hasAny ? 'none' : 'flex';
    if (historialEl) historialEl.style.display  = hasAny ? 'flex' : 'none';

    if (!list || !hasAny) return;

    const items = _showAllErrores ? _allErrores : _allErrores.slice(0, 3);

    const sevClass = s => {
        if (s === 'critico')     return 'it-error-sev--critico';
        if (s === 'advertencia') return 'it-error-sev--advertencia';
        return 'it-error-sev--menor';
    };
    const sevLabel = s => {
        if (s === 'critico')     return 'Crítico';
        if (s === 'advertencia') return 'Advertencia';
        return 'Menor';
    };
    const estadoClass = e => {
        if (e === 'resuelto')  return 'it-error-estado--resuelto';
        if (e === 'pendiente') return 'it-error-estado--pendiente';
        if (e === 'revision')  return 'it-error-estado--revision';
        return 'it-error-estado--critico';
    };
    const estadoLabel = e => {
        if (e === 'resuelto')  return 'Resuelto';
        if (e === 'pendiente') return 'Pendiente';
        if (e === 'revision')  return 'En revisión';
        return 'Crítico';
    };
    const sevIcon = s => {
        if (s === 'critico') return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FB7185" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        if (s === 'advertencia') return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FBBF24" stroke-width="2.2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
        return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#60A5FA" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    };

    list.innerHTML = items.map(e => `
        <div class="it-error-item">
            <div class="it-error-top">
                <span class="it-error-icon">${sevIcon(e.severidad)}</span>
                <span class="it-error-tipo">${esc(e.tipo)}</span>
                <span class="it-error-sev ${sevClass(e.severidad)}">${sevLabel(e.severidad)}</span>
            </div>
            <p class="it-error-desc">${esc(e.descripcion)}</p>
            <div class="it-error-bottom">
                <span class="it-error-hora">${esc(e.hora || '')}</span>
                <span class="it-error-estado ${estadoClass(e.estado)}">${estadoLabel(e.estado)}</span>
            </div>
        </div>`).join('');

    const btn = $el('it-ver-errores-btn');
    if (btn) {
        btn.style.display = _allErrores.length > 3 ? 'inline' : 'none';
        btn.textContent = _showAllErrores ? 'Ver menos' : 'Ver todos';
        btn.onclick = () => { _showAllErrores = !_showAllErrores; _renderErroresList(); };
    }
}

// ── Render: comunidad (real Firebase push-key structure) ───────────────
let _showAllPosts = false;
let _allPosts     = [];

function parseComunidadPosts(data) {
    if (!data || typeof data !== 'object') return [];
    if (data.items) return [];
    return Object.entries(data)
        .map(([id, post]) => ({ id, ...post }))
        .filter(p => p && p.contenido)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function renderComunidadPosts(posts) {
    _allPosts = posts;

    // Update users active stat (total posts count as proxy)
    const usersEl = $el('it-stat-users-val');
    if (usersEl) usersEl.textContent = posts.length > 0 ? String(posts.length) : '—';

    _renderPostsList();
}

function _renderPostsList() {
    const list = $el('it-comunidad-list');
    if (!list) return;
    const items = _showAllPosts ? _allPosts : _allPosts.slice(0, 3);

    if (!items.length) {
        list.innerHTML = '<p class="it-notas-empty" style="padding:6px 0">Sé el primero en publicar algo.</p>';
        const btn = $el('it-ver-posts-btn');
        if (btn) btn.style.display = 'none';
        return;
    }

    const badgeClass = t => {
        if (t === 'error')        return 'it-post-badge--error';
        if (t === 'recomendacion')return 'it-post-badge--recomendacion';
        if (t === 'pregunta')     return 'it-post-badge--pregunta';
        if (t === 'idea')         return 'it-post-badge--idea';
        if (t === 'imagen')       return 'it-post-badge--imagen';
        return 'it-post-badge--general';
    };
    const badgeLabel = t => {
        if (t === 'error')        return 'Error';
        if (t === 'recomendacion')return 'Recomend.';
        if (t === 'pregunta')     return 'Pregunta';
        if (t === 'idea')         return 'Idea';
        if (t === 'imagen')       return 'Imagen';
        return 'General';
    };
    const timeAgo = ts => {
        if (!ts) return '';
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60)    return 'Ahora mismo';
        if (s < 3600)  return `Hace ${Math.floor(s / 60)} min`;
        if (s < 86400) return `Hace ${Math.floor(s / 3600)} h`;
        return `Hace ${Math.floor(s / 86400)} d`;
    };

    const heartSVG    = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    const commentSVG  = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const shareSVG    = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

    list.innerHTML = items.map(p => {
        const initial       = (p.alias || '?').charAt(0).toUpperCase();
        const avatarContent = p.avatarUrl
            ? `<img src="${esc(p.avatarUrl)}" alt="${initial}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none'">`
            : initial;
        const alreadyReacted = sessionStorage.getItem(`reacted_${p.id}`) ? 'style="color:#FB7185"' : '';
        return `
        <div class="it-post-item">
            <div class="it-post-header">
                <div class="it-post-avatar" style="background:${esc(p.avatarColor || '#6366f1')}">${avatarContent}</div>
                <div class="it-post-meta">
                    <span class="it-post-alias">${esc(p.alias || 'Anónimo')}</span>
                    <span class="it-post-badge ${badgeClass(p.tipo)}">${badgeLabel(p.tipo)}</span>
                </div>
                <span class="it-post-hora">${timeAgo(p.timestamp)}</span>
            </div>
            <p class="it-post-content">${esc(p.contenido || '')}</p>
            <div class="it-post-actions">
                <button class="it-post-action it-react-btn" data-id="${p.id}" data-count="${p.reaccionesCount || 0}" ${alreadyReacted}>
                    ${heartSVG} ${p.reaccionesCount || 0}
                </button>
                <button class="it-post-action">
                    ${commentSVG} 0
                </button>
                <button class="it-post-action it-post-action--report">Reportar</button>
                <button class="it-post-action it-post-action--share">${shareSVG}</button>
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.it-react-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            reactToPost(btn.dataset.id, parseInt(btn.dataset.count) || 0, btn);
        });
    });

    const verBtn = $el('it-ver-posts-btn');
    if (verBtn) {
        verBtn.style.display = _allPosts.length > 3 ? 'flex' : 'none';
        verBtn.innerHTML = _showAllPosts
            ? `Ver menos <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`
            : `Ver más publicaciones <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
        verBtn.onclick = () => { _showAllPosts = !_showAllPosts; _renderPostsList(); };
    }
}

// ── React to a post ─────────────────────────────────────────────────────
async function reactToPost(postId, currentCount, btn) {
    if (!_db || !postId) return;
    const key = `reacted_${postId}`;
    if (sessionStorage.getItem(key)) { toast('Ya reaccionaste a este post'); return; }
    sessionStorage.setItem(key, '1');
    const newCount = currentCount + 1;
    if (btn) { btn.dataset.count = newCount; btn.style.color = '#FB7185'; btn.childNodes[btn.childNodes.length - 1].textContent = ` ${newCount}`; }
    try {
        await set(ref(_db, `public/comunidad/${postId}/reaccionesCount`), newCount);
    } catch {
        sessionStorage.removeItem(key);
        toast('Error al reaccionar');
    }
}

// ── Submit new community post ──────────────────────────────────────────
let _isPosting = false;

async function submitPost() {
    if (_isPosting) return;
    const input   = $el('it-post-input');
    const content = input?.value.trim();
    if (!content) { toast('Escribe algo antes de publicar'); return; }
    if (content.length > 300) { toast('Máximo 300 caracteres'); return; }
    if (!_db) { toast('Sin conexión a Firebase'); return; }

    _isPosting = true;
    const submitBtn = $el('it-post-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Publicando...'; }

    const user        = _auth?.currentUser;
    const alias       = user?.displayName || user?.email?.split('@')[0] || 'Anónimo';
    const uid         = user?.uid || null;
    const avatarUrl   = user?.photoURL || '';
    const colors      = ['#6366f1','#8B5CF6','#F472B6','#60A5FA','#22C55E','#FBBF24','#F97316'];
    const avatarColor = uid
        ? colors[Math.abs([...uid].reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length]
        : colors[Math.floor(Math.random() * colors.length)];

    // Read tipo from active pill
    const activePill = document.querySelector('.it-type-pill--active');
    const tipo = activePill?.dataset.tipo || 'general';

    try {
        await push(ref(_db, 'public/comunidad'), {
            alias, uid, avatarUrl, avatarColor, tipo,
            contenido: content,
            timestamp: Date.now(),
            reaccionesCount: 0
        });
        if (input) input.value = '';
        toast('Publicado correctamente');
    } catch(e) {
        toast('Error al publicar: ' + e.message);
    }

    _isPosting = false;
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Publicar`;
    }
}

// ── Update composer avatar ─────────────────────────────────────────────
function updateComposerAvatar() {
    const avEl = $el('it-composer-avatar');
    if (!avEl) return;
    const user = _auth?.currentUser;
    if (user?.photoURL) {
        avEl.innerHTML = `<img src="${esc(user.photoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.textContent='${esc((user.displayName||'U').charAt(0).toUpperCase())}'">`;
    } else if (user) {
        avEl.textContent   = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
        avEl.style.background = '#6366f1';
    } else {
        avEl.textContent   = '?';
        avEl.style.background = '#374151';
    }
}

// ── Render: notas ──────────────────────────────────────────────────────
let _showAllNotas = false;
let _allNotas     = [];

function renderNotas(notas) {
    _allNotas = (notas && notas.items) ? notas.items : [];
    _renderNotasList();
}

function _renderNotasList() {
    const list = $el('it-notas-list');
    if (!list) return;
    const items = _showAllNotas ? _allNotas : _allNotas.slice(0, 4);
    if (!items.length) {
        list.innerHTML = '<p class="it-notas-empty">Sin notas por ahora.</p>';
        return;
    }
    list.innerHTML = items.map(item => `
        <div class="it-nota-item">
            <span class="it-nota-dot"></span>
            <span class="it-nota-text">${esc(item.texto)}</span>
            <span class="it-nota-date">${esc(item.fecha)}</span>
        </div>`).join('');

    const btn = $el('it-ver-todas-btn');
    if (btn) {
        btn.style.display = _allNotas.length > 4 ? 'flex' : 'none';
        btn.innerHTML = _showAllNotas
            ? `Ver menos <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`
            : `Ver todas las notas <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
        btn.onclick = () => { _showAllNotas = !_showAllNotas; _renderNotasList(); };
    }
}

// ── Render: footer ─────────────────────────────────────────────────────
let _visitUrl   = 'https://animesao.replit.app';
let _githubUrl  = '';
let _twitterUrl = '';
let _discordUrl = '';

function renderFooter(footer) {
    const nameEl = $el('it-dev-name');
    const subEl  = $el('it-dev-sub');
    const imgEl  = $el('it-footer-img');
    if (nameEl) nameEl.textContent = footer.devName || 'Jimmy';
    if (subEl)  subEl.textContent  = footer.devSub  || 'Gracias por apoyar el proyecto.';
    _visitUrl   = footer.visitUrl   || 'https://animesao.replit.app';
    _githubUrl  = footer.githubUrl  || '';
    _twitterUrl = footer.twitterUrl || '';
    _discordUrl = footer.discordUrl || '';
    if (imgEl) {
        imgEl.src = (footer.avatarUrl && footer.avatarUrl.startsWith('http'))
            ? footer.avatarUrl : '/icon-192.png';
    }
}

// ── Show content ───────────────────────────────────────────────────────
function showContent() {
    const loadEl    = $el('it-loading');
    const contentEl = $el('it-content');
    if (loadEl)    loadEl.style.display    = 'none';
    if (contentEl) contentEl.style.display = 'flex';
}

// ── Sidebar navigation ─────────────────────────────────────────────────
function initSidebar() {
    const sidebar = $el('it-sidebar');
    if (!sidebar) return;

    sidebar.querySelectorAll('.it-sb-btn[data-scroll]').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            sidebar.querySelectorAll('.it-sb-btn').forEach(b => b.classList.remove('it-sb-btn--active'));
            btn.classList.add('it-sb-btn--active');

            // Scroll to section
            const targetId = btn.dataset.scroll;
            const targetEl = $el(targetId);
            if (targetEl) {
                const scrollEl = $el('it-scroll');
                if (scrollEl) {
                    const offset = targetEl.offsetTop - 12;
                    scrollEl.scrollTo({ top: offset, behavior: 'smooth' });
                }
            }
        });
    });

    // Settings button
    const settingsBtn = $el('it-sb-settings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => nav('view-settings'));
    }

    // Visit button
    const visitBtn2 = $el('it-sb-visit');
    if (visitBtn2) {
        visitBtn2.addEventListener('click', () => {
            if (_visitUrl) window.open(_visitUrl, '_blank');
        });
    }
}

// ── Type pills ─────────────────────────────────────────────────────────
function initTypePills() {
    const container = $el('it-composer-types');
    if (!container) return;
    container.querySelectorAll('.it-type-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            container.querySelectorAll('.it-type-pill').forEach(p => p.classList.remove('it-type-pill--active'));
            pill.classList.add('it-type-pill--active');
        });
    });
}

// ── Social buttons ─────────────────────────────────────────────────────
function initSocialButtons() {
    const gh  = $el('it-social-github');
    const tw  = $el('it-social-twitter');
    const dc  = $el('it-social-discord');
    const vis = $el('it-visit-btn');

    if (gh)  gh.addEventListener('click',  () => { if (_githubUrl)  window.open(_githubUrl, '_blank');  else toast('GitHub no configurado'); });
    if (tw)  tw.addEventListener('click',  () => { if (_twitterUrl) window.open(_twitterUrl,'_blank');  else toast('Twitter no configurado'); });
    if (dc)  dc.addEventListener('click',  () => { if (_discordUrl) window.open(_discordUrl,'_blank');  else toast('Discord no configurado'); });
    if (vis) vis.addEventListener('click', () => { if (_visitUrl)   window.open(_visitUrl,  '_blank');  });
}

// ── Real-time subscriptions ────────────────────────────────────────────
let _unsubPublic    = null;
let _unsubComunidad = null;
let _firstLoad      = true;

function attachRealtime() {
    if (!_db) {
        renderInfo(defInfo());
        renderErrores(null);
        renderComunidadPosts([]);
        renderNotas(defNotas());
        renderFooter(defFooter());
        showContent();
        _firstLoad = false;
        return;
    }
    if (_unsubPublic) return;

    _unsubPublic = onValue(ref(_db, 'public'), (snapshot) => {
        const data = snapshot.val() || {};

        // board data (no longer rendered visually)
        // info
        renderInfo({ ...defInfo(), ...(data.info || {}) });
        // errors
        renderErrores(data.errores || null);
        // notas
        renderNotas(data.notas || defNotas());
        // footer
        renderFooter({ ...defFooter(), ...(data.footer || {}) });

        if (_firstLoad) { showContent(); _firstLoad = false; }
    }, (err) => {
        console.warn('[InfoTable] Firebase error:', err.message);
        renderInfo(defInfo());
        renderErrores(null);
        renderNotas(defNotas());
        renderFooter(defFooter());
        showContent();
        _firstLoad = false;
    });

    _unsubComunidad = onValue(ref(_db, 'public/comunidad'), (snap) => {
        renderComunidadPosts(parseComunidadPosts(snap.val()));
    });
}

function detachRealtime() {
    if (_unsubPublic)    { _unsubPublic();    _unsubPublic    = null; }
    if (_unsubComunidad) { _unsubComunidad(); _unsubComunidad = null; }
    _firstLoad = true;
}

// ── Dev panel ─────────────────────────────────────────────────────────
let _devUser = null;

function showDevPanel() {
    const panel = document.getElementById('dev-panel-overlay');
    if (panel) panel.style.display = 'flex';
}

function initDevPanel() {
    // Dev panel login
    const loginBtn  = $el('dev-login-btn');
    const logoutBtn = $el('dp-logout-btn');
    const devModal  = $el('dev-login-modal');

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = $el('dev-email')?.value?.trim();
            const pass  = $el('dev-password')?.value;
            const errEl = $el('dev-login-error');
            if (!email || !pass) { if (errEl) errEl.textContent = 'Completa todos los campos'; return; }
            loginBtn.disabled = true;
            loginBtn.textContent = 'Accediendo...';
            try {
                await signInWithEmailAndPassword(_auth, email, pass);
                _devUser = _auth.currentUser;
                if (devModal) devModal.style.display = 'none';
                showDevPanel();
                updateComposerAvatar();
            } catch(e) {
                if (errEl) errEl.textContent = e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
                    ? 'Credenciales incorrectas'
                    : 'Error al acceder';
            }
            loginBtn.disabled = false;
            loginBtn.textContent = 'Acceder al panel';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fbSignOut(_auth).catch(() => {});
            _devUser = null;
            const panel = $el('dev-panel-overlay');
            if (panel) panel.style.display = 'none';
            updateComposerAvatar();
        });
    }

    // Gestionar errores btn → open dev panel or login modal
    const gestionarBtn = $el('it-gestionar-errores-btn');
    if (gestionarBtn) {
        gestionarBtn.addEventListener('click', () => {
            if (_auth?.currentUser) {
                showDevPanel();
            } else {
                const modal = $el('dev-login-modal');
                if (modal) modal.style.display = 'flex';
            }
        });
    }

    // Dev panel save errores
    const dpAddError  = $el('dp-add-error');
    const dpSaveError = $el('dp-save-errores');
    if (dpAddError) {
        dpAddError.addEventListener('click', () => {
            const container = $el('dp-errores-container');
            if (!container) return;
            const idx = container.querySelectorAll('.dp-error-entry').length;
            const entry = document.createElement('div');
            entry.className = 'dp-error-entry';
            entry.innerHTML = `
                <input class="dp-input" placeholder="Tipo de error" data-field="tipo" style="grid-column:span 2">
                <textarea class="dp-input" placeholder="Descripción" data-field="descripcion" rows="2" style="grid-column:span 2;resize:none"></textarea>
                <select class="dp-input" data-field="severidad">
                    <option value="menor">Menor</option>
                    <option value="advertencia">Advertencia</option>
                    <option value="critico">Crítico</option>
                </select>
                <select class="dp-input" data-field="estado">
                    <option value="pendiente">Pendiente</option>
                    <option value="revision">En revisión</option>
                    <option value="resuelto">Resuelto</option>
                </select>
                <input class="dp-input" placeholder="Hace X min / Hace 1 h" data-field="hora" style="grid-column:span 2">
                <button class="dp-remove-btn" onclick="this.closest('.dp-error-entry').remove()">Eliminar</button>`;
            container.appendChild(entry);
        });
    }

    if (dpSaveError) {
        dpSaveError.addEventListener('click', async () => {
            if (!_db || !_auth?.currentUser) { toast('No autenticado'); return; }
            const entries = document.querySelectorAll('.dp-error-entry');
            const items = [...entries].map(entry => ({
                tipo:        entry.querySelector('[data-field="tipo"]')?.value || '',
                descripcion: entry.querySelector('[data-field="descripcion"]')?.value || '',
                severidad:   entry.querySelector('[data-field="severidad"]')?.value || 'menor',
                estado:      entry.querySelector('[data-field="estado"]')?.value || 'pendiente',
                hora:        entry.querySelector('[data-field="hora"]')?.value || ''
            })).filter(e => e.tipo);
            try {
                await set(ref(_db, 'public/errores'), { items });
                toast('Errores guardados');
            } catch(e) { toast('Error al guardar: ' + e.message); }
        });
    }

    // Dev panel note live preview
    const dpNote = $el('dp-live-note');
    if (dpNote) {
        dpNote.addEventListener('input', async () => {
            if (!_db || !_auth?.currentUser) return;
            const val = dpNote.value;
            try { await set(ref(_db, 'public/info/proximaActualizacion'), val); } catch {}
        });
    }
}

// ── Main init ──────────────────────────────────────────────────────────
let _initialized = false;

export function initInfoTable() {
    if (_initialized) return;
    _initialized = true;

    // Back button
    const backBtn = $el('it-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => nav('view-home'));

    // Refresh button
    const refreshBtn = $el('it-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.6';
        await renderStatCards(defInfo());
        setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.style.opacity = '';
        }, 1000);
        toast('Actualizando...');
    });

    // Panel de control button
    const panelBtn = $el('it-panel-btn');
    if (panelBtn) panelBtn.addEventListener('click', () => {
        if (_auth?.currentUser) {
            showDevPanel();
        } else {
            const modal = $el('dev-login-modal');
            if (modal) modal.style.display = 'flex';
        }
    });

    // Dev panel cancel
    const modalCancel = $el('dev-modal-cancel');
    if (modalCancel) modalCancel.addEventListener('click', () => {
        const modal = $el('dev-login-modal');
        if (modal) modal.style.display = 'none';
    });

    // Dev panel back
    const dpBack = $el('dp-back-btn');
    if (dpBack) dpBack.addEventListener('click', () => {
        const panel = $el('dev-panel-overlay');
        if (panel) panel.style.display = 'none';
    });

    // Publish post
    const postSubmit = $el('it-post-submit');
    if (postSubmit) postSubmit.addEventListener('click', submitPost);

    // Tutorials button
    const tutBtn = $el('it-tutorials-btn');
    if (tutBtn) tutBtn.addEventListener('click', () => toast('Tutoriales próximamente disponibles'));

    // Sidebar, pills, socials
    initSidebar();
    initTypePills();
    initSocialButtons();
    initDevPanel();

    // Auth state listener
    if (_auth) {
        _auth.onAuthStateChanged(user => {
            _devUser = user;
            updateComposerAvatar();
        });
    }

    // Start realtime
    attachRealtime();
}

export function destroyInfoTable() {
    detachRealtime();
}

// ── Auto-init when view becomes active ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const view = document.getElementById('view-info-table');
    if (!view) return;

    const observer = new MutationObserver(() => {
        if (view.classList.contains('active')) {
            initInfoTable();
        }
    });
    observer.observe(view, { attributes: true, attributeFilter: ['class'] });

    if (view.classList.contains('active')) initInfoTable();
});

// ── Global manager (called by script.js via window.InfoTableManager.open()) ──
window.InfoTableManager = {
    open: () => {
        try { window.Navigation?.switchView('view-info-table'); } catch(_) {}
    }
};
