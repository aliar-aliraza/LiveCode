/* =====================================================================
   LiveCode — core
   Storage, state, event bus, panel manager, dialogs, boot.
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC = window.LC || {};

  LC.store = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem('lc.' + k);
        return v === null ? fallback : v;
      } catch (_) { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem('lc.' + k, String(v)); } catch (_) {}
    },
    del(k) {
      try { localStorage.removeItem('lc.' + k); } catch (_) {}
    },
    getJSON(k, fallback) {
      try {
        const v = localStorage.getItem('lc.' + k);
        return v === null ? fallback : JSON.parse(v);
      } catch (_) { return fallback; }
    },
    setJSON(k, v) {
      try { localStorage.setItem('lc.' + k, JSON.stringify(v)); } catch (_) {}
    }
  };

  LC.$  = (id) => document.getElementById(id);
  LC.$$ = (sel, root) => (root || document).querySelectorAll(sel);

  LC.el = function (tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.startsWith('on') && typeof v === 'function')
        n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    if (children) for (const c of [].concat(children)) {
      if (c == null) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  };

  LC.state = {
    fname: LC.store.get('fname', 'index.html'),
    code:  LC.store.get('code', ''),
    lang:  'html',
    zoom:  1,
    loaded: false
  };

  LC.langOf = function (name) {
    if (/\.css$/i.test(name))  return 'css';
    if (/\.js$/i.test(name))   return 'js';
    if (/\.json$/i.test(name)) return 'json';
    if (/\.md$/i.test(name))   return 'md';
    return 'html';
  };

  const listeners = {};
  LC.on = function (evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => {
      const a = listeners[evt];
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    };
  };
  LC.removeListener = function (evt, fn) {
    const a = listeners[evt];
    if (!a) return;
    const i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  };
  LC.emit = function (evt, payload) {
    const a = listeners[evt];
    if (!a) return;
    for (const fn of a.slice()) {
      try { fn(payload); } catch (e) { console.error('[LC]', evt, e); }
    }
  };

  LC.panels = new Map();
  let zTop = 100;

  LC.openPanel = function (opts) {
    opts = opts || {};
    const id = opts.id || ('p' + Math.random().toString(36).slice(2, 8));
    if (LC.panels.has(id)) return LC.panels.get(id);

    const el = LC.el('div', { class: 'panel', id: 'panel-' + id });

    const title    = LC.el('div', { class: 'panel-title', text: opts.title || 'Panel' });
    const closeBtn = LC.el('button', { title: 'Close', text: '×' });
    const header   = LC.el('div', { class: 'panel-header' }, [title, closeBtn]);

    const body   = LC.el('div', { class: 'panel-body' });
    const resize = LC.el('div', { class: 'panel-resize' });

    el.append(header, body, resize);
    LC.$('panel-layer').appendChild(el);

    const key   = 'panel.' + id;
    const saved = LC.store.getJSON(key, null);
    const rect  = (saved && saved.rect) ? saved.rect : {
      x: opts.right ? window.innerWidth - (opts.width || 260) - 56 : 20 + LC.panels.size * 24,
      y: 40 + LC.panels.size * 24,
      w: opts.width  || 260,
      h: opts.height || 320
    };
    applyRect(rect);
    if (saved && typeof saved.opacity === 'number') el.style.opacity = saved.opacity;

    function applyRect(r) {
      const maxW = window.innerWidth  - 8;
      const maxH = window.innerHeight - 8;
      r.w = Math.max(140, Math.min(r.w, maxW));
      r.h = Math.max(60,  Math.min(r.h, maxH));
      r.x = Math.max(-r.w + 60, Math.min(r.x, window.innerWidth  - 60));
      r.y = Math.max(0,         Math.min(r.y, window.innerHeight - 40));
      el.style.left   = r.x + 'px';
      el.style.top    = r.y + 'px';
      el.style.width  = r.w + 'px';
      el.style.height = r.h + 'px';
      el._rect = r;
    }

    function persist() {
      LC.store.setJSON(key, {
        rect: el._rect,
        opacity: parseFloat(el.style.opacity) || null
      });
    }

    function focus() {
      el.style.zIndex = ++zTop;
      LC.panels.forEach(p => p.el.classList.remove('focused'));
      el.classList.add('focused');
      LC.emit('panel:focus', id);
    }

    let drag = null;
    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      header.setPointerCapture(e.pointerId);
      drag = { dx: e.clientX - el._rect.x, dy: e.clientY - el._rect.y };
      focus();
    });
    header.addEventListener('pointermove', (e) => {
      if (!drag) return;
      applyRect({
        x: e.clientX - drag.dx,
        y: e.clientY - drag.dy,
        w: el._rect.w,
        h: el._rect.h
      });
    });
    const endDrag = (e) => {
      if (!drag) return;
      drag = null;
      try { header.releasePointerCapture(e.pointerId); } catch (_) {}
      persist();
    };
    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);

    let rs = null;
    resize.addEventListener('pointerdown', (e) => {
      resize.setPointerCapture(e.pointerId);
      rs = { x: e.clientX, y: e.clientY, w: el._rect.w, h: el._rect.h };
      focus();
    });
    resize.addEventListener('pointermove', (e) => {
      if (!rs) return;
      applyRect({
        x: el._rect.x,
        y: el._rect.y,
        w: rs.w + (e.clientX - rs.x),
        h: rs.h + (e.clientY - rs.y)
      });
    });
    const endRs = (e) => {
      if (!rs) return;
      rs = null;
      try { resize.releasePointerCapture(e.pointerId); } catch (_) {}
      persist();
    };
    resize.addEventListener('pointerup', endRs);
    resize.addEventListener('pointercancel', endRs);

    let pd = 0;
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) { pd = 0; return; }
      e.preventDefault();
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
      if (pd) {
        const cur = parseFloat(el.dataset.scale || '1') || 1;
        const s   = Math.min(2, Math.max(0.5, cur * d / pd));
        el.dataset.scale = s;
        el.style.transform = 'scale(' + s + ')';
      }
      pd = d;
    }, { passive: false });
    el.addEventListener('touchend', () => { pd = 0; });

    el.addEventListener('pointerdown', () => focus(), true);

    const api = {
      id, el, header, body, title,
      close() {
        el.remove();
        LC.panels.delete(id);
        LC.emit('panel:close', id);
      },
      setTitle(t) { title.textContent = t; },
      setOpacity(o) {
        el.style.opacity = o;
        persist();
      },
      focus,
      persist,
      get rect() { return el._rect; }
    };

    LC.panels.set(id, api);
    closeBtn.addEventListener('click', () => api.close());
    focus();
    LC.emit('panel:open', id);
    return api;
  };

  LC.closePanel = function (id) {
    const p = LC.panels.get(id);
    if (p) p.close();
  };

  LC.closeAllPanels = function () {
    Array.from(LC.panels.values()).forEach(p => p.close());
  };

  LC.isPanelOpen = function (id) {
    return LC.panels.has(id);
  };

  LC.togglePanel = function (id, opts) {
    if (LC.isPanelOpen(id)) LC.closePanel(id);
    else LC.openPanel(Object.assign({ id }, opts || {}));
  };

  LC.confirm = function (message, okLabel) {
    return new Promise((resolve) => {
      const p = LC.openPanel({
        id: 'confirm-' + Date.now(),
        title: 'Confirm',
        width: 300, height: 140
      });
      const cancel = LC.el('button', { class: 'pbtn', text: 'Cancel' });
      const ok     = LC.el('button', { class: 'pbtn', text: okLabel || 'OK' });
      cancel.onclick = () => { p.close(); resolve(false); };
      ok.onclick     = () => { p.close(); resolve(true); };
      p.body.append(
        LC.el('div', { class: 'pgroup-title', text: message }),
        LC.el('div', { class: 'btnrow' }, [cancel, ok])
      );
    });
  };

  LC.prompt = function (message, defaultValue) {
    return new Promise((resolve) => {
      const p = LC.openPanel({
        id: 'prompt-' + Date.now(),
        title: 'Input',
        width: 320, height: 170
      });
      const input  = LC.el('input', { type: 'text', value: defaultValue || '' });
      const wrap   = LC.el('div', { class: 'prow' }, [input]);
      const cancel = LC.el('button', { class: 'pbtn', text: 'Cancel' });
      const ok     = LC.el('button', { class: 'pbtn', text: 'OK' });
      cancel.onclick = () => { p.close(); resolve(null); };
      ok.onclick     = () => { p.close(); resolve(input.value); };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); ok.click(); }
      });
      p.body.append(
        LC.el('div', { class: 'pgroup-title', text: message }),
        wrap,
        LC.el('div', { class: 'btnrow' }, [cancel, ok])
      );
      setTimeout(() => { input.focus(); input.select(); }, 30);
    });
  };

  LC.esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  LC.debounce = function (fn, ms) {
    let t;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), ms);
    };
  };

  /* =========================================================
     toast — small floating message at the bottom of the screen
     used by the formatter and other short confirmations
     ========================================================= */

  let toastTimer = null;
  LC.toast = function (msg, isError, ms) {
    const el = LC.$('toast');
    if (!el) { console.log('[toast]', msg); return; }
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('on'); }, ms || 1600);
  };

  /* =========================================================
     panel keyboard navigation
     ArrowUp/Down cycle .prow / .pbtn rows, Enter activates,
     Escape closes focused panel. Only when a panel is focused
     and the editor is NOT the event target.
     ========================================================= */

  function panelRows(panelEl) {
    return Array.from(panelEl.querySelectorAll('.prow, button.pbtn, .btnrow button'))
      .filter((n) => n.offsetParent !== null);
  }

  function highlightRow(rows, idx) {
    rows.forEach((r, i) => {
      if (i === idx) {
        r.classList.add('kb-focus');
        r.scrollIntoView({ block: 'nearest' });
      } else {
        r.classList.remove('kb-focus');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    /* find topmost focused panel */
    let top = null, z = -1;
    LC.panels.forEach((p) => {
      if (p.el.classList.contains('focused')) {
        const zi = parseInt(p.el.style.zIndex || '0', 10);
        if (zi >= z) { z = zi; top = p; }
      }
    });
    if (!top) return;

    /* don't steal typing from inputs inside the panel */
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      if (e.key === 'Escape') {
        e.preventDefault();
        top.close();
        if (LC.editor) LC.editor.focus();
      }
      return;
    }

    const rows = panelRows(top.el);
    if (!rows.length && e.key !== 'Escape') return;

    let idx = rows.findIndex((r) => r.classList.contains('kb-focus'));
    if (idx < 0) idx = 0;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      top.close();
      if (LC.editor) LC.editor.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      idx = (idx + 1) % rows.length;
      highlightRow(rows, idx);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      idx = (idx - 1 + rows.length) % rows.length;
      highlightRow(rows, idx);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const row = rows[idx];
      if (row) row.click();
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      highlightRow(rows, 0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      highlightRow(rows, rows.length - 1);
      return;
    }
  }, true);

  LC.boot = function () {
    LC.emit('boot:start');
    if (LC.themes)    LC.themes.init();
    if (LC.settings)  LC.settings.init();
    if (LC.menu)      LC.menu.init();
    if (LC.editor)    LC.editor.init();
    if (LC.preview)   LC.preview.init();
    if (LC.projects)  LC.projects.init();
    if (LC.format)    /* nothing to init; it registers itself */;
    if (LC.shortcuts) LC.shortcuts.init();
    LC.emit('boot:done');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  };

})();