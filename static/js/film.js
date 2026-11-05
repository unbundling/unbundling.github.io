/* ==========================================================================
   Teaser film: the page as one animation, played in chapters.
   Every frame is drawn from (chapter, time) alone, so play, pause, seeking and the static frames share one path.
   Values come from DATA (data.js); glyphs, markers and colors from Viz (viz.js).
   Each chapter's beats are timed in seconds in its T table; every built-up figure holds a few seconds to be read.
   The stage is wide (960 x 540) on most screens and tall (440 x 820) on phones, where side-by-side figures stack.
   Layout tables hold both variants and are switched in place, so the drawing code reads one set of names.
   ========================================================================== */
(function () {
  "use strict";
  const fig = document.querySelector(".film");
  if (!fig) return;
  const V = window.Viz, D = window.DATA, C = V.C, RC = V.RECIPE, r1 = V.r1;
  const NS = "http://www.w3.org/2000/svg";
  const TEAL = C.accent, TEAL_D = "#006b67", TEAL_L = C.accentLight, INK2 = "#3d4651", ICON = "#4b5560";
  const params = new URLSearchParams(location.search);
  const STATIC = params.has("static");
  const reduceMotion = STATIC || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------ stage shapes
  const SHAPES = { wide: { W: 960, H: 540 }, tall: { W: 440, H: 820 } };
  let TALL = false, SW = 960, SH = 540;
  const TABLES = [];
  // a layout table with a wide and a tall variant (same keys); setShape() copies the active variant into it
  function table(wide, tall) { const t = Object.assign({}, wide); TABLES.push([t, wide, tall]); return t; }
  function setShape(tall) {
    TALL = tall;
    ({ W: SW, H: SH } = SHAPES[tall ? "tall" : "wide"]);
    TABLES.forEach(([t, w, tl]) => Object.assign(t, tall ? tl : w));
  }

  // ------------------------------------------------------------ timing and drawing helpers
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const outC = (x) => 1 - Math.pow(1 - x, 3);
  const pop = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2));
  const lerp = (a, b, x) => a + (b - a) * x;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, x) => { const B = hex(b); return "#" + hex(a).map((v, i) => Math.round(lerp(v, B[i], x)).toString(16).padStart(2, "0")).join(""); };

  // a group with an opacity and an optional move, or a scale about (cx, cy)
  function grp(body, o = {}) {
    const op = o.o == null ? 1 : o.o;
    if (op <= 0.002 || !body) return "";
    const dx = o.x || 0, dy = o.y || 0, s = o.s == null ? 1 : o.s;
    let tr = "";
    if (s !== 1) tr = ` transform="translate(${r1(dx + (o.cx || 0))} ${r1(dy + (o.cy || 0))}) scale(${s.toFixed(3)}) translate(${r1(-(o.cx || 0))} ${r1(-(o.cy || 0))})"`;
    else if (dx || dy) tr = ` transform="translate(${r1(dx)} ${r1(dy)})"`;
    return `<g${op < 1 ? ` opacity="${op.toFixed(3)}"` : ""}${tr}>${body}</g>`;
  }

  // text widths, measured in the page's font (re-measured once the web font has loaded)
  const meas = document.createElementNS(NS, "svg");
  meas.setAttribute("aria-hidden", "true");
  meas.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden";
  const mt = document.createElementNS(NS, "text");
  meas.appendChild(mt);
  fig.appendChild(meas);
  const widths = new Map();
  function tw(s, size, weight = 400) {
    const key = `${s}|${size}|${weight}`;
    if (!widths.has(key)) {
      mt.setAttribute("font-size", size);
      mt.setAttribute("font-weight", weight);
      mt.textContent = s;
      widths.set(key, mt.getComputedTextLength() || s.length * size * 0.5);
    }
    return widths.get(key);
  }
  const fit = (s, size, weight, maxW) => Math.min(size, size * maxW / tw(s, size, weight));
  // word wrap at a width, balanced so the last line isn't left with a word or two
  const wraps = new Map();
  function wrap(s, size, weight, maxW) {
    const key = `${s}|${size}|${weight}|${maxW}`;
    if (!wraps.has(key)) wraps.set(key, balance(s, size, weight, maxW));
    return wraps.get(key);
  }
  function balance(s, size, weight, maxW) {
    const greedy = (lim) => {
      const out = [];
      let cur = "";
      s.split(" ").forEach((w) => {
        const next = cur ? `${cur} ${w}` : w;
        if (cur && tw(next, size, weight) > lim) { out.push(cur); cur = w; } else cur = next;
      });
      return cur ? out.concat(cur) : out;
    };
    const n = greedy(maxW).length;
    if (n < 2) return greedy(maxW);
    // the narrowest width that still needs no more lines
    let lo = maxW / n, hi = maxW;
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (greedy(mid).length > n) lo = mid; else hi = mid; }
    return greedy(hi);
  }
  const textLines = (ls, x, y, size, o) => ls.map((l, i) => V.T(x, y + i * size * 1.25, l, Object.assign({ size }, o))).join("");

  // a recipe glyph centered at (cx, cy), h tall
  const glyphs = new Map();
  function glyphAt(kind, cx, cy, h) {
    const key = `${kind}|${h}`;
    if (!glyphs.has(key)) {
      const s = V.glyph(kind, { height: h });
      glyphs.set(key, { s: s.slice(5), w: +s.match(/width="([\d.]+)"/)[1], h: +s.match(/height="([\d.]+)"/)[1] });
    }
    const g = glyphs.get(key);
    return `<svg x="${r1(cx - g.w / 2)}" y="${r1(cy - g.h / 2)}" ${g.s}`;
  }
  const icon = (id, x, y, size, color) => `<use href="#ic-${id}" x="${r1(x)}" y="${r1(y)}" width="${size}" height="${size}" style="color:${color}"/>`;
  const tick = (cx, cy, r, color = "#fff") => `<path d="M${r1(cx - r * 0.42)},${r1(cy + r * 0.02)}l${r1(r * 0.3)},${r1(r * 0.3)}l${r1(r * 0.56)},${r1(-r * 0.62)}" fill="none" stroke="${color}" stroke-width="${r1(Math.max(1.6, r * 0.22))}" stroke-linecap="round" stroke-linejoin="round"/>`;

  // every chapter after the overview: a section label and a question at the top, its answer at the bottom
  const M0 = table({ x: 36, ky: 40, ks: 15, qy: 74, qs: 23, ay: 512.5 }, { x: 20, ky: 34, ks: 14, qy: 64, qs: 21, ay: 792 });
  const question = (line) => textLines(wrap(line, M0.qs, 600, SW - 2 * M0.x), M0.x, M0.qy, M0.qs, { weight: 600, color: C.ink });
  function heading(kicker, line, t, t0 = 0.45) {
    const a = outC(seg(t, t0, t0 + 0.5)), b = outC(seg(t, t0 + 0.12, t0 + 0.62));
    return grp(V.T(M0.x, M0.ky, kicker, { size: M0.ks, weight: 600, color: TEAL_D }), { o: a, y: 6 * (1 - a) }) +
      grp(question(line), { o: b, y: 8 * (1 - b) });
  }
  function answer(text, t, t0) {
    const a = outC(seg(t, t0, t0 + 0.55));
    const ls = wrap(text, M0.qs, 600, SW - 2 * M0.x - 34), y0 = M0.ay - (ls.length - 1) * M0.qs * 1.25;
    const cx = M0.x + 12, cy = y0 - 7.5;
    return grp(`<circle cx="${cx}" cy="${r1(cy)}" r="11" fill="${TEAL}"/>` + tick(cx, cy, 11) + textLines(ls, M0.x + 34, y0, M0.qs, { weight: 600, color: TEAL_D }), { o: a, y: 8 * (1 - a) });
  }

  // ------------------------------------------------------------ chart helpers (§3 to §6)
  const subTitle = (x, y, s) => V.T(x, y, s, { size: fit(s, 15.5, 400, TALL ? SW - 40 : 420), color: C.muted });
  const yTitle = (x, y, s) => V.T(x, y, s, { size: 13.5, color: C.muted, weight: 500 });
  // the rule between two figures: vertical when they sit side by side, horizontal when they stack
  const divider = (d) => (d.x != null ? `<line x1="${d.x}" x2="${d.x}" y1="104" y2="470" stroke="#eceef1" stroke-width="1.2"/>` : `<line x1="20" x2="${SW - 20}" y1="${d.y}" y2="${d.y}" stroke="#eceef1" stroke-width="1.2"/>`);
  function yGrid(ticks, ys, x0, x1) {
    return ticks.map((v) => `<line x1="${x0}" x2="${x1}" y1="${r1(ys(v))}" y2="${r1(ys(v))}" stroke="${C.grid}"/>` +
      V.T(x0 - 8, ys(v) + 4.5, String(v), { size: 13, anchor: "end", color: C.muted })).join("");
  }
  function xAxis(ticks, xs, x0, x1, y, label) {
    let g = `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${C.axis}"/>`;
    ticks.forEach(([v, lab]) => { g += `<line x1="${r1(xs(v))}" x2="${r1(xs(v))}" y1="${y}" y2="${y + 4}" stroke="${C.axis}"/>` + V.T(xs(v), y + 19, lab, { size: 13, anchor: "middle", color: C.muted }); });
    return g + (label ? V.T((x0 + x1) / 2, y + 41, label, { size: 13, anchor: "middle", color: C.muted }) : "");
  }
  // the value axis under rows of dots: vertical gridlines, ticks and a label
  function dotAxis(ticks, xs, x0, x1, top, bottom, label) {
    let g = "";
    ticks.forEach((v) => { g += `<line x1="${r1(xs(v))}" x2="${r1(xs(v))}" y1="${top}" y2="${bottom}" stroke="${C.grid}"/>` + V.T(xs(v), bottom + 19, String(v), { size: 13, anchor: "middle", color: C.muted }); });
    g += `<line x1="${x0}" x2="${x1}" y1="${bottom}" y2="${bottom}" stroke="${C.axis}"/>`;
    return g + (label ? V.T((x0 + x1) / 2, bottom + 41, label, { size: 13, anchor: "middle", color: C.muted }) : "");
  }
  // a dashed reference line at x, drawn upward from y0 to y1 as e runs 0 -> 1
  const vref = (x, y0, y1, e, color) => (e > 0 ? `<line x1="${r1(x)}" x2="${r1(x)}" y1="${r1(lerp(y0, y1, e))}" y2="${r1(y0)}" stroke="${color}" stroke-width="1.6" stroke-dasharray="5 4"/>` : "");
  const popMark = (shape, x, y, r, color, e) => (e > 0 ? grp(V.marker(shape, x, y, r, color), { o: Math.min(1, e * 2), s: e, cx: x, cy: y }) : "");
  const valueText = (x, y, v, o, left) => grp(V.T(left ? x - 12 : x + 12, y + 4.8, V.f1(v), { size: 13.5, weight: 600, color: C.ink, halo: true, anchor: left ? "end" : undefined }), { o });

  // a series drawn as far as point index f (fractional); each marker pops in as the line reaches it
  function drawOn(pts, f, st) {
    const out = { line: "", marks: "", end: null };
    if (f <= 0 || !pts.length) return out;
    const n = pts.length, k = Math.min(n - 1, Math.floor(f)), fr = k < n - 1 ? f - k : 0;
    const path = pts.slice(0, k + 1);
    out.end = pts[k];
    if (fr > 0) { out.end = [lerp(pts[k][0], pts[k + 1][0], fr), lerp(pts[k][1], pts[k + 1][1], fr)]; path.push(out.end); }
    if (path.length > 1) out.line = `<path d="${path.map((q, i) => (i ? "L" : "M") + r1(q[0]) + "," + r1(q[1])).join("")}" fill="none" stroke="${st.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (let i = 0; i <= k; i++) out.marks += popMark(st.marker, pts[i][0], pts[i][1], st.r || 5.8, st.color, pop(clamp((f - i) * 2.5)));
    return out;
  }
  // names at the ends of lines, pushed apart until none overlap
  function endNames(items, x, gap = 15) {
    items.sort((a, b) => a.y - b.y);
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (let i = 1; i < items.length; i++) {
        const d = items[i].y - items[i - 1].y;
        if (d < gap) { const p = (gap - d) / 2 + 0.01; items[i - 1].y -= p; items[i].y += p; moved = true; }
      }
      if (!moved) break;
    }
    return items.map((l) => V.T(x != null ? x : l.x + 12, l.y + 4.5, l.text, { size: 13.5, weight: 600, color: l.color, halo: true })).join("");
  }
  // a compute-gap arrow drawn from x1 toward x2, its factor placed where it covers the least of the plot
  function gapArrow(x1, x2, y, label, e, polys, prefer) {
    if (e <= 0) return "";
    const L = V.placeArrowLabel(x1, y, x2, y, label, 15, polys, prefer);
    return `<line x1="${r1(x1)}" y1="${r1(y)}" x2="${r1(lerp(x1, x2, e))}" y2="${r1(y)}" stroke="${C.ink}" stroke-width="1.6" marker-end="url(#film-ah)"/>` +
      grp(V.T(L.x, L.y, label, { size: 15, weight: 600, anchor: "middle", color: C.ink, halo: true }), { o: seg(e, 0.6, 1) });
  }
  const box = (x, y, r = 5) => [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r], [x - r, y - r]];

  // ------------------------------------------------------------ Overview: the three questions, answered in turn
  const T0 = { answers: [0.8, 1.8, 2.8], dur: 8 };
  const STRIP = [["data", "Common data"], ["schedule", "Training schedule"], ["compute", "Lifetime compute"], ["backbone", "One backbone"]];
  const SY = 52;
  // the controls strip: one row on the wide stage, a 2 x 2 grid on the tall one
  function stripLayout() {
    if (TALL) {
      return { fs: 15.5, lx: 20, ly: 40, lfs: 16.5, ruleY: 126, ruleX: null,
        items: STRIP.map(([id, label], i) => ({ id, label, x: 20 + (i % 2) * 206, y: 76 + Math.floor(i / 2) * 31 })) };
    }
    const fs = 18, x0 = 36;
    const ruleX = x0 + tw("§2 Controlled", fs, 600) + 24;
    const items = STRIP.map(([id, label]) => ({ id, label, w: 33 + tw(label, fs), y: SY }));
    const left = ruleX + 26, right = SW - 36;
    const gap = (right - left - items.reduce((a, b) => a + b.w, 0)) / (items.length - 1);
    let x = left;
    items.forEach((it) => { it.x = x; x += it.w + gap; });
    return { fs, lx: x0, ly: SY + 6.5, lfs: fs, ruleY: 92, ruleX, items };
  }

  const QS = [
    { sec: "§3", q: "Is separate pretraining needed?", a: "Separate pretraining is optional.", opts: [["pretrained", "Pretrained encoder", C.preDark], ["scratch", "Scratch encoder", C.encDark]] },
    { sec: "§4", q: "Is vision capacity needed?", a: "Dedicated vision capacity is key.", opts: [["free", "Encoder-free", C.efDark], ["scratch", "Scratch encoder", C.encDark]] },
    { sec: "§5", q: "Must capacity precede fusion?", a: "Vision capacity can be in-fusion.", opts: [["scratch", "Pre-fusion capacity", C.encDark], ["infusion", "In-fusion capacity", C.encDark]] },
  ];
  // panels: three columns on the wide stage, three stacked rows (each with its two options side by side) on the tall one
  const PW = 304, PX = (i) => 24 + i * PW, TY = (i) => 144 + i * 222;
  const OV = { qy: 150, cx: 46, cw: 238, ch: 114, cy: [176, 302], ay: 466, gh: 54 };
  const dividers = () => (TALL ? `<path d="M20,${TY(1) - 12}H${SW - 20}M20,${TY(2) - 12}H${SW - 20}" stroke="#eceef1" stroke-width="1.2"/>` : `<path d="M328,112V516M632,112V516" stroke="#eceef1" stroke-width="1.2"/>`);
  const stripRule = (L) => `<line x1="${TALL ? 20 : 24}" x2="${SW - (TALL ? 20 : 24)}" y1="${L.ruleY}" y2="${L.ruleY}" stroke="#eceef1" stroke-width="1.2"/>` +
    (L.ruleX ? `<line x1="${r1(L.ruleX)}" x2="${r1(L.ruleX)}" y1="${SY - 13}" y2="${SY + 13}" stroke="#d6dadf" stroke-width="1.5"/>` : "");

  // one option card; ans runs 0 -> 1 as the panel's answer is picked
  function card(kind, label, color, pick, ans, x, y, w, h, o) {
    const stroke = pick ? mix("#d3d7dc", TEAL, ans) : mix("#d3d7dc", "#c7ccd2", ans);
    const fill = pick ? mix("#ffffff", "#f1f8f7", ans) : "#ffffff";
    let g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="${fill}" stroke="${stroke}" stroke-width="1.6"${!pick && ans > 0.5 ? ' stroke-dasharray="6 4"' : ""}/>`;
    g += `<circle cx="${o.rx}" cy="${o.ry}" r="${o.rr}" fill="${pick ? mix("#ffffff", TEAL, ans) : "#ffffff"}" stroke="${pick ? mix("#9aa1ab", TEAL, ans) : "#9aa1ab"}" stroke-width="1.7"/>`;
    if (pick && ans > 0.05) g += grp(tick(o.rx, o.ry, o.rr), { o: ans });
    return g + grp(glyphAt(kind, o.gx, o.gy, o.gh) + V.T(o.gx, o.ly, label, { size: o.ls, weight: 600, color, anchor: "middle" }), { o: pick ? 1 : 1 - 0.5 * ans });
  }
  function panel(i, ans) {
    const P = QS[i], out = [];
    if (TALL) {
      const y0 = TY(i);
      out.push(`<text x="20" y="${y0 + 18}" font-size="16.5" font-weight="600" fill="${C.ink}"><tspan fill="${TEAL_D}">${P.sec}</tspan> ${V.esc(P.q)}</text>`);
      P.opts.forEach(([kind, label, color], j) => {
        const x = 20 + j * 206, y = y0 + 34, w = 194;
        out.push(card(kind, label, color, j === 1, ans, x, y, w, 116, { rx: x + 16, ry: y + 16, rr: 7, gx: x + w / 2, gy: y + 52, gh: 44, ly: y + 99, ls: 14.5 }));
      });
      out.push(grp(V.T(SW / 2, y0 + 182, P.a, { size: 16, weight: 500, color: TEAL_D, anchor: "middle" }), { o: ans, y: 5 * (1 - ans) }));
      return out.join("");
    }
    const x0 = PX(i);
    const fs = fit(`${P.sec} ${P.q}`, 17.5, 600, PW - 40);
    out.push(`<text x="${x0 + 20}" y="${OV.qy}" font-size="${r1(fs)}" font-weight="600" fill="${C.ink}"><tspan fill="${TEAL_D}">${P.sec}</tspan> ${V.esc(P.q)}</text>`);
    const bx = x0 + 22, cx = x0 + OV.cx, mids = OV.cy.map((y) => y + OV.ch / 2);
    out.push(`<path d="M${bx},${mids[0]}V${mids[1]}M${bx},${mids[0]}H${cx - 3}M${bx},${mids[1]}H${cx - 3}" fill="none" stroke="#9aa1ab" stroke-width="2"/>`);
    P.opts.forEach(([kind, label, color], j) => {
      const y = OV.cy[j], gx = cx + 22 + (OV.cw - 22) / 2;
      out.push(card(kind, label, color, j === 1, ans, cx, y, OV.cw, OV.ch, { rx: cx + 22, ry: y + OV.ch / 2, rr: 8, gx, gy: y + 47, gh: OV.gh, ly: y + 97, ls: 17 }));
    });
    out.push(grp(V.T(x0 + PW / 2, OV.ay, P.a, { size: 18, weight: 500, color: TEAL_D, anchor: "middle" }), { o: ans, y: 5 * (1 - ans) }));
    return out.join("");
  }

  function drawOverview(t) {
    const L = stripLayout();
    let s = V.T(L.lx, L.ly, "§2 Controlled", { size: L.lfs, weight: 600, color: TEAL_D }) + stripRule(L) + dividers();
    L.items.forEach((it) => { s += icon(it.id, it.x, it.y - 12, 24, ICON) + V.T(it.x + 33, it.y + 6.5, it.label, { size: L.fs, color: INK2 }); });
    QS.forEach((_, i) => {
      const a0 = T0.answers[i];
      const lit = i === 0 ? 1 : lerp(0.42, 1, inOut(seg(t, a0 - 0.35, a0)));
      s += grp(panel(i, inOut(seg(t, a0, a0 + 0.5))), { o: lit });
    });
    return s;
  }

  // ------------------------------------------------------------ §2 Setup: why the controls, and what they fix
  /* The strip's four controls become rows. Published recipes differ in all four at once; the rows then snap to one
     shared setting each, until the recipe (the glyph row) is the only thing that differs. On the tall stage each row's
     label sits above its cells, and the cells are drawn smaller. */
  const T2 = { cells: 1.6, line2: 6.4, snap: [7.0, 8.0, 9.0, 10.0], cols: [11.4, 12.1], inf: [11.85, 12.45], band: 13.1, answer: 13.5, dur: 19 };
  const GR = table(
    { HY: 128, gh: 46, ny: 48, ns: 15.5, RY: [222, 296, 370, 444], X3: [363, 592, 821], X4: [334, 506, 678, 850], cs: 1, cdy: 0, lx: 40, ldy: 0, ls: 17.5, band: [252, 96, 684, 94], vx: 40, vy: 134, vs: 17.5 },
    { HY: 162, gh: 30, ny: 33, ns: 13, RY: [276, 396, 516, 636], X3: [87, 220, 353], X4: [70, 170, 270, 370], cs: 0.66, cdy: 16, lx: 20, ldy: -28, ls: 15.5, band: [20, 128, 400, 78], vx: 20, vy: 118, vs: 14 });
  const COLS = [["pretrained", "Pretrained encoder", "Pretrained", C.preDark], ["scratch", "Scratch encoder", "Scratch", C.encDark], ["free", "Encoder-free", "Encoder-free", C.efDark], ["infusion", "In-fusion", "In-fusion", C.infDark]];
  const snapAt = (t, i) => inOut(seg(t, T2.snap[i], T2.snap[i] + 0.7));
  const GRAY_F = ["#e6e9ed", "#d9dde2", "#eef0f2"], GRAY_S = "#9aa1ab";

  // Common data: datasets as cylinders on one baseline. Published: different sets; controlled: the same three.
  const DATA_M = [[[-26, 22, 30], [0, 22, 40], [26, 22, 22]], [[0, 44, 42], [0, 0, 0], [0, 0, 0]], [[-14, 22, 22], [14, 22, 32], [14, 0, 0]]];
  const DATA_C = [[-26, 22, 34], [0, 22, 34], [26, 22, 34]];
  function cyl(cx, base, w, h, fill, stroke) {
    const rx = w / 2, ry = Math.min(5, w * 0.22), top = base - h;
    return `<path d="M${r1(cx - rx)},${r1(top + ry)}V${r1(base - ry)}A${r1(rx)},${r1(ry)} 0 0 0 ${r1(cx + rx)},${r1(base - ry)}V${r1(top + ry)}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>` +
      `<ellipse cx="${r1(cx)}" cy="${r1(top + ry)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  }
  function cellData(cx, cy, j, e) {
    const M = DATA_M[j] || DATA_C;
    let g = "";
    for (let q = 0; q < 3; q++) {
      const [dx, w, h] = M[q].map((v, n) => lerp(v, DATA_C[q][n], e));
      if (w > 1 && h > 1) g += cyl(cx + dx, cy + 21, w, h, mix(GRAY_F[(j + q) % 3], TEAL_L, e), mix(GRAY_S, TEAL, e));
    }
    return g;
  }

  // Training schedule: learning-rate curves. Published: cosine, step and linear decay over different lengths;
  // controlled: one warmup-stable-decay schedule.
  const LR = [
    (u) => (u < 0.06 ? u / 0.06 : 0.5 * (1 + Math.cos(Math.PI * (u - 0.06) / 0.94))) * 0.92,
    (u) => (u < 0.04 ? u / 0.04 : u < 0.5 ? 1 : u < 0.75 ? 0.5 : 0.22) * 0.72,
    (u) => (u < 0.12 ? u / 0.12 : 1 - 0.92 * (u - 0.12) / 0.88),
  ];
  const LRX = [1, 0.92, 0.7];
  const WSD = (u) => (u < 0.08 ? u / 0.08 : u < 0.78 ? 1 : 1 - (u - 0.78) / 0.22) * 0.88;
  function cellSchedule(cx, cy, j, e) {
    const w = 128, h = 36, x0 = cx - w / 2, y0 = cy + h / 2, N = 48;
    let d = "";
    for (let n = 0; n <= N; n++) {
      const u = n / N;
      const xm = j < 3 ? LRX[j] * u : u, ym = j < 3 ? LR[j](u) : WSD(u);
      d += (n ? "L" : "M") + r1(x0 + w * lerp(xm, u, e)) + "," + r1(y0 - h * lerp(ym, WSD(u), e));
    }
    return `<line x1="${x0 - 2}" x2="${x0 + w + 2}" y1="${y0}" y2="${y0}" stroke="#d5d8db" stroke-width="1.2"/>` +
      `<path d="${d}" fill="none" stroke="${mix("#788190", TEAL, e)}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  // Lifetime compute: [pretraining from, to, rest from, to] in px from the cell's center. Published runs differ in
  // compute and leave encoder pretraining uncounted (dashed, outside the bar); controlled runs count it inside one budget.
  const CMP_M = [[-88, -60, -54, 24], [-66, -66, -66, 72], [-62, -62, -62, 0]];
  const CMP_C = [[-62, -38, -38, 62], [-62, -62, -62, 62]];
  function cellCompute(cx, cy, j, e) {
    const Cc = CMP_C[j === 0 ? 0 : 1], M = CMP_M[j] || Cc;
    const [p0, p1, q0, q1] = M.map((v, n) => lerp(v, Cc[n], e));
    const h = 16, y = cy - h / 2;
    let g = `<rect x="${r1(cx + q0)}" y="${y}" width="${r1(q1 - q0)}" height="${h}" rx="3" fill="${mix("#c9ced4", TEAL_L, e)}" stroke="${mix("#c9ced4", TEAL, e)}" stroke-width="1.4"/>`;
    if (p1 - p0 > 0.5) {
      g += `<rect x="${r1(cx + p0)}" y="${y}" width="${r1(p1 - p0)}" height="${h}" rx="3" fill="${mix("#fdf0e6", C.pre, e)}" stroke="${C.pre}" stroke-width="1.4"${e < 0.5 ? ' stroke-dasharray="4 3"' : ""}/>`;
      // the label keeps its size when the cell is drawn smaller; on the tall stage it starts at the bar, clear of the edge
      g += V.T(TALL ? cx + p0 : cx + (p0 + p1) / 2, y - 6 - (1 / GR.cs - 1) * 3, "pretraining", { size: r1(12.5 / GR.cs), anchor: TALL ? "start" : "middle", color: C.preDark });
    }
    return g;
  }

  // One backbone: a stack of layers. Published: different depths and widths; controlled: one configuration.
  const BB_M = [[5, 72], [3, 108], [6, 56]], BB_C = [4, 88];
  function cellBackbone(cx, cy, j, e) {
    const [nm, wm] = BB_M[j] || BB_C, [nc, wc] = BB_C;
    const lh = 6.5, gap = 2.6, w = lerp(wm, wc, e);
    const hs = [0, 1, 2, 3, 4, 5].map((q) => lerp(q < nm ? 1 : 0, q < nc ? 1 : 0, e));
    let y = cy - (hs.reduce((a, v) => a + v * (lh + gap), 0) - gap) / 2, g = "";
    hs.forEach((v) => {
      if (v > 0.02) g += `<rect x="${r1(cx - w / 2)}" y="${r1(y)}" width="${r1(w)}" height="${r1(lh * v)}" rx="2" fill="${mix("#dfe3e8", TEAL_L, e)}" stroke="${mix(GRAY_S, TEAL, e)}" stroke-width="1.3" opacity="${v.toFixed(2)}"/>`;
      y += v * (lh + gap);
    });
    return g;
  }
  const CELL = [cellData, cellSchedule, cellCompute, cellBackbone];

  function drawSetup(t) {
    const L = stripLayout();
    let s = "";
    // the overview leaves: its panels drop away while the strip's controls move into the rows' labels
    const away = inOut(seg(t, 0, 0.6)), m = inOut(seg(t, 0.15, 1.3));
    if (away < 1) s += grp(dividers() + QS.map((_, i) => panel(i, 1)).join(""), { o: 1 - away, y: 24 * away }) + grp(stripRule(L), { o: 1 - away });
    s += grp(V.T(lerp(L.lx, M0.x, m), lerp(L.ly, M0.ky, m), "§2 Controlled", { size: lerp(L.lfs, M0.ks, m), weight: 600, color: TEAL_D }), { o: 1 - seg(t, 0.25, 0.6) });
    s += grp(V.T(M0.x, M0.ky, "§2 · Setup", { size: M0.ks, weight: 600, color: TEAL_D }), { o: seg(t, 0.7, 1.05) });
    STRIP.forEach(([id, label], i) => {
      const it = L.items[i], x = lerp(it.x, GR.lx, m), y = lerp(it.y, GR.RY[i] + GR.ldy, m);
      s += icon(id, x, y - 12, 24, mix(ICON, TEAL, snapAt(t, i))) + V.T(x + 33, y + 6.5, label, { size: lerp(L.fs, GR.ls, m), color: mix(INK2, C.ink, m) });
    });

    // the one line of text: what published comparisons vary, then what this study fixes
    const l1 = outC(seg(t, 1.3, 1.8)) * (1 - seg(t, T2.line2 - 0.35, T2.line2)), l2 = outC(seg(t, T2.line2 - 0.05, T2.line2 + 0.45));
    s += grp(question("Published models differ in everything at once."), { o: l1, y: 8 * (1 - outC(seg(t, 1.3, 1.8))) });
    s += grp(question("We hold everything else fixed."), { o: l2, y: 8 * (1 - l2) });

    // recipe columns: three published recipes, then in-fusion joins once everything else is fixed
    const c4 = inOut(seg(t, T2.cols[0], T2.cols[1])), inf = outC(seg(t, T2.inf[0], T2.inf[1]));
    const colX = (j) => (j < 3 ? lerp(GR.X3[j], GR.X4[j], c4) : GR.X4[3] + 24 * (1 - inf));
    const hb = outC(seg(t, T2.band, T2.band + 0.6));
    if (hb > 0) {
      const [bx, by, bw, bh] = GR.band;
      s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="12" fill="${TEAL_L}" stroke="${TEAL}" stroke-width="1.5" opacity="${hb.toFixed(3)}"/>`;
      s += grp(V.T(GR.vx, GR.vy, "Vision encoding", { size: GR.vs, weight: 600, color: TEAL_D }), { o: hb, x: -8 * (1 - hb) });
    }
    const hIn = outC(seg(t, 0.9, 1.5));
    COLS.forEach(([kind, name, short, color], j) => {
      const o = j < 3 ? hIn : inf;
      if (o > 0) s += grp(glyphAt(kind, colX(j), GR.HY, GR.gh) + V.T(colX(j), GR.HY + GR.ny, TALL ? short : name, { size: GR.ns, weight: 600, color, anchor: "middle" }), { o, y: -10 * (1 - o) });
    });
    GR.RY.forEach((ry, i) => {
      const e = snapAt(t, i), y = ry + GR.cdy;
      COLS.forEach((_, j) => {
        let o = inf, sc = 1;
        if (j < 3) {
          const a0 = T2.cells + 0.14 * i + 0.06 * j, a = seg(t, a0, a0 + 0.4);
          o = Math.min(1, a * 2);
          sc = lerp(0.6, 1, pop(a));
        }
        if (o > 0) s += grp(CELL[i](colX(j), y, j, j < 3 ? e : 1), { o, s: sc * GR.cs, cx: colX(j), cy: y });
      });
    });
    return s + answer("Only the vision encoding differs.", t, T2.answer);
  }

  // ------------------------------------------------------------ §3 Visual prior
  /* First: one fixed budget; as encoder pretraining takes a larger share, Avg. VQA falls below the scratch encoder
     (Figure 2a). Second: pretraining for longer at no charge raises ImageNet accuracy but not Avg. VQA (Figure 7). */
  const T3 = { bar: 1.0, scratch: 1.8, steps: [3.4, 4.9, 6.4, 7.9], right: 10.4, rows: [11.1, 12.1, 13.1, 14.1, 15.1], concl: 16.2, answer: 17.2, dur: 23 };
  const PL = table(
    { x0: 36, x1: 452, sy: 116, by: 148, bh: 20, px0: 76, px1: 392, py0: 422, py1: 230 },
    { x0: 20, x1: 420, sy: 128, by: 156, bh: 18, px0: 56, px1: 356, py0: 404, py1: 254 });
  function priorLeft(t) {
    const U = D.upstreamShare, ST = T3.steps;
    const xs = V.scale([-0.35, 4.35], [PL.px0, PL.px1]), ys = V.scale([36, 44], [PL.py0, PL.py1]);
    let share = 0, cur = 0;
    ST.forEach((st, i) => {
      share = lerp(share, U.shares[i + 1], inOut(seg(t, st, st + 0.45)));
      if (t >= st) cur = i + 1;
    });
    let g = grp(subTitle(PL.x0, PL.sy, `One budget of ${U.budget} FLOPs`), { o: outC(seg(t, T3.bar - 0.1, T3.bar + 0.4)) });

    // the budget bar: encoder pretraining (orange) takes its share; multimodal training gets the rest
    const grow = inOut(seg(t, T3.bar, T3.bar + 0.6)), bw = PL.x1 - PL.x0, split = PL.x0 + bw * share / 100;
    if (grow > 0) {
      g += `<clipPath id="film-budget"><rect x="${PL.x0}" y="${PL.by}" width="${r1(bw * grow)}" height="${PL.bh}" rx="4"/></clipPath>`;
      g += `<g clip-path="url(#film-budget)"><rect x="${PL.x0}" y="${PL.by}" width="${bw}" height="${PL.bh}" fill="#c3c8ce"/>` +
        (share > 0.05 ? `<rect x="${PL.x0}" y="${PL.by}" width="${r1(split - PL.x0)}" height="${PL.bh}" fill="${C.pre}"/><line x1="${r1(split)}" x2="${r1(split)}" y1="${PL.by}" y2="${PL.by + PL.bh}" stroke="#fff" stroke-width="2"/>` : "") + `</g>`;
      g += grp(V.T(PL.x1, PL.by + PL.bh + 18, "multimodal training", { size: 13.5, anchor: "end", color: C.muted }), { o: grow });
      if (cur > 0) {
        const o = seg(t, ST[0], ST[0] + 0.3);
        g += grp(V.T(PL.x0, PL.by + PL.bh + 18, "encoder pretraining", { size: 13.5, color: C.preDark, weight: 500 }), { o });
        g += grp(V.T(split, PL.by - 8, `${U.shares[cur]}%`, { size: 13.5, anchor: split < PL.x0 + 24 ? "start" : "middle", color: C.preDark, weight: 600 }), { o });
      }
    }

    // Figure 2a: axes
    let ax = yTitle(PL.x0, PL.py1 - 16, "Avg. VQA (%)") + yGrid([36, 38, 40, 42, 44], ys, PL.px0, PL.px1);
    U.shares.forEach((sh, i) => { ax += V.T(xs(i), PL.py0 + 20, String(sh), { size: 13, anchor: "middle", color: i === cur && cur > 0 ? C.preDark : C.muted, weight: i === cur && cur > 0 ? 600 : 400 }); });
    ax += `<line x1="${PL.px0}" x2="${PL.px1}" y1="${PL.py0}" y2="${PL.py0}" stroke="${C.axis}"/>`;
    ax += V.T((PL.px0 + PL.px1) / 2, PL.py0 + 42, "Share of budget on encoder pretraining (%)", { size: 13, anchor: "middle", color: C.muted });
    g += grp(ax, { o: outC(seg(t, T3.bar + 0.2, T3.bar + 0.7)) });

    // the share being added, highlighted while its points land
    if (cur > 0) {
      const st = ST[cur - 1], o = seg(t, st, st + 0.25) * (1 - seg(t, st + 1.0, st + 1.25));
      if (o > 0) g += `<rect x="${r1(xs(cur) - 17)}" y="${PL.py1 - 6}" width="34" height="${PL.py0 - PL.py1 + 6}" rx="6" fill="#fdf0e6" opacity="${o.toFixed(3)}"/>`;
    }

    // the scratch encoder: no separate pretraining, one point and its dashed reference, named in a key above the plot
    const ref = U.scratch.vqa, yr = ys(ref);
    const hl = inOut(seg(t, T3.scratch + 0.2, T3.scratch + 0.9));
    if (hl > 0) g += `<line x1="${r1(xs(0))}" x2="${r1(lerp(xs(0), PL.px1, hl))}" y1="${r1(yr)}" y2="${r1(yr)}" stroke="${C.enc}" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    g += popMark("circle", xs(0), yr, 6.5, C.enc, pop(seg(t, T3.scratch, T3.scratch + 0.4)));
    const kx = PL.px1 - tw("scratch encoder", 13.5, 600), ky = PL.py1 - 16;
    g += grp(`<line x1="${r1(kx - 34)}" x2="${r1(kx - 8)}" y1="${ky - 4.5}" y2="${ky - 4.5}" stroke="${C.enc}" stroke-width="1.6" stroke-dasharray="5 4"/>` +
      V.marker("circle", kx - 21, ky - 4.5, 4.6, C.enc, { sw: 1.4 }) + V.T(kx, ky, "scratch encoder", { size: 13.5, color: C.encDark, weight: 600 }), { o: outC(seg(t, T3.scratch + 0.3, T3.scratch + 0.8)) });

    // pretrained encoders: one point per share, joined as they land, each named at its newest point
    const ends = [];
    let lines = "", marks = "";
    U.series.forEach((sr) => {
      const rc = RC[sr.key], pts = sr.vqa.map((v, i) => [xs(i + 1), ys(v)]);
      let end = null;
      for (let i = 1; i < pts.length; i++) {
        const e = inOut(seg(t, ST[i] + 0.05, ST[i] + 0.5));
        if (e <= 0) continue;
        const [x0, y0] = pts[i - 1], x1 = lerp(x0, pts[i][0], e), y1 = lerp(y0, pts[i][1], e);
        lines += `<line x1="${r1(x0)}" y1="${r1(y0)}" x2="${r1(x1)}" y2="${r1(y1)}" stroke="${rc.color}" stroke-width="2.2" stroke-linecap="round"/>`;
        end = [x1, y1];
      }
      if (!end && t >= ST[0]) end = pts[0];
      if (end) ends.push({ x: end[0], y: end[1], text: sr.name, color: rc.dark });
      sr.vqa.forEach((v, i) => { marks += popMark(rc.marker, xs(i + 1), ys(v), 6.2, rc.color, pop(seg(t, ST[i] + 0.25, ST[i] + 0.6))); });
    });
    g += lines + marks;
    if (ends.length) g += grp(endNames(ends), { o: seg(t, ST[0] + 0.3, ST[0] + 0.7) });
    return g;
  }

  const PR = table(
    { x0: 508, sy: 116, lab: 552, bx0: 562, bx1: 662, ix0: 684, ix1: 790, vx0: 812, vx1: 918, top: 178, bot: 428, div: { x: 480 } },
    { x0: 20, sy: 494, lab: 64, bx0: 74, bx1: 174, ix0: 196, ix1: 302, vx0: 316, vx1: 422, top: 548, bot: 703, div: { y: 466 } });
  function priorRight(t) {
    const F = D.freePretraining, n = F.rows.length, RT = T3.rows;
    const rowH = (PR.bot - PR.top) / n, yOf = (k) => PR.bot - rowH * (k + 0.5); // k = 0 (scratch) at the bottom
    const rIn = outC(seg(t, T3.right, T3.right + 0.5));
    if (rIn <= 0) return "";
    const sb = V.scale([0, 12], [PR.bx0, PR.bx1]);
    const si = V.scale([79.5, 86], [PR.ix0 + 6, PR.ix1 - 6]), sv = V.scale([35.6, 39.8], [PR.vx0 + 6, PR.vx1 - 6]);
    let ax = divider(PR.div) + subTitle(PR.x0, PR.sy, "Longer pretraining, for free");
    ax += V.T(PR.lab, PR.top - 16, "×10^21", { size: 12.5, anchor: "end", color: C.faint });
    ax += V.T(PR.bx0, PR.top - 16, "Compute", { size: 14, weight: 600, color: C.ink });
    [["ImageNet (%)", PR.ix0, [80, 82, 84], si], ["Avg. VQA (%)", PR.vx0, [36, 37, 38, 39], sv]].forEach(([title, x0, ticks, sc]) => {
      ax += V.T(x0, PR.top - 16, title, { size: 14, weight: 600, color: C.ink });
      ticks.forEach((v) => { ax += `<line x1="${r1(sc(v))}" x2="${r1(sc(v))}" y1="${PR.top - 4}" y2="${PR.bot}" stroke="${C.grid}"/>` + V.T(sc(v), PR.bot + 19, String(v), { size: 13, anchor: "middle", color: C.muted }); });
      ax += `<line x1="${x0}" x2="${x0 + 106}" y1="${PR.bot}" y2="${PR.bot}" stroke="${C.axis}"/>`;
    });
    let g = grp(ax, { o: rIn });
    // the scratch encoder's Avg. VQA, as the dashed reference
    g += vref(sv(F.rows[0].vqa), PR.bot, PR.top - 4, inOut(seg(t, RT[0] + 0.2, RT[0] + 0.8)), C.enc);
    // rows land from the bottom (no pretraining) to the top (the most)
    let lines = "", dots = "";
    F.rows.forEach((r, k) => {
      const y = yOf(k), t0 = RT[k];
      const lab = outC(seg(t, t0, t0 + 0.3));
      if (lab <= 0) return;
      g += grp(V.T(PR.lab, y + 4.8, r.label, { size: 14, anchor: "end", weight: 600, color: r.pre ? C.preDark : C.encDark }) + (r.note === "scratch" ? V.T(PR.lab, y + 19, "scratch", { size: 11.5, anchor: "end", color: C.faint, italic: true }) : ""), { o: lab });
      const bar = inOut(seg(t, t0, t0 + 0.45)), bh = 16, by = y - bh / 2;
      const preEnd = sb(r.pre * bar), all = sb((r.pre + F.multimodal) * bar);
      if (r.pre) g += `<rect x="${PR.bx0}" y="${r1(by)}" width="${r1(Math.max(0, preEnd - PR.bx0 - 1))}" height="${bh}" fill="${C.pre}"/>`;
      g += `<rect x="${r1(r.pre ? preEnd : PR.bx0)}" y="${r1(by)}" width="${r1(Math.max(0, all - (r.pre ? preEnd : PR.bx0)))}" height="${bh}" rx="2" fill="#c3c8ce"/>`;
      if (k >= 2) {
        const e = inOut(seg(t, t0 + 0.1, t0 + 0.45)), pv = F.rows[k - 1], y0 = yOf(k - 1);
        if (e > 0) [[si(pv.imagenet), si(r.imagenet)], [sv(pv.vqa), sv(r.vqa)]].forEach(([a, b]) => {
          lines += `<line x1="${r1(a)}" y1="${r1(y0)}" x2="${r1(lerp(a, b, e))}" y2="${r1(lerp(y0, y, e))}" stroke="${C.pre}" stroke-width="2.2" stroke-linecap="round"/>`;
        });
      }
      const d = pop(seg(t, t0 + 0.25, t0 + 0.6));
      if (d > 0) {
        dots += r.imagenet != null ? popMark("diamond", si(r.imagenet), y, 6.4, C.pre, d) : grp(V.T(PR.ix0 + 8, y + 5, "—", { size: 14, color: C.faint }), { o: d });
        dots += popMark(r.pre ? "diamond" : "circle", sv(r.vqa), y, 6.4, r.pre ? C.pre : C.enc, d);
      }
    });
    g += lines + dots;
    // what the rows show, under each panel
    const c = outC(seg(t, T3.concl, T3.concl + 0.5));
    g += grp(V.T((PR.ix0 + PR.ix1) / 2, PR.bot + 44, "better ImageNet", { size: 14, anchor: "middle", weight: 600, color: C.ink }) +
      V.T((PR.vx0 + PR.vx1) / 2, PR.bot + 44, "not better VQA", { size: 14, anchor: "middle", weight: 600, color: C.ink }), { o: c, y: 5 * (1 - c) });
    return g;
  }

  function drawPrior(t) {
    return heading("§3 · Visual prior", "Does the vision encoder need separate pretraining?", t) + priorLeft(t) + priorRight(t) +
      answer("Separate pretraining is optional.", t, T3.answer);
  }

  // ------------------------------------------------------------ §4 Dedicated capacity
  /* First: encoder-free against the scratch encoder over lifetime compute at 1.7B, and the compute encoder-free needs
     to catch up (Figure 3). Second: the encoder's parameters given to the encoder-free backbone barely move it (Table 2). */
  const T4 = { curve: [1.7, 5.2], arrow: [6.0, 6.7], right: 9.2, ef: 9.8, sc: 10.5, rows: [11.8, 13.0, 14.2], answer: 15.9, dur: 22 };
  const PC = table({ x0: 36, sy: 116, px0: 76, px1: 400, py0: 418, py1: 172 }, { x0: 20, sy: 128, px0: 56, px1: 314, py0: 404, py1: 184 });
  function capLeft(t) {
    const S = D.trajectories.fig3["1.7B"];
    const xs = V.scale([0.56, 15.4], [PC.px0, PC.px1], true), ys = V.scale([28, 45], [PC.py0, PC.py1]);
    let g = grp(subTitle(PC.x0, PC.sy, "Over lifetime compute, 1.7B backbone") + yTitle(PC.x0, PC.py1 - 16, "Avg. VQA (%)") + yGrid([30, 35, 40, 45], ys, PC.px0, PC.px1) +
      xAxis([[1, "10^{21}"], [3, "3×10^{21}"], [10, "10^{22}"]], xs, PC.px0, PC.px1, PC.py0, "Lifetime FLOPs"), { o: outC(seg(t, 1.0, 1.5)) });
    const f = (S.x.length - 0.6) * seg(t, T4.curve[0], T4.curve[1]);
    let lines = "", marks = "";
    const ends = [], polys = [];
    ["encoderFree", "scratch"].forEach((key) => {
      const rc = RC[key], pts = S.x.map((x, i) => [xs(x), ys(S[key].vqa[i])]);
      const d = drawOn(pts, f, { color: rc.color, marker: rc.marker });
      lines += d.line; marks += d.marks;
      if (d.end) ends.push({ x: d.end[0], y: d.end[1], text: rc.name, color: rc.dark });
      polys.push(pts, ...pts.map((q) => box(q[0], q[1])));
    });
    g += lines + marks;
    // encoder-free needs this much more compute to reach the encoder's Avg. VQA
    const M = S.multiplier;
    g += gapArrow(xs(M.to * 0.97), xs(M.from * 1.03), ys(M.y), M.label, inOut(seg(t, T4.arrow[0], T4.arrow[1])), polys);
    if (ends.length) g += grp(endNames(ends), { o: seg(t, T4.curve[0] + 0.2, T4.curve[0] + 0.6) });
    return g;
  }

  const PS = table(
    { x0: 572, sy: 116, lab: 704, dx0: 716, dx1: 872, par: 906, top: 172, rowH: 46, div: { x: 544 } },
    { x0: 20, sy: 494, lab: 152, dx0: 164, dx1: 346, par: 396, top: 536, rowH: 33, div: { y: 466 } });
  function capRight(t) {
    const G = D.steelman[0];
    const rIn = outC(seg(t, T4.right, T4.right + 0.5));
    if (rIn <= 0) return "";
    const xs = V.scale([33.5, 41], [PS.dx0, PS.dx1]);
    const bottom = PS.top + G.rows.length * PS.rowH, yOf = (i) => PS.top + PS.rowH * (i + 0.5);
    let g = grp(divider(PS.div) + subTitle(PS.x0, PS.sy, "Giving encoder-free the encoder's parameters") +
      V.T(PS.par, PS.top - 12, "Params", { size: 12.5, anchor: "middle", color: C.faint }) +
      dotAxis([34, 36, 38, 40], xs, PS.dx0, PS.dx1, PS.top - 6, bottom, "Avg. VQA (%)"), { o: rIn });
    const sc = G.rows.find((r) => r.key === "scratch"), ef = G.rows[0];
    g += vref(xs(sc.vqa), bottom, PS.top - 6, inOut(seg(t, T4.sc + 0.2, T4.sc + 0.8)), C.enc);
    // encoder-free, then the scratch encoder, then three ways to spend the encoder's 0.4B parameters in the backbone
    const at = { encoderFree: T4.ef, scratch: T4.sc, wider: T4.rows[0], deeper: T4.rows[1], both: T4.rows[2] };
    G.rows.forEach((r, i) => {
      const t0 = at[r.key], y = yOf(i), a = outC(seg(t, t0, t0 + 0.35));
      if (a <= 0) return;
      const isEnc = r.key === "scratch", isEF = r.key === "encoderFree", fixed = isEnc || isEF;
      g += grp(V.T(PS.lab, y + 4.8, r.label, { size: 14, anchor: "end", weight: fixed ? 600 : 400, color: C.ink }) +
        V.T(PS.par, y + 4.8, r.params, { size: 13.5, anchor: "middle", color: C.muted }) +
        `<line x1="${PS.dx0}" x2="${PS.dx1}" y1="${y}" y2="${y}" stroke="${C.grid}"/>`, { o: a });
      // each variant starts at encoder-free's score and slides to its own
      const v = fixed ? r.vqa : lerp(ef.vqa, r.vqa, inOut(seg(t, t0 + 0.3, t0 + 0.9)));
      g += popMark(isEnc ? "circle" : "square", xs(v), y, 6.2, isEnc ? C.enc : isEF ? C.ef : "#f3b95c", pop(seg(t, t0 + 0.1, t0 + 0.45)));
      g += valueText(xs(v), y, r.vqa, seg(t, t0 + (fixed ? 0.4 : 0.9), t0 + (fixed ? 0.7 : 1.2)));
    });
    return g;
  }

  function drawCapacity(t) {
    return heading("§4 · Dedicated capacity", "Does visual understanding need capacity that only vision tokens use?", t) + capLeft(t) + capRight(t) +
      answer("Dedicated vision capacity is key.", t, T4.answer);
  }

  // ------------------------------------------------------------ §5 Placement, then Scale
  /* Part one: the encoder's capacity slides across the fusion boundary into the backbone (the bundle diagram's morph),
     and the first eight layers turn out to be the place for it (Table 3). Part two, as in the contents list's nested
     entry: per-recipe laws from 1B to 6.4B backbones (Figure 6). */
  const T5 = { glyph: 1.0, morph: [3.6, 5.2], right: 6.8, rows: [7.6, 8.8, 10.0, 11.2], best: 12.6, ansA: 13.0, toB: 17.6, ladder: 18.4, sweep: [19.1, 22.9], arrows: [23.6, 24.3, 25.0], ansB: 26.2, dur: 32.5 };
  const MORPH = {
    pre: { pw: 25, ph: 66, px: 88, pg: 8, a1: 80, c0: 173, c1: 226, bd: 200, bx: 226, bw: 254, Bx: 353 },
    inf: { pw: 21, ph: 52, px: 124, pg: 7, a1: 62, c0: 62, c1: 108, bd: 94, bx: 108, bw: 372, Bx: 404 },
  };
  // the bundle diagram (main.js), from a pre-fusion encoder (e = 0) to in-fusion capacity (e = 1); 492 x 276 units
  function morphGlyph(e) {
    const s = {}, cy = 134;
    Object.keys(MORPH.pre).forEach((k) => (s[k] = lerp(MORPH.pre[k], MORPH.inf[k], e)));
    let g = `<rect x="10" y="${cy - 29}" width="46" height="58" rx="7" fill="#eef0f2" stroke="#b7bcc3" stroke-width="2"/>` +
      `<path d="M15,${cy + 22}L27,${cy + 2}L35,${cy + 12}L41,${cy + 5}L51,${cy + 22}z" fill="#b7bcc3"/><circle cx="44" cy="${cy - 14}" r="5" fill="#c9cdd2"/>`;
    if (s.a1 - 62 > 3) g += `<line x1="62" x2="${r1(s.a1)}" y1="${cy}" y2="${cy}" stroke="#9aa1ab" stroke-width="5" stroke-linecap="round"/>`;
    g += `<line x1="${r1(s.c0)}" x2="${r1(s.c1)}" y1="${cy}" y2="${cy}" stroke="#9aa1ab" stroke-width="5" stroke-linecap="round"/>`;
    g += `<rect x="${r1(s.bx)}" y="${cy - 45}" width="${r1(s.bw)}" height="90" rx="20" fill="#fff" stroke="#3a4048" stroke-width="3"/>`;
    for (let i = 0; i < 3; i++) g += `<rect x="${r1(s.px + i * (s.pw + s.pg))}" y="${r1(cy - s.ph / 2)}" width="${r1(s.pw)}" height="${r1(s.ph)}" rx="${r1(s.pw / 2)}" fill="${C.encLight}" stroke="${C.enc}" stroke-width="2.6"/>`;
    g += V.T(s.Bx, cy + 17, "B", { size: 50, weight: 600, anchor: "middle", color: C.ink });
    g += `<line x1="446" x2="446" y1="${cy + 94}" y2="${cy + 52}" stroke="#9aa1ab" stroke-width="2.4" marker-end="url(#film-ahg)"/>` + V.T(446, cy + 114, "text tokens", { size: 17, anchor: "middle", color: C.faint, italic: true });
    g += `<line x1="${r1(s.bd)}" x2="${r1(s.bd)}" y1="${cy - 72}" y2="${cy + 74}" stroke="${C.ink}" stroke-width="1.8" stroke-dasharray="6 5"/>` + V.T(s.bd, cy + 92, "fusion boundary", { size: 16, anchor: "middle", color: C.muted });
    return g;
  }
  const PG = table({ x0: 36, sy: 116, tx: 40, ty: 176, s: 0.84, lx: 244, ly: 414 }, { x0: 20, sy: 128, tx: 24, ty: 148, s: 0.8, lx: SHAPES.tall.W / 2, ly: 386 });
  function placeLeft(t) {
    const gIn = outC(seg(t, T5.glyph, T5.glyph + 0.5)), e = inOut(seg(t, T5.morph[0], T5.morph[1]));
    if (gIn <= 0) return "";
    const out = seg(t, T5.morph[0], T5.morph[0] + 0.35), into = outC(seg(t, T5.morph[1] - 0.3, T5.morph[1] + 0.2));
    return grp(subTitle(PG.x0, PG.sy, "The encoder's 0.4B parameters, moved into the backbone") +
      `<g transform="translate(${PG.tx} ${PG.ty}) scale(${PG.s})">${morphGlyph(e)}</g>` +
      grp(V.T(PG.lx, PG.ly, "Pre-fusion capacity", { size: 17, weight: 600, anchor: "middle", color: C.encDark }), { o: 1 - out }) +
      grp(V.T(PG.lx, PG.ly, "In-fusion capacity", { size: 17, weight: 600, anchor: "middle", color: C.encDark }), { o: into, y: 5 * (1 - into) }), { o: gIn, y: 8 * (1 - gIn) });
  }

  // the backbone's 28 layers (gray, used by every token) with blue vision-only modules where a design puts them
  const SPREAD = new Set([0, 4, 8, 12, 15, 19, 23, 27]);
  const VIS = { "vis-every": () => "thin", "vis-spread": (i) => SPREAD.has(i), "vis-late": (i) => i >= 20, "vis-early": (i) => i < 8 };
  function layers(pattern, x, base, e) {
    const w = 4.3, gap = 1.5, hb = 12, he = 7;
    let g = "";
    for (let i = 0; i < 28; i++) {
      const lx = x + i * (w + gap), v = VIS[pattern](i);
      g += `<rect x="${r1(lx)}" y="${base - hb}" width="${w}" height="${hb}" rx="1" fill="#c3c8ce"/>`;
      if (v && e > 0) { const h = (v === "thin" ? 2.8 : he) * e; g += `<rect x="${r1(lx)}" y="${r1(base - hb - 1.4 - h)}" width="${w}" height="${r1(h)}" rx="1" fill="${C.enc}"/>`; }
    }
    return g;
  }
  const PP = table(
    { x0: 508, sy: 116, dx0: 704, dx1: 904, top: 178, rowH: 56, div: { x: 480 } },
    { x0: 20, sy: 440, dx0: 214, dx1: 414, top: 488, rowH: 52, div: { y: 418 } });
  function placeRight(t) {
    const CD = D.capacityDesign, rows = CD.groups[1].rows;
    const rIn = outC(seg(t, T5.right, T5.right + 0.5));
    if (rIn <= 0) return "";
    const xs = V.scale([31, 41], [PP.dx0, PP.dx1]);
    const bottom = PP.top + rows.length * PP.rowH, yOf = (i) => PP.top + PP.rowH * (i + 0.5) + 6;
    let g = "";
    const hb = outC(seg(t, T5.best, T5.best + 0.5)), bi = rows.findIndex((r) => r.best);
    if (hb > 0) g += `<rect x="${PP.x0 - 8}" y="${r1(PP.top + PP.rowH * bi + 3)}" width="${PP.dx1 - PP.x0 + 18}" height="${PP.rowH - 6}" rx="8" fill="${TEAL_L}" opacity="${hb.toFixed(3)}"/>`;
    g += grp(divider(PP.div) + subTitle(PP.x0, PP.sy, "Where the vision-only parameters sit") + dotAxis([31, 33, 35, 37, 39, 41], xs, PP.dx0, PP.dx1, PP.top - 6, bottom, "Avg. VQA (%)"), { o: rIn });
    // references: encoder-free and the scratch encoder
    const rf = inOut(seg(t, T5.right + 0.3, T5.right + 0.9));
    [[CD.refs.encoderFree.vqa, C.ef, C.efDark, "encoder-free"], [CD.refs.scratch.vqa, C.enc, C.encDark, "scratch encoder"]].forEach(([v, c, cd, lab]) => {
      g += vref(xs(v), bottom, PP.top - 8, rf, c) + grp(V.T(xs(v), PP.top - 14, lab, { size: 13, anchor: "middle", color: cd, weight: 600 }), { o: seg(rf, 0.5, 1) });
    });
    // each placement: its layers fill in, then its score lands
    rows.forEach((r, i) => {
      const t0 = T5.rows[i], y = yOf(i), a = outC(seg(t, t0, t0 + 0.35));
      if (a <= 0) return;
      g += grp(V.T(PP.x0, y - 16, r.label, { size: 13.5, color: C.ink, weight: r.best ? 600 : 500 }) + layers(r.pattern, PP.x0, y + 10, inOut(seg(t, t0 + 0.2, t0 + 0.65))), { o: a });
      g += popMark("tri-up", xs(r.vqa), y, 6.6, C.infFFN, pop(seg(t, t0 + 0.55, t0 + 0.9)));
      g += valueText(xs(r.vqa), y, r.vqa, seg(t, t0 + 0.8, t0 + 1.1), xs(r.vqa) > PP.dx1 - 60);
    });
    return g;
  }

  const PB = table({ x0: 36, px0: 76, px1: 756, py0: 420, py1: 150 }, { x0: 20, px0: 56, px1: 420, py0: 640, py1: 200 });
  // the tall stage names the recipes in a row above the plot instead of at the lines' ends, so the plot can take the full width
  function legendRow(keys, x, y) {
    return keys.map((k) => {
      const rc = RC[k], x0 = x;
      x += 48 + tw(rc.name, 13.5, 600);
      return `<line x1="${x0}" x2="${x0 + 24}" y1="${y - 4.5}" y2="${y - 4.5}" stroke="${rc.color}" stroke-width="2.2"${k === "infusion" ? ' stroke-dasharray="5 3"' : ""}/>` +
        V.marker(rc.marker, x0 + 12, y - 4.5, 4.6, rc.color, { sw: 1.4 }) + V.T(x0 + 30, y, rc.name, { size: 13.5, weight: 600, color: rc.dark });
    }).join("");
  }
  function scaleLaws(t) {
    const L = D.ladder, keys = ["encoderFree", "scratch", "infusion"];
    const aIn = outC(seg(t, T5.ladder, T5.ladder + 0.5));
    if (aIn <= 0) return "";
    const xs = V.scale([5.86e20, 3.9e22], [PB.px0, PB.px1], true), ys = V.scale([25, 53], [PB.py0, PB.py1]);
    let g = grp(yTitle(PB.x0, PB.py1 - 16, "Avg. VQA (%)") + yGrid([25, 30, 35, 40, 45, 50], ys, PB.px0, PB.px1) +
      xAxis([[1e21, "10^{21}"], [3e21, "3×10^{21}"], [1e22, "10^{22}"], [3e22, "3×10^{22}"]], xs, PB.px0, PB.px1, PB.py0, "Lifetime compute (FLOPs)") +
      (TALL ? legendRow(keys, PB.x0, PB.py1 - 58) : ""), { o: aIn });
    const curves = {};
    keys.forEach((k) => (curves[k] = L.vqaCurves[k].map((q) => [xs(q[0]), ys(q[1])])));
    // a sweep from small to large compute draws each recipe's fitted law; each backbone's runs land as it passes
    const sw = inOut(seg(t, T5.sweep[0], T5.sweep[1])), front = lerp(PB.px0, PB.px1 + 2, sw);
    if (sw > 0) {
      g += `<clipPath id="film-sweep"><rect x="${PB.px0 - 2}" y="${PB.py1 - 12}" width="${r1(front - PB.px0 + 2)}" height="${PB.py0 - PB.py1 + 24}"/></clipPath><g clip-path="url(#film-sweep)">` +
        keys.map((k) => `<path d="${curves[k].map((q, i) => (i ? "L" : "M") + r1(q[0]) + "," + r1(q[1])).join("")}" fill="none" stroke="${RC[k].color}" stroke-width="1.9"${k === "infusion" ? ' stroke-dasharray="6 4"' : ""}/>`).join("") + `</g>`;
    }
    L.sizes.forEach((sz, i) => {
      const x = xs(L.x[i]), e = pop(clamp((front - x) / 36));
      if (e <= 0) return;
      g += grp(V.T(x, PB.py0 - 9, sz, { size: 13, anchor: "middle", color: C.faint, weight: 500 }), { o: Math.min(1, e) });
      keys.forEach((k) => (g += popMark(RC[k].marker, x, ys(L.vqa[k][i]), 5.6, RC[k].color, e)));
    });
    // the compute encoder-free needs to match the encoder, at each backbone size
    const polys = keys.map((k) => curves[k]);
    L.x.forEach((x, i) => keys.forEach((k) => polys.push(box(xs(x), ys(L.vqa[k][i])))));
    L.vqa.multipliers.forEach((M, i) => { g += gapArrow(xs(M.to / 1.04), xs(M.from * 1.04), ys(M.y), M.label, inOut(seg(t, T5.arrows[i], T5.arrows[i] + 0.55)), polys, "right"); });
    if (TALL) return g;
    const ends = keys.map((k) => ({ y: curves[k][curves[k].length - 1][1], text: RC[k].name, color: RC[k].dark }));
    return g + grp(endNames(ends, PB.px1 + 12, 16), { o: seg(t, T5.sweep[1] - 0.3, T5.sweep[1] + 0.2) });
  }

  function drawPlacement(t) {
    const b = inOut(seg(t, T5.toB, T5.toB + 0.6));
    const a = outC(seg(t, 0.45, 0.95)), q = outC(seg(t, 0.57, 1.07)), h = outC(seg(t, T5.toB + 0.3, T5.toB + 0.8));
    let s = grp(V.T(M0.x, M0.ky, "§5 · Placement", { size: M0.ks, weight: 600, color: TEAL_D }), { o: a, y: 6 * (1 - a) });
    // the Scale part: a hooked arrow and its name follow the section label, as in the contents list
    const kx = M0.x + tw("§5 · Placement", M0.ks, 600) + 12, ky = M0.ky - 12;
    s += grp(`<path d="M${r1(kx)},${ky}v6q0 4 4 4h8M${r1(kx + 9)},${ky + 6.8}l3.4 3.2-3.4 3.2" fill="none" stroke="${TEAL_D}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      V.T(kx + 19, M0.ky, "Scale", { size: M0.ks, weight: 600, color: TEAL_D }), { o: h, x: -6 * (1 - h) });
    s += grp(question("Must that capacity act before vision meets text?"), { o: q * (1 - b), y: 8 * (1 - q) });
    s += grp(question("The comparisons hold with scale."), { o: h, y: 8 * (1 - h) });
    if (b < 1) s += grp(placeLeft(t) + placeRight(t) + answer("Vision capacity can be in-fusion.", t, T5.ansA), { o: 1 - b });
    return s + scaleLaws(t) + answer("In-fusion stays comparable to the encoder at every size.", t, T5.ansB);
  }

  // ------------------------------------------------------------ §6 In practice
  /* First: adding vision to a pretrained 1.7B text model (Figure 8). Second: time to first token (Figure 9). */
  const T6 = { left: 1.0, rows: [1.8, 2.6, 3.4, 4.2, 5.0, 5.8], right: 8.8, prefill: 9.4, adds: [10.3, 10.9, 11.5, 12.1, 12.7, 13.3], answer: 14.8, dur: 21 };
  const PM = table({ x0: 36, sy: 116, lab: 236, dx0: 250, dx1: 438, top: 162, rowH: 42 }, { x0: 20, sy: 128, lab: 212, dx0: 224, dx1: 408, top: 158, rowH: 34 });
  function midLeft(t) {
    const M = D.midtraining, n = M.rows.length;
    const xs = V.scale([35, 46], [PM.dx0, PM.dx1]);
    const bottom = PM.top + n * PM.rowH, yOf = (i) => PM.top + PM.rowH * (i + 0.5);
    let g = grp(subTitle(PM.x0, PM.sy, "Mid-training from a pretrained 1.7B text model") + dotAxis([35, 37, 39, 41, 43, 45], xs, PM.dx0, PM.dx1, PM.top - 6, bottom, "Avg. VQA (%)"), { o: outC(seg(t, T6.left, T6.left + 0.5)) });
    // rows land from the lowest score up
    M.rows.forEach((r, i) => {
      const t0 = T6.rows[n - 1 - i], y = yOf(i), a = outC(seg(t, t0, t0 + 0.35));
      if (a <= 0) return;
      const rc = RC[r.key];
      g += grp(V.T(PM.lab, y + 4.8, r.label, { size: 14, anchor: "end", color: C.ink }) + `<line x1="${PM.dx0}" x2="${PM.dx1}" y1="${y}" y2="${y}" stroke="${C.grid}"/>`, { o: a });
      g += popMark(rc.marker, xs(r.vqa), y, 6.2, rc.color, pop(seg(t, t0 + 0.15, t0 + 0.5)));
      g += valueText(xs(r.vqa), y, r.vqa, seg(t, t0 + 0.4, t0 + 0.7));
    });
    return g;
  }

  const PT = table(
    { x0: 508, sy: 116, lab: 652, bx0: 662, bx1: 862, top: 162, rowH: 42, div: { x: 480 } },
    { x0: 20, sy: 468, lab: 150, bx0: 160, bx1: 350, top: 518, rowH: 28, div: { y: 440 } });
  function ttftRight(t) {
    const TT = D.ttft, rows = TT.groups.flatMap((gr) => gr.rows), n = rows.length;
    const rIn = outC(seg(t, T6.right, T6.right + 0.5));
    if (rIn <= 0) return "";
    const xs = V.scale([0, 108], [PT.bx0, PT.bx1]), px = xs(TT.prefill);
    const bottom = PT.top + n * PT.rowH, yOf = (i) => PT.top + PT.rowH * (i + 0.5);
    let g = grp(divider(PT.div) + subTitle(PT.x0, PT.sy, "Time to first token") + dotAxis([0, 20, 40, 60, 80, 100], xs, PT.bx0, PT.bx1, PT.top - 6, bottom, "Milliseconds, lower is better") +
      rows.map((r, i) => V.T(PT.lab, yOf(i) + 4.8, r.label, { size: 14, anchor: "end", color: C.ink })).join(""), { o: rIn });
    // every recipe pays the same backbone prefill; each then adds its vision-only work
    const pf = inOut(seg(t, T6.prefill, T6.prefill + 0.6));
    g += grp(`<path d="M${PT.bx0},${PT.top - 10}v-5H${r1(px)}v5" fill="none" stroke="${C.muted}" stroke-width="1.2"/>` +
      V.T((PT.bx0 + px) / 2, PT.top - 21, "backbone prefill", { size: 12.5, anchor: "middle", color: C.muted }), { o: seg(t, T6.prefill + 0.4, T6.prefill + 0.8) });
    rows.forEach((r, i) => {
      const y = yOf(i), bh = 18, rc = RC[r.key];
      if (pf > 0) g += `<rect x="${PT.bx0}" y="${r1(y - bh / 2)}" width="${r1((px - PT.bx0) * pf)}" height="${bh}" fill="#dfe2e6"/>`;
      const e = inOut(seg(t, T6.adds[i], T6.adds[i] + 0.45));
      if (e <= 0) return;
      if (r.added > 0) g += `<rect x="${r1(px + 1.5)}" y="${r1(y - bh / 2)}" width="${r1(Math.max(0, (xs(TT.prefill + r.added) - px - 1.5) * e))}" height="${bh}" rx="3" fill="${rc.hatch ? "url(#film-hatch)" : rc.color}"/>`;
      else g += `<rect x="${r1(px - 2.5)}" y="${r1(y - bh / 2)}" width="2.5" height="${bh}" fill="${rc.color}" opacity="${e.toFixed(2)}"/>`;
      g += grp(V.T(xs(TT.prefill + r.added) + 8, y + 4.8, r.total, { size: 13.5, weight: 600, color: C.ink }), { o: seg(e, 0.6, 1) });
    });
    return g;
  }

  function drawPractice(t) {
    return heading("§6 · In practice", "Does dedicated capacity still matter in practice?", t) + midLeft(t) + ttftRight(t) +
      answer("Dedicated capacity still matters in practice.", t, T6.answer);
  }

  // ------------------------------------------------------------ chapters and playback
  const CH = [
    { key: "overview", label: "Overview", dur: T0.dur, draw: drawOverview,
      aria: "Three questions about the vision encoder, answered: separate pretraining is optional, dedicated vision capacity is key, and vision capacity can be in-fusion." },
    { key: "setup", sec: "§2", label: "Setup", dur: T2.dur, draw: drawSetup, morph: true,
      aria: "Published models differ in data, training schedule, compute and backbone at once. This study holds all four fixed, so only the vision encoding differs." },
    { key: "prior", sec: "§3", label: "Visual prior", dur: T3.dur, draw: drawPrior,
      aria: "As encoder pretraining takes more of a fixed budget, Avg. VQA falls below the scratch encoder's. Longer pretraining at no cost raises ImageNet accuracy but not Avg. VQA. Separate pretraining is optional." },
    { key: "capacity", sec: "§4", label: "Dedicated capacity", dur: T4.dur, draw: drawCapacity,
      aria: "Encoder-free trails the scratch encoder over lifetime compute and needs 2.6 times the compute to match it. Giving encoder-free the encoder's parameters does not close the gap. Dedicated vision capacity is key." },
    { key: "placement", sec: "§5", label: "Placement", dur: T5.dur, draw: drawPlacement,
      aria: "Moved into the backbone, vision-only capacity works best in the first eight layers, close to the scratch encoder. From 1B to 6.4B backbones, in-fusion stays comparable to the encoder, while encoder-free needs 2.4 to 3.4 times the compute." },
    { key: "practice", sec: "§6", label: "In practice", dur: T6.dur, draw: drawPractice,
      aria: "Adding vision to a pretrained 1.7B text model, in-fusion, early mixture-of-transformers and the scratch encoder lead encoder-free. In-fusion adds the least time to first token. Dedicated capacity still matters in practice." },
  ];
  const BTN = {
    pause: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.2" y="1.5" width="2.6" height="9" rx=".6" fill="currentColor"/><rect x="7.2" y="1.5" width="2.6" height="9" rx=".6" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 1.6v8.8l7-4.4z" fill="currentColor"/></svg>',
    replay: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M9.2 4.45A3.7 3.7 0 1 1 6 2.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7.6 2.6L5.2 0.85v3.5z" fill="currentColor"/></svg>',
  };
  const BTN_LABEL = { pause: "Pause", play: "Play", replay: "Replay" };

  const stage = fig.querySelector(".film-stage"), svg = stage.querySelector("svg"), body = svg.querySelector(".film-body");
  const btn = fig.querySelector(".ch-btn"), list = fig.querySelector(".ch-list");
  svg.insertAdjacentHTML("afterbegin", `<defs>${V.arrowDef("film-ah", C.ink)}${V.arrowDef("film-ahg", "#9aa1ab")}` +
    `<pattern id="film-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${C.motLight}"/><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" stroke-width="2.2"/></pattern></defs>`);
  list.style.setProperty("--n", CH.length);
  // each chapter: a progress track and its name; on phones only the tracks show, with the current name below them
  list.innerHTML = CH.map((c) => `<button class="ch" type="button" aria-label="${c.sec ? c.sec + " " : ""}${c.label}"><span class="trk"><span class="fill"></span></span><span class="lbl">${c.sec ? `<span class="sec">${c.sec}</span>` : ""}${c.label}</span></button>`).join("") +
    `<p class="ch-now" aria-hidden="true"></p>`;
  const chs = [...list.querySelectorAll(".ch")], fills = chs.map((c) => c.querySelector(".fill")), now = list.querySelector(".ch-now");

  // the tall stage when the figure is under 640 px wide (measured on the figure: the tall stage itself may be capped narrower)
  function fitShape() {
    const tall = fig.clientWidth > 0 && fig.clientWidth < 640;
    if (tall === TALL && svg.dataset.shape) return false;
    setShape(tall);
    fig.classList.toggle("tall", tall);
    svg.setAttribute("viewBox", `0 0 ${SW} ${SH}`);
    svg.dataset.shape = tall ? "tall" : "wide";
    return true;
  }

  const FADE = 0.45;
  let k = 0, t = 0, playing = false, last = null, raf = 0, flowed = false, held = false, done = false;
  function frame() {
    const c = CH[k];
    if (reduceMotion) return c.draw(c.dur);
    let s = c.draw(t);
    // arriving from the previous chapter: its last frame fades out first (the setup chapter morphs instead)
    if (flowed && k > 0 && !c.morph && t < FADE) s = grp(CH[k - 1].draw(CH[k - 1].dur), { o: 1 - inOut(t / FADE) }) + s;
    return s;
  }
  // the stage is redrawn only when its picture changes (about half the frames hold still), a track's fill only when
  // it grows by a device pixel, and the chapter bar's names and states only when the chapter changes
  let drawn = "", shown = -1, fillSteps = 300;
  const fillAt = fills.map(() => -1);
  const measureFills = () => { fillSteps = Math.max(60, Math.round(fills[0].parentElement.clientWidth * (window.devicePixelRatio || 1))); };
  function render() {
    const t0 = performance.now(), s = frame();
    if (s !== drawn) { body.innerHTML = drawn = s; pace(performance.now() - t0); }
    fills.forEach((f, i) => {
      const v = i < k ? 1 : i > k ? 0 : reduceMotion ? 1 : Math.round(clamp(t / CH[i].dur) * fillSteps) / fillSteps;
      if (v !== fillAt[i]) { fillAt[i] = v; f.style.transform = `scaleX(${v})`; }
    });
    if (shown === k) return;
    shown = k;
    svg.setAttribute("aria-label", CH[k].aria);
    chs.forEach((c, i) => { c.classList.toggle("on", i === k); if (i === k) c.setAttribute("aria-current", "step"); else c.removeAttribute("aria-current"); });
    now.innerHTML = (CH[k].sec ? `<span class="sec">${CH[k].sec}</span>` : "") + CH[k].label;
  }
  // a redraw on every screen refresh up to 100 Hz (every other one on faster screens, which would double the work for
  // nothing), and 30 a second where building a frame takes over 2.5 ms (a laptop takes about 1, a mid-range phone
  // about 4): after a warm-up, the median of each 24 redraws decides, and a slow device stays at 30
  let gap = 10, lastDraw = -Infinity, redraws = 0;
  const costs = [];
  function pace(ms) {
    if (gap > 10 || ++redraws <= 30) return;
    costs.push(ms);
    if (costs.length < 24) return;
    if (costs.sort((a, b) => a - b)[12] > 2.5) gap = 31;
    costs.length = 0;
  }
  const setBtn = (st) => { btn.innerHTML = BTN[st]; btn.setAttribute("aria-label", BTN_LABEL[st]); };
  function loop(stamp) {
    if (!playing) return;
    if (last != null) t += Math.min(0.1, (stamp - last) / 1000);
    last = stamp;
    while (t >= CH[k].dur) {
      if (k === CH.length - 1) { t = CH[k].dur; playing = false; done = true; setBtn("replay"); render(); return; }
      t -= CH[k].dur; k += 1; flowed = true;
    }
    if (stamp - lastDraw >= gap) { lastDraw = stamp; render(); }
    raf = requestAnimationFrame(loop);
  }
  function play() {
    if (done) { k = 0; t = 0; flowed = false; done = false; }
    playing = true; held = false; last = null;
    setBtn("pause");
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function pause(byUser) {
    playing = false;
    if (byUser) held = true;
    cancelAnimationFrame(raf);
    setBtn(done ? "replay" : "play");
    render();
  }
  function jump(i) {
    k = clamp(i, 0, CH.length - 1); t = 0; flowed = false; done = false;
    render();
    if (!reduceMotion) play();
  }
  const toggle = () => (playing ? pause(true) : play());

  btn.addEventListener("click", toggle);
  stage.addEventListener("click", () => { if (!reduceMotion) toggle(); });
  chs.forEach((c, i) => c.addEventListener("click", () => jump(i)));
  fig.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); jump(k + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); jump(t > 1.5 ? k : k - 1); }
    else if (e.key === " " && e.target === stage && !reduceMotion) { e.preventDefault(); toggle(); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { widths.clear(); wraps.clear(); render(); });
  // switch between the wide and tall stage when the width crosses the breakpoint (playback redraws on its own)
  if ("ResizeObserver" in window) new ResizeObserver(() => { const changed = fitShape(); measureFills(); if (changed && !playing) render(); }).observe(fig);

  fitShape();
  measureFills();
  if (reduceMotion) {
    btn.hidden = true;
    render();
  } else {
    // ?film=<chapter>@<seconds> opens paused on one frame (for checking stills)
    const seek = params.get("film");
    if (seek) {
      const [key, at] = seek.split("@"), i = CH.findIndex((c) => c.key === key);
      if (i >= 0) { k = i; t = clamp(+at || 0, 0, CH[i].dur); }
      held = true;
    }
    setBtn("play");
    render();
    // play while at least half the stage is on screen; pause when it scrolls away, resume when it returns
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { if (!playing && !held && !done) play(); }
        else if (playing) pause(false);
      }), { threshold: 0.5 }).observe(stage);
    } else if (!held) play();
  }
})();
