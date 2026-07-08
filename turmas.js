/* =======================================================================
   SIGOE · turmas.js — Cadastro de turmas (com foto da turma)
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast, modal, confirmDialog } = U;

  function form(rec = {}) {
    const escolas = DB.all('escolas');
    return `
      <div class="form-grid">
        <div class="field col-span-2" style="align-items:center;display:flex;gap:16px;flex-direction:row">
          ${SIGOE.photoField('foto', rec.foto, 'Foto da turma')}
        </div>
        <label class="field"><span>Nome da turma *</span><input class="control" name="nome" value="${esc(rec.nome)}" placeholder="1º Ano A" /></label>
        <label class="field"><span>Série</span><input class="control" name="serie" value="${esc(rec.serie)}" placeholder="1º Ano EM" /></label>
        <label class="field"><span>Turno</span><select class="control" name="turno">${['Manhã', 'Tarde', 'Noite', 'Integral'].map(t => `<option ${rec.turno === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Sala</span><input class="control" name="sala" value="${esc(rec.sala)}" placeholder="Sala 01" /></label>
        <label class="field"><span>Ano letivo</span><input class="control" name="anoLetivo" type="number" value="${esc(rec.anoLetivo || DB.getConfig('anoLetivo'))}" /></label>
        <label class="field"><span>Escola</span><select class="control" name="escolaId">${escolas.map(e => `<option value="${e.id}" ${rec.escolaId === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select></label>
      </div>`;
  }

  function openForm(id) {
    const rec = id ? DB.get('turmas', id) : {};
    const m = modal({
      title: id ? 'Editar turma' : 'Nova turma', size: 'wide', body: form(rec),
      footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save><i class="fa-solid fa-floppy-disk"></i> Salvar</button>`,
      onMount(root) {
        SIGOE.bindPhoto(root);
        root.querySelector('[data-save]').addEventListener('click', () => {
          const data = SIGOE.formData(root);
          if (!data.nome) return toast('Informe o nome da turma', 'warn');
          if (id) { DB.update('turmas', id, data); toast('Turma atualizada', 'success'); }
          else { DB.insert('turmas', data); DB.notify('Turma cadastrada', data.nome, 'success', 'fa-users-rectangle'); toast('Turma cadastrada', 'success'); }
          m.close(); SIGOE.rerender();
        });
      }
    });
  }

  SIGOE.views.turmas = {
    title: 'Turmas', subtitle: 'Gestão de turmas e salas',
    render(view) {
      const list = DB.all('turmas');
      view.innerHTML = `
        <div class="page-toolbar">
          <div class="toolbar-search"><i class="fa-solid fa-magnifying-glass"></i><input id="s" placeholder="Buscar turma..." /></div>
          <div class="spacer"></div>
          <button class="btn btn-primary" id="add"><i class="fa-solid fa-plus"></i> Nova turma</button>
        </div>
        <div class="card"><div class="table-wrap"><table class="data">
          <thead><tr><th>Turma</th><th>Série</th><th>Turno</th><th>Sala</th><th>Alunos</th><th>Ocorrências</th><th></th></tr></thead>
          <tbody id="tb"></tbody>
        </table></div></div>`;
      const tb = view.querySelector('#tb');
      const draw = (q = '') => {
        const rows = list.filter(t => (t.nome || '').toLowerCase().includes(q.toLowerCase()));
        if (!rows.length) { tb.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-users-rectangle"></i><h4>Nenhuma turma</h4></div></td></tr>`; return; }
        tb.innerHTML = rows.map(t => {
          const nAlunos = DB.count('alunos', a => a.turmaId === t.id);
          const nOcc = DB.count('ocorrencias', o => o.turmaId === t.id);
          const av = t.foto ? `<img class="mini-avatar" src="${esc(t.foto)}" />` : `<div class="mini-avatar"><i class="fa-solid fa-users-rectangle"></i></div>`;
          return `<tr>
            <td><div class="cell-user">${av}<strong>${esc(t.nome)}</strong></div></td>
            <td>${esc(t.serie) || '—'}</td><td><span class="tag blue">${esc(t.turno) || '—'}</span></td>
            <td>${esc(t.sala) || '—'}</td><td><span class="tag">${nAlunos}</span></td>
            <td>${nOcc ? `<span class="tag amber">${nOcc}</span>` : '<span class="tag gray">0</span>'}</td>
            <td><div class="row-actions">
              <button class="btn btn-sm btn-ghost btn-icon" data-edit="${t.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-ghost btn-icon" data-del="${t.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
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
        if (dl) {
          const n = DB.count('alunos', a => a.turmaId === dl.dataset.del);
          if (await confirmDialog(n ? `Esta turma possui ${n} aluno(s) vinculado(s). Excluir mesmo assim?` : 'Excluir esta turma?')) {
            DB.remove('turmas', dl.dataset.del); toast('Turma excluída', 'success'); SIGOE.rerender();
          }
        }
      });
    }
  };
})();
