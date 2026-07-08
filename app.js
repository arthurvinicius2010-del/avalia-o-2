/* =======================================================================
   SIGOE · app.js
   Núcleo da aplicação: inicialização, roteador SPA (hash), sidebar
   retrátil, tema claro/escuro, cabeçalho, pesquisa instantânea,
   notificações, login visual e helpers de formulário/foto.
   ======================================================================= */
(function () {
  'use strict';
  const { $, $$, esc, toast } = U;
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};

  let currentRoute = 'dashboard';

  /* ==================== HELPERS DE FORMULÁRIO ==================== */
  /** Coleta valores de inputs/selects/textarea com atributo name dentro de root. */
  SIGOE.formData = function (root) {
    const data = {};
    $$('[name]', root).forEach(el => {
      if (el.type === 'checkbox') data[el.name] = el.checked;
      else data[el.name] = el.value.trim();
    });
    // fotos armazenadas em dataset
    $$('[data-photo-name]', root).forEach(el => { data[el.dataset.photoName] = el.dataset.value || ''; });
    return data;
  };

  /** Aplica máscaras (CPF, telefone) a inputs com data-mask. */
  SIGOE.bindMasks = function (root) {
    $$('[data-mask]', root).forEach(el => {
      const fn = el.dataset.mask === 'cpf' ? U.maskCPF : U.maskPhone;
      el.addEventListener('input', () => { const p = el.selectionStart; el.value = fn(el.value); el.setSelectionRange(p, p); });
      if (el.value) el.value = fn(el.value);
    });
  };

  /** HTML de campo de foto com preview. */
  SIGOE.photoField = function (name, value, label, shape = '') {
    const preview = value
      ? `<img class="photo-preview ${shape}" data-photo-preview src="${esc(value)}" />`
      : `<div class="photo-preview ${shape}" data-photo-preview style="display:grid;place-items:center;color:var(--text-muted)"><i class="fa-solid fa-image" style="font-size:26px"></i></div>`;
    return `
      <div style="display:flex;gap:16px;align-items:center">
        <span data-photo-holder data-value="${esc(value || '')}" data-photo-name="${name}" style="display:contents">${preview}</span>
        <div style="flex:1">
          <span class="field" style="margin-bottom:6px;display:block;font-size:12.5px;font-weight:600;color:var(--text-soft)">${esc(label || 'Foto')}</span>
          <label class="photo-drop"><i class="fa-solid fa-cloud-arrow-up"></i> Clique para enviar imagem
            <input type="file" accept="image/*" data-photo-input="${name}" hidden />
          </label>
        </div>
      </div>`;
  };

  /** Liga inputs de foto: converte para dataURL e mostra preview. */
  SIGOE.bindPhoto = function (root) {
    $$('[data-photo-input]', root).forEach(input => {
      input.addEventListener('change', async () => {
        const file = input.files[0]; if (!file) return;
        if (file.size > 3 * 1024 * 1024) return toast('Imagem muito grande (máx. 3MB)', 'warn');
        const dataURL = await U.readImageAsDataURL(file);
        const holder = input.closest('.photo-drop').parentElement.parentElement.querySelector('[data-photo-holder]');
        holder.dataset.value = dataURL;
        const oldPrev = holder.querySelector('[data-photo-preview]');
        const shape = oldPrev.classList.contains('round') ? 'round' : '';
        const img = U.el(`<img class="photo-preview ${shape}" data-photo-preview src="${dataURL}" />`);
        oldPrev.replaceWith(img);
      });
    });
  };

  /* ==================== TEMA ==================== */
  SIGOE.setTheme = function (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    DB.setConfig('theme', theme);
    const icon = $('#theme-toggle i');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    // redesenha dashboard para atualizar cores dos gráficos
    if (currentRoute === 'dashboard') SIGOE.rerender();
  };

  /* ==================== CONFIG / SIDEBAR ==================== */
  SIGOE.applyConfig = function () {
    const cfg = DB.getConfig();
    document.documentElement.setAttribute('data-theme', cfg.theme);
    const icon = $('#theme-toggle i');
    if (icon) icon.className = cfg.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    $('#app').classList.toggle('sidebar-collapsed', !!cfg.sidebarCollapsed);
    updateNotifDot();
  };

  /* ==================== ROTEADOR ==================== */
  function setActiveNav(route) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === route));
  }

  function navigate() {
    const hash = location.hash.replace(/^#\//, '') || 'dashboard';
    const route = SIGOE.views[hash] ? hash : 'dashboard';
    const prev = SIGOE.views[currentRoute];
    if (prev && typeof prev.onLeave === 'function' && currentRoute !== route) prev.onLeave();
    currentRoute = route;
    const view = SIGOE.views[route];
    $('#page-title').textContent = view.title;
    $('#page-subtitle').textContent = view.subtitle || '';
    setActiveNav(route);
    const outlet = $('#view');
    outlet.innerHTML = '';
    view.render(outlet);
    // fecha sidebar mobile
    $('#app').classList.remove('sidebar-open');
    window.scrollTo(0, 0);
  }

  SIGOE.rerender = function () { navigate(); };

  /* ==================== PESQUISA INSTANTÂNEA ==================== */
  function globalSearch(q) {
    const box = $('#global-search-results');
    q = q.trim().toLowerCase();
    if (!q) { box.classList.remove('open'); return; }
    const res = [];
    DB.query('alunos', a => (a.nome || '').toLowerCase().includes(q) || (a.matricula || '').includes(q))
      .slice(0, 5).forEach(a => res.push({ tipo: 'Aluno', tag: 'blue', ic: 'fa-user-graduate', label: a.nome, sub: DB.turmaNome(a.turmaId), action: () => SIGOE.openAlunoProfile(a.id) }));
    DB.query('professores', p => (p.nome || '').toLowerCase().includes(q))
      .slice(0, 3).forEach(p => res.push({ tipo: 'Professor', tag: 'green', ic: 'fa-chalkboard-user', label: p.nome, sub: p.disciplina || '', action: () => location.hash = '#/professores' }));
    DB.query('ocorrencias', o => (o.tipo || '').toLowerCase().includes(q) || (o.descricao || '').toLowerCase().includes(q))
      .slice(0, 4).forEach(o => res.push({ tipo: 'Ocorrência', tag: 'amber', ic: 'fa-clipboard-list', label: `${o.tipo} — ${DB.alunoNome(o.alunoId)}`, sub: U.formatDate(o.data), action: () => location.hash = '#/ocorrencias' }));

    box.classList.add('open');
    if (!res.length) { box.innerHTML = `<div class="search-empty">Nenhum resultado para "${esc(q)}"</div>`; return; }
    box.innerHTML = res.map((r, i) => `
      <div class="search-result" data-i="${i}">
        <div class="mini-avatar"><i class="fa-solid ${r.ic}"></i></div>
        <div><strong>${esc(r.label)}</strong><br><small style="color:var(--text-muted)">${esc(r.sub)}</small></div>
        <span class="tag ${r.tag}">${r.tipo}</span>
      </div>`).join('');
    $$('.search-result', box).forEach(el => el.addEventListener('click', () => {
      res[+el.dataset.i].action(); box.classList.remove('open'); $('#global-search').value = '';
    }));
  }

  /* ==================== NOTIFICAÇÕES ==================== */
  function updateNotifDot() { $('#notif-dot').classList.toggle('on', DB.unreadCount() > 0); }
  function renderNotifPanel() {
    const panel = $('#notif-panel');
    const list = DB.all('notificacoes').slice(-12).reverse();
    const colorMap = { info: 'ic-blue', success: 'ic-green', warn: 'ic-amber', error: 'ic-red' };
    panel.innerHTML = `<h4>Notificações</h4>` + (list.length ? list.map(n => `
      <div class="notif-item">
        <div class="ic ${colorMap[n.tipo] || 'ic-blue'}"><i class="fa-solid ${esc(n.icon || 'fa-circle-info')}"></i></div>
        <div><strong>${esc(n.titulo)}</strong><br><span style="font-size:12.5px;color:var(--text-soft)">${esc(n.mensagem)}</span><br><small>${U.timeAgo(n.createdAt)}</small></div>
      </div>`).join('') : `<div class="search-empty">Sem notificações</div>`);
  }

  /* ==================== LOGIN (autenticação real) ==================== */
  function showApp() { $('#login-screen').classList.add('hidden'); $('#app').classList.remove('hidden'); }
  function showLogin() { $('#app').classList.add('hidden'); $('#login-screen').classList.remove('hidden'); }

  function applyUser(user) {
    if (!user) return;
    const ini = (user.nome || user.usuario || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    if ($('#user-avatar')) $('#user-avatar').textContent = ini || 'U';
    if ($('#user-name')) $('#user-name').textContent = user.nome || user.usuario;
    if ($('#user-email')) $('#user-email').textContent = user.email || '';
  }

  async function initLogin() {
    // Verifica se já existe uma sessão ativa no servidor.
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      if (res.ok) { const { user } = await res.json(); applyUser(user); showApp(); startApp(); bindLogout(); return; }
    } catch (e) { /* servidor fora do ar — cai no login abaixo (modo local) */ }

    showLogin();
    const err = $('#login-error');
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      err.classList.add('hidden');
      const usuario = $('#login-user').value.trim();
      const senha = $('#login-pass').value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario, senha })
        });
        if (res.ok) {
          const { user } = await res.json();
          applyUser(user); showApp(); startApp(); bindLogout();
          toast('Bem-vindo ao SIGOE', 'success', 'Login realizado');
        } else {
          err.textContent = 'Usuário ou senha inválidos.';
          err.classList.remove('hidden');
        }
      } catch (netErr) {
        // Servidor indisponível: permite acesso em modo local (offline).
        console.warn('Servidor de login indisponível — entrando em modo local.', netErr);
        showApp(); startApp(); bindLogout();
        toast('Servidor fora do ar: modo local (dados só neste navegador).', 'warn', 'Modo offline');
      }
    });
  }

  function bindLogout() {
    const btn = $('#logout-btn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* ignore */ }
      location.reload();
    });
  }

  /* ==================== INICIALIZAÇÃO ==================== */
  function bindShell() {
    $('#footer-year').textContent = new Date().getFullYear();

    // Sidebar toggle (colapsar em desktop / abrir em mobile)
    $('#sidebar-toggle').addEventListener('click', () => {
      if (window.innerWidth <= 860) $('#app').classList.toggle('sidebar-open');
      else { const c = !DB.getConfig('sidebarCollapsed'); DB.setConfig('sidebarCollapsed', c); $('#app').classList.toggle('sidebar-collapsed', c); }
    });
    $('#sidebar-collapse').addEventListener('click', () => {
      const c = !DB.getConfig('sidebarCollapsed'); DB.setConfig('sidebarCollapsed', c); $('#app').classList.toggle('sidebar-collapsed', c);
    });
    $('#sidebar-backdrop').addEventListener('click', () => $('#app').classList.remove('sidebar-open'));

    // Tema
    $('#theme-toggle').addEventListener('click', () => {
      SIGOE.setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    // Pesquisa
    const gs = $('#global-search');
    gs.addEventListener('input', U.debounce(() => globalSearch(gs.value)));
    document.addEventListener('click', (e) => { if (!e.target.closest('.global-search')) $('#global-search-results').classList.remove('open'); });

    // Notificações
    $('#notif-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = $('#notif-panel');
      const open = panel.classList.toggle('open');
      if (open) { renderNotifPanel(); DB.markAllRead(); updateNotifDot(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-btn')) $('#notif-panel').classList.remove('open'); });
    document.addEventListener('sigoe:notify', () => updateNotifDot());

    window.addEventListener('hashchange', navigate);
  }

  async function startApp() {
    await DB.init();          // carrega dados do backend (ou localStorage)
    DB.seedIfEmpty();         // só semeia no modo local; no servidor já vem pronto
    SIGOE.applyConfig();
    if (!location.hash) location.hash = '#/dashboard';
    navigate();
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindShell();
    initLogin();
  });
})();
