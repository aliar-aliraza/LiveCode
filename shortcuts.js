/* =====================================================================
   LiveCode — shortcuts
   Every action of the app reachable from a physical keyboard.
   User-rebindable. Saved in localStorage.
   Skips combos that Chrome / Android reserve so we do not fight the
   browser for keys we cannot win.
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC;
  const el = LC.el;

  /* =========================================================
     actions — every row is a name + a function + a label
     ========================================================= */

  const ACTIONS = [
    /* ---- panels ---- */
    { id: 'menu',       label: 'Open main menu',      fn: () => togglePanelBuilt('main-menu', 'openMainMenu') },
    { id: 'filePanel',  label: 'Open file panel',     fn: () => togglePanelBuilt('files', 'openFilePanel') },
    { id: 'projPanel',  label: 'Open project panel',  fn: () => togglePanelBuilt('project', 'openProjectPanel') },
    { id: 'settings',   label: 'Open settings',       fn: () => togglePanelBuilt('settings', 'openSettingsPanel') },
    { id: 'keyboard',   label: 'Open keyboard panel', fn: () => togglePanelBuilt('keyboard', 'openKeyboardPanel') },
    { id: 'theme',      label: 'Open theme panel',    fn: () => togglePanelBuilt('theme', 'openThemePanel') },
    { id: 'colors',     label: 'Open colors panel',   fn: () => togglePanelBuilt('colors', 'openColorsPanel') },
    { id: 'preview',    label: 'Open preview panel',  fn: () => togglePanelBuilt('preview', 'openPreviewPanel') },

    /* ---- panels: close ---- */
    { id: 'closeP',     label: 'Close panels, back to code', fn: () => { LC.closeAllPanels(); LC.editor.focus(); } },

    /* ---- focus ---- */
    { id: 'focusEd',    label: 'Focus editor',        fn: () => LC.editor.focus() },
    { id: 'focusPv',    label: 'Focus preview (arrows scroll it)', fn: () => { const pv = LC.$('pv'); if (pv) pv.focus(); } },

    /* ---- divider ---- */
    { id: 'divUp',      label: 'Divider: grow editor',   fn: () => bumpDivider(+5) },
    { id: 'divDown',    label: 'Divider: shrink editor', fn: () => bumpDivider(-5) },
    { id: 'divReset',   label: 'Divider: reset to 50%',  fn: () => { const ed = LC.$('ed'); if (ed) { ed.style.flexBasis = '50%'; ed.dataset.userSized = ''; } } },

    /* ---- preview size & zoom ---- */
    { id: 'zoomIn',     label: 'Preview: zoom in',    fn: () => LC.preview.zoomIn() },
    { id: 'zoomOut',    label: 'Preview: zoom out',   fn: () => LC.preview.zoomOut() },
    { id: 'zoomReset',  label: 'Preview: reset zoom', fn: () => LC.preview.resetZoom() },
    { id: 'sizeUp',     label: 'Preview: width +10',  fn: () => bumpWidth(+10) },
    { id: 'sizeDown',   label: 'Preview: width −10',  fn: () => bumpWidth(-10) },
    { id: 'sizeUpH',    label: 'Preview: height +10', fn: () => bumpHeight(+10) },
    { id: 'sizeDownH',  label: 'Preview: height −10', fn: () => bumpHeight(-10) },
    { id: 'fit',        label: 'Preview: fit',        fn: () => LC.preview.fit() },
    { id: 'rotatePv',   label: 'Preview: rotate',     fn: () => LC.preview.rotate() },
    { id: 'reloadPv',   label: 'Preview: reload',     fn: () => LC.preview.reload() },

    /* ---- file ---- */
    { id: 'save',       label: 'Save file',           fn: () => LC.editor.saveFile() },
    { id: 'saveAs',     label: 'Save as',             fn: () => LC.editor.saveFileAs() },
    { id: 'new',        label: 'New file',            fn: () => LC.editor.newFile() },
    { id: 'open',       label: 'Open file',           fn: () => LC.editor.openFile() },

    /* ---- format ---- */
    { id: 'format',     label: 'Format code',         fn: () => { if (!LC.format) return; setTimeout(function () { LC.format.document(); }, 0); } },
    { id: 'formatSel',  label: 'Format selection',    fn: () => { if (!LC.format) return; setTimeout(function () { LC.format.selection(); }, 0); } },

    /* ---- editor: everyday actions ---- */
    { id: 'comment',    label: 'Toggle comment',      fn: () => toggleComment() },
    { id: 'dupLine',    label: 'Duplicate line',      fn: () => duplicateLine() },
    { id: 'delLine',    label: 'Delete line',         fn: () => deleteLine() },
    { id: 'moveUp',     label: 'Move line up',        fn: () => moveLine(-1) },
    { id: 'moveDown',   label: 'Move line down',      fn: () => moveLine(+1) },
    { id: 'selAll',     label: 'Select all',          fn: () => LC.editor.node.select() },

    /* ---- editor: cursor movement ---- */
    { id: 'curUp10',    label: 'Cursor up 10 lines',  fn: () => moveCursorLines(-10) },
    { id: 'curDown10',  label: 'Cursor down 10 lines',fn: () => moveCursorLines(+10) },
    { id: 'curUp50',    label: 'Cursor up 50 lines',  fn: () => moveCursorLines(-50) },
    { id: 'curDown50',  label: 'Cursor down 50 lines',fn: () => moveCursorLines(+50) },

    /* ---- editor: view scroll ---- */
    { id: 'viewUp',     label: 'Scroll view up',      fn: () => scrollView(-120) },
    { id: 'viewDown',   label: 'Scroll view down',    fn: () => scrollView(+120) },
    { id: 'viewTop',    label: 'Scroll to top',       fn: () => { const t = LC.editor.node; t.scrollTop = 0; } },
    { id: 'viewBottom', label: 'Scroll to bottom',    fn: () => { const t = LC.editor.node; t.scrollTop = t.scrollHeight; } },

    /* ---- editor: font size ---- */
    { id: 'fontUp',     label: 'Font size +1',        fn: () => LC.settings.set('fontSize', LC.settings.get('fontSize') + 1) },
    { id: 'fontDown',   label: 'Font size −1',        fn: () => LC.settings.set('fontSize', LC.settings.get('fontSize') - 1) },

    /* ---- theme ---- */
    { id: 'themeCycle', label: 'Cycle theme',         fn: () => LC.themes.cycleMode() },
    { id: 'themeDark',  label: 'Theme: dark',         fn: () => LC.themes.setMode('dark') },
    { id: 'themeLight', label: 'Theme: light',        fn: () => LC.themes.setMode('light') },
    { id: 'themeSys',   label: 'Theme: system',       fn: () => LC.themes.setMode('system') },

    /* ---- settings toggles ---- */
    { id: 'toggleWrap', label: 'Toggle word wrap',    fn: () => LC.settings.set('wordWrap', !LC.settings.get('wordWrap')) },
    { id: 'toggleLn',   label: 'Toggle line numbers', fn: () => LC.settings.set('showLineNumbers', !LC.settings.get('showLineNumbers')) },
    { id: 'toggleGuides',label:'Toggle indent guides',fn: () => LC.settings.set('showIndentGuides', !LC.settings.get('showIndentGuides')) },

    /* ---- open tabs / project upload ---- */
    { id: 'nextTab',    label: 'Next open file',      fn: () => switchOpenTab(+1) },
    { id: 'prevTab',    label: 'Previous open file',  fn: () => switchOpenTab(-1) },
    { id: 'openTabs',   label: 'Open files panel',    fn: () => { if (LC.projects && LC.projects.openFilesPanel) LC.projects.openFilesPanel(); } },
    { id: 'upload',     label: 'Upload files to project', fn: () => { if (LC.projects && LC.projects.uploadRoot) LC.projects.uploadRoot(); } },
    { id: 'credits',    label: 'Open credits',        fn: () => { if (LC.menu && LC.menu.openCreditsPanel) LC.menu.openCreditsPanel(); } },
    { id: 'formatOpts', label: 'Format options panel', fn: () => { if (LC.menu && LC.menu.openFormatPanel) LC.menu.openFormatPanel(); } },

    /* ---- focus panels by index (Ctrl+3 … Ctrl+9) ---- */
    { id: 'panel1', label: 'Focus panel 1', fn: () => focusPanelByIndex(0) },
    { id: 'panel2', label: 'Focus panel 2', fn: () => focusPanelByIndex(1) },
    { id: 'panel3', label: 'Focus panel 3', fn: () => focusPanelByIndex(2) },
    { id: 'panel4', label: 'Focus panel 4', fn: () => focusPanelByIndex(3) },
    { id: 'panel5', label: 'Focus panel 5', fn: () => focusPanelByIndex(4) }
  ];

  /* open a panel the same way the menu does (so it is filled), or close it if open */
  function togglePanelBuilt(id, fn) {
    if (LC.isPanelOpen(id)) { LC.closePanel(id); return; }
    LC.menu[fn]();
  }

  const actionById = {};
  for (const a of ACTIONS) actionById[a.id] = a;

  /* =========================================================
     default key bindings
     ========================================================= */

  const DEFAULTS = {
    menu:        'Ctrl+Shift+P',
    filePanel:   'Ctrl+O',
    projPanel:   'Ctrl+Shift+O',
    settings:    'Ctrl+,',
    keyboard:    'Ctrl+K',
    theme:       'Ctrl+Shift+T',
    colors:      'Ctrl+Shift+C',
    preview:     'Ctrl+Shift+V',
    closeP:      'Escape',

    focusEd:     'Ctrl+1',
    focusPv:     'Ctrl+2',

    divUp:       'Ctrl+Alt+ArrowUp',
    divDown:     'Ctrl+Alt+ArrowDown',
    divReset:    'Ctrl+Alt+0',

    zoomIn:      'Ctrl+=',
    zoomOut:     'Ctrl+-',
    zoomReset:   'Ctrl+0',
    sizeUp:      'Ctrl+Shift+ArrowRight',
    sizeDown:    'Ctrl+Shift+ArrowLeft',
    sizeUpH:     'Ctrl+Shift+ArrowUp',
    sizeDownH:   'Ctrl+Shift+ArrowDown',
    fit:         'Ctrl+Shift+F',
    rotatePv:    'Ctrl+Shift+R',
    reloadPv:    'F5',

    save:        'Ctrl+S',
    saveAs:      'Ctrl+Shift+S',
    new:         'Ctrl+Alt+N',
    open:        'Ctrl+Alt+O',

    format:      'Alt+Shift+F',
    formatSel:   'Alt+Shift+S',

    comment:     'Ctrl+/',
    dupLine:     'Ctrl+D',
    delLine:     'Ctrl+Shift+K',
    moveUp:      'Alt+ArrowUp',
    moveDown:    'Alt+ArrowDown',
    selAll:      'Ctrl+A',

    curUp10:     'Ctrl+Alt+PageUp',
    curDown10:   'Ctrl+Alt+PageDown',
    curUp50:     'Ctrl+Shift+PageUp',
    curDown50:   'Ctrl+Shift+PageDown',

    viewUp:      'Ctrl+Shift+Alt+ArrowUp',
    viewDown:    'Ctrl+Shift+Alt+ArrowDown',
    viewTop:     'Ctrl+Home',
    viewBottom:  'Ctrl+End',

    themeCycle:  'Ctrl+Alt+T',
    themeDark:   'Ctrl+Alt+1',
    themeLight:  'Ctrl+Alt+2',
    themeSys:    'Ctrl+Alt+3',

    toggleWrap:  'Alt+Z',
    toggleLn:    'Ctrl+Alt+L',
    toggleGuides:'Ctrl+Alt+G',
    fontUp:      'Ctrl+Alt+=',
    fontDown:    'Ctrl+Alt+-',

    nextTab:     'Alt+]',
    prevTab:     'Alt+[',
    openTabs:    'Ctrl+Shift+E',
    upload:      'Ctrl+Shift+U',
    credits:     'Ctrl+Shift+I',
    formatOpts:  'Ctrl+Alt+Shift+O',

    panel1:      'Ctrl+3',
    panel2:      'Ctrl+4',
    panel3:      'Ctrl+5',
    panel4:      'Ctrl+6',
    panel5:      'Ctrl+7'
  };

  /* =========================================================
     binding store
     ========================================================= */

  let bindings = Object.assign({}, DEFAULTS, LC.store.getJSON('shortcuts', {}));
  const reverseIndex = {}; /* key combination -> action id */

  function saveBindings() {
    LC.store.setJSON('shortcuts', bindings);
    rebuildIndex();
  }

  function normalizeKeyEvent(e) {
    const parts = [];
    if (e.ctrlKey)  parts.push('Ctrl');
    if (e.altKey)   parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey)  parts.push('Meta');

    let key = e.key;

    if (key === ' ' || key === 'Spacebar') key = 'Space';
    else if (key === 'Esc') key = 'Escape';
    else if (key.length === 1) key = key.toLowerCase();

    if (!key) return null;

    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null;

    if (parts.includes('Shift') && key.length === 1) key = key.toLowerCase();

    return parts.length ? parts.join('+') + '+' + key : key;
  }

  function canon(combo) {
    const i = combo.lastIndexOf('+');
    if (i < 0 || i === combo.length - 1) return combo;
    const k = combo.slice(i + 1);
    return combo.slice(0, i + 1) + (k.length === 1 ? k.toLowerCase() : k);
  }

  function rebuildIndex() {
    for (const k in reverseIndex) delete reverseIndex[k];
    for (const actionId in bindings) {
      const combo = bindings[actionId];
      if (combo) reverseIndex[canon(combo)] = actionId;
    }
  }

  /* =========================================================
     global key handler
     ========================================================= */

  let recording = null;
  let recordResolve = null;

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  function onKeyDown(e) {
    if (recording) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        const r = recordResolve;
        recording = null; recordResolve = null;
        if (r) r(null);
        return;
      }
      const combo = normalizeKeyEvent(e);
      if (!combo) return;
      const r = recordResolve;
      recording = null; recordResolve = null;
      if (r) r(combo);
      return;
    }

    if (isEditableTarget(e.target) && e.target.id !== 'ta') {
      const t = e.target.type;
      const plain = !t || t === 'text' || t === 'number' || t === 'search';
      if (plain && e.key !== 'Escape' && !e.altKey && !(e.ctrlKey && e.shiftKey)) return;
    }

    const combo = normalizeKeyEvent(e);
    if (!combo) return;

    const actionId = reverseIndex[combo];
    if (!actionId) return;

    const action = actionById[actionId];
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();
    try { action.fn(); } catch (err) { console.error('[LC shortcut]', actionId, err); }
  }

  /* =========================================================
     editor helpers
     ========================================================= */

  function toggleComment() {
    const ta = LC.editor.node;
    const v  = ta.value;
    const s  = ta.selectionStart;
    const e  = ta.selectionEnd;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let   le = v.indexOf('\n', e);
    if (le < 0) le = v.length;

    const lang = LC.state.lang;
    const open = lang === 'css' ? '/* ' : lang === 'js' ? '// ' : '<!-- ';
    const close = lang === 'css' ? ' */' : lang === 'js' ? ''    : ' -->';

    const block = v.slice(ls, le);
    const lines = block.split('\n');
    const allCommented = lines.every((l) => {
      const t = l.trim();
      return t === '' || t.startsWith(open.trim());
    });

    const newLines = lines.map((l) => {
      if (!l.trim()) return l;
      if (allCommented) {
        return l.replace(open, '').replace(new RegExp(close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), '');
      }
      return open + l + close;
    });

    const out = newLines.join('\n');
    ta.setSelectionRange(ls, le);
    document.execCommand('insertText', false, out);
    ta.setSelectionRange(ls, ls + out.length);
  }

  function duplicateLine() {
    const ta = LC.editor.node;
    const v  = ta.value;
    const s  = ta.selectionStart;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let   le = v.indexOf('\n', s);
    if (le < 0) le = v.length;
    const line = v.slice(ls, le);
    ta.setSelectionRange(le, le);
    document.execCommand('insertText', false, '\n' + line);
  }

  function deleteLine() {
    const ta = LC.editor.node;
    const v  = ta.value;
    const s  = ta.selectionStart;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let   le = v.indexOf('\n', s);
    if (le < 0) le = v.length;
    else le += 1;
    ta.setSelectionRange(ls, le);
    document.execCommand('delete');
  }

  function moveLine(dir) {
    const ta = LC.editor.node;
    const v  = ta.value;
    const s  = ta.selectionStart;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let   le = v.indexOf('\n', s);
    if (le < 0) le = v.length;
    const line = v.slice(ls, le);

    if (dir < 0) {
      if (ls === 0) return;
      const prevLs = v.lastIndexOf('\n', ls - 2) + 1;
      const prev = v.slice(prevLs, ls - 1);
      ta.setSelectionRange(prevLs, le);
      document.execCommand('insertText', false, line + '\n' + prev);
    } else {
      if (le >= v.length) return;
      const nextLe = v.indexOf('\n', le + 1);
      const nextEnd = nextLe < 0 ? v.length : nextLe;
      const next = v.slice(le + 1, nextEnd);
      ta.setSelectionRange(ls, nextEnd);
      document.execCommand('insertText', false, next + '\n' + line);
    }
  }

  /* move cursor N lines up/down, keeping column */
  function moveCursorLines(delta) {
    const ta = LC.editor.node;
    const v = ta.value;
    const pos = ta.selectionStart;
    /* current line number */
    let line = 0, lineStart = 0;
    for (let i = 0; i < pos; i++) if (v[i] === '\n') { line++; lineStart = i + 1; }
    const col = pos - lineStart;
    const target = line + delta;
    if (target < 0) { ta.setSelectionRange(0, 0); return; }
    /* find start of target line */
    let ln = 0, i = 0;
    while (ln < target && i < v.length) {
      if (v[i] === '\n') ln++;
      i++;
    }
    if (ln < target) { ta.setSelectionRange(v.length, v.length); return; }
    let start = i;
    let end = v.indexOf('\n', start);
    if (end < 0) end = v.length;
    const newPos = Math.min(start + col, end);
    ta.setSelectionRange(newPos, newPos);
    /* keep cursor in view */
    const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 21;
    const rect = ta.scrollTop;
    const cursorY = target * lineH;
    if (cursorY < rect) ta.scrollTop = cursorY - lineH;
    else if (cursorY > rect + ta.clientHeight - lineH * 2) ta.scrollTop = cursorY - ta.clientHeight + lineH * 2;
  }

  function scrollView(delta) {
    const ta = LC.editor.node;
    ta.scrollTop = Math.max(0, Math.min(ta.scrollHeight, ta.scrollTop + delta));
  }

  function bumpDivider(delta) {
    const ed = LC.$('ed');
    const app = LC.$('app');
    if (!ed || !app) return;
    const r = app.getBoundingClientRect();
    const landscape = getComputedStyle(app).flexDirection === 'row';
    const total = landscape ? r.width : r.height;
    const cur = ed.getBoundingClientRect();
    const curSize = landscape ? cur.width : cur.height;
    const next = Math.max(80, Math.min(total - 80, curSize + delta));
    ed.style.flexBasis = next + 'px';
    ed.dataset.userSized = '1';
  }

  function bumpWidth(delta) {
    const s = LC.preview.getSize();
    const base = s.w || (LC.$('pv').getBoundingClientRect().width / LC.preview.getZoom());
    LC.preview.setSize(Math.max(50, Math.round(base + delta)), s.h);
  }

  function bumpHeight(delta) {
    const s = LC.preview.getSize();
    const base = s.h || (LC.$('pv').getBoundingClientRect().height / LC.preview.getZoom());
    LC.preview.setSize(s.w, Math.max(50, Math.round(base + delta)));
  }

  /* =========================================================
     keyboard panel
     ========================================================= */


  function switchOpenTab(dir) {
    if (!LC.projects || !LC.projects.switchTab) return;
    LC.projects.switchTab(dir);
  }

  function focusPanelByIndex(i) {
    const list = Array.from(LC.panels.values()).sort((a, b) => {
      return (parseInt(a.el.style.zIndex || '0', 10) - parseInt(b.el.style.zIndex || '0', 10));
    });
    if (!list.length) return;
    const p = list[Math.min(i, list.length - 1)];
    if (p && p.focus) p.focus();
    /* mark first row for keyboard */
    const rows = p.el.querySelectorAll('.prow, button.pbtn, .btnrow button');
    rows.forEach((r) => r.classList.remove('kb-focus'));
    if (rows[0]) rows[0].classList.add('kb-focus');
  }

  function buildPanel(p) {
    p.body.textContent = '';

    const head = el('div', { class: 'btnrow' });
    const resetAll = el('button', { class: 'pbtn', text: 'Reset all to defaults' });
    resetAll.addEventListener('click', async () => {
      const ok = await LC.confirm('Reset every shortcut to its default?', 'Reset');
      if (!ok) return;
      bindings = Object.assign({}, DEFAULTS);
      saveBindings();
      p.close();
      LC.shortcuts.openPanel();
    });
    head.append(resetAll);
    p.body.append(head);

    p.body.append(el('div', { class: 'pgroup-title', text: 'Tap a key to rebind' }));

    for (const a of ACTIONS) {
      const combo = bindings[a.id] || '';
      const row = el('div', { class: 'prow' });
      const lbl = el('span', { class: 'lbl', text: a.label });
      const key = el('span', { class: 'val', text: combo || '—' });
      const rb  = el('button', {
        class: 'pbtn', text: 'Set',
        style: { padding: '2px 8px', minWidth: '40px', marginLeft: '6px' }
      });
      const rs = el('button', {
        class: 'pbtn', text: '⟲',
        style: { padding: '2px 8px', minWidth: '32px', marginLeft: '4px' }
      });

      rb.addEventListener('click', async (e) => {
        e.stopPropagation();
        key.textContent = 'press keys…';
        const got = await beginRecording(a.id);
        if (got === null) { key.textContent = bindings[a.id] || '—'; return; }
        const conflictId = reverseIndex[got];
        if (conflictId && conflictId !== a.id) {
          const ok = await LC.confirm(
            '"' + got + '" is already used by "' + actionById[conflictId].label + '". Override?',
            'Override'
          );
          if (!ok) { key.textContent = bindings[a.id] || '—'; return; }
          delete bindings[conflictId];
        }
        bindings[a.id] = got;
        saveBindings();
        key.textContent = got;
      });

      rs.addEventListener('click', () => {
        bindings[a.id] = DEFAULTS[a.id];
        saveBindings();
        key.textContent = DEFAULTS[a.id] || '—';
      });

      row.append(lbl, key, rb, rs);
      p.body.append(row);
    }
  }

  function beginRecording(actionId) {
    return new Promise((resolve) => {
      recording = actionId;
      recordResolve = resolve;
      window.focus();
    });
  }

  /* =========================================================
     public API
     ========================================================= */

  LC.shortcuts = {
    init() {
      rebuildIndex();
      window.addEventListener('keydown', onKeyDown, true);
    },

    buildPanel,
    openPanel() { LC.menu.openKeyboardPanel(); },

    get(actionId) { return bindings[actionId]; },
    set(actionId, combo) { bindings[actionId] = combo; saveBindings(); },
    reset(actionId) { bindings[actionId] = DEFAULTS[actionId]; saveBindings(); },
    resetAll() { bindings = Object.assign({}, DEFAULTS); saveBindings(); },

    run(actionId) {
      const a = actionById[actionId];
      if (a) a.fn();
    },

    actions() { return ACTIONS.slice(); },
    defaults() { return Object.assign({}, DEFAULTS); }
  };

})();