/* =======================================================================
   SIGOE · alunos.js — Cadastro de alunos + histórico/perfil completo
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast, modal, confirmDialog } = U;

  function form(rec = {}) {
    const turmas = DB.all('turmas');
    const resps = DB.all('responsaveis');
    return `
      <div class="form-grid">
        <div class="field col-span-2" style="display:flex;flex-direction:row;gap:16px;align-items:center">
          ${SIGOE.photoField('foto', rec.foto, 'Foto do aluno', 'round')}
        </div>
        <label class="field col-span-2"><span>Nome completo *</span><input class="control" name="nome" value="${esc(rec.nome)}" /></label>
        <label class="field"><span>CPF</span><input class="control" name="cpf" data-mask="cpf" value="${esc(rec.cpf)}" placeholder="000.000.000-00" /></label>
        <label class="field"><span>RA</span><input class="control" name="ra" value="${esc(rec.ra)}" /></label>
        <label class="field"><span>Matrícula</span><input class="control" name="matricula" value="${esc(rec.matricula)}" /></label>
        <label class="field"><span>Data de nascimento</span><input class="control" name="dataNascimento" type="date" value="${esc(rec.dataNascimento)}" /></label>
        <label class="field"><span>Sexo</span><select class="control" name="sexo">${['M', 'F', 'Outro'].map(s => `<option ${rec.sexo === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field"><span>Status</span><select class="control" name="status">${['Ativo', 'Transferido', 'Inativo'].map(s => `<option ${rec.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field"><span>Turma</span><select class="control" name="turmaId"><option value="">— Sem turma —</option>${turmas.map(t => `<option value="${t.id}" ${rec.turmaId === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></label>
        <label class="field"><span>Responsável</span><select class="control" name="responsavelId"><option value="">— Selecionar —</option>${resps.map(r => `<option value="${r.id}" ${rec.responsavelId === r.id ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
        <label class="field"><span>Telefone</span><input class="control" name="telefone" data-mask="phone" value="${esc(rec.telefone)}" /></label>
      </div>`;
  }

  function openForm(id) {
    const rec = id ? DB.get('alunos', id) : {};
    const m = modal({
      title: id ? 'Editar aluno' : 'Novo aluno', size: 'wide', body: form(rec),
      footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save><i class="fa-solid fa-floppy-disk"></i> Salvar</button>`,
      onMount(root) {
        SIGOE.bindMasks(root); SIGOE.bindPhoto(root);
        root.querySelector('[data-save]').addEventListener('click', () => {
          const data = SIGOE.formData(root);
          if (!data.nome) return toast('Informe o nome do aluno', 'warn');
          if (data.cpf && !U.validCPF(data.cpf)) return toast('CPF inválido', 'warn');
          const resp = DB.get('responsaveis', data.responsavelId);
          data.responsavelNome = resp ? resp.nome : '';
          if (id) { DB.update('alunos', id, data); toast('Aluno atualizado', 'success'); }
          else { DB.insert('alunos', data); DB.notify('Aluno cadastrado', data.nome, 'success', 'fa-user-graduate'); toast('Aluno cadastrado', 'success'); }
          m.close(); SIGOE.rerender();
        });
      }
    });
  }

  /** Perfil/histórico completo do aluno com linha do tempo. */
  function openProfile(id) {
    const a = DB.get('alunos', id); if (!a) return;
    const occ = DB.ocorrenciasDoAluno(id);
    const resp = DB.get('responsaveis', a.responsavelId);
    const photo = a.foto ? `<img class="profile-photo" src="${esc(a.foto)}" />` : `<div class="profile-photo">${U.initials(a.nome)}</div>`;
    const gCount = { grave: 0, media: 0, leve: 0 };
    occ.forEach(o => gCount[o.gravidade] = (gCount[o.gravidade] || 0) + 1);
    const timeline = occ.length ? occ.map(o => `
      <div class="timeline-item ${o.gravidade}">
        <div class="tl-time">${U.formatDate(o.data)} · ${esc(DB.turmaNome(o.turmaId))}</div>
        <div class="tl-title">${esc(o.tipo)} <span class="tag ${o.gravidade === 'grave' ? 'red' : o.gravidade === 'media' ? 'amber' : 'green'}">${o.gravidade}</span></div>
        <div class="tl-desc">${esc(o.descricao)}</div>
        <div class="tl-desc" style="color:var(--text-muted);margin-top:2px"><i class="fa-solid fa-user-tie"></i> ${esc(DB.professorNome(o.professorId))} · Providência: ${esc(o.providencia) || '—'}</div>
      </div>`).join('') : `<div class="empty-state"><i class="fa-solid fa-face-smile"></i><h4>Sem ocorrências</h4><p>Este aluno não possui registros.</p></div>`;

    modal({
      title: 'Histórico do aluno', size: 'wide',
      body: `
        <div class="profile-head">
          ${photo}
          <div>
            <h2 style="margin:0">${esc(a.nome)}</h2>
            <div class="profile-meta">
              <div><span>Matrícula</span>${esc(a.matricula) || '—'}</div>
              <div><span>RA</span>${esc(a.ra) || '—'}</div>
              <div><span>Turma</span>${esc(DB.turmaNome(a.turmaId))}</div>
              <div><span>Responsável</span>${esc(resp ? resp.nome : a.responsavelNome) || '—'}</div>
              <div><span>Telefone</span>${esc(a.telefone) || '—'}</div>
              <div><span>Status</span>${esc(a.status) || '—'}</div>
            </div>
          </div>
        </div>
        <div class="stats-grid" style="margin-top:20px">
          <div class="stat-card"><div class="stat-ic ic-blue"><i class="fa-solid fa-clipboard-list"></i></div><div class="stat-value">${occ.length}</div><div class="stat-label">Total de ocorrências</div></div>
          <div class="stat-card"><div class="stat-ic ic-red"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="stat-value">${gCount.grave || 0}</div><div class="stat-label">Graves</div></div>
          <div class="stat-card"><div class="stat-ic ic-amber"><i class="fa-solid fa-circle-exclamation"></i></div><div class="stat-value">${gCount.media || 0}</div><div class="stat-label">Médias</div></div>
          <div class="stat-card"><div class="stat-ic ic-green"><i class="fa-solid fa-circle-info"></i></div><div class="stat-value">${gCount.leve || 0}</div><div class="stat-label">Leves</div></div>
        </div>
        <h3 style="margin:8px 0 16px"><i class="fa-solid fa-timeline"></i> Linha do tempo</h3>
        <div class="timeline">${timeline}</div>`,
      footer: `<button class="btn btn-ghost" data-close>Fechar</button>`
    });
  }
  SIGOE.openAlunoProfile = openProfile;

  SIGOE.views.alunos = {
    title: 'Alunos', subtitle: 'Cadastro e histórico de estudantes',
    render(view) {
      const turmas = DB.all('turmas');
      view.innerHTML = `
        <div class="page-toolbar">
          <div class="toolbar-search"><i class="fa-solid fa-magnifying-glass"></i><input id="s" placeholder="Buscar por nome, matrícula, RA..." /></div>
          <div class="field" style="min-width:170px"><select class="control" id="fturma"><option value="">Todas as turmas</option>${turmas.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></div>
          <div class="spacer"></div>
          <button class="btn btn-primary" id="add"><i class="fa-solid fa-plus"></i> Novo aluno</button>
        </div>
        <div class="card"><div class="table-wrap"><table class="data">
          <thead><tr><th>Aluno</th><th>Matrícula</th><th>Turma</th><th>Responsável</th><th>Ocorrências</th><th>Status</th><th></th></tr></thead>
          <tbody id="tb"></tbody>
        </table></div></div>`;
      const tb = view.querySelector('#tb');
      const draw = () => {
        const q = view.querySelector('#s').value.toLowerCase();
        const ft = view.querySelector('#fturma').value;
        let rows = DB.all('alunos');
        if (ft) rows = rows.filter(a => a.turmaId === ft);
        if (q) rows = rows.filter(a => [a.nome, a.matricula, a.ra, a.cpf].some(f => (f || '').toLowerCase().includes(q)));
        rows.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        if (!rows.length) { tb.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i><h4>Nenhum aluno encontrado</h4></div></td></tr>`; return; }
        tb.innerHTML = rows.map(a => {
          const nOcc = DB.count('ocorrencias', o => o.alunoId === a.id);
          const av = a.foto ? `<img class="mini-avatar round" src="${esc(a.foto)}" />` : `<div class="mini-avatar round">${U.initials(a.nome)}</div>`;
          const st = a.status === 'Ativo' ? 'green' : a.status === 'Transferido' ? 'amber' : 'gray';
          return `<tr data-id="${a.id}">
            <td><div class="cell-user">${av}<div><strong>${esc(a.nome)}</strong><br><small style="color:var(--text-muted)">RA ${esc(a.ra) || '—'}</small></div></div></td>
            <td>${esc(a.matricula) || '—'}</td><td>${esc(DB.turmaNome(a.turmaId))}</td>
            <td>${esc(a.responsavelNome) || '—'}</td>
            <td>${nOcc ? `<span class="tag amber">${nOcc}</span>` : '<span class="tag gray">0</span>'}</td>
            <td><span class="tag ${st}">${esc(a.status) || '—'}</span></td>
            <td><div class="row-actions">
              <button class="btn btn-sm btn-ghost btn-icon" data-view="${a.id}" title="Histórico"><i class="fa-solid fa-clock-rotate-left"></i></button>
              <button class="btn btn-sm btn-ghost btn-icon" data-edit="${a.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-ghost btn-icon" data-del="${a.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div></td>
          </tr>`;
        }).join('');
      };
      draw();
      view.querySelector('#add').addEventListener('click', () => openForm());
      view.querySelector('#s').addEventListener('input', U.debounce(draw));
      view.querySelector('#fturma').addEventListener('change', draw);
      tb.addEventListener('click', async (e) => {
        const v = e.target.closest('[data-view]'); const ed = e.target.closest('[data-edit]'); const dl = e.target.closest('[data-del]');
        if (v) return openProfile(v.dataset.view);
        if (ed) return openForm(ed.dataset.edit);
        if (dl) { if (await confirmDialog('Excluir este aluno e suas ocorrências?')) { DB.query('ocorrencias', o => o.alunoId === dl.dataset.del).forEach(o => DB.remove('ocorrencias', o.id)); DB.remove('alunos', dl.dataset.del); toast('Aluno excluído', 'success'); SIGOE.rerender(); } return; }
        const row = e.target.closest('tr[data-id]'); if (row) openProfile(row.dataset.id);
      });
    }
  };
})();
