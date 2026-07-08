/* =======================================================================
   SIGOE · dashboard.js — Dashboard com estatísticas, gráficos e widgets
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc } = U;
  let charts = [];

  function destroyCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) {} }); charts = []; }

  function themeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(16,35,63,.08)',
      text: dark ? '#aebdd6' : '#4a5b74'
    };
  }

  SIGOE.views.dashboard = {
    title: 'Dashboard', subtitle: 'Visão geral do sistema',
    onLeave: destroyCharts,
    render(view) {
      destroyCharts();
      const alunos = DB.all('alunos');
      const turmas = DB.all('turmas');
      const profs = DB.all('professores');
      const occ = DB.all('ocorrencias');
      const graves = occ.filter(o => o.gravidade === 'grave').length;
      const emAnalise = occ.filter(o => o.status === 'Em análise').length;

      view.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-ic ic-blue"><i class="fa-solid fa-user-graduate"></i></div><div class="stat-value">${alunos.length}</div><div class="stat-label">Alunos matriculados</div></div>
          <div class="stat-card"><div class="stat-ic ic-violet"><i class="fa-solid fa-users-rectangle"></i></div><div class="stat-value">${turmas.length}</div><div class="stat-label">Turmas ativas</div></div>
          <div class="stat-card"><div class="stat-ic ic-cyan"><i class="fa-solid fa-chalkboard-user"></i></div><div class="stat-value">${profs.length}</div><div class="stat-label">Professores</div></div>
          <div class="stat-card"><div class="stat-ic ic-red"><i class="fa-solid fa-clipboard-list"></i></div><div class="stat-value">${occ.length}</div><div class="stat-label">Ocorrências (total)</div><div class="stat-trend ${graves ? 'down' : 'up'}">${graves} graves</div></div>
        </div>

        <div class="dash-grid">
          <div class="card"><div class="card-head"><h3>Ocorrências por mês</h3><span class="sub">${DB.getConfig('anoLetivo')}</span></div><div class="card-body"><div class="chart-box"><canvas id="chMes"></canvas></div></div></div>
          <div class="card"><div class="card-head"><h3>Por gravidade</h3></div><div class="card-body"><div class="chart-box"><canvas id="chGrav"></canvas></div></div></div>
        </div>

        <div class="dash-grid-3">
          <div class="card"><div class="card-head"><h3>Por tipo</h3></div><div class="card-body"><div class="chart-box sm"><canvas id="chTipo"></canvas></div></div></div>
          <div class="card"><div class="card-head"><h3><i class="fa-solid fa-ranking-star"></i> Alunos com mais ocorrências</h3></div><div class="card-body"><div class="list" id="ranking"></div></div></div>
          <div class="card"><div class="card-head"><h3><i class="fa-solid fa-bullhorn"></i> Avisos da escola</h3></div><div class="card-body" id="avisos"></div></div>
        </div>

        <div class="dash-grid" style="margin-top:22px">
          <div class="card"><div class="card-head"><h3><i class="fa-solid fa-clock-rotate-left"></i> Últimas ocorrências</h3><a class="btn btn-sm btn-ghost" href="#/ocorrencias">Ver todas</a></div><div class="card-body"><div class="timeline" id="ultimas"></div></div></div>
          <div class="card"><div class="card-head"><h3>Status das ocorrências</h3></div><div class="card-body"><div class="chart-box sm"><canvas id="chStatus"></canvas></div></div></div>
        </div>`;

      const tc = themeColors();
      Chart.defaults.color = tc.text;
      Chart.defaults.font.family = "'Inter', sans-serif";

      // Por mês
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const porMes = new Array(12).fill(0);
      occ.forEach(o => { const m = new Date((o.data || '') + 'T00:00:00').getMonth(); if (!isNaN(m)) porMes[m]++; });
      charts.push(new Chart(view.querySelector('#chMes'), {
        type: 'line',
        data: { labels: meses, datasets: [{ label: 'Ocorrências', data: porMes, borderColor: '#1a4fa0', backgroundColor: 'rgba(26,79,160,.15)', fill: true, tension: .4, pointRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: tc.grid } }, x: { grid: { display: false } } } }
      }));

      // Gravidade
      const grav = { leve: 0, media: 0, grave: 0 };
      occ.forEach(o => grav[o.gravidade] = (grav[o.gravidade] || 0) + 1);
      charts.push(new Chart(view.querySelector('#chGrav'), {
        type: 'doughnut',
        data: { labels: ['Leve', 'Média', 'Grave'], datasets: [{ data: [grav.leve, grav.media, grav.grave], backgroundColor: ['#16a34a', '#f59e0b', '#d92d20'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } }
      }));

      // Tipo
      const porTipo = {};
      occ.forEach(o => porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1);
      const tipoEntries = Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 6);
      charts.push(new Chart(view.querySelector('#chTipo'), {
        type: 'bar',
        data: { labels: tipoEntries.map(e => e[0]), datasets: [{ data: tipoEntries.map(e => e[1]), backgroundColor: '#2563c9', borderRadius: 6 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: tc.grid } }, y: { grid: { display: false } } } }
      }));

      // Status
      const status = {};
      occ.forEach(o => status[o.status || 'Em análise'] = (status[o.status || 'Em análise'] || 0) + 1);
      charts.push(new Chart(view.querySelector('#chStatus'), {
        type: 'polarArea',
        data: { labels: Object.keys(status), datasets: [{ data: Object.values(status), backgroundColor: ['#f59e0b', '#16a34a', '#2563c9', '#8b5cf6'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { r: { grid: { color: tc.grid } } } }
      }));

      // Ranking
      const cnt = {};
      occ.forEach(o => cnt[o.alunoId] = (cnt[o.alunoId] || 0) + 1);
      const rank = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const rankEl = view.querySelector('#ranking');
      rankEl.innerHTML = rank.length ? rank.map(([id, n], i) => {
        const a = DB.get('alunos', id);
        return `<div class="list-item"><div class="rank-num ${i === 0 ? 'top' : ''}">${i + 1}</div>
          <div class="li-main"><strong>${esc(a ? a.nome : '—')}</strong><small>${esc(a ? DB.turmaNome(a.turmaId) : '')}</small></div>
          <span class="tag ${n >= 3 ? 'red' : 'amber'}">${n}</span></div>`;
      }).join('') : `<div class="empty-state" style="padding:24px"><i class="fa-solid fa-face-smile"></i><p>Sem ocorrências</p></div>`;

      // Avisos
      const avisosEl = view.querySelector('#avisos');
      const eventos = DB.all('eventos').filter(e => (e.data || '') >= U.todayISO()).sort((a, b) => (a.data || '').localeCompare(b.data || '')).slice(0, 4);
      const iconMap = { prova: ['ic-blue', 'fa-file-pen'], feriado: ['ic-red', 'fa-umbrella-beach'], reuniao: ['ic-amber', 'fa-users'], evento: ['ic-green', 'fa-star'] };
      avisosEl.innerHTML = eventos.length ? eventos.map(e => {
        const [cls, ic] = iconMap[e.tipo] || iconMap.evento;
        return `<div class="notice"><div class="ic ${cls}"><i class="fa-solid ${ic}"></i></div><div><strong>${esc(e.titulo)}</strong><br><small>${U.formatDate(e.data)}</small></div></div>`;
      }).join('') : `<div class="empty-state" style="padding:24px"><i class="fa-solid fa-calendar"></i><p>Nenhum aviso próximo</p></div>`;

      // Últimas ocorrências
      const ultimasEl = view.querySelector('#ultimas');
      const ultimas = occ.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 6);
      ultimasEl.innerHTML = ultimas.length ? ultimas.map(o => `
        <div class="timeline-item ${o.gravidade}">
          <div class="tl-time">${U.formatDate(o.data)}</div>
          <div class="tl-title">${esc(DB.alunoNome(o.alunoId))} — ${esc(o.tipo)}</div>
          <div class="tl-desc">${esc(DB.turmaNome(o.turmaId))} · ${esc(o.status) || ''}</div>
        </div>`).join('') : `<div class="empty-state"><i class="fa-solid fa-clipboard-check"></i><p>Sem registros</p></div>`;
    }
  };
})();
