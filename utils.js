/* =======================================================================
   SIGOE · utils.js
   Funções utilitárias: seletores, formatação, IDs, toasts, modais,
   validações e helpers de upload de imagem.
   ======================================================================= */
(function (global) {
  'use strict';

  /* ---------- DOM helpers ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /** Cria elemento a partir de string HTML. */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /** Escapa HTML para evitar injeção ao renderizar dados do usuário. */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- IDs / datas ---------- */
  const uid = (prefix = 'id') =>
    prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function nowISO() { return new Date().toISOString(); }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + ' min atrás';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h atrás';
    if (diff < 604800) return Math.floor(diff / 86400) + ' d atrás';
    return formatDate(iso);
  }

  /* ---------- Máscaras / validações ---------- */
  function maskCPF(v) {
    v = (v || '').replace(/\D/g, '').slice(0, 11);
    return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  function maskPhone(v) {
    v = (v || '').replace(/\D/g, '').slice(0, 11);
    if (v.length <= 10) return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }
  function validCPF(cpf) {
    cpf = (cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
    let d1 = 11 - (s % 11); if (d1 >= 10) d1 = 0;
    if (d1 !== parseInt(cpf[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
    let d2 = 11 - (s % 11); if (d2 >= 10) d2 = 0;
    return d2 === parseInt(cpf[10]);
  }

  function initials(name) {
    if (!name) return '?';
    const p = name.trim().split(/\s+/);
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  function downloadFile(filename, content, type = 'application/json') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Lê arquivo de imagem como dataURL (base64). */
  function readImageAsDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function debounce(fn, wait = 250) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
  }

  /* ---------- Toasts ---------- */
  function toast(message, type = 'info', title = '') {
    const root = $('#toast-root');
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const node = el(`
      <div class="toast ${type}">
        <i class="fa-solid ${icons[type] || icons.info} ic"></i>
        <div>${title ? `<strong>${esc(title)}</strong>` : ''}<div>${esc(message)}</div></div>
      </div>`);
    root.appendChild(node);
    setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateX(30px)'; setTimeout(() => node.remove(), 300); }, 3400);
  }

  /* ---------- Modal ---------- */
  let modalOpen = false;
  /**
   * Abre um modal. opts: { title, body(HTML|Node), size, footer(HTML|Node), onMount(rootEl) }
   * Retorna { close }.
   */
  function modal(opts = {}) {
    const root = $('#modal-root');
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal ${opts.size === 'wide' ? 'wide' : ''}">
          <div class="modal-head">
            <h3>${esc(opts.title || '')}</h3>
            <button class="icon-btn" data-close><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body"></div>
          ${opts.footer !== undefined ? '<div class="modal-foot"></div>' : ''}
        </div>
      </div>`);
    const bodyEl = $('.modal-body', overlay);
    if (opts.body instanceof Node) bodyEl.appendChild(opts.body); else bodyEl.innerHTML = opts.body || '';
    if (opts.footer !== undefined) {
      const footEl = $('.modal-foot', overlay);
      if (opts.footer instanceof Node) footEl.appendChild(opts.footer); else footEl.innerHTML = opts.footer || '';
    }
    const close = () => { overlay.remove(); modalOpen = false; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    root.appendChild(overlay);
    modalOpen = true;
    if (typeof opts.onMount === 'function') opts.onMount(overlay);
    return { close, root: overlay };
  }

  /** Confirmação simples. Retorna Promise<boolean>. */
  function confirmDialog(message, { title = 'Confirmar', danger = true, okText = 'Confirmar' } = {}) {
    return new Promise((resolve) => {
      const m = modal({
        title,
        body: `<p style="margin:0;color:var(--text-soft)">${esc(message)}</p>`,
        footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button>
                 <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`,
        onMount(rootEl) {
          rootEl.querySelector('[data-cancel]').addEventListener('click', () => { m.close(); resolve(false); });
          rootEl.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(true); });
        }
      });
    });
  }

  global.U = {
    $, $$, el, esc, uid, todayISO, nowISO, formatDate, formatDateTime, timeAgo,
    maskCPF, maskPhone, validCPF, initials, downloadFile, readImageAsDataURL,
    debounce, toast, modal, confirmDialog
  };
})(window);
