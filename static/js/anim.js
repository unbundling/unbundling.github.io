/* ==========================================================================
   Animated figures: the teaser (the three questions, answered in turn) and §2's protocol grid (published models differ
   in everything, so no comparison is clean; this study fixes each control to one listed setting, leaving the vision
   encoding as the only difference).
   Every frame is drawn from time alone. Each figure plays once when it reaches the middle of the screen and again on
   Replay; reduced motion and ?static show the last frame.
   Glyphs, markers and colors come from Viz (viz.js). Each figure has a wide layout and a tall one for phones;
   layout tables hold both variants and are switched in place, so the drawing code reads one set of names.
   ========================================================================== */
(function () {
  "use strict";
  const V = window.Viz, C = V.C, r1 = V.r1;
  const NS = "http://www.w3.org/2000/svg";
  const TEAL = C.accent, TEAL_D = "#006b67", TEAL_L = C.accentLight, INK2 = "#3d4651", ICON = "#4b5560";
  const params = new URLSearchParams(location.search);
  const reduceMotion = params.has("static") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------ layouts: wide, or tall when the figure is under 640 px
  let TALL = false, SW = 960;
  const TABLES = [];
  // a layout table with a wide and a tall variant (same keys); setShape() copies the active variant into it
  function table(wide, tall) { const t = Object.assign({}, wide); TABLES.push([t, wide, tall]); return t; }
  function setShape(tall) {
    TALL = tall;
    SW = tall ? 440 : 960;
    TABLES.forEach(([t, w, tl]) => Object.assign(t, tall ? tl : w));
  }

  // ------------------------------------------------------------ timing and drawing helpers
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const outC = (x) => 1 - Math.pow(1 - x, 3);
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
  document.body.appendChild(meas);
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

  // ------------------------------------------------------------ teaser: the three questions, answered in turn
  const T0 = { answers: [0.8, 1.8, 2.8], dur: 3.4 };
  const STRIP = [["data", "Common data"], ["schedule", "Training schedule"], ["compute", "Lifetime compute"], ["backbone", "One backbone"]];
  const SY = 52;
  // the controls strip: one row on the wide layout, a 2 x 2 grid on the tall one
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
    { sec: "§3", href: "#prior", q: "Is separate pretraining needed?", a: "Separate pretraining is optional.", opts: [["pretrained", "Pretrained encoder", C.preDark], ["scratch", "Scratch encoder", C.encDark]] },
    { sec: "§4", href: "#capacity", q: "Is vision capacity needed?", a: "Dedicated vision capacity is key.", opts: [["free", "Encoder-free", C.efDark], ["scratch", "Scratch encoder", C.encDark]] },
    { sec: "§5", href: "#placement", q: "Must capacity precede fusion?", a: "Vision capacity can be in-fusion.", opts: [["scratch", "Pre-fusion capacity", C.encDark], ["infusion", "In-fusion capacity", C.encDark]] },
  ];
  // panels: three columns on the wide layout, three stacked rows (each with its two options side by side) on the tall one
  const PW = 304, PX = (i) => 24 + i * PW, TY = (i) => 144 + i * 222;
  const OV = { qy: 150, cx: 46, cw: 238, ch: 114, cy: [176, 302], ay: 466, gh: 54 };
  const dividers = () => (TALL ? `<path d="M20,${TY(1) - 12}H${SW - 20}M20,${TY(2) - 12}H${SW - 20}" stroke="#eceef1" stroke-width="1.2"/>` : `<path d="M328,112V488M632,112V488" stroke="#eceef1" stroke-width="1.2"/>`);
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
  // each panel links to its section; the whole panel is the target
  const panelBox = (i) => (TALL ? [10, TY(i) - 6, SW - 20, 200] : [PX(i) + 4, 122, PW - 8, 368]);

  function drawOverview(t) {
    const L = stripLayout();
    let s = V.T(L.lx, L.ly, "§2 Controlled", { size: L.lfs, weight: 600, color: TEAL_D }) + stripRule(L) + dividers();
    L.items.forEach((it) => { s += icon(it.id, it.x, it.y - 12, 24, ICON) + V.T(it.x + 33, it.y + 6.5, it.label, { size: L.fs, color: INK2 }); });
    QS.forEach((P, i) => {
      const a0 = T0.answers[i];
      const lit = i === 0 ? 1 : lerp(0.42, 1, inOut(seg(t, a0 - 0.35, a0)));
      const [bx, by, bw, bh] = panelBox(i);
      s += `<a class="q-link" href="${P.href}" aria-label="${V.esc(`${P.sec} ${P.q} ${P.a}`)}"><rect class="q-hit" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="10"/>` +
        grp(panel(i, inOut(seg(t, a0, a0 + 0.5))), { o: lit }) + `</a>`;
    });
    return s;
  }

  // ------------------------------------------------------------ §2 protocol: published models differ in everything; we fix all but the vision encoding
  /* Rows are the four controls. Published models (one per recipe) differ in all four at once, so no comparison between
     them is clean. Each row then snaps to one common setting, its cells merging into one, and the setting is listed
     beside it. Last, the recipes become the vision-encoding band and in-fusion joins: the only thing left that differs.
     On the tall layout each row's label sits above its cells, the cells are drawn smaller, and the listed settings wrap. */
  const TG = { ne: [0.4, 0.55, 0.7, 0.85], msg: [1.3, 2.8], fix: [3.2, 3.85, 4.5, 5.15], fixDur: 0.6, head: 5.9, inf: [6.2, 6.7], dur: 6.9 };
  const PROTO = [
    { id: "data", label: "Data", fixed: "Common data", lines: ["Text from Nemotron-CC v2 and v2.1", "Image–text pairs from MetaCLIP 1.2 (English subset)", "One set of Qwen2.5-VL-32B captions, shared by all recipes"] },
    { id: "schedule", label: "Training schedule", fixed: "Training schedule", lines: ["Warmup–stable–decay: any checkpoint can be decayed", "Budgets from 6.5×10^{20} to 2.9×10^{22} FLOPs", "One peak learning rate per backbone size"] },
    { id: "compute", label: "Compute", fixed: "Lifetime compute", eq: "C_{lifetime} = Σ_{s} C_{s}", lines: ["Every training stage counts, encoder pretraining too", "Recipes are compared at matched lifetime compute"] },
    { id: "backbone", label: "Backbone", fixed: "One backbone", lines: ["Dense decoder-only Transformer, trained from scratch", "Mainly the Qwen3-1.7B and 4B configurations", "One encoder architecture: a 27-layer, 0.4B ViT"] },
  ];
  // XM, YM: where a row's cells merge (YM from the row); dx, dw, dfs, dlh, dy: the listed settings' left edge, width, size,
  // line step and offset from the row; msg: the "no clean comparison" note's center and size. On the tall layout the
  // merged setting moves up beside its label, so the list below it can use the full width.
  const GR = table(
    { HY: 128, gh: 46, ny: 48, ns: 15.5, RY: [236, 328, 420, 512], X3: [363, 592, 821], X4: [334, 506, 678, 850], XM: 322, YM: 0, cs: 1, cdy: 0, lx: 40, ldy: 0, ls: 17.5,
      band: [252, 92, 688, 98], vx: 40, vy: 134, vs: 17.5, ne: 26, dx: 418, dw: 520, dfs: 16, dlh: 22, dy: -22, msg: [594, 374, 560, 74] },
    { HY: 162, gh: 30, ny: 33, ns: 13, RY: [282, 446, 610, 774], X3: [87, 220, 353], X4: [70, 170, 270, 370], XM: 364, YM: -28, cs: 0.66, cdy: 16, lx: 20, ldy: -28, ls: 17,
      band: [20, 128, 400, 78], vx: 20, vy: 118, vs: 14, ne: 20, dx: 20, dw: 400, dfs: 16, dlh: 21, dy: 8, msg: [220, 528, 404, 80] });
  const COLS = [["pretrained", "Pretrained encoder", "Pretrained", C.preDark], ["scratch", "Scratch encoder", "Scratch", C.encDark], ["free", "Encoder-free", "Encoder-free", C.efDark], ["infusion", "In-fusion", "In-fusion", C.infDark]];
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
      // the label keeps its size when the cell is drawn smaller; on the tall layout it starts at the bar, clear of the edge
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

  // a row's listed settings, each broken to the column's width: the equation (if any), then one bulleted line per setting
  const wraps = new Map();
  function wrap(str, size, maxW) {
    const key = `${str}|${size}|${maxW}`;
    if (!wraps.has(key)) {
      const out = [];
      let cur = "";
      str.split(" ").forEach((w) => {
        const next = cur ? `${cur} ${w}` : w;
        if (cur && tw(next.replace(/[\^_]\{([^}]*)\}/g, "$1"), size) > maxW) { out.push(cur); cur = w; } else cur = next;
      });
      out.push(cur);
      wraps.set(key, out);
    }
    return wraps.get(key);
  }
  function settingLines(P) {
    const out = P.eq ? [{ s: P.eq, eq: true }] : [];
    P.lines.forEach((l) => wrap(l, GR.dfs, GR.dw - 12).forEach((str, k) => out.push({ s: str, bullet: k === 0 })));
    return out;
  }

  function drawGrid(t) {
    const ov = outC(seg(t, TG.msg[0], TG.msg[0] + 0.3)) * (1 - seg(t, TG.msg[1], TG.msg[1] + 0.3)), dim = 1 - 0.62 * ov;
    const h = inOut(seg(t, TG.head, TG.head + 0.6)), hb = outC(seg(t, TG.head, TG.head + 0.5)), inf = outC(seg(t, TG.inf[0], TG.inf[1]));
    let s = "";
    // header: the published models' recipes, which become the vision-encoding band once everything else is fixed
    if (hb > 0) {
      const [bx, by, bw, bh] = GR.band;
      s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="12" fill="${TEAL_L}" stroke="${TEAL}" stroke-width="1.5" opacity="${hb.toFixed(3)}"/>`;
    }
    s += grp(V.T(GR.vx, GR.vy, "Published models", { size: GR.vs, weight: 600, color: C.muted }), { o: 1 - hb });
    s += grp(V.T(GR.vx, GR.vy, "Vision encoding", { size: GR.vs, weight: 600, color: TEAL_D }), { o: hb, x: -8 * (1 - hb) });
    COLS.forEach(([kind, name, short, color], j) => {
      const o = j < 3 ? 1 : inf, x = j < 3 ? lerp(GR.X3[j], GR.X4[j], h) : GR.X4[3] + 24 * (1 - inf);
      if (o > 0) s += grp(glyphAt(kind, x, GR.HY, GR.gh) + V.T(x, GR.HY + GR.ny, TALL ? short : name, { size: GR.ns, weight: 600, color, anchor: "middle" }), { o, y: j < 3 ? 0 : -10 * (1 - o) });
    });
    PROTO.forEach((P, i) => {
      const f = TG.fix[i], e = inOut(seg(t, f, f + TG.fixDur)), m = inOut(seg(t, f + 0.1, f + 0.1 + TG.fixDur));
      const ly = GR.RY[i] + GR.ldy, cy = GR.RY[i] + GR.cdy;
      // label: the control, renamed for its common setting once fixed
      s += icon(P.id, GR.lx, ly - 12, 24, mix(ICON, TEAL, e));
      const lab = (str, o) => grp(V.T(GR.lx + 33, ly + 6.5, str, { size: GR.ls, color: C.ink }), { o });
      s += P.fixed === P.label ? lab(P.label, 1) : lab(P.label, 1 - e) + lab(P.fixed, e);
      // cells: one per published model, then merged into the one common setting
      [0, 1, 2].forEach((j) => {
        const x = lerp(GR.X3[j], GR.XM, m), y = lerp(cy, GR.RY[i] + GR.YM, m), o = (j ? 1 - seg(m, 0.55, 1) : 1) * dim;
        if (o > 0.002) s += grp(CELL[i](x, y, j, e), { o, s: GR.cs, cx: x, cy: y });
      });
      // the published models differ
      const ne = outC(seg(t, TG.ne[i], TG.ne[i] + 0.25)) * (1 - seg(t, TG.msg[1], TG.msg[1] + 0.3)) * dim;
      if (ne > 0.002) [0, 1].forEach((j) => { s += grp(V.T((GR.X3[j] + GR.X3[j + 1]) / 2, cy + GR.ne * 0.34, "≠", { size: GR.ne, anchor: "middle", color: "#9aa1ab" }), { o: ne }); });
      // the common setting, listed line by line
      let y = GR.RY[i] + GR.dy;
      settingLines(P).forEach((L, k) => {
        if (TALL && L.bullet && k) y += 3;
        const o = outC(seg(t, f + 0.5 + 0.08 * k, f + 0.9 + 0.08 * k));
        if (o > 0.002) {
          const dot = L.bullet ? `<circle cx="${GR.dx + 3}" cy="${r1(y - 0.5)}" r="2.1" fill="#9aa1ab"/>` : "";
          s += grp(dot + V.T(GR.dx + 12, y + GR.dfs * 0.34, L.s, { size: GR.dfs, color: L.eq ? TEAL_D : INK2 }), { o, y: 4 * (1 - o) });
        }
        y += GR.dlh;
      });
    });
    // so no comparison between them is clean
    if (ov > 0.002) {
      const [mx, my, mw, mh] = GR.msg;
      s += grp(`<rect x="${mx - mw / 2}" y="${my - mh / 2}" width="${mw}" height="${mh}" rx="12" fill="#fff" stroke="#d5d8db" stroke-width="1.4"/>` +
        V.T(mx, my - (TALL ? 5 : 4), "No clean comparison", { size: TALL ? 17 : 19, weight: 600, anchor: "middle", color: C.ink }) +
        V.T(mx, my + (TALL ? 18 : 21), "Any gap between them could come from any of these.", { size: TALL ? 13.5 : 15.5, anchor: "middle", color: C.muted }), { o: ov, y: 6 * (1 - ov) });
    }
    return s;
  }

  // ------------------------------------------------------------ playback: once when the figure reaches mid-screen, again on Replay
  const figures = [];
  function animate(el, draw, dur, boxes) {
    const svg = el.querySelector("svg.anim"), body = svg.querySelector("g"), btn = el.querySelector(".replay");
    let t = reduceMotion ? dur : 0, tall = false, raf = 0, last = null, lastDraw = -Infinity, drawn = "";
    // redrawn only when the picture changes, at most once per screen refresh up to 100 Hz
    function render() {
      setShape(tall);
      const s = draw(t);
      if (s !== drawn) body.innerHTML = drawn = s;
    }
    function fitShape() {
      const next = el.clientWidth > 0 && el.clientWidth < 640;
      if (next === tall && svg.dataset.shape) return false;
      tall = next;
      el.classList.toggle("tall", tall);
      svg.setAttribute("viewBox", boxes[tall ? 1 : 0].join(" "));
      svg.dataset.shape = tall ? "tall" : "wide";
      return true;
    }
    function loop(stamp) {
      if (last != null) t = Math.min(dur, t + Math.min(0.1, (stamp - last) / 1000));
      last = stamp;
      if (stamp - lastDraw >= 10 || t >= dur) { lastDraw = stamp; render(); }
      if (t < dur) raf = requestAnimationFrame(loop);
    }
    let played = false;
    function play() { played = true; cancelAnimationFrame(raf); t = 0; last = null; render(); raf = requestAnimationFrame(loop); }
    fitShape();
    render();
    figures.push(render);
    if ("ResizeObserver" in window) new ResizeObserver(() => { if (fitShape()) render(); }).observe(el);
    if (reduceMotion) { if (btn) btn.hidden = true; return; }
    if (btn) btn.addEventListener("click", play);
    V.whenCentered(svg, () => { if (!played) play(); });
  }

  const teaser = document.querySelector(".teaser");
  if (teaser) animate(teaser, drawOverview, T0.dur, [[0, 0, 960, 500], [0, 0, 440, 800]]);
  const grid = document.getElementById("fig-protocol");
  if (grid) animate(grid, drawGrid, TG.dur, [[0, 84, 960, 470], [0, 100, 440, 750]]);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { widths.clear(); wraps.clear(); figures.forEach((r) => r()); });
})();
