/* =======================================================================
   SIGOE · galeria.js — Galeria de fotos das turmas
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, modal } = U;

  SIGOE.views.galeria = {
    title: 'Galeria', subtitle: 'Fotos das turmas',
    render(view) {
      const turmas = DB.all('turmas');
      if (!turmas.length) { view.innerHTML = `<div class="card"><div class="empty-state"><i class="fa-solid fa-images"></i><h4>Nenhuma turma cadastrada</h4><p>Cadastre turmas e adicione fotos para vê-las aqui.</p></div></div>`; return; }
      view.innerHTML = `<div class="gallery-grid">${turmas.map(t => {
        const nAlunos = DB.count('alunos', a => a.turmaId === t.id);
        const img = t.foto ? `style="background-image:url('${esc(t.foto)}')"` : '';
        return `<div class="gallery-card" data-id="${t.id}">
          <div class="g-img" ${img}>${t.foto ? '' : '<i class="fa-solid fa-users-rectangle"></i>'}</div>
          <div class="g-info"><strong>${esc(t.nome)}</strong><small>${esc(t.serie) || ''} · ${esc(t.turno) || ''} · ${nAlunos} alunos</small></div>
        </div>`;
      }).join('')}</div>`;

      view.querySelectorAll('.gallery-card').forEach(card => card.addEventListener('click', () => {
        const t = DB.get('turmas', card.dataset.id);
        modal({
          title: t.nome, size: 'wide',
          body: t.foto
            ? `<img src="${esc(t.foto)}" style="width:100%;border-radius:12px" />`
            : `<div class="empty-state"><i class="fa-solid fa-image"></i><h4>Sem foto</h4><p>Adicione uma foto ao editar a turma.</p></div>`,
          footer: `<button class="btn btn-ghost" data-close>Fechar</button>`
        });
      }));
    }
  };
})();
