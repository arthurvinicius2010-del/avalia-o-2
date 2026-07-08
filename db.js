/* =======================================================================
   SIGOE · db.js
   Camada de dados. Agora conversa com o backend (Flask + SQLite) via API
   REST em /api. Mantém um cache em memória para que o restante do app
   continue lendo de forma síncrona (DB.all, DB.get, ...). As gravações
   atualizam o cache imediatamente e são enviadas ao servidor (write-through).

   Se o backend não estiver disponível, cai automaticamente para o modo
   local (localStorage), como na Etapa 1/2 — assim o app nunca "quebra".

   Coleções: escolas, turmas, alunos, professores, responsaveis,
   ocorrencias, eventos (calendário), notificacoes, config.
   ======================================================================= */
(function (global) {
  'use strict';

  const API = '';                       // mesma origem do servidor Flask
  const KEY = 'sigoe_db_v1';            // fallback local (localStorage)
  const COLLECTIONS = ['escolas', 'turmas', 'alunos', 'professores', 'responsaveis', 'ocorrencias', 'eventos', 'notificacoes'];

  const defaultConfig = {
    theme: 'light',
    sidebarCollapsed: false,
    escolaAtiva: null,
    notificacoesAtivas: true,
    nomeInstituicao: 'CETI Professor Felismino Freitas',
    anoLetivo: new Date().getFullYear()
  };

  function emptyDB() {
    const db = { config: { ...defaultConfig }, _seeded: false };
    COLLECTIONS.forEach(c => { db[c] = []; });
    return db;
  }

  let cache = null;
  let remote = false;   // true quando o backend respondeu

  /* ==================== Comunicação com a API ==================== */
  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      credentials: 'same-origin',      // envia o cookie de sessão (login)
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res;
  }

  // Envia uma gravação ao servidor sem travar a interface.
  function sync(method, path, body) {
    if (!remote) { persistLocal(); return; }
    api(method, path, body).catch(err => {
      console.error('Falha ao sincronizar com o servidor:', method, path, err);
      if (global.U && U.toast) U.toast('Não foi possível salvar no servidor', 'error');
    });
  }

  /* ==================== Inicialização ==================== */
  // Carrega o estado a partir do backend; se falhar, usa localStorage.
  async function init() {
    try {
      const res = await api('GET', '/api/state');
      const state = await res.json();
      cache = emptyDB();
      cache.config = { ...defaultConfig, ...(state.config || {}) };
      COLLECTIONS.forEach(c => { cache[c] = Array.isArray(state.collections[c]) ? state.collections[c] : []; });
      cache._seeded = true;
      remote = true;
    } catch (e) {
      console.warn('Backend indisponível — usando armazenamento local (localStorage).', e);
      remote = false;
      loadLocal();
      seedLocal();
    }
    return cache;
  }

  /* ==================== Fallback local (localStorage) ==================== */
  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? JSON.parse(raw) : emptyDB();
    } catch (e) {
      console.error('Falha ao carregar DB local, recriando.', e);
      cache = emptyDB();
    }
    COLLECTIONS.forEach(c => { if (!cache[c]) cache[c] = []; });
    cache.config = { ...defaultConfig, ...(cache.config || {}) };
    return cache;
  }

  function persistLocal() {
    if (remote) return;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ }
  }

  function load() {
    if (!cache) loadLocal();
    return cache;
  }

  /* ==================== CRUD genérico ==================== */
  function all(col) { return load()[col] ? load()[col].slice() : []; }
  function get(col, id) { return (load()[col] || []).find(r => r.id === id) || null; }

  function insert(col, record) {
    const db = load();
    record.id = record.id || U.uid(col.slice(0, 3));
    record.createdAt = record.createdAt || U.nowISO();
    record.updatedAt = U.nowISO();
    db[col].push(record);
    sync('POST', '/api/' + col, record);
    return record;
  }

  function update(col, id, patch) {
    const db = load();
    const idx = db[col].findIndex(r => r.id === id);
    if (idx === -1) return null;
    db[col][idx] = { ...db[col][idx], ...patch, id, updatedAt: U.nowISO() };
    sync('PUT', '/api/' + col + '/' + id, db[col][idx]);
    return db[col][idx];
  }

  function remove(col, id) {
    const db = load();
    const before = db[col].length;
    db[col] = db[col].filter(r => r.id !== id);
    sync('DELETE', '/api/' + col + '/' + id);
    return db[col].length < before;
  }

  function query(col, predicate) { return (load()[col] || []).filter(predicate); }
  function count(col, predicate) { return predicate ? query(col, predicate).length : (load()[col] || []).length; }

  /* ==================== Config ==================== */
  function getConfig(k) { const c = load().config; return k ? c[k] : { ...c }; }
  function setConfig(k, v) {
    const db = load();
    db.config[k] = v;
    if (remote) sync('PUT', '/api/config', { [k]: v }); else persistLocal();
    return v;
  }

  /* ==================== Notificações ==================== */
  function notify(titulo, mensagem, tipo = 'info', icon = 'fa-circle-info') {
    const n = insert('notificacoes', { titulo, mensagem, tipo, icon, lida: false });
    document.dispatchEvent(new CustomEvent('sigoe:notify', { detail: n }));
    return n;
  }
  function markAllRead() {
    const db = load();
    db.notificacoes.forEach(n => {
      if (!n.lida) { n.lida = true; if (remote) sync('PUT', '/api/notificacoes/' + n.id, { lida: true }); }
    });
    persistLocal();
  }
  function unreadCount() { return count('notificacoes', n => !n.lida); }

  /* ==================== Backup / restauração ==================== */
  function exportJSON() {
    const db = load();
    return JSON.stringify({ app: 'SIGOE', version: 1, exportedAt: U.nowISO(), data: db }, null, 2);
  }

  async function importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;
    if (typeof data !== 'object') throw new Error('Arquivo inválido');
    if (remote) {
      await api('POST', '/api/import', { data });
      await init();
    } else {
      cache = { ...emptyDB(), ...data };
      COLLECTIONS.forEach(c => { if (!Array.isArray(cache[c])) cache[c] = []; });
      cache.config = { ...defaultConfig, ...(cache.config || {}) };
      persistLocal();
    }
    return true;
  }

  async function reset() {
    if (remote) {
      await api('POST', '/api/reset');
      await init();
    } else {
      cache = emptyDB();
      persistLocal();
    }
  }

  /* ==================== Relacionamentos úteis ==================== */
  function turmaNome(id) { const t = get('turmas', id); return t ? t.nome : '—'; }
  function alunoNome(id) { const a = get('alunos', id); return a ? a.nome : '—'; }
  function professorNome(id) { const p = get('professores', id); return p ? p.nome : '—'; }
  function ocorrenciasDoAluno(alunoId) {
    return query('ocorrencias', o => o.alunoId === alunoId)
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }

  /* =======================================================================
     SEED — só é usado no MODO LOCAL (fallback). Quando o backend está
     ativo, os dados de exemplo são criados pelo próprio servidor.
     ======================================================================= */
  function seedIfEmpty() { if (!remote) seedLocal(); }

  function seedLocal() {
    const db = load();
    if (db._seeded) return;

    const escola = insert('escolas', {
      nome: 'CETI Professor Felismino Freitas', inep: '22012345', municipio: 'Teresina',
      uf: 'PI', endereco: 'Av. Principal, s/n - Centro', telefone: '(86) 3221-0000',
      diretor: 'Maria de Fátima Sousa', email: 'ceti.felismino@seduc.pi.gov.br'
    });
    db.config.escolaAtiva = escola.id; persistLocal();

    const turmasSeed = [
      { nome: '1º Ano A', turno: 'Manhã', serie: '1º Ano EM', sala: 'Sala 01' },
      { nome: '2º Ano B', turno: 'Manhã', serie: '2º Ano EM', sala: 'Sala 05' },
      { nome: '3º Ano C', turno: 'Tarde', serie: '3º Ano EM', sala: 'Sala 09' }
    ].map(t => insert('turmas', { ...t, escolaId: escola.id, foto: '', anoLetivo: db.config.anoLetivo }));

    const profsSeed = [
      { nome: 'Carlos Alberto Lima', disciplina: 'Matemática', email: 'carlos.lima@ceti.pi.gov.br', telefone: '(86) 99911-0001' },
      { nome: 'Ana Paula Ribeiro', disciplina: 'Português', email: 'ana.ribeiro@ceti.pi.gov.br', telefone: '(86) 99911-0002' },
      { nome: 'João Marcos Teixeira', disciplina: 'História', email: 'joao.teixeira@ceti.pi.gov.br', telefone: '(86) 99911-0003' },
      { nome: 'Fernanda Costa', disciplina: 'Biologia', email: 'fernanda.costa@ceti.pi.gov.br', telefone: '(86) 99911-0004' }
    ].map(p => insert('professores', { ...p, escolaId: escola.id, foto: '' }));

    const respSeed = [
      { nome: 'José Ferreira da Silva', parentesco: 'Pai', cpf: '111.222.333-44', telefone: '(86) 98800-1111', email: 'jose.silva@email.com' },
      { nome: 'Marta Oliveira', parentesco: 'Mãe', cpf: '222.333.444-55', telefone: '(86) 98800-2222', email: 'marta.oliveira@email.com' },
      { nome: 'Antônio Gomes', parentesco: 'Responsável', cpf: '333.444.555-66', telefone: '(86) 98800-3333', email: 'antonio.gomes@email.com' }
    ].map(r => insert('responsaveis', r));

    const nomes = [
      'Lucas Santos Silva', 'Maria Eduarda Alves', 'Pedro Henrique Costa', 'Beatriz Gomes Lima',
      'Gabriel Oliveira Souza', 'Larissa Ferreira', 'Matheus Rocha', 'Júlia Mendes Barros',
      'Rafael Nunes', 'Ana Clara Dias', 'Vinícius Araújo', 'Sofia Cardoso'
    ];
    const alunos = nomes.map((nome, i) => insert('alunos', {
      nome,
      turmaId: turmasSeed[i % turmasSeed.length].id,
      escolaId: escola.id,
      responsavelId: respSeed[i % respSeed.length].id,
      matricula: '2024' + String(1000 + i),
      ra: 'RA' + String(50000 + i),
      cpf: '',
      dataNascimento: `${2007 + (i % 3)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      telefone: U.maskPhone('869' + String(90000000 + i)),
      responsavelNome: respSeed[i % respSeed.length].nome,
      foto: '',
      sexo: i % 2 === 0 ? 'M' : 'F',
      status: 'Ativo'
    }));

    const tipos = [
      { t: 'Atraso', g: 'leve' }, { t: 'Uso de celular em aula', g: 'leve' },
      { t: 'Falta de material', g: 'leve' }, { t: 'Indisciplina em sala', g: 'media' },
      { t: 'Desrespeito ao colega', g: 'media' }, { t: 'Agressão física', g: 'grave' },
      { t: 'Dano ao patrimônio', g: 'grave' }
    ];
    const nOcc = 22;
    for (let i = 0; i < nOcc; i++) {
      const aluno = alunos[Math.floor(Math.random() * alunos.length)];
      const tp = tipos[Math.floor(Math.random() * tipos.length)];
      const prof = profsSeed[Math.floor(Math.random() * profsSeed.length)];
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * 60));
      insert('ocorrencias', {
        alunoId: aluno.id, turmaId: aluno.turmaId, professorId: prof.id, escolaId: escola.id,
        tipo: tp.t, gravidade: tp.g,
        descricao: `${tp.t} registrada durante atividade escolar. Encaminhamento realizado conforme regimento interno.`,
        data: d.toISOString().slice(0, 10),
        providencia: tp.g === 'grave' ? 'Convocação dos responsáveis' : (tp.g === 'media' ? 'Advertência verbal' : 'Orientação'),
        status: Math.random() > 0.4 ? 'Resolvida' : 'Em análise'
      });
    }

    const y = db.config.anoLetivo;
    [
      { titulo: 'Início do ano letivo', data: `${y}-02-05`, tipo: 'evento' },
      { titulo: 'Reunião de pais', data: `${y}-03-15`, tipo: 'reuniao' },
      { titulo: 'Prova bimestral', data: `${y}-04-22`, tipo: 'prova' },
      { titulo: 'Feriado - Tiradentes', data: `${y}-04-21`, tipo: 'feriado' },
      { titulo: 'Conselho de classe', data: `${y}-06-28`, tipo: 'reuniao' },
      { titulo: 'Festa Junina', data: `${y}-06-24`, tipo: 'evento' }
    ].forEach(ev => insert('eventos', ev));

    notify('Bem-vindo ao SIGOE', 'Sistema iniciado com dados de demonstração.', 'info', 'fa-hand-sparkles');
    notify('Ocorrência grave registrada', 'Uma ocorrência de gravidade alta requer atenção.', 'warn', 'fa-triangle-exclamation');

    db._seeded = true;
    persistLocal();
  }

  global.DB = {
    COLLECTIONS, init, all, get, insert, update, remove, query, count,
    getConfig, setConfig, notify, markAllRead, unreadCount,
    exportJSON, importJSON, reset, seedIfEmpty,
    turmaNome, alunoNome, professorNome, ocorrenciasDoAluno
  };
})(window);
