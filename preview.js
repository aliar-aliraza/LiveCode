/* =====================================================================
   LiveCode — preview
   Live in-place DOM patching. Preview never fully reloads on each
   keystroke, only patches what changed. Scroll position, zoom, scale
   are preserved through every edit.
   Same logic as the original single-file app, unchanged.
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC;

  /* DOM */
  let fr, pv, stage;

  /* state */
  let loaded = false;
  let lastSig = '';
  let z = 1;
  let fullT = null;
  let pinT  = null;
  let bw = LC.store.get('bw', '1') !== '0';
  let currentSize = { w: 0, h: 0 }; /* 0 = auto */

  /* =========================================================
     signatures — a preview is only fully reloaded when the
     <script> tags change. Everything else is patched in place.
     ========================================================= */

  const sigOf = (code) => {
    try {
      const doc = new DOMParser().parseFromString(code, 'text/html');
      return [...doc.scripts].map((s) => (s.src || '') + '|' + s.textContent).join('\u0001');
    } catch (_) { return ''; }
  };

  /* =========================================================
     DOM patcher — copied unchanged from original
     ========================================================= */

  function setAttrs(a, b) {
    for (const x of [...a.attributes]) {
      if (!b.hasAttribute(x.name)) a.removeAttribute(x.name);
    }
    for (const x of b.attributes) {
      if (a.getAttribute(x.name) !== x.value) a.setAttribute(x.name, x.value);
    }
  }

  function sync(a, b) {
    const ak = a.childNodes;
    const bk = b.childNodes;

    for (let i = 0; i < bk.length; i++) {
      const x = ak[i];
      const y = bk[i];

      if (!x) {
        a.appendChild(a.ownerDocument.importNode(y, true));
        continue;
      }
      if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) {
        a.replaceChild(a.ownerDocument.importNode(y, true), x);
        continue;
      }
      if (x.nodeType === 3 || x.nodeType === 8) {
        if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue;
        continue;
      }
      if (x.nodeName === 'SCRIPT') continue;
      setAttrs(x, y);
      sync(x, y);
    }
    while (a.childNodes.length > bk.length) a.removeChild(a.lastChild);
  }

  /* =========================================================
     full reload — only used when scripts change, or on first load,
     or when the user asks. Scroll position is restored.
     ========================================================= */

  function fullReload(code) {
    const w = fr.contentWindow;
    const sx = w ? w.scrollX : 0;
    const sy = w ? w.scrollY : 0;
    loaded = false;

    fr.onload = () => {
      loaded = true;
      lastSig = sigOf(code);
      const w2 = fr.contentWindow;
      try { applyBw(); } catch (_) {}
      try { w2.scrollTo(sx, sy); } catch (_) {}
      hook();
      setTimeout(() => { try { w2.scrollTo(sx, sy); } catch (_) {} }, 80);
    };
    fr.srcdoc = code;
  }

  /* =========================================================
     setPreview — the in-place update path.
     This is what runs on every keystroke when the user edits HTML.
     ========================================================= */

  function setPreview(code) {
    if (LC.state.lang !== 'html' && !(LC.projects && LC.projects.active)) return;

    const d = fr.contentDocument;

    if (!loaded || !d || !d.body) {
      fullReload(code);
      return;
    }

    /* If script tags changed, we must reload (can't patch a <script>) */
    if (sigOf(code) !== lastSig) {
      clearTimeout(fullT);
      fullT = setTimeout(() => fullReload(code), 600);
      return;
    }

    const w  = fr.contentWindow;
    const sx = LC.settings && LC.settings.get('preserveScroll') ? w.scrollX : 0;
    const sy = LC.settings && LC.settings.get('preserveScroll') ? w.scrollY : 0;
    const h  = d.documentElement;
    const hh = h.scrollHeight;

    const nd = new DOMParser().parseFromString(code, 'text/html');

    setAttrs(h, nd.documentElement);
    sync(d.head, nd.head);
    setAttrs(d.body, nd.body);
    sync(d.body, nd.body);

    /* Pin the document height so it never shrinks during typing.
       That is what prevents the browser from clamping the scroll
       to the top when a line is deleted. */
    h.style.minHeight = hh + 'px';
    w.scrollTo(sx, sy);

    clearTimeout(pinT);
    pinT = setTimeout(() => { h.style.minHeight = ''; }, 900);
  }

  /* =========================================================
     word break — so a long unbroken string never forces the
     stage to widen
     ========================================================= */

  function applyBw() {
    try {
      const d = fr.contentDocument;
      if (!d) return;
      const sh = new fr.contentWindow.CSSStyleSheet();
      sh.replaceSync(bw ? 'html{overflow-wrap:anywhere}' : '');
      d.adoptedStyleSheets = [sh];
    } catch (_) {}
  }

  /* =========================================================
     pinch to zoom inside the preview
     ========================================================= */

  function pinch(el, fn) {
    let pd = 0;
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) { pd = 0; return; }
      e.preventDefault();
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
      if (pd) fn(d / pd);
      pd = d;
    }, { passive: false });
    el.addEventListener('touchend', () => { pd = 0; });
  }

  function hook() {
    const d = fr.contentDocument;
    if (d) pinch(d, (r) => setZoom(z * r));
  }

  /* =========================================================
     layout — apply size and zoom to the iframe + stage
     ========================================================= */

  function layout() {
    if (!pv || !stage || !fr) return;

    const r = pv.getBoundingClientRect();

    const w = currentSize.w || Math.max(50, Math.round(r.width  / z));
    const h = currentSize.h || Math.max(50, Math.round(r.height / z));

    fr.style.width  = w + 'px';
    fr.style.height = h + 'px';
    fr.style.transform = 'scale(' + z + ')';

    stage.style.width  = w * z + 'px';
    stage.style.height = h * z + 'px';

    LC.emit('preview:changed', { w, h, z });
  }

  function setZoom(n) {
    z = Math.min(2, Math.max(0.2, n));
    if (LC.settings && LC.settings.get('preserveZoom')) {
      LC.store.set('preview.zoom', z);
    }
    layout();
  }

  /* =========================================================
     public API
     ========================================================= */

  LC.preview = {
    init() {
      fr    = LC.$('fr');
      pv    = LC.$('pv');
      stage = LC.$('stage');

      /* restore stored zoom */
      const savedZ = parseFloat(LC.store.get('preview.zoom', '1'));
      if (LC.settings.get('preserveZoom') && savedZ > 0) z = savedZ;

      /* word break checkbox reflects setting */
      bw = !!LC.settings.get('breakLongWords');

      /* react to settings */
      LC.on('settings:set', (e) => {
        if (e.name === 'breakLongWords') {
          bw = !!e.value;
          LC.store.set('bw', bw ? '1' : '0');
          applyBw();
        }
      });

      /* observe resize of the pane */
      if (window.ResizeObserver) {
        new ResizeObserver(layout).observe(pv);
      } else {
        window.addEventListener('resize', layout);
      }

      /* pinch on the preview pane to zoom */
      pinch(pv, (r) => setZoom(z * r));

      /* default size / zoom from settings (only when nothing was saved yet) */
      currentSize.w = LC.settings.get('previewWidth')  || 0;
      currentSize.h = LC.settings.get('previewHeight') || 0;
      if (!LC.store.get('preview.zoom', '')) z = (LC.settings.get('previewZoom') || 100) / 100;

      /* the divider between the code and the preview: drag it */
      const bar = LC.$('bar'), app = LC.$('app'), edEl = LC.$('ed');
      let drag = false;
      bar.addEventListener('pointerdown', (e) => { bar.setPointerCapture(e.pointerId); drag = true; });
      bar.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const r = app.getBoundingClientRect();
        const row = getComputedStyle(app).flexDirection === 'row';
        const size = row ? r.width : r.height;
        const pos  = row ? e.clientX - r.left : e.clientY - r.top;
        edEl.style.flexBasis = Math.min(Math.max(pos - 8, 60), size - 84) + 'px';
        edEl.dataset.userSized = '1';
      });
      const stop = () => { drag = false; };
      bar.addEventListener('pointerup', stop);
      bar.addEventListener('pointercancel', stop);
      window.matchMedia('(orientation:landscape)').addEventListener('change', () => {
        edEl.style.flexBasis = LC.settings.get('editorSplit') + '%';
        edEl.dataset.userSized = '';
      });

      /* first layout */
      layout();

      /* initial paint — editor may not be ready yet; wait a tick */
      setTimeout(() => {
        if (LC.editor && LC.editor.getText) {
          this.update(LC.editor.getText(), true);
        }
      }, 60);
    },

    /* Called by the editor on every change. force = true bypasses
       the "autoRefresh off" check. */
    update(code, force) {
      if (!LC.settings.get('autoRefresh') && !force) return;
      setPreview(code);
    },

    /* force a full reload (used by the Reload button) */
    reload() {
      fullReload(LC.projects && LC.projects.previewHtml ? LC.projects.previewHtml(LC.editor.getText()) : LC.editor.getText());
    },

    /* size API — called by the preview panel */
    setSize(w, h) {
      currentSize.w = Math.max(0, Number(w) || 0);
      currentSize.h = Math.max(0, Number(h) || 0);
      layout();
    },
    getSize() {
      return { w: currentSize.w, h: currentSize.h };
    },

    /* zoom API */
    setZoom,
    getZoom() { return z; },
    zoomIn()  { setZoom(z * 1.1); },
    zoomOut() { setZoom(z / 1.1); },
    resetZoom(){ setZoom(1); },

    /* fit the current sized preview into the pane */
    fit() {
      const r = pv.getBoundingClientRect();
      if (currentSize.w && currentSize.h) {
        setZoom(Math.min(r.width / currentSize.w, r.height / currentSize.h));
      } else {
        setZoom(1);
      }
    },

    /* swap width and height */
    rotate() {
      const t = currentSize.w;
      currentSize.w = currentSize.h;
      currentSize.h = t;
      layout();
    },

    /* expose internals if anything needs them */
    get node() { return fr; },
    get stage() { return stage; }
  };

})();