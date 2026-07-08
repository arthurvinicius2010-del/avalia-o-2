/* =======================================================================
   SIGOE · configuracoes.js — Painel de configurações + backup/restauração
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast, confirmDialog } = U;

  SIGOE.views.configuracoes = {
    title: 'Configurações', subtitle: 'Preferências e dados do sistema',
    render(view) {
      const cfg = DB.getConfig();
      view.innerHTML = `
        <div class="config-grid">
          <div class="card"><div class="card-body"><div class="config-tabs">
            <div class="config-tab active" data-tab="geral"><i class="fa-solid fa-sliders"></i> Geral</div>
            <div class="config-tab" data-tab="aparencia"><i class="fa-solid fa-palette"></i> Aparência</div>
            <div class="config-tab" data-tab="dados"><i class="fa-solid fa-database"></i> Dados</div>
            <div class="config-tab" data-tab="sobre"><i class="fa-solid fa-circle-info"></i> Sobre</div>
          </div></div></div>
          <div id="panel"></div>
        </div>`;

      const panel = view.querySelector('#panel');
      const panels = {
        geral: () => `
          <div class="card"><div class="card-head"><h3>Configurações gerais</h3></div><div class="card-body">
            <div class="form-grid">
              <label class="field col-span-2"><span>Nome da instituição</span><input class="control" id="nomeInstituicao" value="${esc(cfg.nomeInstituicao)}" /></label>
              <label class="field"><span>Ano letivo</span><input class="control" id="anoLetivo" type="number" value="${esc(cfg.anoLetivo)}" /></label>
            </div>
            <div class="setting-row" style="margin-top:16px">
              <div class="s-label"><strong>Notificações na interface</strong><small>Exibir avisos e alertas do sistema</small></div>
              <label class="switch"><input type="checkbox" id="notificacoesAtivas" ${cfg.notificacoesAtivas ? 'checked' : ''} /><span class="slider"></span></label>
            </div>
            <button class="btn btn-primary" id="save-geral" style="margin-top:16px"><i class="fa-solid fa-floppy-disk"></i> Salvar</button>
          </div></div>`,
        aparencia: () => `
          <div class="card"><div class="card-head"><h3>Aparência</h3></div><div class="card-body">
            <div class="setting-row">
              <div class="s-label"><strong>Tema escuro</strong><small>Alterna entre modo claro e escuro</small></div>
              <label class="switch"><input type="checkbox" id="darkToggle" ${cfg.theme === 'dark' ? 'checked' : ''} /><span class="slider"></span></label>
            </div>
            <div class="setting-row">
              <div class="s-label"><strong>Menu lateral recolhido</strong><small>Inicia com o menu compacto</small></div>
              <label class="switch"><input type="checkbox" id="collapseToggle" ${cfg.sidebarCollapsed ? 'checked' : ''} /><span class="slider"></span></label>
            </div>
          </div></div>`,
        dados: () => `
          <div class="card"><div class="card-head"><h3>Backup e restauração</h3><span class="sub">Armazenamento local (localStorage)</span></div><div class="card-body">
            <p style="color:var(--text-soft);margin-top:0">Exporte todos os dados para um arquivo JSON ou restaure a partir de um backup. Ideal para migrar entre navegadores.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-primary" id="export"><i class="fa-solid fa-download"></i> Exportar backup (JSON)</button>
              <button class="btn" id="import"><i class="fa-solid fa-upload"></i> Restaurar backup</button>
              <input type="file" id="importFile" accept="application/json" hidden />
              <button class="btn btn-danger" id="reset"><i class="fa-solid fa-trash"></i> Apagar todos os dados</button>
            </div>
            <div class="setting-row" style="margin-top:20px">
              <div class="s-label"><strong>Registros armazenados</strong><small>${DB.COLLECTIONS.map(c => `${DB.count(c)} ${c}`).join(' · ')}</small></div>
            </div>
          </div></div>`,
        sobre: () => `
          <div class="card"><div class="card-head"><h3>Sobre o SIGOE</h3></div><div class="card-body">
            <p style="margin-top:0"><strong>SIGOE</strong> — Sistema Inteligente de Gestão de Ocorrências Escolares.</p>
            <p style="color:var(--text-soft)">${esc(cfg.nomeInstituicao)} · SEDUC-PI</p>
            <ul style="color:var(--text-soft);line-height:1.9">
              <li>HTML5, CSS3 e JavaScript puro (sem frameworks)</li>
              <li>SPA modular com armazenamento local no navegador</li>
              <li>Gráficos com Chart.js · Exportação PDF (jsPDF) e Excel (SheetJS)</li>
              <li>Etapa atual: <span class="tag blue">Interface</span> · Próximas: login, backend, segurança</li>
            </ul>
          </div></div>`
      };

      const bindPanel = (tab) => {
        panel.innerHTML = panels[tab]();
        if (tab === 'geral') {
          panel.querySelector('#save-geral').addEventListener('click', () => {
            DB.setConfig('nomeInstituicao', panel.querySelector('#nomeInstituicao').value);
            DB.setConfig('anoLetivo', parseInt(panel.querySelector('#anoLetivo').value) || cfg.anoLetivo);
            DB.setConfig('notificacoesAtivas', panel.querySelector('#notificacoesAtivas').checked);
            toast('Configurações salvas', 'success'); SIGOE.applyConfig();
          });
        }
        if (tab === 'aparencia') {
          panel.querySelector('#darkToggle').addEventListener('change', e => { SIGOE.setTheme(e.target.checked ? 'dark' : 'light'); });
          panel.querySelector('#collapseToggle').addEventListener('change', e => { DB.setConfig('sidebarCollapsed', e.target.checked); SIGOE.applyConfig(); });
        }
        if (tab === 'dados') {
          panel.querySelector('#export').addEventListener('click', () => { U.downloadFile(`sigoe-backup-${U.todayISO()}.json`, DB.exportJSON()); toast('Backup exportado', 'success'); });
          panel.querySelector('#import').addEventListener('click', () => panel.querySelector('#importFile').click());
          panel.querySelector('#importFile').addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const r = new FileReader();
            r.onload = async () => {
              try { await DB.importJSON(r.result); toast('Backup restaurado', 'success'); SIGOE.applyConfig(); SIGOE.rerender(); }
              catch (err) { toast('Arquivo inválido', 'error'); }
            };
            r.readAsText(file);
          });
          panel.querySelector('#reset').addEventListener('click', async () => {
            if (await confirmDialog('Isso apagará TODOS os dados permanentemente. Continuar?', { okText: 'Apagar tudo' })) {
              await DB.reset(); DB.seedIfEmpty(); toast('Dados reiniciados', 'success'); SIGOE.applyConfig(); SIGOE.rerender();
            }
          });
        }
      };
      bindPanel('geral');
      view.querySelectorAll('.config-tab').forEach(t => t.addEventListener('click', () => {
        view.querySelectorAll('.config-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active'); bindPanel(t.dataset.tab);
      }));
    }
  };
})();
