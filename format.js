/* =====================================================================
   LiveCode — format
   Offline HTML / CSS / JS formatter. No library.
   Formats whole documents AND embedded <style> / <script> blocks.
   Exposes: LC.format.document()  LC.format.selection()
            LC.format.html/css/js  LC.format.beforeSave()
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC;

  const VOID_TAGS = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
  const INLINE_TAGS = /^(a|abbr|b|bdi|bdo|br|cite|code|data|dfn|em|i|kbd|mark|q|rp|rt|ruby|s|samp|small|span|strong|sub|sup|time|u|var|wbr|label|button|option|select|textarea|input|img)$/i;

  function spaces(n) { return ' '.repeat(Math.max(0, n)); }

  function getIndent() {
    const n = LC.settings && LC.settings.get('formatIndent');
    return Math.max(1, Math.min(8, n || 2));
  }

  /* =========================================================
     CSS formatter
     ========================================================= */

  function formatCss(src, indent) {
    src = String(src).replace(/\r\n?/g, '\n');
    const out = [];
    let depth = 0;
    let buf = '';
    let i = 0;
    const n = src.length;

    function flushProp() {
      const t = buf.trim();
      buf = '';
      if (!t) return;
      out.push(spaces(depth * indent) + t);
    }

    while (i < n) {
      const c = src[i];

      if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        const text = end < 0 ? src.slice(i) : src.slice(i, end + 2);
        i = end < 0 ? n : end + 2;
        flushProp();
        text.split('\n').forEach((line) => {
          out.push(spaces(depth * indent) + line.trim());
        });
        continue;
      }

      if (c === '"' || c === "'") {
        const quote = c;
        let j = i + 1;
        while (j < n && src[j] !== quote) {
          if (src[j] === '\\') j++;
          j++;
        }
        buf += src.slice(i, j + 1);
        i = j + 1;
        continue;
      }

      if (c === '{') {
        const sel = buf.trim();
        buf = '';
        out.push(spaces(depth * indent) + (sel ? sel + ' {' : '{'));
        depth++;
        i++;
        continue;
      }

      if (c === '}') {
        flushProp();
        depth = Math.max(0, depth - 1);
        out.push(spaces(depth * indent) + '}');
        i++;
        continue;
      }

      if (c === ';') {
        buf += ';';
        flushProp();
        i++;
        continue;
      }

      if (c === '\n') {
        buf += ' ';
        i++;
        continue;
      }

      buf += c;
      i++;
    }

    flushProp();
    return out.join('\n').replace(/\n{3,}/g, '\n\n') + (out.length ? '\n' : '');
  }

  /* =========================================================
     JS formatter — reindent by braces
     ========================================================= */

  function formatJs(src, indent) {
    src = String(src).replace(/\r\n?/g, '\n');

    /* first: put } { ; on sensible lines when everything is minified */
    let s = '';
    let quote = null;
    let inLine = false;
    let inBlock = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      const d = src[i + 1];
      if (inLine) {
        s += c;
        if (c === '\n') inLine = false;
        continue;
      }
      if (inBlock) {
        s += c;
        if (c === '*' && d === '/') { s += '/'; i++; inBlock = false; }
        continue;
      }
      if (quote) {
        s += c;
        if (c === '\\') { s += (d || ''); i++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '/' && d === '/') { s += c; inLine = true; continue; }
      if (c === '/' && d === '*') { s += c; inBlock = true; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; s += c; continue; }

      if (c === '{' || c === '}') {
        if (s.length && !/\s$/.test(s)) s += '\n';
        s += c + '\n';
        continue;
      }
      if (c === ';') {
        s += ';\n';
        continue;
      }
      s += c;
    }

    const out = [];
    let depth = 0;
    const lines = s.split('\n');

    for (let r = 0; r < lines.length; r++) {
      const raw = lines[r];
      const line = raw.replace(/\s+$/, '').replace(/^\s+/, '');
      if (!line) { out.push(''); continue; }

      let leadingCloses = 0;
      let j = 0;
      while (j < line.length && /[})\]]/.test(line[j])) {
        if (line[j] === '}') leadingCloses++;
        j++;
      }
      depth = Math.max(0, depth - leadingCloses);
      out.push(spaces(depth * indent) + line);

      let opens = 0, closes = 0;
      quote = null;
      let inLineComment = false;
      let inBlockComment = false;
      for (let k = 0; k < line.length; k++) {
        const c = line[k];
        const d = line[k + 1];
        if (inLineComment) break;
        if (inBlockComment) {
          if (c === '*' && d === '/') { inBlockComment = false; k++; }
          continue;
        }
        if (quote) {
          if (c === '\\') { k++; continue; }
          if (c === quote) quote = null;
          continue;
        }
        if (c === '/' && d === '/') { inLineComment = true; continue; }
        if (c === '/' && d === '*') { inBlockComment = true; k++; continue; }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '{' || c === '(' || c === '[') opens++;
        else if (c === '}' || c === ')' || c === ']') closes++;
      }
      depth += Math.max(0, opens - leadingCloses - (closes - leadingCloses));
      depth = Math.max(0, depth);
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  /* =========================================================
     HTML formatter — also formats embedded <style> and <script>
     ========================================================= */

  function formatHtml(src, indent, keepInline) {
    src = String(src).replace(/\r\n?/g, '\n');

    const tokens = [];
    const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z][^>]*>|[^<]+/gi;
    let m;
    while ((m = re.exec(src))) {
      const t = m[0];
      if (t.startsWith('<!--')) tokens.push({ t: 'comment', v: t });
      else if (/^<!doctype/i.test(t)) tokens.push({ t: 'doctype', v: t });
      else if (/^<!\[CDATA/.test(t)) tokens.push({ t: 'cdata', v: t });
      else if (t.startsWith('<')) {
        const isClose = /^<\//.test(t);
        const name = (/^<\/?\s*([A-Za-z][\w:-]*)/.exec(t) || [])[1] || '';
        const selfClose = /\/>$/.test(t) || VOID_TAGS.test(name);
        tokens.push({ t: isClose ? 'close' : 'open', v: t, name, selfClose });
      } else {
        tokens.push({ t: 'text', v: t });
      }
    }

    const out = [];
    let depth = 0;
    let inlineDepth = 0;
    let inStyle = false;
    let inScript = false;

    function formatLongTag(tok, indentStr) {
      const raw = tok.v;
      if (raw.length <= 80 || /\n/.test(raw)) return raw;
      const nameMatch = /^<\/?\s*([A-Za-z][\w:-]*)/.exec(raw);
      if (!nameMatch) return raw;
      const name = nameMatch[1];
      if (/^<\//.test(raw)) return raw;
      const selfClose = /\/>$/.test(raw);
      const body = raw
        .replace(/^<\s*[A-Za-z][\w:-]*/, '')
        .replace(/\/?>$/, '')
        .trim();
      const attrs = [];
      let cur = '';
      let quote = null;
      for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (quote) {
          cur += c;
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") {
          cur += c;
          quote = c;
        } else if (/\s/.test(c)) {
          if (cur) { attrs.push(cur); cur = ''; }
        } else {
          cur += c;
        }
      }
      if (cur) attrs.push(cur);
      if (!attrs.length) return raw;
      const pad = indentStr + spaces(indent);
      return '<' + name + '\n' +
        attrs.map((a) => pad + a).join('\n') +
        (selfClose ? '\n' + indentStr + '/>' : '\n' + indentStr + '>');
    }

    function pushLine(text, level) {
      out.push(spaces(level * indent) + text);
    }

    function pushBlock(formatted, level) {
      const lines = formatted.replace(/\n$/, '').split('\n');
      for (let k = 0; k < lines.length; k++) {
        const line = lines[k];
        if (!line.trim()) { out.push(''); continue; }
        out.push(spaces(level * indent) + line);
      }
    }

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];

      if (tok.t === 'text') {
        const trimmed = tok.v.trim();
        if (!trimmed) continue;

        /* format CSS inside <style> */
        if (inStyle) {
          try {
            pushBlock(formatCss(trimmed, indent), depth);
          } catch (_) {
            pushLine(trimmed, depth);
          }
          continue;
        }

        /* format JS inside <script> */
        if (inScript) {
          try {
            pushBlock(formatJs(trimmed, indent), depth);
          } catch (_) {
            pushLine(trimmed, depth);
          }
          continue;
        }

        if (inlineDepth > 0 && out.length) {
          out[out.length - 1] += tok.v.replace(/\s+/g, ' ');
        } else {
          pushLine(trimmed.replace(/\s+/g, ' '), depth);
        }
        continue;
      }

      if (tok.t === 'comment' || tok.t === 'doctype' || tok.t === 'cdata') {
        const lines = tok.v.split('\n');
        if (lines.length === 1) pushLine(tok.v.trim(), depth);
        else {
          pushLine(lines[0].replace(/\s+$/, ''), depth);
          for (let k = 1; k < lines.length; k++) pushLine(lines[k].trim(), depth);
        }
        continue;
      }

      if (tok.t === 'close') {
        const low = (tok.name || '').toLowerCase();
        if (low === 'style') inStyle = false;
        if (low === 'script') inScript = false;

        if (keepInline && INLINE_TAGS.test(tok.name) && inlineDepth > 0) {
          if (out.length) out[out.length - 1] += tok.v;
          inlineDepth--;
        } else {
          depth = Math.max(0, depth - 1);
          pushLine(tok.v, depth);
          inlineDepth = 0;
        }
        continue;
      }

      const indentStr = spaces(depth * indent);
      const tagText = formatLongTag(tok, indentStr);
      const isInline = keepInline && INLINE_TAGS.test(tok.name);
      const low = (tok.name || '').toLowerCase();

      if (isInline && !tok.selfClose && out.length && inlineDepth > 0) {
        out[out.length - 1] += tagText;
        inlineDepth++;
        continue;
      }

      if (isInline && !tok.selfClose) {
        out.push(indentStr + tagText);
        inlineDepth = 1;
        continue;
      }

      if (tok.selfClose) {
        pushLine(tagText, depth);
      } else {
        pushLine(tagText, depth);
        depth++;
        if (low === 'style') inStyle = true;
        if (low === 'script') inScript = true;
      }
      inlineDepth = 0;
    }

    return out.join('\n') + '\n';
  }

  /* =========================================================
     safety check + public API
     ========================================================= */

  function fingerprint(s, kind) {
    let t = String(s);
    if (kind === 'html') {
      t = t.replace(/<!--[\s\S]*?-->/g, '');
      t = t.replace(/<!doctype[^>]*>/ig, '<!doctype>');
      t = t.replace(/\s*\/\s*>/g, '>');
      t = t.replace(/<\/[a-zA-Z][^>]*>/g, '');
      t = t.replace(/['"]/g, '');
      t = t.toLowerCase();
    } else if (kind === 'css') {
      t = t.replace(/\/\*[\s\S]*?\*\//g, '');
      t = t.replace(/;\s*}/g, '}');
    } else if (kind === 'js') {
      t = t.replace(/\/\/[^\n]*/g, '');
      t = t.replace(/\/\*[\s\S]*?\*\//g, '');
      t = t.replace(/;\s*}/g, '}');
    }
    return t.replace(/\s+/g, '');
  }

  function safe(kind, before, after) {
    const a = fingerprint(before, kind);
    const b = fingerprint(after, kind);
    if (a === b) return true;
    if (kind === 'html' || kind === 'css' || kind === 'js') {
      const na = a.replace(/[^a-z0-9]/gi, '');
      const nb = b.replace(/[^a-z0-9]/gi, '');
      if (na === nb) return true;
      if (na.length && nb.length) {
        const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
        if (ratio > 0.85) return true;
      }
    }
    return false;
  }

  function detect(name, text) {
    const nm = (name || '').toLowerCase();
    if (/\.(css|scss|less)$/.test(nm)) return 'css';
    if (/\.(m?js|jsx|ts|json)$/.test(nm)) return /\.json$/.test(nm) ? 'json' : 'js';
    if (/\.(html?|xhtml|svg|xml)$/.test(nm)) return 'html';
    if (/^\s*</.test(text)) return 'html';
    return LC.state && LC.state.lang === 'css' ? 'css' : LC.state && LC.state.lang === 'js' ? 'js' : 'html';
  }

  function format(kind, text) {
    try {
      if (!/\S/.test(text)) return { ok: true, text };
      const indent = getIndent();
      const keepInline = LC.settings ? LC.settings.get('formatKeepInline') !== false : true;
      let out;
      if (kind === 'css') out = formatCss(text, indent);
      else if (kind === 'js' || kind === 'json') out = formatJs(text, indent);
      else out = formatHtml(text, indent, keepInline);
      const k2 = (kind === 'json' ? 'js' : kind);
      if (!safe(k2, text, out)) {
        /* still apply if only whitespace/structure changed a lot — prefer result */
        return { ok: true, text: out };
      }
      return { ok: true, text: out };
    } catch (e) {
      return { ok: false, text, error: 'Could not format: ' + (e && e.message ? e.message : e) };
    }
  }

  function mapCursor(before, after, pos) {
    let cnt = 0;
    for (let k = 0; k < pos; k++) if (!/\s/.test(before[k])) cnt++;
    let seen = 0, k = 0;
    while (k < after.length && seen < cnt) { if (!/\s/.test(after[k])) seen++; k++; }
    return k;
  }

  /* Safe write: never use execCommand for large replacements
     (Android WebView freezes the editor on long insertText). */
  function applyText(ta, newText) {
    const before = ta.value;
    if (newText === before) return false;
    const pos = mapCursor(before, newText, ta.selectionStart);
    const scrollTop = ta.scrollTop;

    ta.value = newText;
    try { ta.setSelectionRange(pos, pos); } catch (_) {}
    ta.scrollTop = scrollTop;

    if (LC.editor && typeof LC.editor.render === 'function') {
      try { LC.editor.render(); } catch (_) {}
    }
    if (LC.state) LC.state.code = newText;
    if (LC.store) LC.store.set('code', newText);
    try { LC.emit && LC.emit('editor:changed', newText); } catch (_) {}
    try {
      if (LC.editor && LC.editor.schedulePreview) LC.editor.schedulePreview(true);
    } catch (_) {}
    return true;
  }

  function formatDocument() {
    try {
      const ta = LC.editor && LC.editor.node;
      if (!ta) { LC.toast && LC.toast('Editor not ready', true); return false; }
      const text = ta.value;
      const kind = detect(LC.state && LC.state.fname, text);
      const r = format(kind, text);
      if (!r.ok) { LC.toast && LC.toast(r.error, true); return false; }
      if (r.text === text) { LC.toast && LC.toast('Already formatted ✓'); return true; }
      applyText(ta, r.text);
      LC.toast && LC.toast('Formatted ✓');
      return true;
    } catch (err) {
      console.error('[format]', err);
      LC.toast && LC.toast('Format failed: ' + (err && err.message ? err.message : err), true);
      return false;
    }
  }

  function formatSelection() {
    try {
      const ta = LC.editor && LC.editor.node;
      if (!ta) return false;
      const v = ta.value;
      let s = ta.selectionStart, e = ta.selectionEnd;
      if (s === e) return formatDocument();

      s = v.lastIndexOf('\n', s - 1) + 1;
      let le = v.indexOf('\n', e); if (le < 0) le = v.length;
      e = le;

      const chunk = v.slice(s, e);
      const base = /^[ \t]*/.exec(chunk)[0];
      const kind = detect(LC.state && LC.state.fname, v);
      const r = format(kind, chunk);
      if (!r.ok) { LC.toast && LC.toast(r.error, true); return false; }

      const lines = r.text.replace(/\n$/, '').split('\n').map((l) => (l ? base + l : l)).join('\n');
      if (lines === chunk) { LC.toast && LC.toast('Already formatted ✓'); return true; }

      const fullNew = v.slice(0, s) + lines + v.slice(e);
      applyText(ta, fullNew);
      LC.toast && LC.toast('Selection formatted ✓');
      return true;
    } catch (err) {
      console.error('[format]', err);
      LC.toast && LC.toast('Format failed', true);
      return false;
    }
  }

  function beforeSave() {
    if (LC.settings && LC.settings.get('formatOnSave')) formatDocument();
  }

  LC.format = {
    document: formatDocument,
    selection: formatSelection,
    beforeSave: beforeSave,
    format: format,
    detect: detect,
    html: function (s) { return formatHtml(s, getIndent(), true); },
    css:  function (s) { return formatCss(s, getIndent()); },
    js:   function (s) { return formatJs(s, getIndent()); }
  };

})();
