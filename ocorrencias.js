/* =======================================================================
   SIGOE · ocorrencias.js — Registro de ocorrências, filtros e linha do tempo
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast, modal, confirmDialog } = U;

  const TIPOS = ['Atraso', 'Uso de celular em aula', 'Falta de material', 'Indisciplina em sala',
    'Desrespeito ao colega', 'Desrespeito ao professor', 'Agressão física', 'Dano ao patrimônio',
    'Saída sem autorização', 'Outro'];

  const gvTag = g => `<span class="tag ${g === 'grave' ? 'red' : g === 'media' ? 'amber' : 'green'}">${g}</span>`;

  function form(rec = {}) {
    const alunos = DB.all('alunos').sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const profs = DB.all('professores');
    return `
      <div class="form-grid">
        <label class="field"><span>Aluno *</span><select class="control" name="alunoId"><option value="">— Selecionar —</option>${alunos.map(a => `<option value="${a.id}" ${rec.alunoId === a.id ? 'selected' : ''}>${esc(a.nome)} (${esc(DB.turmaNome(a.turmaId))})</option>`).join('')}</select></label>
        <label class="field"><span>Professor/Registrado por</span><select class="control" name="professorId"><option value="">— Selecionar —</option>${profs.map(p => `<option value="${p.id}" ${rec.professorId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <label class="field"><span>Tipo *</span><select class="control" name="tipo">${TIPOS.map(t => `<option ${rec.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Gravidade *</span><select class="control" name="gravidade">${[['leve', 'Leve'], ['media', 'Média'], ['grave', 'Grave']].map(([v, l]) => `<option value="${v}" ${rec.gravidade === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Data *</span><input class="control" name="data" type="date" value="${esc(rec.data || U.todayISO())}" /></label>
        <label class="field"><span>Status</span><select class="control" name="status">${['Em análise', 'Resolvida', 'Encaminhada'].map(s => `<option ${rec.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field col-span-2"><span>Descrição *</span><textarea class="control" name="descricao" placeholder="Descreva o ocorrido...">${esc(rec.descricao)}</textarea></label>
        <label class="field col-span-2"><span>Providência / Encaminhamento</span><input class="control" name="providencia" value="${esc(rec.providencia)}" placeholder="Advertência verbal, convocação dos responsáveis..." /></label>
        <div class="field col-span-2">${SIGOE.photoField('anexo', rec.anexo, 'Anexo (foto/documento)')}</div>
      </div>`;
  }

  function openForm(id, presetAluno) {
    const rec = id ? DB.get('ocorrencias', id) : (presetAluno ? { alunoId: presetAluno } : {});
    const m = modal({
      title: id ? 'Editar ocorrência' : 'Registrar ocorrência', size: 'wide', body: form(rec),
      footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save><i class="fa-solid fa-floppy-disk"></i> Salvar</button>`,
      onMount(root) {
        SIGOE.bindPhoto(root);
        root.querySelector('[data-save]').addEventListener('click', () => {
          const data = SIGOE.formData(root);
          if (!data.alunoId) return toast('Selecione o aluno', 'warn');
          if (!data.descricao) return toast('Descreva a ocorrência', 'warn');
          const aluno = DB.get('alunos', data.alunoId);
          data.turmaId = aluno ? aluno.turmaId : '';
          if (id) { DB.update('ocorrencias', id, data); toast('Ocorrência atualizada', 'success'); }
          else {
            DB.insert('ocorrencias', data);
            DB.notify('Nova ocorrência', `${data.tipo} — ${aluno ? aluno.nome : ''}`, data.gravidade === 'grave' ? 'warn' : 'info', 'fa-clipboard-list');
            toast('Ocorrência registrada', 'success');
          }
          m.close(); SIGOE.rerender();
        });
      }
    });
  }
  SIGOE.openOcorrenciaForm = openForm;

  SIGOE.views.ocorrencias = {
    title: 'Ocorrências', subtitle: 'Registro e acompanhamento',
    render(view) {
      const turmas = DB.all('turmas');
      const profs = DB.all('professores');
      view.innerHTML = `
        <div class="filter-bar">
          <div class="toolbar-search"><i class="fa-solid fa-magnifying-glass"></i><input id="s" placeholder="Buscar por aluno, tipo..." /></div>
          <label class="field"><span>Turma</span><select class="control" id="fturma"><option value="">Todas</option>${turmas.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></label>
          <label class="field"><span>Professor</span><select class="control" id="fprof"><option value="">Todos</option>${profs.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></label>
          <label class="field"><span>Gravidade</span><select class="control" id="fgrav"><option value="">Todas</option><option value="leve">Leve</option><option value="media">Média</option><option value="grave">Grave</option></select></label>
          <label class="field"><span>De</span><input class="control" id="fde" type="date" /></label>
          <label class="field"><span>Até</span><input class="control" id="fate" type="date" /></label>
          <div class="spacer"></div>
          <button class="btn btn-primary" id="add" style="align-self:end"><i class="fa-solid fa-plus"></i> Registrar</button>
        </div>
        <div class="card"><div class="table-wrap"><table class="data">
          <thead><tr><th>Data</th><th>Aluno</th><th>Turma</th><th>Tipo</th><th>Gravidade</th><th>Registrado por</th><th>Status</th><th></th></tr></thead>
          <tbody id="tb"></tbody>
        </table></div></div>`;

      const g = id => view.querySelector(id);
      const tb = g('#tb');
      const draw = () => {
        let rows = DB.all('ocorrencias');
        const q = g('#s').value.toLowerCase();
        const ft = g('#fturma').value, fp = g('#fprof').value, fg = g('#fgrav').value;
        const de = g('#fde').value, ate = g('#fate').value;
        if (ft) rows = rows.filter(o => o.turmaId === ft);
        if (fp) rows = rows.filter(o => o.professorId === fp);
        if (fg) rows = rows.filter(o => o.gravidade === fg);
        if (de) rows = rows.filter(o => (o.data || '') >= de);
        if (ate) rows = rows.filter(o => (o.data || '') <= ate);
        if (q) rows = rows.filter(o => [DB.alunoNome(o.alunoId), o.tipo, o.descricao].some(f => (f || '').toLowerCase().includes(q)));
        rows.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
        if (!rows.length) { tb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-clipboard-check"></i><h4>Nenhuma ocorrência</h4></div></td></tr>`; return; }
        tb.innerHTML = rows.map(o => {
          const st = o.status === 'Resolvida' ? 'green' : o.status === 'Encaminhada' ? 'blue' : 'amber';
          return `<tr>
            <td>${U.formatDate(o.data)}</td>
            <td><a href="#" data-al="${o.alunoId}" style="color:var(--primary);font-weight:600">${esc(DB.alunoNome(o.alunoId))}</a></td>
            <td>${esc(DB.turmaNome(o.turmaId))}</td><td>${esc(o.tipo)}</td>
            <td>${gvTag(o.gravidade)}</td><td>${esc(DB.professorNome(o.professorId))}</td>
            <td><span class="tag ${st}">${esc(o.status) || '—'}</span></td>
            <td><div class="row-actions">
              <button class="btn btn-sm btn-ghost btn-icon" data-edit="${o.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-ghost btn-icon" data-del="${o.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div></td>
          </tr>`;
        }).join('');
      };
      draw();
      g('#add').addEventListener('click', () => openForm());
      ['#s'].forEach(s => g(s).addEventListener('input', U.debounce(draw)));
      ['#fturma', '#fprof', '#fgrav', '#fde', '#fate'].forEach(s => g(s).addEventListener('change', draw));
      tb.addEventListener('click', async (e) => {
        const al = e.target.closest('[data-al]'); const ed = e.target.closest('[data-edit]'); const dl = e.target.closest('[data-del]');
        if (al) { e.preventDefault(); return SIGOE.openAlunoProfile(al.dataset.al); }
        if (ed) return openForm(ed.dataset.edit);
        if (dl) { if (await confirmDialog('Excluir esta ocorrência?')) { DB.remove('ocorrencias', dl.dataset.del); toast('Ocorrência excluída', 'success'); SIGOE.rerender(); } }
      });
    }
  };
})();
