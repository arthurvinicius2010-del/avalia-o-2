/* =======================================================================
   SIGOE · responsaveis.js — Cadastro de responsáveis
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast, modal, confirmDialog } = U;

  function form(rec = {}) {
    return `
      <div class="form-grid">
        <label class="field col-span-2"><span>Nome completo *</span><input class="control" name="nome" value="${esc(rec.nome)}" /></label>
        <label class="field"><span>Parentesco</span><select class="control" name="parentesco">${['Mãe', 'Pai', 'Avó/Avô', 'Tio(a)', 'Responsável', 'Outro'].map(p => `<option ${rec.parentesco === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
        <label class="field"><span>CPF</span><input class="control" name="cpf" data-mask="cpf" value="${esc(rec.cpf)}" /></label>
        <label class="field"><span>Telefone</span><input class="control" name="telefone" data-mask="phone" value="${esc(rec.telefone)}" /></label>
        <label class="field"><span>E-mail</span><input class="control" name="email" type="email" value="${esc(rec.email)}" /></label>
        <label class="field col-span-2"><span>Endereço</span><input class="control" name="endereco" value="${esc(rec.endereco)}" /></label>
      </div>`;
  }

  function openForm(id) {
    const rec = id ? DB.get('responsaveis', id) : {};
    const m = modal({
      title: id ? 'Editar responsável' : 'Novo responsável', size: 'wide', body: form(rec),
      footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save><i class="fa-solid fa-floppy-disk"></i> Salvar</button>`,
      onMount(root) {
        SIGOE.bindMasks(root);
        root.querySelector('[data-save]').addEventListener('click', () => {
          const data = SIGOE.formData(root);
          if (!data.nome) return toast('Informe o nome', 'warn');
          if (data.cpf && !U.validCPF(data.cpf)) return toast('CPF inválido', 'warn');
          if (id) { DB.update('responsaveis', id, data); toast('Responsável atualizado', 'success'); }
          else { DB.insert('responsaveis', data); toast('Responsável cadastrado', 'success'); }
          m.close(); SIGOE.rerender();
        });
      }
    });
  }

  SIGOE.views.responsaveis = {
    title: 'Responsáveis', subtitle: 'Responsáveis pelos alunos',
    render(view) {
      view.innerHTML = `
        <div class="page-toolbar">
          <div class="toolbar-search"><i class="fa-solid fa-magnifying-glass"></i><input id="s" placeholder="Buscar responsável..." /></div>
          <div class="spacer"></div>
          <button class="btn btn-primary" id="add"><i class="fa-solid fa-plus"></i> Novo responsável</button>
        </div>
        <div class="card"><div class="table-wrap"><table class="data">
          <thead><tr><th>Responsável</th><th>Parentesco</th><th>CPF</th><th>Telefone</th><th>Alunos vinculados</th><th></th></tr></thead>
          <tbody id="tb"></tbody>
        </table></div></div>`;
      const tb = view.querySelector('#tb');
      const draw = (q = '') => {
        let rows = DB.all('responsaveis').filter(r => (r.nome || '').toLowerCase().includes(q.toLowerCase()));
        rows.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        if (!rows.length) { tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-people-roof"></i><h4>Nenhum responsável</h4></div></td></tr>`; return; }
        tb.innerHTML = rows.map(r => {
          const n = DB.count('alunos', a => a.responsavelId === r.id);
          return `<tr>
            <td><div class="cell-user"><div class="mini-avatar round">${U.initials(r.nome)}</div><strong>${esc(r.nome)}</strong></div></td>
            <td><span class="tag">${esc(r.parentesco) || '—'}</span></td><td>${esc(r.cpf) || '—'}</td>
            <td>${esc(r.telefone) || '—'}</td><td><span class="tag blue">${n}</span></td>
            <td><div class="row-actions">
              <button class="btn btn-sm btn-ghost btn-icon" data-edit="${r.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-ghost btn-icon" data-del="${r.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div></td>
          </tr>`;
        }).join('');
      };
      draw();
      view.querySelector('#add').addEventListener('click', () => openForm());
      view.querySelector('#s').addEventListener('input', U.debounce(e => draw(e.target.value)));
      tb.addEventListener('click', async (e) => {
        const ed = e.target.closest('[data-edit]'); const dl = e.target.closest('[data-del]');
        if (ed) openForm(ed.dataset.edit);
        if (dl) { if (await confirmDialog('Excluir este responsável?')) { DB.remove('responsaveis', dl.dataset.del); toast('Responsável excluído', 'success'); SIGOE.rerender(); } }
      });
    }
  };
})();
