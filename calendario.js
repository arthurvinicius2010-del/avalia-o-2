/* =======================================================================
   SIGOE · calendario.js — Calendário escolar com eventos
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast, modal, confirmDialog } = U;
  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function openForm(dateISO) {
    const m = modal({
      title: 'Novo evento', body: `
        <div class="form-grid">
          <label class="field col-span-2"><span>Título *</span><input class="control" name="titulo" /></label>
          <label class="field"><span>Data *</span><input class="control" name="data" type="date" value="${esc(dateISO || U.todayISO())}" /></label>
          <label class="field"><span>Tipo</span><select class="control" name="tipo"><option value="evento">Evento</option><option value="prova">Prova</option><option value="reuniao">Reunião</option><option value="feriado">Feriado</option></select></label>
        </div>`,
      footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save>Salvar</button>`,
      onMount(root) {
        root.querySelector('[data-save]').addEventListener('click', () => {
          const data = SIGOE.formData(root);
          if (!data.titulo) return toast('Informe o título', 'warn');
          DB.insert('eventos', data); toast('Evento adicionado', 'success'); m.close(); SIGOE.rerender();
        });
      }
    });
  }

  SIGOE.views.calendario = {
    title: 'Calendário', subtitle: 'Calendário escolar',
    render(view) {
      let cur = new Date();
      view.innerHTML = `
        <div class="page-toolbar"><div class="spacer"></div><button class="btn btn-primary" id="add"><i class="fa-solid fa-plus"></i> Novo evento</button></div>
        <div class="card"><div class="card-body calendar">
          <div class="cal-head">
            <button class="icon-btn" id="prev"><i class="fa-solid fa-chevron-left"></i></button>
            <h3 id="label"></h3>
            <button class="icon-btn" id="next"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
          <div class="cal-grid" id="grid"></div>
        </div></div>`;

      const draw = () => {
        const y = cur.getFullYear(), mth = cur.getMonth();
        view.querySelector('#label').textContent = `${MES[mth]} ${y}`;
        const first = new Date(y, mth, 1);
        const start = new Date(first); start.setDate(1 - first.getDay());
        const events = DB.all('eventos');
        const todayStr = U.todayISO();
        let html = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const iso = d.toISOString().slice(0, 10);
          const out = d.getMonth() !== mth;
          const dayEv = events.filter(e => e.data === iso);
          html += `<div class="cal-cell ${out ? 'out' : ''} ${iso === todayStr ? 'today' : ''}" data-date="${iso}">
            <div class="cal-num">${d.getDate()}</div>
            ${dayEv.map(e => `<div class="cal-event ${esc(e.tipo)}" title="${esc(e.titulo)}" data-ev="${e.id}">${esc(e.titulo)}</div>`).join('')}
          </div>`;
        }
        view.querySelector('#grid').innerHTML = html;
      };
      draw();
      view.querySelector('#prev').addEventListener('click', () => { cur.setMonth(cur.getMonth() - 1); draw(); });
      view.querySelector('#next').addEventListener('click', () => { cur.setMonth(cur.getMonth() + 1); draw(); });
      view.querySelector('#add').addEventListener('click', () => openForm());
      view.querySelector('#grid').addEventListener('click', async (e) => {
        const ev = e.target.closest('[data-ev]');
        if (ev) { if (await confirmDialog('Excluir este evento?')) { DB.remove('eventos', ev.dataset.ev); toast('Evento excluído', 'success'); SIGOE.rerender(); } return; }
        const cell = e.target.closest('[data-date]'); if (cell) openForm(cell.dataset.date);
      });
    }
  };
})();
