/* =====================================================================
   LiveCode — themes
   Dark (VS Code Dark+), Light, System-follow.
   Custom color overrides. Reset per theme.
   All colors are applied as CSS variables on :root.
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC;

  /* =========================================================
     default palettes
     ========================================================= */

  const DARK = {
    /* base UI */
    'bg':        '#1e1e1e',
    'bg-soft':   '#252526',
    'bg-input':  '#3c3c3c',
    'fg':        '#d4d4d4',
    'fg-dim':    '#858585',
    'border':    '#454545',
    'accent':    '#0a84ff',

    /* editor */
    'ed-bg':     '#1e1e1e',
    'ed-fg':     '#d4d4d4',
    'ed-ln':     '#858585',
    'ed-guide':  '#404040',
    'ed-sel':    '#264f78',
    'ed-caret':  '#aeafad',

    /* syntax */
    'syn-tag':   '#569cd6',
    'syn-punc':  '#808080',
    'syn-attr':  '#9cdcfe',
    'syn-str':   '#ce9178',
    'syn-com':   '#6a9955',
    'syn-kw':    '#c586c0',
    'syn-num':   '#b5cea8',
    'syn-fn':    '#dcdcaa',
    'syn-cls':   '#d7ba7d',

    /* preview */
    'pv-bg':     '#3c3c3c',
    'pv-stage':  '#ffffff',

    /* panel */
    'pn-bg':     '#252526',
    'pn-fg':     '#cccccc',
    'pn-border': '#454545',
    'pn-shadow': '0 8px 32px rgba(0,0,0,.55)',
    'pn-opacity':'0.55',

    /* fab */
    'fab-bg':    '#37373d',
    'fab-fg':    '#cccccc',
    'fab-op':    '0.55'
  };

  /* Light theme — same slots, high contrast on white */
  const LIGHT = {
    'bg':        '#f3f3f3',
    'bg-soft':   '#e6e6e6',
    'bg-input':  '#ffffff',
    'fg':        '#1f1f1f',
    'fg-dim':    '#6a6a6a',
    'border':    '#c8c8c8',
    'accent':    '#0066cc',

    'ed-bg':     '#ffffff',
    'ed-fg':     '#1f1f1f',
    'ed-ln':     '#9a9a9a',
    'ed-guide':  '#d8d8d8',
    'ed-sel':    '#b3d7ff',
    'ed-caret':  '#1f1f1f',

    /* darker syntax colors for readable contrast on white */
    'syn-tag':   '#0000c0',
    'syn-punc':  '#5a5a5a',
    'syn-attr':  '#0451a5',
    'syn-str':   '#a31515',
    'syn-com':   '#067d17',
    'syn-kw':    '#af00db',
    'syn-num':   '#098658',
    'syn-fn':    '#795e26',
    'syn-cls':   '#267f99',

    'pv-bg':     '#dcdcdc',
    'pv-stage':  '#ffffff',

    'pn-bg':     '#f3f3f3',
    'pn-fg':     '#1f1f1f',
    'pn-border': '#c8c8c8',
    'pn-shadow': '0 8px 32px rgba(0,0,0,.18)',
    'pn-opacity':'0.85',

    'fab-bg':    '#e0e0e0',
    'fab-fg':    '#1f1f1f',
    'fab-op':    '0.7'
  };

  /* =========================================================
     state
     ========================================================= */

  const KEYS = Object.keys(DARK);

  const state = {
    mode:    LC.store.get('theme.mode', 'dark'),   // dark | light | system
    custom:  LC.store.getJSON('theme.custom', {})  // overrides per resolved theme
  };

  /* resolved theme: what is actually applied right now (dark or light) */
  let resolved = 'dark';

  /* ---------- system preference watcher ---------- */
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)');
  sysDark.addEventListener('change', () => {
    if (state.mode === 'system') applyTheme();
  });

  /* =========================================================
     apply
     ========================================================= */

  function resolvedMode() {
    if (state.mode === 'light')  return 'light';
    if (state.mode === 'dark')   return 'dark';
    return sysDark.matches ? 'dark' : 'light';
  }

  function paletteFor(mode) {
    const base = mode === 'light' ? LIGHT : DARK;
    const over = (state.custom && state.custom[mode]) || {};
    const out  = {};
    for (const k of KEYS) out[k] = over[k] || base[k];
    return out;
  }

  function applyTheme() {
    resolved = resolvedMode();
    const pal = paletteFor(resolved);
    const root = document.documentElement.style;

    for (const k of KEYS) {
      root.setProperty('--' + k, pal[k]);
    }

    /* update the browser UI color */
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', pal['bg']);

    LC.emit('theme:changed', { mode: state.mode, resolved, palette: pal });
  }

  /* =========================================================
     public API
     ========================================================= */

  LC.themes = {
    init() {
      applyTheme();
    },

    /* ---------- getters ---------- */
    get mode()    { return state.mode; },
    get resolved(){ return resolved; },

    /* ---------- change mode ---------- */
    setMode(mode) {
      if (!['dark', 'light', 'system'].includes(mode)) return;
      state.mode = mode;
      LC.store.set('theme.mode', mode);
      applyTheme();
    },

    cycleMode() {
      const order = ['dark', 'light', 'system'];
      const i = order.indexOf(state.mode);
      this.setMode(order[(i + 1) % order.length]);
    },

    /* ---------- read current palette ---------- */
    getPalette(mode) {
      return paletteFor(mode || resolved);
    },

    /* ---------- custom colors ---------- */
    setColor(key, color, mode) {
      if (!KEYS.includes(key)) return;
      mode = mode || resolved;
      state.custom[mode] = state.custom[mode] || {};
      state.custom[mode][key] = color;
      LC.store.setJSON('theme.custom', state.custom);
      if (mode === resolved) applyTheme();
      else LC.emit('theme:changed', { mode: state.mode, resolved, palette: paletteFor(resolved) });
    },

    resetColor(key, mode) {
      mode = mode || resolved;
      if (state.custom[mode]) {
        delete state.custom[mode][key];
        LC.store.setJSON('theme.custom', state.custom);
      }
      applyTheme();
    },

    resetTheme(mode) {
      mode = mode || resolved;
      if (state.custom[mode]) {
        delete state.custom[mode];
        LC.store.setJSON('theme.custom', state.custom);
      }
      applyTheme();
    },

    resetAll() {
      state.custom = {};
      LC.store.setJSON('theme.custom', {});
      applyTheme();
    },

    /* ---------- re-render on demand ---------- */
    refresh() { applyTheme(); }
  };

})();