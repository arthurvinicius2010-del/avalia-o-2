/* =======================================================================
   SIGOE · relatorios.js — Relatórios com exportação PDF/Excel e impressão
   ======================================================================= */
(function () {
  'use strict';
  window.SIGOE = window.SIGOE || {}; SIGOE.views = SIGOE.views || {};
  const { esc, toast } = U;

  function buildRows(filtros) {
    let rows = DB.all('ocorrencias');
    if (filtros.turma) rows = rows.filter(o => o.turmaId === filtros.turma);
    if (filtros.grav) rows = rows.filter(o => o.gravidade === filtros.grav);
    if (filtros.de) rows = rows.filter(o => (o.data || '') >= filtros.de);
    if (filtros.ate) rows = rows.filter(o => (o.data || '') <= filtros.ate);
    rows.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    return rows.map(o => ({
      Data: U.formatDate(o.data), Aluno: DB.alunoNome(o.alunoId), Turma: DB.turmaNome(o.turmaId),
      Tipo: o.tipo, Gravidade: o.gravidade, 'Registrado por': DB.professorNome(o.professorId),
      Providencia: o.providencia || '—', Status: o.status || '—'
    }));
  }

  function exportPDF(rows) {
    if (!rows.length) return toast('Nada para exportar', 'warn');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(15); doc.setTextColor(16, 61, 130);
    doc.text('SIGOE — Relatório de Ocorrências', 14, 16);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`${DB.getConfig('nomeInstituicao')} · Emitido em ${U.formatDateTime(U.nowISO())}`, 14, 22);
    doc.autoTable({
      startY: 28,
      head: [Object.keys(rows[0])],
      body: rows.map(r => Object.values(r)),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 79, 160] },
      alternateRowStyles: { fillColor: [244, 247, 252] }
    });
    doc.save(`relatorio-ocorrencias-${U.todayISO()}.pdf`);
    toast('PDF gerado', 'success');
  }

  function exportExcel(rows) {
    if (!rows.length) return toast('Nada para exportar', 'warn');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ocorrências');
    XLSX.writeFile(wb, `relatorio-ocorrencias-${U.todayISO()}.xlsx`);
    toast('Excel gerado', 'success');
  }

  SIGOE.views.relatorios = {
    title: 'Relatórios', subtitle: 'Exportação e impressão',
    render(view) {
      const turmas = DB.all('turmas');
      view.innerHTML = `
        <div class="filter-bar">
          <label class="field"><span>Turma</span><select class="control" id="fturma"><option value="">Todas</option>${turmas.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></label>
          <label class="field"><span>Gravidade</span><select class="control" id="fgrav"><option value="">Todas</option><option value="leve">Leve</option><option value="media">Média</option><option value="grave">Grave</option></select></label>
          <label class="field"><span>De</span><input class="control" id="fde" type="date" /></label>
          <label class="field"><span>Até</span><input class="control" id="fate" type="date" /></label>
          <div class="spacer"></div>
          <button class="btn" id="pdf" style="align-self:end"><i class="fa-solid fa-file-pdf" style="color:var(--red-600)"></i> PDF</button>
          <button class="btn" id="xls" style="align-self:end"><i class="fa-solid fa-file-excel" style="color:var(--green-500)"></i> Excel</button>
          <button class="btn" id="print" style="align-self:end"><i class="fa-solid fa-print"></i> Imprimir</button>
        </div>
        <div class="card" id="report-area">
          <div class="card-head"><h3>Relatório de ocorrências</h3><span class="sub" id="count"></span></div>
          <div class="table-wrap"><table class="data"><thead id="th"></thead><tbody id="tb"></tbody></table></div>
        </div>`;

      const g = id => view.querySelector(id);
      const filtros = () => ({ turma: g('#fturma').value, grav: g('#fgrav').value, de: g('#fde').value, ate: g('#fate').value });
      const draw = () => {
        const rows = buildRows(filtros());
        g('#count').textContent = `${rows.length} registro(s)`;
        if (!rows.length) { g('#th').innerHTML = ''; g('#tb').innerHTML = `<tr><td><div class="empty-state"><i class="fa-solid fa-file-lines"></i><h4>Sem dados para os filtros</h4></div></td></tr>`; return; }
        g('#th').innerHTML = `<tr>${Object.keys(rows[0]).map(k => `<th>${esc(k)}</th>`).join('')}</tr>`;
        g('#tb').innerHTML = rows.map(r => `<tr>${Object.values(r).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
      };
      draw();
      ['#fturma', '#fgrav', '#fde', '#fate'].forEach(s => g(s).addEventListener('change', draw));
      g('#pdf').addEventListener('click', () => exportPDF(buildRows(filtros())));
      g('#xls').addEventListener('click', () => exportExcel(buildRows(filtros())));
      g('#print').addEventListener('click', () => window.print());
    }
  };
})();
