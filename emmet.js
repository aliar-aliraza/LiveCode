/* =====================================================================
   LiveCode — emmet
   HTML and CSS abbreviation expansion.
   Same behavior as the original single-file app.
   Reads settings for indent unit and on/off toggles.
   ===================================================================== */

(function () {
    "use strict";

    const LC = window.LC;

    /* =========================================================
     shared constants
     ========================================================= */

    const VOID =
        /^(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)$/;
    const M = "\u0000"; /* cursor marker */

    /* indent unit comes from settings so it can be tabs, 2, or 4 spaces */
    function IND() {
        return LC.settings ? LC.settings.indentUnit() : "  ";
    }

    /* =========================================================
     HTML emmet
     ========================================================= */

    const boiler = () =>
        "<!DOCTYPE html>\n" +
        '<html lang="en">\n' +
        "<head>\n" +
        IND() +
        '<meta charset="UTF-8">\n' +
        IND() +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        IND() +
        "<title>Document</title>\n" +
        "</head>\n" +
        "<body>\n" +
        IND() +
        M +
        "\n" +
        "</body>\n" +
        "</html>";

    const DEF = {
        a: ' href=""',
        img: ' src="" alt=""',
        link: ' rel="stylesheet" href=""',
        script: ' src=""',
        input: ' type="text"',
        form: ' action=""'
    };

    /* examples:  ul>li.item$*3   a[href=#]{Link}   div#a+div#b   ! */
    function gen(parts, d) {
        const sibs = parts[0].split("+");
        const pad = IND().repeat(d);
        const out = [];

        sibs.forEach((s, k) => {
            const m =
                /^([\w-]*)((?:[.#][\w$-]+)*)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?(?:\*(\d+))?$/.exec(
                    s
                );
            if (!m) throw 0;

            const tag = m[1] || "div";
            const kids = k === sibs.length - 1 && parts.length > 1;

            for (let n = 1; n <= (+m[5] || 1); n++) {
                const q = x => x.replace(/\$/g, n);
                const id = (/#([\w$-]+)/.exec(m[2]) || [])[1];
                const cls = (m[2].match(/\.[\w$-]+/g) || [])
                    .map(c => q(c.slice(1)))
                    .join(" ");

                let at =
                    (id ? ' id="' + q(id) + '"' : "") +
                    (cls ? ' class="' + cls + '"' : "");

                if (m[3]) {
                    at += m[3]
                        .trim()
                        .split(/\s+/)
                        .map(a => {
                            const [p, ...v] = a.split("=");
                            return " " + p + '="' + q(v.join("=")) + '"';
                        })
                        .join("");
                } else {
                    at += DEF[tag] || "";
                }

                if (VOID.test(tag)) {
                    out.push(pad + "<" + tag + at + ">");
                    continue;
                }

                if (kids) {
                    out.push(
                        pad + "<" + tag + at + ">",
                        gen(parts.slice(1), d + 1),
                        pad + "</" + tag + ">"
                    );
                } else {
                    out.push(
                        pad +
                            "<" +
                            tag +
                            at +
                            ">" +
                            q(m[4] || "") +
                            (m[4] ? "" : M) +
                            "</" +
                            tag +
                            ">"
                    );
                }
            }
        });

        return out.join("\n");
    }

    /* =========================================================
     CSS emmet
     ========================================================= */

    const CK = {
        df: ["display", "flex"],
        dg: ["display", "grid"],
        db: ["display", "block"],
        dn: ["display", "none"],
        dib: ["display", "inline-block"],
        pa: ["position", "absolute"],
        pr: ["position", "relative"],
        pf: ["position", "fixed"],
        ps: ["position", "sticky"],
        jcc: ["justify-content", "center"],
        jcsb: ["justify-content", "space-between"],
        aic: ["align-items", "center"],
        fdc: ["flex-direction", "column"],
        tac: ["text-align", "center"],
        ofh: ["overflow", "hidden"],
        bxz: ["box-sizing", "border-box"],
        cur: ["cursor", "pointer"],
        m0a: ["margin", "0 auto"],
        c: ["color", M],
        bgc: ["background-color", M],
        bg: ["background", M],
        bd: ["border", "1px solid " + M],
        w: ["width", M],
        h: ["height", M],
        m: ["margin", M],
        p: ["padding", M]
    };

    const CN = {
        m: "margin",
        p: "padding",
        w: "width",
        h: "height",
        mt: "margin-top",
        mb: "margin-bottom",
        ml: "margin-left",
        mr: "margin-right",
        pt: "padding-top",
        pb: "padding-bottom",
        pl: "padding-left",
        pr: "padding-right",
        fz: "font-size",
        lh: "line-height",
        br: "border-radius",
        mw: "max-width",
        mh: "max-height",
        t: "top",
        l: "left",
        r: "right",
        b: "bottom",
        z: "z-index",
        gap: "gap",
        op: "opacity",
        fw: "font-weight"
    };

    /* a <style> block is a CSS block even in an HTML file */
    function cssBlock(v, s) {
        const b = v.slice(0, s);
        const lang = LC.state.lang;
        let c = b;

        if (lang === "html") {
            const a = b.lastIndexOf("<style");
            if (a < 0 || a < b.lastIndexOf("</style")) return false;
            c = b.slice(a);
        } else if (lang !== "css") {
            return false;
        }

        return c.lastIndexOf("{") > c.lastIndexOf("}");
    }

    /* df, jcc, m10, p20, w100p, fz16, br8 */
    function cssExpand(line, cursor) {
        const mm = /[a-z]+(?:-?\d+\.?\d*(?:p|e|r|x|vh|vw)?)?$/.exec(line);
        if (!mm) return null;

        const w = mm[0];
        const n = /^([a-z]+?)(-?\d+\.?\d*)(p|e|r|x|vh|vw)?$/.exec(w);
        let out;

        if (CK[w]) {
            out = CK[w][0] + ": " + CK[w][1] + ";";
        } else if (n && CN[n[1]]) {
            const bare = ["z", "op", "fw", "lh"].includes(n[1]);
            out =
                CN[n[1]] +
                ": " +
                n[2] +
                (n[3]
                    ? { p: "%", e: "em", r: "rem", x: "px" }[n[3]] || n[3]
                    : bare
                      ? ""
                      : "px") +
                ";";
        } else {
            return null;
        }

        const cur = out.indexOf(M);
        const start = cursor - w.length;

        return {
            text: out.split(M).join(""),
            start,
            cursor: cur < 0 ? null : start + cur
        };
    }

    /* =========================================================
     shared: is cursor inside a tag or a script/style body
     ========================================================= */

    function insideTag(b) {
        return b.lastIndexOf("<") > b.lastIndexOf(">");
    }
    function insideScriptOrStyle(b) {
        return (
            Math.max(b.lastIndexOf("<style"), b.lastIndexOf("<script")) >
            Math.max(b.lastIndexOf("</style"), b.lastIndexOf("</script"))
        );
    }

    /* =========================================================
     public API
     Used by editor.js. Everything returns null if not applicable.
     ========================================================= */

    LC.emmet = {
        /* Try to expand the abbreviation ending at the cursor.
       Returns { text, start, cursor } or null. */
        expandHtml(value, cursor) {
            if (LC.settings && !LC.settings.get("emmetHtml")) return null;
            if (LC.state.lang !== "html") return null;
            if (cursor !== cursor) return null; /* sanity */

            const b = value.slice(0, cursor);
            const line = b.slice(b.lastIndexOf("\n") + 1);

            if (insideTag(b)) return null;
            if (insideScriptOrStyle(b)) return null;

            const m = /(?:[\w.#>+*$!-]|\{[^}]*\}|\[[^\]]*\])+$/.exec(line);
            if (!m) return null;

            let text;
            try {
                text = m[0] === "!" ? boiler() : gen(m[0].split(">"), 0);
            } catch (_) {
                return null;
            }

            /* re-indent every new line to match the current line's indent */
            const lineIndent = /^[ \t]*/.exec(line)[0];
            text = text.split("\n").join("\n" + lineIndent);

            const cur = text.indexOf(M);
            const start = cursor - m[0].length;

            return {
                text: text.split(M).join(""),
                start,
                cursor: cur < 0 ? null : start + cur
            };
        },

        /* Try to expand a CSS shorthand ending at the cursor. */
        expandCss(value, cursor) {
            if (LC.settings && !LC.settings.get("emmetCss")) return null;

            const lang = LC.state.lang;
            if (lang !== "css" && !cssBlock(value, cursor)) return null;
            if (cursor !== cursor) return null;

            const b = value.slice(0, cursor);
            const line = b.slice(b.lastIndexOf("\n") + 1);

            return cssExpand(line, cursor);
        },

        /* One entry point the editor calls: tries CSS first if we are in
       a CSS context, HTML otherwise. */
        expand(value, cursor) {
            const lang = LC.state.lang;
            if (lang === "css") return this.expandCss(value, cursor);
            if (lang === "js" || lang === "json") return null;
            if (cssBlock(value, cursor)) return this.expandCss(value, cursor);
            return this.expandHtml(value, cursor);
        },

        /* used by editor and menu to know if emmet is armed */
        enabled() {
            const lang = LC.state.lang;
            if (lang === "css")
                return !LC.settings || LC.settings.get("emmetCss");
            if (lang === "js" || lang === "json") return false;
            return !LC.settings || LC.settings.get("emmetHtml");
        }
    };
})();
