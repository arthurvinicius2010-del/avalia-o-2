/* =======================================================================
   SIGOE · escolas.js — Cadastro de escolas
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast, modal, confirmDialog } = U;

  function form(rec = {}) {
    return `
      <div class="form-grid">
        <label class="field col-span-2"><span>Nome da escola *</span><input class="control" name="nome" value="${esc(rec.nome)}" placeholder="CETI Professor Felismino Freitas" /></label>
        <label class="field"><span>Código INEP</span><input class="control" name="inep" value="${esc(rec.inep)}" /></label>
        <label class="field"><span>Diretor(a)</span><input class="control" name="diretor" value="${esc(rec.diretor)}" /></label>
        <label class="field"><span>Município</span><input class="control" name="municipio" value="${esc(rec.municipio || 'Teresina')}" /></label>
        <label class="field"><span>UF</span><input class="control" name="uf" value="${esc(rec.uf || 'PI')}" maxlength="2" /></label>
        <label class="field col-span-2"><span>Endereço</span><input class="control" name="endereco" value="${esc(rec.endereco)}" /></label>
        <label class="field"><span>Telefone</span><input class="control" name="telefone" data-mask="phone" value="${esc(rec.telefone)}" /></label>
        <label class="field"><span>E-mail</span><input class="control" name="email" type="email" value="${esc(rec.email)}" /></label>
      </div>`;
  }

  function openForm(id) {
    const rec = id ? DB.get('escolas', id) : {};
    const m = modal({
      title: id ? 'Editar escola' : 'Nova escola', size: 'wide', body: form(rec),
      footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save><i class="fa-solid fa-floppy-disk"></i> Salvar</button>`,
      onMount(root) {
        SIGOE.bindMasks(root);
        root.querySelector('[data-save]').addEventListener('click', () => {
          const data = SIGOE.formData(root);
          if (!data.nome) return toast('Informe o nome da escola', 'warn');
          if (id) { DB.update('escolas', id, data); toast('Escola atualizada', 'success'); }
          else { DB.insert('escolas', data); DB.notify('Escola cadastrada', data.nome, 'success', 'fa-school'); toast('Escola cadastrada', 'success'); }
          m.close(); SIGOE.rerender();
        });
      }
    });
  }

  SIGOE.views.escolas = {
    title: 'Escolas', subtitle: 'Cadastro de unidades escolares',
    render(view) {
      const list = DB.all('escolas');
      view.innerHTML = `
        <div class="page-toolbar">
          <div class="toolbar-search"><i class="fa-solid fa-magnifying-glass"></i><input id="s" placeholder="Buscar escola..." /></div>
          <div class="spacer"></div>
          <button class="btn btn-primary" id="add"><i class="fa-solid fa-plus"></i> Nova escola</button>
        </div>
        <div class="card"><div class="table-wrap"><table class="data">
          <thead><tr><th>Escola</th><th>INEP</th><th>Diretor(a)</th><th>Município/UF</th><th>Telefone</th><th></th></tr></thead>
          <tbody id="tb"></tbody>
        </table></div></div>`;

      const tb = view.querySelector('#tb');
      const draw = (q = '') => {
        const rows = list.filter(e => (e.nome || '').toLowerCase().includes(q.toLowerCase()));
        if (!rows.length) { tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-school"></i><h4>Nenhuma escola</h4><p>Cadastre a primeira unidade escolar.</p></div></td></tr>`; return; }
        tb.innerHTML = rows.map(e => `
          <tr>
            <td><div class="cell-user"><div class="mini-avatar"><i class="fa-solid fa-school"></i></div><strong>${esc(e.nome)}</strong></div></td>
            <td>${esc(e.inep) || '—'}</td><td>${esc(e.diretor) || '—'}</td>
            <td>${esc(e.municipio) || '—'}/${esc(e.uf) || '—'}</td><td>${esc(e.telefone) || '—'}</td>
            <td><div class="row-actions">
              <button class="btn btn-sm btn-ghost btn-icon" data-edit="${e.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-ghost btn-icon" data-del="${e.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div></td>
          </tr>`).join('');
      };
      draw();
      view.querySelector('#add').addEventListener('click', () => openForm());
      view.querySelector('#s').addEventListener('input', U.debounce(e => draw(e.target.value)));
      tb.addEventListener('click', async (e) => {
        const ed = e.target.closest('[data-edit]'); const dl = e.target.closest('[data-del]');
        if (ed) openForm(ed.dataset.edit);
        if (dl) { if (await confirmDialog('Excluir esta escola?')) { DB.remove('escolas', dl.dataset.del); toast('Escola excluída', 'success'); SIGOE.rerender(); } }
      });
    }
  };
})();
