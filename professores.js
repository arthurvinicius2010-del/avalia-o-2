/* =======================================================================
   SIGOE · professores.js — Cadastro de professores
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast, modal, confirmDialog } = U;

  function form(rec = {}) {
    return `
      <div class="form-grid">
        <div class="field col-span-2" style="display:flex;flex-direction:row;gap:16px;align-items:center">
          ${SIGOE.photoField('foto', rec.foto, 'Foto', 'round')}
        </div>
        <label class="field col-span-2"><span>Nome completo *</span><input class="control" name="nome" value="${esc(rec.nome)}" /></label>
        <label class="field"><span>Disciplina</span><input class="control" name="disciplina" value="${esc(rec.disciplina)}" placeholder="Matemática" /></label>
        <label class="field"><span>CPF</span><input class="control" name="cpf" data-mask="cpf" value="${esc(rec.cpf)}" /></label>
        <label class="field"><span>Telefone</span><input class="control" name="telefone" data-mask="phone" value="${esc(rec.telefone)}" /></label>
        <label class="field"><span>E-mail</span><input class="control" name="email" type="email" value="${esc(rec.email)}" /></label>
      </div>`;
  }

  function openForm(id) {
    const rec = id ? DB.get('professores', id) : {};
    const m = modal({
      title: id ? 'Editar professor' : 'Novo professor', size: 'wide', body: form(rec),
      footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save><i class="fa-solid fa-floppy-disk"></i> Salvar</button>`,
      onMount(root) {
        SIGOE.bindMasks(root); SIGOE.bindPhoto(root);
        root.querySelector('[data-save]').addEventListener('click', () => {
          const data = SIGOE.formData(root);
          if (!data.nome) return toast('Informe o nome', 'warn');
          if (data.cpf && !U.validCPF(data.cpf)) return toast('CPF inválido', 'warn');
          if (id) { DB.update('professores', id, data); toast('Professor atualizado', 'success'); }
          else { DB.insert('professores', data); DB.notify('Professor cadastrado', data.nome, 'success', 'fa-chalkboard-user'); toast('Professor cadastrado', 'success'); }
          m.close(); SIGOE.rerender();
        });
      }
    });
  }

  SIGOE.views.professores = {
    title: 'Professores', subtitle: 'Corpo docente',
    render(view) {
      view.innerHTML = `
        <div class="page-toolbar">
          <div class="toolbar-search"><i class="fa-solid fa-magnifying-glass"></i><input id="s" placeholder="Buscar professor..." /></div>
          <div class="spacer"></div>
          <button class="btn btn-primary" id="add"><i class="fa-solid fa-plus"></i> Novo professor</button>
        </div>
        <div class="card"><div class="table-wrap"><table class="data">
          <thead><tr><th>Professor</th><th>Disciplina</th><th>Telefone</th><th>E-mail</th><th>Ocorrências registradas</th><th></th></tr></thead>
          <tbody id="tb"></tbody>
        </table></div></div>`;
      const tb = view.querySelector('#tb');
      const draw = (q = '') => {
        let rows = DB.all('professores').filter(p => (p.nome || '').toLowerCase().includes(q.toLowerCase()));
        rows.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        if (!rows.length) { tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-chalkboard-user"></i><h4>Nenhum professor</h4></div></td></tr>`; return; }
        tb.innerHTML = rows.map(p => {
          const nOcc = DB.count('ocorrencias', o => o.professorId === p.id);
          const av = p.foto ? `<img class="mini-avatar round" src="${esc(p.foto)}" />` : `<div class="mini-avatar round">${U.initials(p.nome)}</div>`;
          return `<tr>
            <td><div class="cell-user">${av}<strong>${esc(p.nome)}</strong></div></td>
            <td><span class="tag blue">${esc(p.disciplina) || '—'}</span></td>
            <td>${esc(p.telefone) || '—'}</td><td>${esc(p.email) || '—'}</td>
            <td><span class="tag">${nOcc}</span></td>
            <td><div class="row-actions">
              <button class="btn btn-sm btn-ghost btn-icon" data-edit="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-ghost btn-icon" data-del="${p.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
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
        if (dl) { if (await confirmDialog('Excluir este professor?')) { DB.remove('professores', dl.dataset.del); toast('Professor excluído', 'success'); SIGOE.rerender(); } }
      });
    }
  };
})();
