/* =====================================================================
   LiveCode — menu
   Corner buttons. Panels for: files, project, settings, keyboard,
   theme, colors, and the preview settings panel.
   Every panel uses LC.openPanel, so it is already movable / resizable /
   pinch-scalable / opacity-adjustable.
   ===================================================================== */

(function () {
    "use strict";

    const LC = window.LC;
    const el = LC.el;

    function rowToggle(name) {
        const s = LC.settings.schemaOf(name);
        const sw = el("div", {
            class: "sw" + (LC.settings.get(name) ? " on" : "")
        });
        const r = el("div", { class: "prow" }, [
            el("span", { class: "lbl", text: s.label }),
            sw
        ]);
        r.addEventListener("click", () => {
            const v = !LC.settings.get(name);
            LC.settings.set(name, v);
            sw.classList.toggle("on", v);
        });
        return r;
    }

    function rowNumber(name) {
        const s = LC.settings.schemaOf(name);
        const input = el("input", {
            type: "number",
            value: LC.settings.get(name),
            min: s.min,
            max: s.max,
            step: s.step,
            inputmode: "numeric"
        });
        const r = el("div", { class: "prow" }, [
            el("span", { class: "lbl", text: s.label }),
            input
        ]);
        input.addEventListener("change", () => {
            LC.settings.set(name, input.value);
            input.value = LC.settings.get(name);
        });
        return r;
    }

    function rowSlider(name, min, max, step, label) {
        const cur = LC.settings.get(name);
        const input = el("input", {
            type: "range",
            min,
            max,
            step,
            value: cur
        });
        const val = el("span", { class: "val", text: cur + "%" });
        const r = el("div", { class: "prow" }, [
            el("span", { class: "lbl", text: label }),
            input,
            val
        ]);
        input.addEventListener("input", () => {
            val.textContent = input.value + "%";
        });
        input.addEventListener("change", () => {
            LC.settings.set(name, Number(input.value));
        });
        return r;
    }

    function section(title) {
        return el("div", { class: "pgroup-title", text: title });
    }

    function actionRow(label, fn) {
        const r = el("div", { class: "prow" }, [
            el("span", { class: "lbl", text: label })
        ]);
        r.addEventListener("click", fn);
        return r;
    }

    function openFilePanel() {
        const p = LC.openPanel({
            id: "files",
            title: "File",
            width: 260,
            height: 340
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        p.body.append(
            actionRow("New file", () => LC.editor.newFile()),
            actionRow("Open file…", () => LC.editor.openFile()),
            actionRow("Save", () => LC.editor.saveFile()),
            actionRow("Save as…", () => LC.editor.saveFileAs()),
            el("div", { class: "psep" }),
            actionRow("Font smaller", () =>
                LC.settings.set("fontSize", LC.settings.get("fontSize") - 1)
            ),
            actionRow("Font larger", () =>
                LC.settings.set("fontSize", LC.settings.get("fontSize") + 1)
            )
        );
    }

    function openProjectPanel() {
        const p = LC.openPanel({
            id: "project",
            title: "Project",
            width: 300,
            height: 400
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        if (LC.projects && LC.projects.buildPanel) {
            LC.projects.buildPanel(p);
            return;
        }

        p.body.append(
            section("No project module"),
            el("div", {
                class: "pgroup-title",
                text: "projects.js did not load."
            })
        );
    }

    function openSettingsPanel() {
        const p = LC.openPanel({
            id: "settings",
            title: "Settings",
            width: 320,
            height: 500
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        const groups = {};
        for (const s of LC.settings.schema()) {
            (groups[s.group] = groups[s.group] || []).push(s);
        }

        p.body.append(
            section("Quick"),
            rowSlider("fabOpacity", 0, 100, 5, "Button opacity"),
            rowSlider("panelOpacity", 20, 100, 5, "Panel opacity"),
            el("div", { class: "psep" }),
            actionRow("Reset all settings", async () => {
                const ok = await LC.confirm(
                    "Reset every setting to default?",
                    "Reset"
                );
                if (ok) {
                    LC.settings.resetAll();
                    p.close();
                    openSettingsPanel();
                }
            }),
            el("div", { class: "psep" })
        );

        for (const g of Object.keys(groups)) {
            p.body.append(section(g));
            for (const s of groups[g]) {
                if (s.type === "bool") p.body.append(rowToggle(s.name));
                else if (s.type === "num") p.body.append(rowNumber(s.name));
            }
        }
    }

    function openKeyboardPanel() {
        const p = LC.openPanel({
            id: "keyboard",
            title: "Keyboard",
            width: 360,
            height: 500
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        if (LC.shortcuts && LC.shortcuts.buildPanel) {
            LC.shortcuts.buildPanel(p);
            return;
        }

        p.body.append(
            section("Keyboard shortcuts"),
            el("div", {
                class: "pgroup-title",
                text: "shortcuts.js did not load."
            })
        );
    }

    function openThemePanel() {
        const p = LC.openPanel({
            id: "theme",
            title: "Theme",
            width: 260,
            height: 220
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        const modes = [
            ["dark", "Dark"],
            ["light", "Light"],
            ["system", "Follow system"]
        ];

        p.body.append(section("Choose theme"));
        for (const [key, label] of modes) {
            const r = el("div", { class: "prow" }, [
                el("span", { class: "lbl", text: label }),
                el("span", {
                    class: "val",
                    text: LC.themes.mode === key ? "●" : ""
                })
            ]);
            r.addEventListener("click", () => {
                LC.themes.setMode(key);
                p.close();
                openThemePanel();
            });
            p.body.append(r);
        }
    }

    const COLOR_SLOTS = [
        ["Background", "bg"],
        ["Foreground", "fg"],
        ["Dim text", "fg-dim"],
        ["Border", "border"],
        ["Accent", "accent"],
        ["Editor background", "ed-bg"],
        ["Editor text", "ed-fg"],
        ["Line numbers", "ed-ln"],
        ["Indent guides", "ed-guide"],
        ["Selection", "ed-sel"],
        ["Caret", "ed-caret"],
        ["Tags", "syn-tag"],
        ["Punctuation", "syn-punc"],
        ["Attribute names", "syn-attr"],
        ["Strings", "syn-str"],
        ["Comments", "syn-com"],
        ["Keywords", "syn-kw"],
        ["Numbers", "syn-num"],
        ["Functions", "syn-fn"],
        ["Classes / ids", "syn-cls"],
        ["Preview background", "pv-bg"],
        ["Preview stage", "pv-stage"],
        ["Panel background", "pn-bg"],
        ["Panel text", "pn-fg"],
        ["Button background", "fab-bg"],
        ["Button text", "fab-fg"]
    ];

    function normalizeColor(c) {
        c = String(c).trim();
        if (/^#[0-9a-f]{6}$/i.test(c)) return c;
        if (/^#[0-9a-f]{3}$/i.test(c))
            return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
        return "#000000";
    }

    function openColorsPanel() {
        const p = LC.openPanel({
            id: "colors",
            title: "Custom colors",
            width: 320,
            height: 520
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        const pal = LC.themes.getPalette();
        const mode = LC.themes.resolved;

        p.body.append(section("Editing: " + mode));
        p.body.append(
            actionRow("Reset this theme's colors", async () => {
                const ok = await LC.confirm(
                    "Reset every color of the " + mode + " theme?",
                    "Reset"
                );
                if (ok) {
                    LC.themes.resetTheme(mode);
                    p.close();
                    openColorsPanel();
                }
            })
        );
        p.body.append(el("div", { class: "psep" }));

        for (const [label, key] of COLOR_SLOTS) {
            const input = el("input", {
                type: "color",
                value: normalizeColor(pal[key])
            });
            const resetBtn = el("button", {
                class: "pbtn",
                title: "Reset this color",
                text: "⟲",
                style: { padding: "4px 8px", minWidth: "32px" }
            });
            const r = el("div", { class: "prow" }, [
                el("span", { class: "lbl", text: label }),
                input,
                resetBtn
            ]);
            input.addEventListener("input", () =>
                LC.themes.setColor(key, input.value)
            );
            resetBtn.addEventListener("click", () => {
                LC.themes.resetColor(key);
                input.value = normalizeColor(LC.themes.getPalette()[key]);
            });
            p.body.append(r);
        }
    }

    function openPreviewPanel() {
        if (LC.isPanelOpen("preview")) {
            LC.closePanel("preview");
            return;
        }

        const p = LC.openPanel({
            id: "preview",
            title: "Preview",
            width: 300,
            height: 440,
            right: true
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        const W = el("input", {
            type: "number",
            placeholder: "auto",
            inputmode: "numeric"
        });
        const H = el("input", {
            type: "number",
            placeholder: "auto",
            inputmode: "numeric"
        });
        const Ws = el("input", {
            type: "range",
            min: 100,
            max: 2400,
            step: 1,
            value: 400,
            "aria-label": "Width slider"
        });
        const Hs = el("input", {
            type: "range",
            min: 100,
            max: 2400,
            step: 1,
            value: 400,
            "aria-label": "Height slider"
        });
        const Z = el("input", {
            type: "range",
            min: 20,
            max: 200,
            step: 1,
            value: 100,
            "aria-label": "Zoom slider"
        });
        const ZV = el("span", { class: "val", text: "100%" });
        const opRange = el("input", {
            type: "range",
            min: 20,
            max: 100,
            value: LC.settings.get("panelOpacity")
        });

        p.body.append(
            section("Size"),
            el("div", { class: "prow" }, [
                el("span", { class: "lbl", text: "Width" }),
                W,
                Ws
            ]),
            el("div", { class: "prow" }, [
                el("span", { class: "lbl", text: "Height" }),
                H,
                Hs
            ]),
            el("div", { class: "prow" }, [
                el("span", { class: "lbl", text: "Zoom" }),
                Z,
                ZV
            ]),
            rowToggle("breakLongWords"),
            el("div", { class: "prow" }, [
                el("span", { class: "lbl", text: "Panel visibility" }),
                opRange
            ])
        );

        p.body.append(section("Presets"));
        const presets = el("div", { class: "btnrow" });
        for (const [label, w, h] of [
            ["Auto", 0, 0],
            ["Phone", 375, 667],
            ["Tablet", 768, 1024],
            ["Laptop", 1280, 800]
        ]) {
            const b = el("button", { class: "pbtn", text: label });
            b.addEventListener("click", () => LC.preview.setSize(w, h));
            presets.append(b);
        }
        p.body.append(presets);

        const row2 = el("div", { class: "btnrow" });
        const fit = el("button", { class: "pbtn", text: "Fit" });
        const rot = el("button", { class: "pbtn", text: "Rotate" });
        const rl = el("button", { class: "pbtn", text: "Reload" });
        fit.addEventListener("click", () => LC.preview.fit());
        rot.addEventListener("click", () => LC.preview.rotate());
        rl.addEventListener("click", () => LC.preview.reload());
        row2.append(fit, rot, rl);
        p.body.append(row2);

        function syncFromPreview(info) {
            const s = LC.preview.getSize();
            if (document.activeElement !== W) W.value = s.w || "";
            if (document.activeElement !== H) H.value = s.h || "";
            Ws.value = info ? info.w : s.w || 400;
            Hs.value = info ? info.h : s.h || 400;
            Z.value = Math.round(LC.preview.getZoom() * 100);
            ZV.textContent = Z.value + "%";
        }
        syncFromPreview();
        const off = LC.on("preview:changed", syncFromPreview);
        const offClose = LC.on("panel:close", id => {
            if (id === "preview") {
                off();
                offClose();
            }
        });

        const apply = () =>
            LC.preview.setSize(Number(W.value) || 0, Number(H.value) || 0);
        W.addEventListener("input", apply);
        H.addEventListener("input", apply);
        Ws.addEventListener("input", () =>
            LC.preview.setSize(Number(Ws.value), Number(H.value) || 0)
        );
        Hs.addEventListener("input", () =>
            LC.preview.setSize(Number(W.value) || 0, Number(Hs.value))
        );
        Z.addEventListener("input", () =>
            LC.preview.setZoom(Number(Z.value) / 100)
        );
        opRange.addEventListener("input", () => {
            p.setOpacity(opRange.value / 100);
            LC.settings.set("panelOpacity", Number(opRange.value));
        });

        setTimeout(() => Ws.focus(), 60);
    }

    function openMainMenu() {
        if (LC.isPanelOpen("main-menu")) {
            LC.closePanel("main-menu");
            return;
        }

        const p = LC.openPanel({
            id: "main-menu",
            title: "Menu",
            width: 260,
            height: 480
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        p.body.append(
            actionRow("File", () => {
                p.close();
                openFilePanel();
            }),
            actionRow("Project", () => {
                p.close();
                openProjectPanel();
            }),
            actionRow("Settings", () => {
                p.close();
                openSettingsPanel();
            }),
            actionRow("Keyboard", () => {
                p.close();
                openKeyboardPanel();
            }),
            actionRow("Theme", () => {
                p.close();
                openThemePanel();
            }),
            actionRow("Colors", () => {
                p.close();
                openColorsPanel();
            }),
            el("div", { class: "psep" }),
            actionRow("Format code", () => {
                if (!LC.format) {
                    LC.toast &&
                        LC.toast(
                            "Formatter not loaded — hard-refresh the app",
                            true
                        );
                    return;
                }
                LC.format.document();
            }),
            actionRow("Format options…", () => {
                p.close();
                openFormatPanel();
            }),
            el("div", { class: "psep" }),
            actionRow("Credits", () => {
                p.close();
                openCreditsPanel();
            }),
            el("div", { class: "psep" }),
            actionRow("Close all panels", () => LC.closeAllPanels())
        );
    }

    /* =========================================================
     FORMAT OPTIONS panel
     ========================================================= */

    function openFormatPanel() {
        if (LC.isPanelOpen("format-opts")) {
            LC.closePanel("format-opts");
            return;
        }
        const p = LC.openPanel({
            id: "format-opts",
            title: "Format options",
            width: 300,
            height: 420
        });
        if (p.body.dataset.built) {
            p.focus();
            return;
        }
        p.body.dataset.built = "1";
        p.body.textContent = "";

        p.body.append(
            section("Actions"),
            actionRow("Format whole document", () => {
                if (!LC.format) {
                    LC.toast && LC.toast("Formatter not loaded", true);
                    return;
                }
                LC.format.document();
            }),
            actionRow("Format selection only", () => {
                if (!LC.format) {
                    LC.toast && LC.toast("Formatter not loaded", true);
                    return;
                }
                LC.format.selection();
            }),
            el("div", { class: "psep" }),
            section("Formatter settings")
        );

        const names = ["formatIndent", "formatOnSave", "formatKeepInline"];
        for (const name of names) {
            const s = LC.settings.schemaOf(name);
            if (!s) continue;
            if (s.type === "bool") p.body.append(rowToggle(name));
            else if (s.type === "num") p.body.append(rowNumber(name));
        }

        p.body.append(
            el("div", { class: "psep" }),
            section("Also related"),
            rowToggle("autoIndent"),
            rowNumber("indentSize"),
            rowToggle("indentWithTabs")
        );
    }

    /* =========================================================
     CREDITS panel — placeholder; content will be filled later
     Shows a floating panel that hosts credit HTML
     ========================================================= */

    function openCreditsPanel() {
        if (LC.isPanelOpen("credits")) {
            LC.closePanel("credits");
            return;
        }
        const p = LC.openPanel({
            id: "credits",
            title: "Credits",
            width: 360,
            height: Math.min(560, Math.round(window.innerHeight * 0.82)),
            right: true
        });
        p.body.dataset.built = "1";
        p.body.textContent = "";
        p.body.style.padding = "0";
        p.body.style.overflow = "hidden";
        p.body.style.display = "flex";
        p.body.style.flexDirection = "column";

        const iframe = el("iframe", {
            src: "credit.html",
            title: "Credits",
            style: {
                border: "0",
                width: "100%",
                height: "100%",
                flex: "1 1 auto",
                background: "#070a0f"
            }
        });
        iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
        iframe.setAttribute("referrerpolicy", "no-referrer");
        p.body.append(iframe);
    }

    LC.menu = {
        init() {
            const mb = LC.$("mb");
            const gear = LC.$("gear");

            if (mb)
                mb.addEventListener("click", e => {
                    e.stopPropagation();
                    openMainMenu();
                });
            if (gear)
                gear.addEventListener("click", e => {
                    e.stopPropagation();
                    openPreviewPanel();
                });
        },

        openMainMenu,
        openFilePanel,
        openProjectPanel,
        openSettingsPanel,
        openKeyboardPanel,
        openThemePanel,
        openColorsPanel,
        openPreviewPanel,
        openFormatPanel,
        openCreditsPanel
    };
})();/* =====================================================================
   LiveCode — menu
   Corner buttons. Panels for: files, project, settings, keyboard,
   theme, colors, and the preview settings panel.
   Every panel uses LC.openPanel, so it is already movable / resizable /
   pinch-scalable / opacity-adjustable.
   ===================================================================== */

(function () {
  'use strict';

  const LC = window.LC;
  const el = LC.el;

  function rowToggle(name) {
    const s = LC.settings.schemaOf(name);
    const sw = el('div', { class: 'sw' + (LC.settings.get(name) ? ' on' : '') });
    const r  = el('div', { class: 'prow' }, [
      el('span', { class: 'lbl', text: s.label }),
      sw
    ]);
    r.addEventListener('click', () => {
      const v = !LC.settings.get(name);
      LC.settings.set(name, v);
      sw.classList.toggle('on', v);
    });
    return r;
  }

  function rowNumber(name) {
    const s = LC.settings.schemaOf(name);
    const input = el('input', {
      type: 'number', value: LC.settings.get(name),
      min: s.min, max: s.max, step: s.step, inputmode: 'numeric'
    });
    const r = el('div', { class: 'prow' }, [
      el('span', { class: 'lbl', text: s.label }),
      input
    ]);
    input.addEventListener('change', () => {
      LC.settings.set(name, input.value);
      input.value = LC.settings.get(name);
    });
    return r;
  }

  function rowSlider(name, min, max, step, label) {
    const cur = LC.settings.get(name);
    const input = el('input', { type: 'range', min, max, step, value: cur });
    const val = el('span', { class: 'val', text: cur + '%' });
    const r = el('div', { class: 'prow' }, [
      el('span', { class: 'lbl', text: label }),
      input, val
    ]);
    input.addEventListener('input', () => { val.textContent = input.value + '%'; });
    input.addEventListener('change', () => { LC.settings.set(name, Number(input.value)); });
    return r;
  }

  function section(title) {
    return el('div', { class: 'pgroup-title', text: title });
  }

  function actionRow(label, fn) {
    const r = el('div', { class: 'prow' }, [
      el('span', { class: 'lbl', text: label })
    ]);
    r.addEventListener('click', fn);
    return r;
  }

  function openFilePanel() {
    const p = LC.openPanel({ id: 'files', title: 'File', width: 260, height: 340 });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    p.body.append(
      actionRow('New file',    () => LC.editor.newFile()),
      actionRow('Open file…',  () => LC.editor.openFile()),
      actionRow('Save',        () => LC.editor.saveFile()),
      actionRow('Save as…',    () => LC.editor.saveFileAs()),
      el('div', { class: 'psep' }),
      actionRow('Font smaller', () => LC.settings.set('fontSize', LC.settings.get('fontSize') - 1)),
      actionRow('Font larger',  () => LC.settings.set('fontSize', LC.settings.get('fontSize') + 1))
    );
  }

  function openProjectPanel() {
    const p = LC.openPanel({ id: 'project', title: 'Project', width: 300, height: 400 });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    if (LC.projects && LC.projects.buildPanel) {
      LC.projects.buildPanel(p);
      return;
    }

    p.body.append(
      section('No project module'),
      el('div', { class: 'pgroup-title', text: 'projects.js did not load.' })
    );
  }

  function openSettingsPanel() {
    const p = LC.openPanel({ id: 'settings', title: 'Settings', width: 320, height: 500 });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    const groups = {};
    for (const s of LC.settings.schema()) {
      (groups[s.group] = groups[s.group] || []).push(s);
    }

    p.body.append(
      section('Quick'),
      rowSlider('fabOpacity',   0,   100, 5, 'Button opacity'),
      rowSlider('panelOpacity', 20,  100, 5, 'Panel opacity'),
      el('div', { class: 'psep' }),
      actionRow('Reset all settings', async () => {
        const ok = await LC.confirm('Reset every setting to default?', 'Reset');
        if (ok) { LC.settings.resetAll(); p.close(); openSettingsPanel(); }
      }),
      el('div', { class: 'psep' })
    );

    for (const g of Object.keys(groups)) {
      p.body.append(section(g));
      for (const s of groups[g]) {
        if (s.type === 'bool') p.body.append(rowToggle(s.name));
        else if (s.type === 'num') p.body.append(rowNumber(s.name));
      }
    }
  }

  function openKeyboardPanel() {
    const p = LC.openPanel({ id: 'keyboard', title: 'Keyboard', width: 360, height: 500 });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    if (LC.shortcuts && LC.shortcuts.buildPanel) {
      LC.shortcuts.buildPanel(p);
      return;
    }

    p.body.append(
      section('Keyboard shortcuts'),
      el('div', { class: 'pgroup-title', text: 'shortcuts.js did not load.' })
    );
  }

  function openThemePanel() {
    const p = LC.openPanel({ id: 'theme', title: 'Theme', width: 260, height: 220 });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    const modes = [['dark','Dark'], ['light','Light'], ['system','Follow system']];

    p.body.append(section('Choose theme'));
    for (const [key, label] of modes) {
      const r = el('div', { class: 'prow' }, [
        el('span', { class: 'lbl', text: label }),
        el('span', { class: 'val', text: LC.themes.mode === key ? '●' : '' })
      ]);
      r.addEventListener('click', () => {
        LC.themes.setMode(key);
        p.close(); openThemePanel();
      });
      p.body.append(r);
    }
  }

  const COLOR_SLOTS = [
    ['Background','bg'], ['Foreground','fg'], ['Dim text','fg-dim'],
    ['Border','border'], ['Accent','accent'],
    ['Editor background','ed-bg'], ['Editor text','ed-fg'],
    ['Line numbers','ed-ln'], ['Indent guides','ed-guide'],
    ['Selection','ed-sel'], ['Caret','ed-caret'],
    ['Tags','syn-tag'], ['Punctuation','syn-punc'],
    ['Attribute names','syn-attr'], ['Strings','syn-str'],
    ['Comments','syn-com'], ['Keywords','syn-kw'],
    ['Numbers','syn-num'], ['Functions','syn-fn'],
    ['Classes / ids','syn-cls'],
    ['Preview background','pv-bg'], ['Preview stage','pv-stage'],
    ['Panel background','pn-bg'], ['Panel text','pn-fg'],
    ['Button background','fab-bg'], ['Button text','fab-fg']
  ];

  function normalizeColor(c) {
    c = String(c).trim();
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3];
    return '#000000';
  }

  function openColorsPanel() {
    const p = LC.openPanel({ id: 'colors', title: 'Custom colors', width: 320, height: 520 });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    const pal = LC.themes.getPalette();
    const mode = LC.themes.resolved;

    p.body.append(section('Editing: ' + mode));
    p.body.append(actionRow("Reset this theme's colors", async () => {
      const ok = await LC.confirm('Reset every color of the ' + mode + ' theme?', 'Reset');
      if (ok) { LC.themes.resetTheme(mode); p.close(); openColorsPanel(); }
    }));
    p.body.append(el('div', { class: 'psep' }));

    for (const [label, key] of COLOR_SLOTS) {
      const input = el('input', { type: 'color', value: normalizeColor(pal[key]) });
      const resetBtn = el('button', {
        class: 'pbtn', title: 'Reset this color', text: '⟲',
        style: { padding: '4px 8px', minWidth: '32px' }
      });
      const r = el('div', { class: 'prow' }, [
        el('span', { class: 'lbl', text: label }),
        input, resetBtn
      ]);
      input.addEventListener('input', () => LC.themes.setColor(key, input.value));
      resetBtn.addEventListener('click', () => {
        LC.themes.resetColor(key);
        input.value = normalizeColor(LC.themes.getPalette()[key]);
      });
      p.body.append(r);
    }
  }

  function openPreviewPanel() {
    if (LC.isPanelOpen('preview')) {
      LC.closePanel('preview');
      return;
    }

    const p = LC.openPanel({ id: 'preview', title: 'Preview', width: 300, height: 440, right: true });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    const W  = el('input', { type: 'number', placeholder: 'auto', inputmode: 'numeric' });
    const H  = el('input', { type: 'number', placeholder: 'auto', inputmode: 'numeric' });
    const Ws = el('input', { type: 'range', min: 100, max: 2400, step: 1, value: 400, 'aria-label': 'Width slider' });
    const Hs = el('input', { type: 'range', min: 100, max: 2400, step: 1, value: 400, 'aria-label': 'Height slider' });
    const Z  = el('input', { type: 'range', min: 20, max: 200, step: 1, value: 100, 'aria-label': 'Zoom slider' });
    const ZV = el('span', { class: 'val', text: '100%' });
    const opRange = el('input', { type: 'range', min: 20, max: 100, value: LC.settings.get('panelOpacity') });

    p.body.append(
      section('Size'),
      el('div', { class: 'prow' }, [ el('span', { class: 'lbl', text: 'Width' }),  W, Ws ]),
      el('div', { class: 'prow' }, [ el('span', { class: 'lbl', text: 'Height' }), H, Hs ]),
      el('div', { class: 'prow' }, [ el('span', { class: 'lbl', text: 'Zoom' }),   Z, ZV ]),
      rowToggle('breakLongWords'),
      el('div', { class: 'prow' }, [ el('span', { class: 'lbl', text: 'Panel visibility' }), opRange ])
    );

    p.body.append(section('Presets'));
    const presets = el('div', { class: 'btnrow' });
    for (const [label, w, h] of [
      ['Auto', 0, 0], ['Phone', 375, 667],
      ['Tablet', 768, 1024], ['Laptop', 1280, 800]
    ]) {
      const b = el('button', { class: 'pbtn', text: label });
      b.addEventListener('click', () => LC.preview.setSize(w, h));
      presets.append(b);
    }
    p.body.append(presets);

    const row2 = el('div', { class: 'btnrow' });
    const fit = el('button', { class: 'pbtn', text: 'Fit' });
    const rot = el('button', { class: 'pbtn', text: 'Rotate' });
    const rl  = el('button', { class: 'pbtn', text: 'Reload' });
    fit.addEventListener('click', () => LC.preview.fit());
    rot.addEventListener('click', () => LC.preview.rotate());
    rl.addEventListener('click',  () => LC.preview.reload());
    row2.append(fit, rot, rl);
    p.body.append(row2);

    function syncFromPreview(info) {
      const s = LC.preview.getSize();
      if (document.activeElement !== W) W.value = s.w || '';
      if (document.activeElement !== H) H.value = s.h || '';
      Ws.value = info ? info.w : (s.w || 400);
      Hs.value = info ? info.h : (s.h || 400);
      Z.value  = Math.round(LC.preview.getZoom() * 100);
      ZV.textContent = Z.value + '%';
    }
    syncFromPreview();
    const off = LC.on('preview:changed', syncFromPreview);
    const offClose = LC.on('panel:close', (id) => {
      if (id === 'preview') { off(); offClose(); }
    });

    const apply = () => LC.preview.setSize(Number(W.value) || 0, Number(H.value) || 0);
    W.addEventListener('input', apply);
    H.addEventListener('input', apply);
    Ws.addEventListener('input', () => LC.preview.setSize(Number(Ws.value), Number(H.value) || 0));
    Hs.addEventListener('input', () => LC.preview.setSize(Number(W.value) || 0, Number(Hs.value)));
    Z.addEventListener('input', () => LC.preview.setZoom(Number(Z.value) / 100));
    opRange.addEventListener('input', () => {
      p.setOpacity(opRange.value / 100);
      LC.settings.set('panelOpacity', Number(opRange.value));
    });

    setTimeout(() => Ws.focus(), 60);
  }

  function openMainMenu() {
    if (LC.isPanelOpen('main-menu')) {
      LC.closePanel('main-menu');
      return;
    }

    const p = LC.openPanel({ id: 'main-menu', title: 'Menu', width: 260, height: 480 });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    p.body.append(
      actionRow('File',     () => { p.close(); openFilePanel(); }),
      actionRow('Project',  () => { p.close(); openProjectPanel(); }),
      actionRow('Settings', () => { p.close(); openSettingsPanel(); }),
      actionRow('Keyboard', () => { p.close(); openKeyboardPanel(); }),
      actionRow('Theme',    () => { p.close(); openThemePanel(); }),
      actionRow('Colors',   () => { p.close(); openColorsPanel(); }),
      el('div', { class: 'psep' }),
      actionRow('Format code', () => {
        if (!LC.format) { LC.toast && LC.toast('Formatter not loaded — hard-refresh the app', true); return; }
        LC.format.document();
      }),
      actionRow('Format options…', () => { p.close(); openFormatPanel(); }),
      el('div', { class: 'psep' }),
      actionRow('Credits', () => { p.close(); openCreditsPanel(); }),
      el('div', { class: 'psep' }),
      actionRow('Close all panels',   () => LC.closeAllPanels())
    );
  }


  /* =========================================================
     FORMAT OPTIONS panel
     ========================================================= */

  function openFormatPanel() {
    if (LC.isPanelOpen('format-opts')) { LC.closePanel('format-opts'); return; }
    const p = LC.openPanel({ id: 'format-opts', title: 'Format options', width: 300, height: 420 });
    if (p.body.dataset.built) { p.focus(); return; }
    p.body.dataset.built = '1';
    p.body.textContent = '';

    p.body.append(
      section('Actions'),
      actionRow('Format whole document', () => {
        if (!LC.format) { LC.toast && LC.toast('Formatter not loaded', true); return; }
        LC.format.document();
      }),
      actionRow('Format selection only', () => {
        if (!LC.format) { LC.toast && LC.toast('Formatter not loaded', true); return; }
        LC.format.selection();
      }),
      el('div', { class: 'psep' }),
      section('Formatter settings')
    );

    const names = ['formatIndent', 'formatOnSave', 'formatKeepInline'];
    for (const name of names) {
      const s = LC.settings.schemaOf(name);
      if (!s) continue;
      if (s.type === 'bool') p.body.append(rowToggle(name));
      else if (s.type === 'num') p.body.append(rowNumber(name));
    }

    p.body.append(
      el('div', { class: 'psep' }),
      section('Also related'),
      rowToggle('autoIndent'),
      rowNumber('indentSize'),
      rowToggle('indentWithTabs')
    );
  }

  /* =========================================================
     CREDITS panel — placeholder; content will be filled later
     Shows a floating panel that hosts credit HTML
     ========================================================= */

  function openCreditsPanel() {
    if (LC.isPanelOpen('credits')) { LC.closePanel('credits'); return; }
    const p = LC.openPanel({
      id: 'credits',
      title: 'Credits',
      width: Math.min(400, window.innerWidth - 20),
      height: Math.min(620, Math.round(window.innerHeight * 0.88)),
      right: true
    });
    p.body.dataset.built = '1';
    p.body.textContent = '';
    p.body.style.cssText = 'padding:0;margin:0;overflow:hidden;position:relative;flex:1 1 auto;min-height:0;height:100%;background:#070a0f';

    const iframe = el('iframe', { title: 'Credits' });
    iframe.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;border:0;display:block;background:#070a0f';
    p.body.append(iframe);

    /* Load full credit.html (with its own CSS) via srcdoc so styles always apply.
       Relative images (gun-park.jpg) resolve against the app origin. */
    function showError(msg) {
      p.body.textContent = '';
      p.body.style.overflow = 'auto';
      p.body.append(el('div', {
        style: { padding: '20px', color: '#e6edf3', fontFamily: 'system-ui,sans-serif', background: '#070a0f' },
        html: '<div style="font-size:15px;margin-bottom:8px">Could not load credits</div>' +
              '<div style="opacity:.75;font-size:13px;line-height:1.5">' + msg + '</div>'
      }));
    }

    fetch('credit.html', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' — is credit.html next to index.html?');
        return r.text();
      })
      .then(function (html) {
        /* Force readable colors + constrain the big tribute image inside the panel */
        var inject =
          '<base href="' + location.href.replace(/[^/]*$/, '') + '">' +
          '<style>' +
          'html,body{margin:0!important;background:#070a0f!important;color:#e6edf3!important;}' +
          '.wrap{padding:28px 16px 48px!important;max-width:100%!important;}' +
          '.tribute-image{max-height:280px!important;width:100%!important;object-fit:cover!important;aspect-ratio:auto!important;}' +
          'h1{color:#e6edf3!important;} .subtitle,.creator-role,.tribute p,.row .tag{color:#8b949e!important;}' +
          '.creator-name,.row .name,.tribute-quote,.kicker,h2{color:#e6edf3!important;}' +
          '.story,.story strong{color:#c9d1d9!important;} .story strong{color:#e6edf3!important;}' +
          'footer{color:#6e7681!important;}' +
          '</style>';
        /* put inject right after <head> or at start */
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head[^>]*>/i, function (m) { return m + inject; });
        } else {
          html = inject + html;
        }
        iframe.srcdoc = html;
      })
      .catch(function (err) {
        showError(String(err && err.message ? err.message : err));
      });
  }


  LC.menu = {
    init() {
      const mb   = LC.$('mb');
      const gear = LC.$('gear');

      if (mb)   mb.addEventListener('click',   (e) => { e.stopPropagation(); openMainMenu(); });
      if (gear) gear.addEventListener('click', (e) => { e.stopPropagation(); openPreviewPanel(); });
    },

    openMainMenu,
    openFilePanel,
    openProjectPanel,
    openSettingsPanel,
    openKeyboardPanel,
    openThemePanel,
    openColorsPanel,
    openPreviewPanel,
    openFormatPanel,
    openCreditsPanel
  };

})();