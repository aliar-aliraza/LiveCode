/* =====================================================================
   LiveCode — projects
   Real project storage in IndexedDB. Nested folders. Files of any
   type. Multi-file tabs. Upload images / audio / video / text.
   Preview reads files from the active project.
   Import / export as .zip.
   Nothing here touches the original single-file mode.
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC;
  const el = LC.el;

  /* =========================================================
     IndexedDB
     ========================================================= */

  const DB_NAME = 'livecode';
  const DB_VER  = 1;
  let db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('projects')) {
          d.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('files')) {
          const s = d.createObjectStore('files', { keyPath: 'id' });
          s.createIndex('byProject', 'projectId', { unique: false });
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror   = () => reject(req.error);
    });
  }

  function idb(storeName, mode) {
    return openDB().then((d) => d.transaction(storeName, mode).objectStore(storeName));
  }

  function idbReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* =========================================================
     state
     ========================================================= */

  const state = {
    projects: [],
    active:   null,
    openTabs: [],
    activeTab: null,
    clipboard: null
  };

  /* =========================================================
     project CRUD
     ========================================================= */

  async function listProjects() {
    const store = await idb('projects', 'readonly');
    return idbReq(store.getAll());
  }

  async function createProject(name) {
    const p = {
      id: uid(),
      name: name || 'new-project',
      created: Date.now()
    };
    const store = await idb('projects', 'readwrite');
    await idbReq(store.put(p));
    return p;
  }

  async function deleteProject(projectId) {
    const ps = await idb('projects', 'readwrite');
    await idbReq(ps.delete(projectId));
    const fs = await idb('files', 'readwrite');
    const idx = fs.index('byProject');
    const req = idx.openCursor(IDBKeyRange.only(projectId));
    await new Promise((resolve) => {
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) { cur.delete(); cur.continue(); }
        else resolve();
      };
      req.onerror = () => resolve();
    });
  }

  async function renameProject(projectId, newName) {
    const store = await idb('projects', 'readwrite');
    const p = await idbReq(store.get(projectId));
    if (!p) return;
    p.name = newName;
    await idbReq(store.put(p));
  }

  async function loadProject(projectId) {
    const ps = await idb('projects', 'readonly');
    const p  = await idbReq(ps.get(projectId));
    if (!p) return null;
    const fs = await idb('files', 'readonly');
    const idx = fs.index('byProject');
    const files = await idbReq(idx.getAll(IDBKeyRange.only(projectId)));
    return Object.assign({}, p, { files: files || [] });
  }

  /* =========================================================
     file CRUD
     ========================================================= */

  async function putFile(file) {
    const store = await idb('files', 'readwrite');
    await idbReq(store.put(file));
  }

  async function deleteFile(fileId) {
    const store = await idb('files', 'readwrite');
    await idbReq(store.delete(fileId));
  }

  async function getFile(fileId) {
    const store = await idb('files', 'readonly');
    return idbReq(store.get(fileId));
  }

  function pathJoin(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a.replace(/\/+$/, '') + '/' + b.replace(/^\/+/, '');
  }

  async function createFile(projectId, folderPath, name, content, mime) {
    const file = {
      id: uid(),
      projectId,
      path: folderPath || '',
      name,
      type: mime || guessMime(name),
      content: content == null ? '' : content,
      created: Date.now()
    };
    await putFile(file);
    return file;
  }

  async function createFolder(projectId, folderPath) {
    const marker = {
      id: uid(),
      projectId,
      path: folderPath,
      name: '.folder',
      type: 'application/x-folder',
      content: '',
      created: Date.now()
    };
    await putFile(marker);
    return marker;
  }

  async function renameFile(fileId, newName) {
    const f = await getFile(fileId);
    if (!f) return;
    f.name = newName;
    f.type = guessMime(newName);
    await putFile(f);
  }

  async function moveFile(fileId, newFolderPath) {
    const f = await getFile(fileId);
    if (!f) return;
    f.path = newFolderPath || '';
    await putFile(f);
  }

  /* =========================================================
     mime / icon helpers
     ========================================================= */

  function guessMime(name) {
    const n = name.toLowerCase();
    if (n.endsWith('.html') || n.endsWith('.htm')) return 'text/html';
    if (n.endsWith('.css'))  return 'text/css';
    if (n.endsWith('.js'))   return 'text/javascript';
    if (n.endsWith('.json')) return 'application/json';
    if (n.endsWith('.md'))   return 'text/markdown';
    if (n.endsWith('.txt'))  return 'text/plain';
    if (n.endsWith('.png'))  return 'image/png';
    if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
    if (n.endsWith('.gif'))  return 'image/gif';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.svg'))  return 'image/svg+xml';
    if (n.endsWith('.mp3'))  return 'audio/mpeg';
    if (n.endsWith('.wav'))  return 'audio/wav';
    if (n.endsWith('.mp4'))  return 'video/mp4';
    if (n.endsWith('.webm')) return 'video/webm';
    return 'application/octet-stream';
  }

  function isText(mime, name) {
    if (/^text\//.test(mime)) return true;
    if (/json|javascript|xml|markdown/.test(mime)) return true;
    if (/\.(html?|css|js|mjs|json|md|txt|svg|xml|yml|yaml)$/i.test(name)) return true;
    return false;
  }

  function iconFor(name, type) {
    if (type === 'application/x-folder') return '📁';
    const n = name.toLowerCase();
    if (n.endsWith('.html') || n.endsWith('.htm')) return '🌐';
    if (n.endsWith('.css'))  return '🎨';
    if (n.endsWith('.js'))   return '📜';
    if (n.endsWith('.json')) return '⚙';
    if (n.endsWith('.md'))   return '📘';
    if (n.endsWith('.txt'))  return '📄';
    if (/^image\//.test(type)) return '🖼';
    if (/^audio\//.test(type)) return '🎵';
    if (/^video\//.test(type)) return '🎬';
    return '📄';
  }

  /* =========================================================
     tree builder
     ========================================================= */

  function buildTree(files) {
    const root = { name: '', path: '', children: {}, isFolder: true };
    const folderMarkers = [];

    for (const f of files) {
      if (f.type === 'application/x-folder' || f.name === '.folder') {
        const full = pathJoin(f.path, '').replace(/\/$/, '');
        folderMarkers.push(full);
      }
    }

    function ensureFolder(pathStr) {
      if (!pathStr) return root;
      const parts = pathStr.split('/').filter(Boolean);
      let node = root;
      let acc = '';
      for (const part of parts) {
        acc = pathJoin(acc, part);
        if (!node.children[part]) {
          node.children[part] = {
            name: part,
            path: acc,
            children: {},
            isFolder: true
          };
        }
        node = node.children[part];
      }
      return node;
    }

    for (const marker of folderMarkers) ensureFolder(marker);

    for (const f of files) {
      if (f.type === 'application/x-folder' || f.name === '.folder') continue;
      const folder = ensureFolder(f.path);
      folder.children[f.name] = {
        name: f.name,
        path: pathJoin(f.path, f.name),
        file: f,
        isFolder: false
      };
    }

    return root;
  }

  /* =========================================================
     tree rows
     ========================================================= */

  function makeRow(node, depth) {
    const r = el('div', {
      class: 'prow',
      style: { paddingLeft: (10 + depth * 14) + 'px' }
    });

    const icon = el('span', {
      style: { width: '18px', flex: '0 0 auto' },
      text: node.isFolder ? '📁' : iconFor(node.name, node.file.type)
    });

    const label = el('span', { class: 'lbl', text: node.name || '/' });
    r.append(icon, label);

    if (node.isFolder) {
      const up = el('span', { class: 'rowbtn', text: '⬆', title: 'Upload files into this folder' });
      up.addEventListener('pointerdown', (e) => e.stopPropagation());
      up.addEventListener('click', (e) => { e.stopPropagation(); uploadFiles(node.path); });
      r.append(up);
    }
    const more = el('span', { class: 'rowbtn', text: '⋮', title: 'More' });
    more.addEventListener('pointerdown', (e) => e.stopPropagation());
    more.addEventListener('click', (e) => { e.stopPropagation(); openContext(node, r); });
    r.append(more);

    if (node.isFolder) {
      r.addEventListener('click', () => toggleFolder(r));
    } else {
      r.addEventListener('click', () => openFileInTab(node.file));
      if (state.activeTab === node.file.id) r.classList.add('active-tab');
    }

    r.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContext(node, r);
    });
    let longT = null;
    r.addEventListener('pointerdown', () => {
      longT = setTimeout(() => openContext(node, r), 550);
    });
    r.addEventListener('pointerup',    () => clearTimeout(longT));
    r.addEventListener('pointerleave', () => clearTimeout(longT));

    return r;
  }

  function toggleFolder(row) {
    const d = Number(row.dataset.depth);
    let nxt = row.nextElementSibling;
    const hidden = row.dataset.collapsed === '1';

    while (nxt && nxt.dataset.depth && Number(nxt.dataset.depth) > d) {
      if (nxt.dataset.parent && Number(nxt.dataset.parent) <= d) break;
      if (hidden) nxt.style.display = '';
      else        nxt.style.display = 'none';
      nxt = nxt.nextElementSibling;
    }
    row.dataset.collapsed = hidden ? '' : '1';
  }

  function renderTree(panel, container) {
    container.textContent = '';
    const tree = buildTree(state.active.files);

    function walk(node, depth) {
      const keys = Object.keys(node.children).sort((a, b) => {
        const A = node.children[a], B = node.children[b];
        if (A.isFolder !== B.isFolder) return A.isFolder ? -1 : 1;
        return a.localeCompare(b);
      });
      for (const k of keys) {
        const child = node.children[k];
        const row = makeRow(child, depth);
        row.dataset.depth = depth;
        row.dataset.path = child.path;
        container.append(row);
        if (child.isFolder) walk(child, depth + 1);
      }
    }

    walk(tree, 0);

    if (!container.children.length) {
      container.append(el('div', {
        class: 'pgroup-title',
        text: 'Empty project — long-press here to add files'
      }));
    }
  }

  /* =========================================================
     context menu
     ========================================================= */

  function openContext(node, anchorRow) {
    const p = LC.openPanel({
      id: 'ctx-' + node.path + '-' + Date.now(),
      title: node.name || '/',
      width: 240, height: 300
    });

    const isFolder = node.isFolder;
    const closeAll = () => p.close();
    const actions = [];

    if (isFolder) {
      actions.push(['New file',     async () => { closeAll(); await promptNewFile(node.path); }]);
      actions.push(['New folder',   async () => { closeAll(); await promptNewFolder(node.path); }]);
      actions.push(['Upload files', () => { closeAll(); uploadFiles(node.path); }]);
      actions.push(['Rename folder', async () => {
        closeAll();
        const n = await LC.prompt('New folder name', node.name);
        if (!n || n === node.name) return;
        const parent = node.path.split('/').slice(0, -1).join('/');
        const newPath = pathJoin(parent, n);
        for (const f of state.active.files) {
          if (f.path === node.path || f.path.startsWith(node.path + '/')) {
            f.path = f.path === node.path ? newPath : f.path.replace(node.path, newPath);
            await putFile(f);
          }
        }
        await refresh();
      }]);
      actions.push(['Delete folder', async () => {
        closeAll();
        if (!await LC.confirm('Delete "' + node.name + '" and everything inside?', 'Delete')) return;
        for (const f of state.active.files.slice()) {
          if (f.path === node.path || f.path.startsWith(node.path + '/')) {
            await deleteFile(f.id);
          }
        }
        await refresh();
      }]);
      if (state.clipboard) {
        actions.push(['Paste here', async () => { closeAll(); await pasteInto(node.path); }]);
      }
    } else {
      actions.push(['Open', () => { closeAll(); openFileInTab(node.file); }]);
      actions.push(['Rename', async () => {
        closeAll();
        const n = await LC.prompt('New file name', node.name);
        if (!n || n === node.name) return;
        await renameFile(node.file.id, n);
        await refresh();
      }]);
      actions.push(['Copy', () => { closeAll(); state.clipboard = { op: 'copy', fileIds: [node.file.id] }; }]);
      actions.push(['Cut',  () => { closeAll(); state.clipboard = { op: 'cut',  fileIds: [node.file.id] }; }]);
      actions.push(['Duplicate', async () => {
        closeAll();
        const f = await getFile(node.file.id);
        if (!f) return;
        const copy = Object.assign({}, f, {
          id: uid(),
          name: uniqueName(f.name, state.active.files)
        });
        delete copy.created;
        await putFile(copy);
        await refresh();
      }]);
      actions.push(['Delete', async () => {
        closeAll();
        if (LC.settings.get('confirmDelete') &&
            !await LC.confirm('Delete "' + node.name + '"?', 'Delete')) return;
        await deleteFile(node.file.id);
        state.openTabs = state.openTabs.filter((id) => id !== node.file.id);
        if (state.activeTab === node.file.id) state.activeTab = state.openTabs[0] || null;
        await refresh();
        LC.emit('tabs:changed');
      }]);
    }

    for (const pair of actions) {
      const label = pair[0], fn = pair[1];
      const r = el('div', { class: 'prow' }, [el('span', { class: 'lbl', text: label })]);
      r.addEventListener('click', fn);
      p.body.append(r);
    }
  }

  function uniqueName(base, files) {
    const dot = base.lastIndexOf('.');
    const stem = dot < 0 ? base : base.slice(0, dot);
    const ext  = dot < 0 ? ''   : base.slice(dot);
    const existing = new Set(files.map((f) => f.name));
    let i = 1;
    let candidate = base;
    while (existing.has(candidate)) {
      candidate = stem + ' ' + (++i) + ext;
    }
    return candidate;
  }

  /* =========================================================
     create / upload
     ========================================================= */

  async function promptNewFile(folderPath) {
    const n = await LC.prompt('File name', 'index.html');
    if (!n) return;
    const f = await createFile(state.active.id, folderPath, n, '');
    state.active.files.push(f);
    await refresh();
    openFileInTab(f);
  }

  async function promptNewFolder(folderPath) {
    const n = await LC.prompt('Folder name', 'new-folder');
    if (!n) return;
    const fullPath = folderPath ? folderPath + '/' + n : n;
    await createFolder(state.active.id, fullPath);
    await refresh();
  }

  function uploadFiles(folderPath) {
    if (!state.active) { LC.toast('Open or create a project first'); return; }
    const inp = LC.$('hidden-file');
    inp.accept = '*/*';
    inp.multiple = true;
    inp.onchange = async () => {
      const list = [...inp.files];
      inp.value = '';
      inp.multiple = false;
      let n = 0;
      for (const f of list) {
        const here = state.active.files.filter((x) => x.path === (folderPath || ''));
        const name = uniqueName(f.name, here);
        const mime = (f.type && f.type !== 'application/octet-stream') ? f.type : guessMime(name);
        const isT = isText(mime, name);
        let content = '', blob = null;
        if (isT) content = await f.text();
        else blob = new Blob([await f.arrayBuffer()], { type: mime });   /* real copy, correct type */
        const entry = {
          id: uid(), projectId: state.active.id, path: folderPath || '',
          name, type: mime, content, blob, created: Date.now()
        };
        await putFile(entry);
        state.active.files.push(entry);
        n++;
      }
      await refresh();
      if (n) LC.toast('Uploaded ' + n + ' file' + (n > 1 ? 's' : '') + (folderPath ? ' to ' + folderPath : ''));
    };
    inp.click();
  }

  /* =========================================================
     clipboard
     ========================================================= */

  async function pasteInto(folderPath) {
    if (!state.clipboard) return;
    const c = state.clipboard;
    for (const fid of c.fileIds) {
      const f = await getFile(fid);
      if (!f) continue;
      if (c.op === 'cut') {
        await moveFile(fid, folderPath);
      } else {
        const copy = Object.assign({}, f, {
          id: uid(),
          path: folderPath,
          name: uniqueName(f.name, state.active.files)
        });
        delete copy.created;
        await putFile(copy);
      }
    }
    if (c.op === 'cut') state.clipboard = null;
    await refresh();
  }

  /* =========================================================
     tabs
     ========================================================= */

  /* List of open files, shown in a small movable panel (button next to the menu button) */
  function renderTabs(container) {
    container.textContent = '';
    if (!state.active || !state.openTabs.length) {
      container.append(el('div', { class: 'pgroup-title', text: 'No open files. Open one from Project.' }));
      return;
    }

    for (const fid of state.openTabs) {
      const f = state.active.files.find((x) => x.id === fid);
      if (!f) continue;
      const active = state.activeTab === fid;
      const row = el('div', { class: 'prow' + (active ? ' active-file' : '') }, [
        el('span', { class: 'lbl', text: iconFor(f.name, f.type) + '  ' + f.name }),
        el('span', { class: 'tab-x', text: '×', title: 'Close file' })
      ]);
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-x')) {
          state.openTabs = state.openTabs.filter((x) => x !== fid);
          if (state.activeTab === fid) {
            state.activeTab = state.openTabs[0] || null;
            if (state.activeTab) loadIntoEditor(state.activeTab);
          }
          LC.emit('tabs:changed');
          return;
        }
        state.activeTab = fid;
        loadIntoEditor(fid);
        LC.emit('tabs:changed');
      });
      container.append(row);
    }
  }

  function openFilesPanel() {
    if (LC.isPanelOpen('openfiles')) { LC.closePanel('openfiles'); return; }
    const p = LC.openPanel({ id: 'openfiles', title: 'Open files', width: 240, height: 240, right: true });
    renderTabs(p.body);
  }

  async function openFileInTab(file) {
    if (!state.openTabs.includes(file.id)) state.openTabs.push(file.id);
    state.activeTab = file.id;
    await loadIntoEditor(file.id);
    LC.emit('tabs:changed');
  }

  async function loadIntoEditor(fileId) {
    await flush();
    LC.store.set('activeTab', fileId);
    const f = await getFile(fileId);
    if (!f) return;
    if (!isText(f.type, f.name)) return;
    LC.state.fname = f.name;
    LC.state.lang  = LC.langOf(f.name);
    LC.store.set('fname', f.name);
    LC.editor.setText(f.content || '');
    LC.emit('file:changed', f.name);
  }

  /* =========================================================
     auto-save back into project
     ========================================================= */

  function wireAutoSave() {}  /* replaced by queueSave / flush below */

  /* =========================================================
     zip export (stored, no compression — no library needed)
     ========================================================= */

  function crc32(bytes) {
    let c;
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
      }
      return t;
    })());
    c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  async function fileBytes(f) {
    if (f.blob) {
      const buf = await f.blob.arrayBuffer();
      return new Uint8Array(buf);
    }
    return new TextEncoder().encode(f.content || '');
  }

  async function exportZip() {
    if (!state.active) {
      await LC.confirm('No project open.', 'OK');
      return;
    }

    const files = state.active.files.filter((f) => f.name !== '.folder');
    const entries = [];

    for (const f of files) {
      const bytes = await fileBytes(f);
      const name  = pathJoin(f.path, f.name);
      entries.push({ name, bytes, crc: crc32(bytes) });
    }

    const chunks = [];
    const central = [];
    let offset = 0;

    for (const e of entries) {
      const nameBytes = new TextEncoder().encode(e.name);
      const local = [
        ...u32(0x04034b50),
        ...u16(20), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(e.crc), ...u32(e.bytes.length), ...u32(e.bytes.length),
        ...u16(nameBytes.length), ...u16(0),
        ...nameBytes
      ];
      chunks.push(new Uint8Array(local), e.bytes);

      const cen = [
        ...u32(0x02014b50),
        ...u16(20), ...u16(20), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(e.crc), ...u32(e.bytes.length), ...u32(e.bytes.length),
        ...u16(nameBytes.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0),
        ...u32(offset),
        ...nameBytes
      ];
      central.push(new Uint8Array(cen));
      offset += local.length + e.bytes.length;
    }

    const cenBytes = new Uint8Array(central.reduce((s, a) => s + a.length, 0));
    let p = 0;
    for (const c of central) { cenBytes.set(c, p); p += c.length; }

    const end = new Uint8Array([
      ...u32(0x06054b50),
      ...u16(0), ...u16(0),
      ...u16(entries.length), ...u16(entries.length),
      ...u32(cenBytes.length),
      ...u32(offset),
      ...u16(0)
    ]);

    const blob = new Blob([...chunks, cenBytes, end], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.active.name || 'project') + '.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* =========================================================
     zip import (stored entries only)
     ========================================================= */

  async function importZipFromFile(file) {
    const buf = new Uint8Array(await file.arrayBuffer());

    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
      if (buf[i] === 0x50 && buf[i + 1] === 0x4B && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
        eocd = i; break;
      }
    }
    if (eocd < 0) throw new Error('Not a zip file');

    const count = buf[eocd + 10] | (buf[eocd + 11] << 8);
    const cdOffset = buf[eocd + 16] | (buf[eocd + 17] << 8) |
                     (buf[eocd + 18] << 16) | (buf[eocd + 19] << 24);

    let p = cdOffset;
    const entries = [];
    for (let i = 0; i < count; i++) {
      const sig = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16) | (buf[p + 3] << 24);
      if (sig !== 0x02014b50) break;
      const method   = buf[p + 10] | (buf[p + 11] << 8);
      const crc      = buf[p + 16] | (buf[p + 17] << 8) | (buf[p + 18] << 16) | (buf[p + 19] << 24);
      const compSize = buf[p + 20] | (buf[p + 21] << 8) | (buf[p + 22] << 16) | (buf[p + 23] << 24);
      const nameLen  = buf[p + 28] | (buf[p + 29] << 8);
      const extraLen = buf[p + 30] | (buf[p + 31] << 8);
      const cmtLen   = buf[p + 32] | (buf[p + 33] << 8);
      const localOff = buf[p + 42] | (buf[p + 43] << 8) | (buf[p + 44] << 16) | (buf[p + 45] << 24);
      const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));

      const lhNameLen  = buf[localOff + 26] | (buf[localOff + 27] << 8);
      const lhExtraLen = buf[localOff + 28] | (buf[localOff + 29] << 8);
      const dataStart  = localOff + 30 + lhNameLen + lhExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);

      if (method !== 0) { p += 46 + nameLen + extraLen + cmtLen; continue; }

      entries.push({ name, data, crc, method });
      p += 46 + nameLen + extraLen + cmtLen;
    }

    if (!entries.length) {
      throw new Error('No stored entries (compressed zips are not supported)');
    }

    const baseName = file.name.replace(/\.zip$/i, '') || 'imported';
    const proj = await createProject(baseName);

    for (const e of entries) {
      if (e.name.endsWith('/')) {
        await createFolder(proj.id, e.name.replace(/\/$/, ''));
        continue;
      }
      const parts = e.name.split('/');
      const name  = parts.pop();
      const folder = parts.join('/');
      const mime = guessMime(name);
      const entry = {
        id: uid(),
        projectId: proj.id,
        path: folder,
        name,
        type: mime,
        content: '',
        blob: new Blob([e.data], { type: mime }),
        created: Date.now()
      };
      if (isText(mime, name)) {
        entry.content = new TextDecoder().decode(e.data);
        entry.blob = null;
      }
      await putFile(entry);
    }

    await loadActiveProject(proj.id);
    return proj;
  }

  function importZip() {
    const inp = LC.$('hidden-file');
    inp.accept = '.zip,application/zip';
    inp.multiple = false;
    inp.onchange = async () => {
      const f = inp.files[0];
      inp.value = '';
      if (!f) return;
      try {
        await importZipFromFile(f);
        LC.emit('projects:changed');
      } catch (err) {
        LC.confirm('Import failed: ' + err.message, 'OK');
      }
    };
    inp.click();
  }

  /* =========================================================
     active project lifecycle
     ========================================================= */

  async function loadActiveProject(projectId) {
    await flush();
    const p = await loadProject(projectId);
    if (!p) return;
    state.active = p;
    state.openTabs = [];
    state.activeTab = null;
    LC.store.set('activeProject', projectId);
    LC.emit('project:opened', p);
    LC.emit('tabs:changed');
    repaint();
  }

  async function refresh() {
    if (!state.active) return;
    await flush();
    state.active = await loadProject(state.active.id);
    LC.emit('project:refreshed', state.active);
    repaint();
  }

  /* =========================================================
     project panel
     ========================================================= */

  function buildPanel(p) {
    p.body.textContent = '';

    const actions = el('div', { class: 'btnrow' });
    const saveB      = el('button', { class: 'pbtn', text: '💾 Save' });
    const newProj    = el('button', { class: 'pbtn', text: 'New project' });
    const openProj   = el('button', { class: 'pbtn', text: 'Open' });
    const importZipB = el('button', { class: 'pbtn', text: 'Import zip' });
    const exportZipB = el('button', { class: 'pbtn', text: 'Export zip' });
    const newFileB   = el('button', { class: 'pbtn', text: 'New file' });
    const newFolderB = el('button', { class: 'pbtn', text: 'New folder' });
    const uploadB    = el('button', { class: 'pbtn', text: 'Upload files' });

    newProj.onclick = async () => {
      const n = await LC.prompt('Project name', 'my-project');
      if (!n) return;
      const proj = await createProject(n);
      await loadActiveProject(proj.id);
      LC.emit('projects:changed');
    };
    saveB.onclick = () => saveNow();
    openProj.onclick = () => openProjectsListPanel();
    importZipB.onclick = importZip;
    exportZipB.onclick = exportZip;
    newFileB.onclick   = () => state.active && promptNewFile('');
    newFolderB.onclick = () => state.active && promptNewFolder('');
    uploadB.onclick    = () => state.active && uploadFiles('');

    actions.append(saveB, newProj, openProj, importZipB, exportZipB,
                   newFileB, newFolderB, uploadB);
    p.body.append(actions);

    if (state.clipboard) {
      p.body.append(el('div', {
        class: 'pgroup-title',
        text: state.clipboard.op.toUpperCase() + ': ' + state.clipboard.fileIds.length +
              ' item(s) — paste with a folder right-click'
      }));
    }

    if (!state.active) {
      p.body.append(el('div', {
        class: 'pgroup-title',
        text: 'No project open. Create one above.'
      }));
      return;
    }

    p.body.append(el('div', { class: 'pgroup-title', text: state.active.name }));
    const tree = el('div', { class: 'tree' });
    p.body.append(tree);
    renderTree(p, tree);
  }

  function openProjectsListPanel() {
    const p = LC.openPanel({
      id: 'projects-list',
      title: 'Projects',
      width: 280, height: 360
    });
    p.body.textContent = '';

    listProjects().then((list) => {
      for (const proj of list) {
        const r = el('div', { class: 'prow' }, [
          el('span', { class: 'lbl', text: proj.name })
        ]);
        r.addEventListener('click', async () => {
          await loadActiveProject(proj.id);
          LC.emit('projects:changed');
          p.close();
        });
        const del = el('button', {
          class: 'pbtn', text: '×',
          style: { minWidth: '28px', padding: '2px 6px' }
        });
        del.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!await LC.confirm('Delete project "' + proj.name + '"?', 'Delete')) return;
          await deleteProject(proj.id);
          if (state.active && state.active.id === proj.id) {
            state.active = null;
            LC.emit('tabs:changed');
          }
          p.close();
          openProjectsListPanel();
        });
        r.append(del);
        p.body.append(r);
      }
      if (!list.length) {
        p.body.append(el('div', { class: 'pgroup-title', text: 'No projects yet' }));
      }
    });
  }

  /* =========================================================
     preview: connect the project's files to the live preview
     - css / js files are put inline
     - images, audio, video, fonts, json ... become blob: links
       (works in <img>, <audio>, <video>, <source>, poster, srcset,
        CSS url(...), and in JS strings like "pics/a.png")
     - always uses what is in the editor right now
     ========================================================= */

  const urlCache = new Map();

  function strHash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h;
  }

  function urlFor(f) {
    const type = (f.type && f.type !== 'application/octet-stream') ? f.type : guessMime(f.name);
    const key = f.id + ':' + type + ':' + (f.blob
      ? f.blob.size
      : (f.content || '').length + ':' + strHash(f.content || ''));
    let u = urlCache.get(key);
    if (u) return u;
    let b;
    if (f.blob) b = (f.blob.type === type) ? f.blob : f.blob.slice(0, f.blob.size, type);
    else        b = new Blob([f.content || ''], { type });
    u = URL.createObjectURL(b);
    urlCache.set(key, u);
    return u;
  }

  /* "pics/../a.png" relative to folder "site/css" -> "site/a.png" */
  function resolvePath(base, ref) {
    ref = String(ref).trim();
    if (!ref || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null;
    ref = ref.split('#')[0].split('?')[0];
    try { ref = decodeURIComponent(ref); } catch (_) {}
    const parts = ref.startsWith('/') ? [] : String(base || '').split('/').filter(Boolean);
    for (const seg of ref.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop(); else parts.push(seg);
    }
    return parts.join('/');
  }

  const MEDIA_RE = new RegExp(
    '(["\'`])([^"\'`\\n<>]*?\\.(?:png|jpe?g|gif|webp|svg|avif|ico|bmp|apng|mp3|wav|ogg|oga|m4a|aac|flac|opus|' +
    'mp4|m4v|webm|ogv|mov|woff2?|ttf|otf|json|txt|csv|pdf|vtt))\\1', 'gi');
  const URL_RE = /url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi;

  function buildPreviewHtml(text) {
    const a = state.active;
    if (!a) return text;
    const act = a.files.find((f) => f.id === state.activeTab);
    if (!act) return text;

    const files = a.files
      .filter((f) => f.type !== 'application/x-folder' && f.name !== '.folder')
      .map((f) => (f.id === act.id ? Object.assign({}, f, { content: text }) : f));

    const byPath = new Map();
    for (const f of files) byPath.set(pathJoin(f.path, f.name).toLowerCase(), f);
    const find = (base, ref) => {
      const p = resolvePath(base, ref);
      return p == null ? null : (byPath.get(p.toLowerCase()) || null);
    };

    const isH = (f) => /\.html?$/i.test(f.name);
    let main = files.find((f) => f.id === act.id && isH(f));
    if (main) state.lastHtml = main.id;
    else {
      main = files.find((f) => f.id === state.lastHtml && isH(f)) ||
             files.find((f) => !f.path && /^index\.html?$/i.test(f.name)) ||
             files.find((f) => f.path === act.path && isH(f)) ||
             files.find(isH);
    }
    if (!main) return text;

    const dir = main.path || '';
    const cssFix = (css, base) => css.replace(URL_RE, (m, q, ref) => {
      const f = find(base, ref);
      return f ? 'url(' + urlFor(f) + ')' : m;
    });
    const mediaFix = (s, base) => s.replace(MEDIA_RE, (m, q, ref) => {
      const f = find(base, ref);
      return f ? q + urlFor(f) + q : m;
    });

    let html = main.content || '';

    /* <link rel="stylesheet" href="..."> -> <style> */
    html = html.replace(/<link\b[^>]*>/gi, (tag) => {
      if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
      const m = /href\s*=\s*(["'])(.*?)\1/i.exec(tag);
      if (!m) return tag;
      const f = find(dir, m[2]);
      if (!f || f.blob) return tag;
      return '<style>' + cssFix(f.content || '', f.path) + '</style>';
    });

    /* <script src="..."></script> -> inline script */
    html = html.replace(/<script\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)>\s*<\/script>/gi,
      (m, a1, q, src, a2) => {
        const f = find(dir, src);
        if (!f || f.blob) return m;
        const js = mediaFix(f.content || '', dir).replace(/<\/script/gi, '<\\/script');
        return '<script' + a1 + a2 + '>' + js + '<\/script>';
      });

    /* srcset="a.png 1x, b.png 2x" */
    html = html.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, (m, q, v) =>
      'srcset=' + q + v.split(',').map((part) => {
        const t = part.trim().split(/\s+/);
        const f = find(dir, t[0]);
        if (f) t[0] = urlFor(f);
        return t.join(' ');
      }).join(', ') + q);

    html = cssFix(html, dir);      /* url(...) in <style> and style="" */
    html = mediaFix(html, dir);    /* src, poster, href, JS strings    */
    return html;
  }

  /* =========================================================
     save — editor text -> the project file
     ========================================================= */

  const inProject = () => !!(state.active && state.activeTab &&
    state.active.files.some((f) => f.id === state.activeTab));

  let pend = null;
  let pendTimer = 0;

  function queueSave(text) {
    if (!inProject()) return;
    pend = { id: state.activeTab, text };
    clearTimeout(pendTimer);
    if (LC.settings.get('autoSave')) {
      pendTimer = setTimeout(flush, LC.settings.get('autoSaveDelay') || 400);
    }
  }

  async function flush() {
    clearTimeout(pendTimer);
    if (!pend) return;
    const p = pend;
    pend = null;
    const f = await getFile(p.id);
    if (!f || !isText(f.type, f.name)) return;
    if (f.content !== p.text) {
      f.content = p.text;
      await putFile(f);
    }
    const mem = state.active && state.active.files.find((x) => x.id === p.id);
    if (mem) mem.content = p.text;
  }

  async function saveNow() {
    if (!inProject()) {
      LC.toast('No project file is open. Use File ▸ Save to device.');
      return;
    }
    pend = { id: state.activeTab, text: LC.editor.getText() };
    await flush();
    const f = state.active.files.find((x) => x.id === state.activeTab);
    LC.toast('Saved ✓  ' + (f ? f.name : ''));
  }

  async function saveAsInProject() {
    const a = state.active;
    const act = a && a.files.find((f) => f.id === state.activeTab);
    if (!act) { LC.editor.saveToDevice(); return; }
    const n = await LC.prompt('Save a copy inside the project as', act.name);
    if (!n) return;
    await flush();
    const text = LC.editor.getText();
    const same = a.files.find((f) => f.path === act.path && f.name === n);
    let id;
    if (same) {
      if (!await LC.confirm('Replace "' + n + '"?', 'Replace')) return;
      same.content = text;
      await putFile(same);
      id = same.id;
    } else {
      id = (await createFile(a.id, act.path, n, text)).id;
    }
    await refresh();
    const nf = state.active.files.find((x) => x.id === id);
    if (nf) await openFileInTab(nf);
    LC.toast('Saved ✓  ' + n);
  }

  /* show the project in the preview (after open / upload / rename ...) */
  function repaint() {
    if (LC.preview && LC.editor) LC.preview.update(LC.editor.getText(), true);
  }

  function hookEditorAndPreview() {
    const E = LC.editor, Pv = LC.preview;

    LC.on('editor:changed', queueSave);
    LC.on('editor:detach', () => {           /* a file from the device was opened: leave the project file alone */
      flush();
      state.activeTab = null;
      LC.emit('tabs:changed');
    });

    /* every preview update uses the project's files */
    const origUpdate = Pv.update;
    Pv.update = function (code, force) {
      return origUpdate.call(Pv, inProject() ? buildPreviewHtml(code) : code, force);
    };

    /* Save = into the project. Device copy is a separate action. */
    const origSave = E.saveFile, origAs = E.saveFileAs;
    E.saveToDevice = origSave;
    E.saveFile     = () => { if (inProject()) saveNow(); else origSave(); };
    E.saveFileAs   = () => { if (inProject()) saveAsInProject(); else origAs(); };

    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', () => { flush(); });
  }

  /* =========================================================
     public API
     ========================================================= */

  function switchTab(dir) {
    if (!state.openTabs.length) return;
    let i = state.openTabs.indexOf(state.activeTab);
    if (i < 0) i = 0;
    i = (i + dir + state.openTabs.length) % state.openTabs.length;
    const id = state.openTabs[i];
    state.activeTab = id;
    loadIntoEditor(id);
    LC.emit('tabs:changed');
  }

  function uploadRoot() {
    if (!state.active) {
      LC.toast('Open or create a project first');
      return;
    }
    uploadFiles('');
  }

  LC.projects = {
    openFilesPanel,
    switchTab,
    uploadRoot,
    init() {
      hookEditorAndPreview();

      /* tabs container wiring */
      LC.on('tabs:changed', () => {
        const fb = LC.$('fb');
        if (fb) fb.style.display = state.openTabs.length ? '' : 'none';
        const pnl = LC.panels.get('openfiles');
        if (pnl) renderTabs(pnl.body);
      });
      const fbBtn = LC.$('fb');
      if (fbBtn) fbBtn.addEventListener('click', (e) => { e.stopPropagation(); openFilesPanel(); });

      /* restore last active project */
      const lastId = LC.store.get('activeProject', '');
      if (lastId) {
        loadProject(lastId).then(async (p) => {
          if (!p) return;
          state.active = p;
          LC.emit('project:opened', p);
          const f = p.files.find((x) => x.id === LC.store.get('activeTab', ''));
          if (f && isText(f.type, f.name)) await openFileInTab(f);
          else repaint();
        });
      }

      LC.emit('projects:ready');
    },

    buildPanel,
    createProject, deleteProject, renameProject,
    loadActiveProject,
    get active() { return state.active; },
    get projects() { return state.projects; },
    buildPreviewHtml,
    previewHtml: (t) => (inProject() ? buildPreviewHtml(t) : t),
    save: saveNow
  };

})();