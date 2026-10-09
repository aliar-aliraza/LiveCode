/* =====================================================================
   LiveCode — settings
   One model. Every behavior reads from here. Panel-editable at runtime.
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC;

  /* =========================================================
     schema
     name        : key used everywhere
     label       : shown in the settings panel
     type        : 'bool' | 'num' | 'text' | 'select'
     default     : initial value
     min,max,step: for num
     options     : for select
     group       : section title in the panel
     ========================================================= */

  const SCHEMA = [
    /* --- Formatter --- */
    { name: 'formatIndent',     group: 'Formatter',   label: 'Format: indent size',  type: 'num',  default: 2,  min: 1, max: 8, step: 1 },
    { name: 'formatOnSave',     group: 'Formatter',   label: 'Format on save',       type: 'bool', default: false },
    { name: 'formatKeepInline', group: 'Formatter',   label: 'Keep inline tags inline', type: 'bool', default: true },

    /* --- Editor: indentation --- */
    { name: 'indentSize',      group: 'Indentation', label: 'Indent size',         type: 'num',    default: 2, min: 1, max: 8, step: 1 },
    { name: 'indentWithTabs',  group: 'Indentation', label: 'Indent with tabs',    type: 'bool',   default: false },
    { name: 'autoIndent',      group: 'Indentation', label: 'Auto indent on Enter',type: 'bool',   default: true },
    { name: 'smartIndentTags', group: 'Indentation', label: 'Stair indent between tags', type: 'bool', default: true },
    { name: 'smartIndentBraces', group: 'Indentation', label: 'Stair indent between braces', type: 'bool', default: true },

    /* --- Editor: tags and brackets --- */
    { name: 'autoCloseTags',    group: 'Tags & brackets', label: 'Auto-close tags',      type: 'bool', default: true },
    { name: 'autoCloseBrackets',group: 'Tags & brackets', label: 'Auto-close brackets',  type: 'bool', default: true },
    { name: 'autoCloseQuotes',  group: 'Tags & brackets', label: 'Auto-close quotes',    type: 'bool', default: true },
    { name: 'autoRenameTags',   group: 'Tags & brackets', label: 'Auto-rename matching tags', type: 'bool', default: true },
    { name: 'skipOverClosing',  group: 'Tags & brackets', label: 'Type over closing bracket', type: 'bool', default: true },
    { name: 'cssAutoSemicolon', group: 'Tags & brackets', label: 'CSS: add ; after :',   type: 'bool', default: true },
    { name: 'cssSkipSemicolon', group: 'Tags & brackets', label: 'CSS: skip over existing ;', type: 'bool', default: true },

    /* --- Editor: emmet --- */
    { name: 'emmetHtml',        group: 'Emmet',       label: 'Emmet for HTML',     type: 'bool', default: true },
    { name: 'emmetCss',         group: 'Emmet',       label: 'Emmet for CSS',      type: 'bool', default: true },
    { name: 'emmetOnTab',       group: 'Emmet',       label: 'Expand on Tab',      type: 'bool', default: true },

    /* --- Editor: view --- */
    { name: 'showLineNumbers',  group: 'View',        label: 'Line numbers',       type: 'bool', default: true },
    { name: 'showIndentGuides', group: 'View',        label: 'Indent guides',      type: 'bool', default: true },
    { name: 'highlightActiveLine', group: 'View',     label: 'Highlight active line', type: 'bool', default: false },
    { name: 'wordWrap',         group: 'View',        label: 'Word wrap',          type: 'bool', default: true },
    { name: 'fontSize',         group: 'View',        label: 'Font size',          type: 'num',  default: 14, min: 8, max: 32, step: 1 },

    /* --- Editor: files --- */
    { name: 'autoSave',         group: 'Files',       label: 'Auto-save',          type: 'bool', default: true },
    { name: 'autoSaveDelay',    group: 'Files',       label: 'Auto-save delay (ms)', type: 'num', default: 400, min: 100, max: 5000, step: 50 },
    { name: 'confirmDelete',    group: 'Files',       label: 'Confirm before delete', type: 'bool', default: true },

    /* --- Preview --- */
    { name: 'autoRefresh',      group: 'Preview',     label: 'Live refresh',       type: 'bool', default: true },
    { name: 'refreshDelay',     group: 'Preview',     label: 'Refresh delay (ms)', type: 'num',  default: 50, min: 0, max: 2000, step: 10 },
    { name: 'preserveScroll',   group: 'Preview',     label: 'Preserve scroll position', type: 'bool', default: true },
    { name: 'preserveZoom',     group: 'Preview',     label: 'Preserve zoom',      type: 'bool', default: true },
    { name: 'breakLongWords',   group: 'Preview',     label: 'Break long words',   type: 'bool', default: true },
    { name: 'previewWidth',     group: 'Preview',     label: 'Default width (px)', type: 'num',  default: 0, min: 0, max: 2400, step: 1 },
    { name: 'previewHeight',    group: 'Preview',     label: 'Default height (px)',type: 'num',  default: 0, min: 0, max: 2400, step: 1 },
    { name: 'previewZoom',      group: 'Preview',     label: 'Default zoom (%)',   type: 'num',  default: 100, min: 20, max: 200, step: 5 },

    /* --- Interface --- */
    { name: 'showFabButtons',   group: 'Interface',   label: 'Show corner buttons',type: 'bool', default: true },
    { name: 'fabOpacity',       group: 'Interface',   label: 'Button transparency',type: 'num',  default: 55, min: 0, max: 100, step: 5 },
    { name: 'panelOpacity',     group: 'Interface',   label: 'Panel transparency', type: 'num',  default: 55, min: 20, max: 100, step: 5 },
    { name: 'editorSplit',      group: 'Interface',   label: 'Editor share (%)',   type: 'num',  default: 50, min: 15, max: 85, step: 5 }
  ];

  const byName = {};
  for (const s of SCHEMA) byName[s.name] = s;

  /* =========================================================
     values
     ========================================================= */

  const values = {};

  function loadValues() {
    const saved = LC.store.getJSON('settings', {});
    for (const s of SCHEMA) {
      const v = Object.prototype.hasOwnProperty.call(saved, s.name)
        ? saved[s.name]
        : s.default;
      values[s.name] = coerce(s, v);
    }
  }

  function coerce(s, v) {
    if (s.type === 'bool') return !!v;
    if (s.type === 'num') {
      const n = Number(v);
      if (isNaN(n)) return s.default;
      return Math.min(s.max, Math.max(s.min, n));
    }
    return v;
  }

  function saveValues() {
    LC.store.setJSON('settings', values);
  }

  /* =========================================================
     apply: set CSS variables and body classes that the
     stylesheet and the rest of the app read
     ========================================================= */

  function apply() {
    const r = document.documentElement.style;

    /* font */
    const f = Math.round(values.fontSize * 2) / 2;
    r.setProperty('--fs', f + 'px');
    r.setProperty('--lh', Math.round(f * 1.5) + 'px');

    /* tab size for the CSS-level tab stop */
    r.setProperty('--tab-size', values.indentSize);

    /* fab opacity */
    r.setProperty('--fab-op', (values.fabOpacity / 100).toString());
    r.setProperty('--pn-opacity', (values.panelOpacity / 100).toString());

    /* editor split */
    const edEl = LC.$('ed');
    if (edEl) {
      if (!edEl.dataset.userSized) {
        edEl.style.flexBasis = values.editorSplit + '%';
      }
    }

    /* body/editor classes */
    const ed = LC.$('ed');
    if (ed) {
      ed.classList.toggle('no-wrap', !values.wordWrap);
      ed.classList.toggle('hide-ln', !values.showLineNumbers);
      ed.classList.toggle('hide-guides', !values.showIndentGuides);
      ed.classList.toggle('hl-line', !!values.highlightActiveLine);
    }

    const edFab = LC.$('ed-fab');
    const pvFab = LC.$('pv-fab');
    if (edFab) edFab.style.display = values.showFabButtons ? '' : 'none';
    if (pvFab) pvFab.style.display = values.showFabButtons ? '' : 'none';

    LC.emit('settings:changed', values);
  }

  /* =========================================================
     public API
     ========================================================= */

  LC.settings = {
    init() {
      loadValues();
      apply();

      const mq = window.matchMedia('(orientation:landscape)');
      mq.addEventListener('change', () => {
        const ed = LC.$('ed');
        if (ed && !ed.dataset.userSized) {
          ed.style.flexBasis = values.editorSplit + '%';
        }
      });
    },

    /* ---------- read ---------- */
    get(name) {
      return values[name];
    },
    all() {
      return Object.assign({}, values);
    },
    schema() {
      return SCHEMA.slice();
    },
    def(name) {
      return byName[name] ? byName[name].default : undefined;
    },
    schemaOf(name) {
      return byName[name];
    },

    /* ---------- write ---------- */
    set(name, value) {
      const s = byName[name];
      if (!s) return;
      const v = coerce(s, value);
      if (values[name] === v) return;
      values[name] = v;
      saveValues();
      apply();
      LC.emit('settings:set', { name, value: v });
    },

    reset(name) {
      const s = byName[name];
      if (!s) return;
      this.set(name, s.default);
    },

    resetAll() {
      for (const s of SCHEMA) values[s.name] = coerce(s, s.default);
      saveValues();
      apply();
      LC.emit('settings:reset', values);
    },

    /* ---------- helpers used elsewhere ---------- */
    indentUnit() {
      return values.indentWithTabs
        ? '\t'
        : ' '.repeat(values.indentSize);
    },

    apply
  };

})();