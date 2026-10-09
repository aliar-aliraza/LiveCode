/* =====================================================================
   LiveCode — editor
   The text editor. Everything from the original single-file app, plus:
     - New stair indentation between tags and braces
     - Settings-aware behavior (every toggle works)
     - Sliding from settings for indent size and unit
   All original behavior is preserved. Nothing is removed.
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC;
  const M = '\u0000';

  /* DOM references (filled at init) */
  let ta, hl, ed;

  /* module state */
  let inserting = false;
  let busy = false;
  let prevV = '';
  const lnCtx = (function () { try { return document.createElement('canvas').getContext('2d'); } catch (_) { return null; } })();
  let lnKey = '';
  /* measure the real width of the line-number digits, so the gutter is exactly as wide as needed */
  function gutter(digits) {
    const cs  = getComputedStyle(hl);
    const lfs = (parseFloat(cs.fontSize) || 14) * 0.8;      /* numbers are 80% of the code size */
    const key = digits + '|' + lfs + '|' + cs.fontFamily;
    if (key === lnKey) return;
    lnKey = key;
    lnCtx.font = lfs + 'px ' + cs.fontFamily;
    const w = Math.ceil((lnCtx ? lnCtx.measureText('0').width : lfs * 0.62) * digits) + 2;
    ed.style.setProperty('--ln-fs', lfs + 'px');
    ed.style.setProperty('--ln-w', w + 'px');
  }
  let pre = null;   /* text + cursor just before the keyboard changed something */
  let IND = '  ';

  /* =========================================================
     syntax highlighting — copied from original, unchanged
     ========================================================= */

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function tok(s, re, cls) {
    let o = '', i = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(s))) {
      o += esc(s.slice(i, m.index));
      let g = 1;
      while (m[g] === undefined) g++;
      o += '<span class="' + cls[g - 1] + '">' + esc(m[0]) + '</span>';
      i = re.lastIndex;
    }
    return o + esc(s.slice(i));
  }

  const hlJs = (s) => tok(
    s,
    /(\/\/.*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(const|let|var|function|return|if|else|for|while|new|class|import|export|from|async|await|try|catch|throw|switch|case|break|continue|this|typeof|of|in|default|true|false|null|undefined)\b|(\b\d+\.?\d*\b)|([A-Za-z_$][\w$]*)(?=\()/g,
    ['c', 's', 'k', 'n', 'f']
  );

  const hlCss = (s) => tok(
    s,
    /(\/\*[\s\S]*?(?:\*\/|$))|("[^"\n]*"|'[^'\n]*')|(#[0-9a-fA-F]{3,8}\b)|((?<![\w#-])-?(?:\d+\.?\d*|\.\d+)(?:px|em|rem|%|vh|vw|s|deg|fr)?)|(@[\w-]+)|([\w-]+)(?=\s*:)|([.#][\w-]+)/gi,
    ['c', 's', 'n', 'n', 'k', 'a', 'y']
  );

  const hlAttr = (s) => tok(
    s,
    /("[^"]*"|'[^']*')|([\w:@.-]+)(?=\s*=)|(=)|([\w:@.-]+)/g,
    ['s', 'a', 'p', 'a']
  );

  function hlHtml(s) {
    let o = '', i = 0, m;
    const re = /<!--[\s\S]*?(?:-->|$)|<!doctype[^>]*>|(<\/?)([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(>?)/gi;
    while ((m = re.exec(s))) {
      o += esc(s.slice(i, m.index));
      i = re.lastIndex;
      if (!m[2]) {
        o += '<span class="' + (m[0][2] === '-' ? 'c' : 'd') + '">' + esc(m[0]) + '</span>';
        continue;
      }
      o += '<span class="p">' + esc(m[1]) + '</span>' +
           '<span class="t">' + m[2] + '</span>' +
           hlAttr(m[3]) +
           '<span class="p">' + m[4] + '</span>';

      const t = m[2].toLowerCase();
      if (m[1] === '<' && (t === 'style' || t === 'script')) {
        let e = s.toLowerCase().indexOf('</' + t, i);
        if (e < 0) e = s.length;
        o += (t === 'style' ? hlCss : hlJs)(s.slice(i, e));
        i = e;
        re.lastIndex = e;
      }
    }
    return o + esc(s.slice(i));
  }

  /* =========================================================
     render — copied from original, unchanged
     ========================================================= */

  function render() {
    if (!ta || !hl) return;
    const v = ta.value;
    const L = LC.state.lang;
    const h = L === 'css' ? hlCss(v) : L === 'js' ? hlJs(v) : hlHtml(v);

    const tabSize = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--tab-size') || '2', 10) || 2;

    let open = '';
    hl.innerHTML = h.split('\n').map((l) => {
      const g = l.replace(/^ +/, (m) =>
        '<i></i>'.repeat(Math.floor(m.length / tabSize)) +
        ' '.repeat(m.length % tabSize)
      );
      const pre = open ? '<span class="' + open + '">' : '';
      let o = open, m;
      const re = /<span class="(\w+)">|<\/span>/g;
      while ((m = re.exec(l))) o = m[1] || '';
      open = o;
      const empty = g.length === 0 ? ' empty' : '';
      return '<div class="l' + empty + '">' + pre + (g || '&#8203;') + (o ? '</span>' : '') + '</div>';
    }).join('');

    gutter(Math.max(2, String(h.split('\n').length).length));

    syncScroll();
    markLine();
  }

  function markLine() {
    if (!ta || !hl) return;
    const old = hl.querySelector('.l.cur');
    if (old) old.classList.remove('cur');
    if (!LC.settings.get('highlightActiveLine')) return;
    let n = 0, i = -1;
    const end = ta.selectionStart;
    while ((i = ta.value.indexOf('\n', i + 1)) >= 0 && i < end) n++;
    const row = hl.children[n];
    if (row) row.classList.add('cur');
  }

  function syncScroll() {
    if (!hl || !ta) return;
    hl.scrollTop  = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
  }

  /* =========================================================
     helpers — copied from original
     ========================================================= */

  const OPEN     = /<([A-Za-z][\w-]*)(?:"[^"]*"|'[^']*'|[^<>"'])*>$/;
  const lineB    = (v, s) => v.slice(v.lastIndexOf('\n', s - 1) + 1, s);
  const VOID_RE  = /^(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)$/;
  const PAIRS    = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  const BR_OPEN  = { '{': '}', '[': ']', '(': ')' };

  function cssBlock(v, s) {
    const b = v.slice(0, s);
    const lang = LC.state.lang;
    let c = b;

    if (lang === 'html') {
      const a = b.lastIndexOf('<style');
      if (a < 0 || a < b.lastIndexOf('</style')) return false;
      c = b.slice(a);
    } else if (lang !== 'css') {
      return false;
    }

    return c.lastIndexOf('{') > c.lastIndexOf('}');
  }

  function ins(t) {
    const was = inserting;
    inserting = true;
    try {
      const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      const want = v.slice(0, s) + t + v.slice(e);
      let ok = false;
      try { ok = document.execCommand('insertText', false, t); } catch (_) {}
      if (!ok || ta.value !== want) {
        ta.value = want;
        const c = s + t.length;
        ta.setSelectionRange(c, c);
        prevV = want;
        render();
        schedulePreview();
      }
    } finally {
      inserting = was;
    }
  }

  /* =========================================================
     NEW: the stair indent engine
     Feature #1 you asked for. Exact examples from your spec:
       <body>|</body>    + Enter  ->  three lines
       <div>|</div>      + Enter  ->  three lines
       <p>|</p>          + Enter  ->  three lines
       CSS  {|}          + Enter  ->  three lines
     Also works when the closing tag/brace is already on the next line.
     ========================================================= */

  function smartEnter() {
    const v = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;

    const line = lineB(v, s);
    const base = /^[ \t]*/.exec(line)[0];
    const unit = IND;

    if (s !== e) { ins('\n' + (LC.settings.get('autoIndent') ? base : '')); return; }

    if (!LC.settings.get('autoIndent')) { ins('\n'); return; }

    const stair = () => {
      ins('\n' + base + unit + '\n' + base);
      const cur = s + 1 + base.length + unit.length;
      ta.setSelectionRange(cur, cur);
    };

    const m = OPEN.exec(line);
    if (m && !line.endsWith('/>') && !VOID_RE.test(m[1].toLowerCase())) {
      const closing = new RegExp('^</' + m[1] + '\\s*>', 'i').test(v.slice(s));
      if (closing && LC.settings.get('smartIndentTags')) { stair(); return; }
      ins('\n' + base + unit);
      return;
    }

    const before = v[s - 1];
    const after  = v[s];
    if (BR_OPEN[before]) {
      if (BR_OPEN[before] === after && LC.settings.get('smartIndentBraces')) { stair(); return; }
      ins('\n' + base + unit);
      return;
    }

    ins('\n' + base);
  }

  function justInsertedNewline() {
    const nv = ta.value, k = nv.length - prevV.length;
    if (k < 1) return false;
    let p = 0;
    while (p < prevV.length && prevV[p] === nv[p]) p++;
    return nv.slice(0, p) + nv.slice(p + k) === prevV && /^[ \t]*\n[ \t]*$/.test(nv.slice(p, p + k));
  }

  function fixPlainEnter() {
    const v = ta.value, s = ta.selectionStart;
    if (s !== ta.selectionEnd) return false;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    if (ls === 0 || /\S/.test(v.slice(ls, s))) return false;
    const ps   = ls - 1 > 0 ? v.lastIndexOf('\n', ls - 2) + 1 : 0;
    const prev = v.slice(ps, ls - 1);
    const rest = v.slice(s);
    const base = /^[ \t]*/.exec(prev)[0];
    let ok = false;
    const m = OPEN.exec(prev);
    if (m && !prev.endsWith('/>') && !VOID_RE.test(m[1].toLowerCase()) &&
        new RegExp('^</' + m[1] + '\\s*>', 'i').test(rest)) {
      ok = !!LC.settings.get('smartIndentTags');
    } else {
      const last = prev.trimEnd().slice(-1);
      if (BR_OPEN[last] && rest[0] === BR_OPEN[last]) ok = !!LC.settings.get('smartIndentBraces');
    }
    if (!ok || !LC.settings.get('autoIndent')) return false;
    ta.setSelectionRange(ls, s);
    ins(base + IND + '\n' + base);
    const c = ls + base.length + IND.length;
    ta.setSelectionRange(c, c);
    return true;
  }

  function closeTag() {
    if (!LC.settings.get('autoCloseTags')) return;

    const v    = ta.value;
    const s    = ta.selectionStart;
    const line = lineB(v, s);
    const m    = OPEN.exec(line);

    if (!m) return;
    if (line.endsWith('/>')) return;
    if (VOID_RE.test(m[1].toLowerCase())) return;
    if (v.slice(s).startsWith('</' + m[1])) return;

    ins('</' + m[1] + '>');
    ta.setSelectionRange(s, s);
  }

  function rename() {
    if (!LC.settings.get('autoRenameTags')) return;

    const v = ta.value;
    const p = ta.selectionStart;
    const m = /<([A-Za-z][\w-]*)$/.exec(v.slice(Math.max(0, p - 60), p));
    if (!m) return;

    const st  = p - m[1].length;
    const nn  = m[1] + /^[\w-]*/.exec(v.slice(p))[0];
    const op  = prevV.slice(st);
    const old = /^[\w-]*/.exec(op)[0];

    if (!old || old === nn || prevV[st - 1] !== '<') return;
    if (!/^[^<>]*>/.test(op.slice(old.length))) return;

    const re = new RegExp('<(/?)' + old + '(?=[\\s>/])', 'g');
    re.lastIndex = st + nn.length;
    let dep = 1, x;

    while ((x = re.exec(v))) {
      x[1] ? dep-- : dep++;
      if (!dep) {
        const a = x.index + 2;
        ta.setSelectionRange(a, a + old.length);
        ins(nn);
        ta.setSelectionRange(p, p);
        return;
      }
    }
  }

  function tabKey(shift) {
    const v = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;

    if ((s !== e && v.slice(s, e).includes('\n')) || shift) {
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      let le = v.indexOf('\n', e);
      if (le < 0) le = v.length;

      const sz = IND.length;
      const r = v.slice(ls, le).split('\n').map((l) =>
        shift ? l.replace(new RegExp('^ {1,' + sz + '}'), '') : IND + l
      ).join('\n');

      ta.setSelectionRange(ls, le);
      ins(r);
      ta.setSelectionRange(ls, ls + r.length);
      return;
    }

    const exp = (LC.emmet && LC.settings.get('emmetOnTab')) ? LC.emmet.expand(v, s) : null;
    if (exp) {
      ta.setSelectionRange(exp.start, s);
      ins(exp.text);
      if (exp.cursor != null) ta.setSelectionRange(exp.cursor, exp.cursor);
      return;
    }

    ins(IND);
  }

  function onBeforeInput(e) {
    if (inserting) return;

    const t = e.inputType;
    const s = ta.selectionStart;
    const v = ta.value;
    pre = { v: v, s: s, e: ta.selectionEnd };

    if (t === 'insertLineBreak' || t === 'insertParagraph' ||
        (t === 'insertText' && e.data === '\n')) {
      if (e.cancelable) {
        e.preventDefault();
        pre = null;
        smartEnter();
      }
      return;
    }

    if (s !== ta.selectionEnd) return;

    const d = e.data;
    const skip = d && (
      (')]}"\'`'.includes(d) && LC.settings.get('skipOverClosing')) ||
      (d === ';' && cssBlock(v, s) && LC.settings.get('cssSkipSemicolon'))
    );

    if (t === 'insertText' && skip && v[s] === d) {
      e.preventDefault();
      ta.setSelectionRange(s + 1, s + 1);
      return;
    }

    if (t === 'deleteContentBackward' && PAIRS[v[s - 1]] === v[s]) {
      e.preventDefault();
      ta.setSelectionRange(s - 1, s + 1);
      document.execCommand('delete');
    }
  }

  function onInput(e) {
    if (busy || inserting) {
      prevV = ta.value;
      render();
      schedulePreview();
      return;
    }
    if (pre && pre.s === pre.e) {
      const nv = ta.value, p = ta.selectionStart, q = pre.s;
      if (nv.length === pre.v.length + 1 && nv[q] === '\n' && p === q + 1 &&
          nv.slice(0, q) === pre.v.slice(0, q) && nv.slice(q + 1) === pre.v.slice(q)) {
        pre = null;
        busy = true;
        try {
          ta.setRangeText('', q, q + 1, 'end');
          smartEnter();
        } finally { busy = false; }
        prevV = ta.value;
        render();
        schedulePreview();
        return;
      }
    }
    if (justInsertedNewline()) {
      busy = true;
      let fixed = false;
      try { fixed = fixPlainEnter(); } finally { busy = false; }
      if (fixed) {
        pre = null;
        prevV = ta.value;
        render();
        schedulePreview();
        return;
      }
    }
    busy = true;
    try {
      const d = e.data;
      const v = ta.value;
      const s = ta.selectionStart;

      if (e.inputType === 'insertText' && d && d.length === 1) {
        if (d === ':' &&
            cssBlock(v, s) &&
            LC.settings.get('cssAutoSemicolon') &&
            /^\s*[\w-]+:$/.test(lineB(v, s)) &&
            (!v[s] || '\n}'.includes(v[s]))) {
          ins(';');
          ta.setSelectionRange(s, s);
        }
        else if (PAIRS[d] &&
                 LC.settings.get(/["'`]/.test(d) ? 'autoCloseQuotes' : 'autoCloseBrackets') &&
                 !(/["'`]/.test(d) && /\w/.test(v[s - 2] || '')) &&
                 !/\w/.test(v[s] || '')) {
          ins(PAIRS[d]);
          ta.setSelectionRange(s, s);
        }
        else if (d === '>') {
          closeTag();
        }
      }

      rename();
    } finally {
      busy = false;
    }
    pre = null;
    prevV = ta.value;
    render();
    schedulePreview();
  }

  function onKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      tabKey(e.shiftKey);
      return;
    }
    if ((e.key === 'Enter' || e.keyCode === 13) && !e.ctrlKey && !e.metaKey && !e.isComposing) {
      e.preventDefault();
      smartEnter();
      return;
    }
  }

  /* =========================================================
     file actions
     ========================================================= */

  function updateLang() {
    LC.state.lang = LC.langOf(LC.state.fname);
    LC.store.set('fname', LC.state.fname);
    LC.emit('file:changed', LC.state.fname);
  }

  async function openFile() {
    const inp = LC.$('hidden-file');
    inp.accept = '.html,.htm,.css,.js,.json,.md,.txt,text/*';
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      LC.state.fname = f.name;
      updateLang();
      const t = await f.text();
      inp.value = '';
      setText(t);
    };
    inp.click();
  }

  function newFile() {
    LC.prompt('File name', 'index.html').then((n) => {
      if (!n) return;
      LC.state.fname = n;
      updateLang();
      setText('');
    });
  }

  function saveFile() {
    if (LC.format) LC.format.beforeSave();
    const blob = new Blob([ta.value], { type: 'text/plain' });
    const name = LC.state.fname;

    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({ suggestedName: name })
        .then((h) => h.createWritable())
        .then((w) => w.write(blob).then(() => w.close()))
        .then(() => LC.toast('Saved ✓'))
        .catch(() => {});
      return;
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    LC.toast('Saved ✓');
  }

  function saveFileAs() {
    LC.prompt('File name', LC.state.fname).then((n) => {
      if (!n) return;
      LC.state.fname = n;
      updateLang();
      saveFile();
    });
  }

  function setText(t) {
    ta.value = t;
    prevV = t;
    LC.state.code = t;
    LC.store.set('code', t);
    render();
    LC.emit('editor:changed', t);
    schedulePreview(true);
  }

  let previewTimer = null;
  function schedulePreview(force) {
    if (!LC.preview) return;
    if (!LC.settings.get('autoRefresh') && !force) return;

    clearTimeout(previewTimer);
    const delay = force ? 0 : LC.settings.get('refreshDelay');
    previewTimer = setTimeout(() => {
      LC.preview.update(ta.value);
    }, delay);
  }

  /* =========================================================
     wire everything
     ========================================================= */

  LC.editor = {
    init() {
      ed = LC.$('ed');
      ta = LC.$('ta');
      hl = LC.$('hl');

      updateLang();
      IND = LC.settings.indentUnit();

      LC.on('settings:set', (e) => {
        if (e.name === 'indentSize' || e.name === 'indentWithTabs') {
          IND = LC.settings.indentUnit();
          render();
        }
        if (e.name === 'fontSize' || e.name === 'highlightActiveLine') render();
      });

      const initial = LC.store.get('code', '');
      ta.value = initial || defaultSample();
      prevV = ta.value;
      LC.state.code = ta.value;

      ta.addEventListener('scroll', syncScroll);
      document.addEventListener('selectionchange', () => {
        if (document.activeElement === ta) markLine();
      });

      let fsv = LC.settings.get('fontSize'), pd = 0;
      LC.on('settings:set', (ev) => {
        if (ev.name === 'fontSize' && Math.abs(ev.value - fsv) > 0.6) fsv = ev.value;
      });
      ta.addEventListener('touchmove', (ev) => {
        if (ev.touches.length !== 2) { pd = 0; return; }
        ev.preventDefault();
        const a = ev.touches[0], b = ev.touches[1];
        const d = Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
        if (pd) {
          fsv = Math.min(32, Math.max(8, fsv * d / pd));
          LC.settings.set('fontSize', Math.round(fsv * 2) / 2);
        }
        pd = d;
      }, { passive: false });
      ta.addEventListener('touchend', () => { pd = 0; });
      ta.addEventListener('beforeinput', onBeforeInput);
      ta.addEventListener('input', onInput);
      ta.addEventListener('keydown', onKeydown);

      render();
      setTimeout(() => { LC.preview && LC.preview.update(ta.value); }, 30);
    },

    openFile, newFile, saveFile, saveFileAs,
    getText:   () => ta.value,
    setText:   (t) => setText(t),
    focus:     () => ta.focus(),
    get node() { return ta; },
    render,
    schedulePreview,

    /* replace the current selection (or insert at cursor) while keeping undo.
       Used by the formatter to swap the whole document in place. */
    replaceSelection(text) {
      if (!ta) return;
      const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      const want = v.slice(0, s) + text + v.slice(e);
      let ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch (_) {}
      if (!ok || ta.value !== want) {
        /* fallback: write directly */
        ta.value = want;
        const c = s + text.length;
        ta.setSelectionRange(c, c);
      }
      prevV = ta.value;
      LC.state.code = ta.value;
      LC.store.set('code', ta.value);
      render();
      LC.emit('editor:changed', ta.value);
      schedulePreview(true);
    }
  };

  function defaultSample() {
    return [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>Document</title>',
      '  <style>',
      '    body { font-family: sans-serif; padding: 16px; }',
      '    h1 { color: #0a84ff; }',
      '  </style>',
      '</head>',
      '<body>',
      '  <h1>Hello World</h1>',
      '  <p>Edit me. The preview updates live.</p>',
      '</body>',
      '</html>',
      ''
    ].join('\n');
  }

})();