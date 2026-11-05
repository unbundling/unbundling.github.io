/* ==========================================================================
   SVG drawing: recipe glyphs, schematics, and charts.
   Charts are drawn for the width of their container and redrawn when it changes.
   Colors and markers follow the paper (one color + marker per recipe).
   ========================================================================== */
(function () {
  "use strict";

  const C = {
    ink: "#1c2b33", muted: "#5e6773", faint: "#8a929c", grid: "#eceef1", axis: "#4c5666", rule: "#d5d8db",
    enc: "#2f70ff", encDark: "#1d4fc4", encLight: "#c3d8ff", encFill: "#e3ecff",
    pre: "#eb6200", preDark: "#a84600", preLight: "#f8ceb2",
    ef: "#ea9600", efDark: "#8a5a00", efLight: "#fbe2bd",
    inf: "#d72090", infDark: "#a8126c", infFFN: "#ee8dbd",
    mot: "#a169da", motDark: "#7340b8", motLight: "#d1adec",
    webssl: "#299236", cap: "#c99b5a", cappa: "#9c6900",
    text: "#299236", textDark: "#1f7a2c", textFill: "#e6f2df", textStroke: "#6fb35f",
    accent: "#008681", accentLight: "#e6f3f2",
    shared: "#eceef0", sharedStroke: "#a9afb7", gray: "#788190",
  };

  const RECIPE = {
    encoderFree: { name: "Encoder-free", color: C.ef, dark: C.efDark, marker: "square" },
    scratch: { name: "Scratch encoder", color: C.enc, dark: C.encDark, marker: "circle" },
    infusion: { name: "In-fusion", color: C.inf, dark: C.infDark, marker: "tri-down" },
    infusionFFN: { name: "In-fusion (FFN-only)", color: C.infFFN, dark: C.infDark, marker: "tri-up" },
    metaclip: { name: "MetaCLIP", color: C.pre, dark: C.preDark, marker: "diamond" },
    webssl: { name: "WebSSL", color: C.webssl, dark: C.textDark, marker: "plus" },
    cap: { name: "Cap", color: C.cap, dark: "#7d5c2c", marker: "hex" },
    cappa: { name: "CapPa", color: C.cappa, dark: "#6f4b00", marker: "pent" },
    motEarly: { name: "MoT, layers 1–8", color: C.mot, dark: C.motDark, marker: "square" },
    motAll: { name: "MoT, all layers", color: C.motLight, dark: C.motDark, marker: "square", hatch: true },
    shared: { name: "Shared", color: C.gray, dark: C.muted, marker: "circle" },
  };

  // ------------------------------------------------------------------ helpers
  const r1 = (v) => Math.round(v * 10) / 10;
  // one decimal, rounding half up on the decimal value (56.65 -> 56.7, as in the paper's tables)
  const f1 = (v) => (Math.round(v * 10 + 1e-6) / 10).toFixed(1);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const A = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === "number" ? r1(v) : esc(v)}"`).join(" ");

  // "2.6×10^21" -> superscript; "x_{l}" -> subscript; "*word*" -> italic. Shifts are absolute so text after them resets.
  function rich(s, fs) {
    const up = r1(fs * 0.38), dn = r1(fs * 0.22);
    let out = "", shift = 0;
    const re = /\^\{([^}]+)\}|\^(-?[\d.]+)|_\{([^}]+)\}|\*([^*]+)\*|([^^_*]+|[\^_*])/g;
    let m;
    while ((m = re.exec(String(s)))) {
      const sup = m[1] || m[2], sub = m[3], it = m[4], plain = m[5];
      if (sup) { out += `<tspan dy="${-up - shift}" font-size="${r1(fs * 0.7)}">${esc(sup)}</tspan>`; shift = -up; }
      else if (sub) { out += `<tspan dy="${dn - shift}" font-size="${r1(fs * 0.72)}">${esc(sub)}</tspan>`; shift = dn; }
      else {
        const body = it ? `<tspan font-style="italic"${shift ? ` dy="${-shift}"` : ""}>${esc(it)}</tspan>` : (shift ? `<tspan dy="${-shift}">${esc(plain)}</tspan>` : esc(plain));
        out += body; shift = 0;
      }
    }
    return out;
  }

  function T(x, y, s, o = {}) {
    const fs = o.size || 13;
    return `<text ${A({
      x, y, "font-size": fs, fill: o.color || C.ink, "text-anchor": o.anchor, "font-weight": o.weight,
      "font-style": o.italic ? "italic" : undefined, class: o.cls, opacity: o.opacity, "letter-spacing": o.ls,
      transform: o.rotate ? `rotate(${o.rotate} ${r1(x)} ${r1(y)})` : undefined,
      stroke: o.halo ? "#fff" : undefined, "stroke-width": o.halo ? 4 : undefined, "paint-order": o.halo ? "stroke" : undefined,
      "stroke-linejoin": o.halo ? "round" : undefined,
    })}>${rich(s, fs)}</text>`;
  }

  function scale(domain, range, log) {
    const d = log ? domain.map(Math.log10) : domain;
    const f = (v) => range[0] + ((log ? Math.log10(v) : v) - d[0]) / (d[1] - d[0]) * (range[1] - range[0]);
    f.inv = (p) => { const v = d[0] + (p - range[0]) / (range[1] - range[0]) * (d[1] - d[0]); return log ? 10 ** v : v; };
    return f;
  }

  function marker(shape, x, y, rad, fill, o = {}) {
    const stroke = o.stroke || "#fff", sw = o.sw == null ? 1.8 : o.sw;
    const P = (pts) => `<polygon points="${pts.map((q) => q.map(r1).join(",")).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    const reg = (n, rot) => Array.from({ length: n }, (_, i) => [x + rad * 1.1 * Math.cos(rot + i * 2 * Math.PI / n), y + rad * 1.1 * Math.sin(rot + i * 2 * Math.PI / n)]);
    switch (shape) {
      case "circle": return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rad)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      case "square": return `<rect x="${r1(x - rad * .9)}" y="${r1(y - rad * .9)}" width="${r1(rad * 1.8)}" height="${r1(rad * 1.8)}" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      case "tri-down": return P([[x - rad * 1.15, y - rad * .8], [x + rad * 1.15, y - rad * .8], [x, y + rad * 1.15]]);
      case "tri-up": return P([[x - rad * 1.15, y + rad * .8], [x + rad * 1.15, y + rad * .8], [x, y - rad * 1.15]]);
      case "diamond": return P([[x, y - rad * 1.25], [x + rad * 1.05, y], [x, y + rad * 1.25], [x - rad * 1.05, y]]);
      case "hex": return P(reg(6, 0));
      case "pent": return P(reg(5, -Math.PI / 2));
      case "plus": {
        const a = rad * .42, b = rad * 1.15;
        return P([[x - a, y - b], [x + a, y - b], [x + a, y - a], [x + b, y - a], [x + b, y + a], [x + a, y + a], [x + a, y + b], [x - a, y + b], [x - a, y + a], [x - b, y + a], [x - b, y - a], [x - a, y - a]]);
      }
      default: return "";
    }
  }

  let uid = 0;
  const nextId = (p) => `${p}${++uid}`;
  function arrowDef(id, color) {
    return `<marker id="${id}" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0,0.6 L10,5 L0,9.4 z" fill="${color}"/></marker>`;
  }
  const svgWrap = (w, h, body, o = {}) =>
    `<svg ${A({ width: o.fluid ? undefined : w, height: o.fluid ? undefined : h, viewBox: `0 0 ${r1(w)} ${r1(h)}`, role: "img", "aria-label": o.label, class: o.cls, style: o.style })}>${o.label ? `<title>${esc(o.label)}</title>` : ""}${body}</svg>`;

  // FLOPs label: 2.6e21 -> "2.6×10^{21}"
  function flops(v) {
    const e = Math.floor(Math.log10(v) + 1e-9);
    const m = Math.round(v / 10 ** e * 10) / 10;
    return (m === 1 ? "" : `${m}×`) + `10^{${e}}`;
  }

  // ------------------------------------------------------------------ glyphs
  /* Recipe glyphs in the style of the paper's Figure 1: pills = dedicated vision capacity (orange if pretrained,
     blue if trained from scratch), B = the shared backbone. kind: pretrained | scratch | free | infusion */
  function glyph(kind, o = {}) {
    const dim = !!o.dim, H = 56;
    const pw = 15, ph = 38, gap = 4.5, bw = 74, bh = 48, rad = 11;
    const ink = dim ? "#b4b9c0" : "#3a4048";
    const dash = dim ? ' stroke-dasharray="5 4"' : "";
    const fills = { pretrained: [C.preLight, C.pre], scratch: [C.encLight, C.enc], infusion: [C.encLight, C.enc] }[kind];
    const pf = fills ? fills[0] : null, ps = fills ? fills[1] : null;
    const pill = (x, y, w, h) => `<rect x="${r1(x)}" y="${r1(y)}" width="${w}" height="${h}" rx="${w / 2}" fill="${pf}" stroke="${ps}" stroke-width="2"/>`;
    const box = (x, w) => `<rect x="${x}" y="${(H - bh) / 2}" width="${w}" height="${bh}" rx="${rad}" fill="#fff" stroke="${ink}" stroke-width="2.2"${dash}/>`;
    const B = (x) => T(x, H / 2 + 8.5, "B", { size: 24, weight: 700, anchor: "middle", color: dim ? "#9aa1a9" : C.ink });
    const wire = (x0, x1) => `<line x1="${x0}" x2="${x1}" y1="${H / 2}" y2="${H / 2}" stroke="${dim ? "#cdd1d6" : "#9aa1ab"}" stroke-width="3"/>`;
    let g = "", W;
    if (kind === "pretrained" || kind === "scratch") {
      for (let i = 0; i < 3; i++) g += pill(i * (pw + gap), (H - ph) / 2, pw, ph);
      const cx = 3 * pw + 2 * gap;
      g += wire(cx, cx + 16) + box(cx + 16, bw) + B(cx + 16 + bw / 2);
      W = cx + 16 + bw;
    } else if (kind === "free") {
      g += wire(0, 22) + box(22, bw) + B(22 + bw / 2);
      W = 22 + bw;
    } else {
      const iw = 112, sw = 12, sh = 30, sg = 3.5;
      g += wire(0, 14) + box(14, iw);
      for (let i = 0; i < 3; i++) g += pill(14 + 13 + i * (sw + sg), (H - sh) / 2, sw, sh);
      g += B(14 + iw - 28);
      W = 14 + iw;
    }
    const s = o.height ? o.height / H : (o.scale || 1);
    return `<svg class="glyph" width="${r1((W + 4) * s)}" height="${r1((H + 4) * s)}" viewBox="-2 -2 ${W + 4} ${H + 4}" aria-hidden="true">${g}</svg>`;
  }

  /* 28 backbone layers as in Table 3's schematics: gray = used by all tokens, blue = vision tokens only, taller = wider. */
  function layerStrip(pattern, o = {}) {
    const n = 28, w = o.w || 3.6, gap = o.gap || 1.7, base = 10, wide = 16, extra = 7;
    const spread = new Set(Array.from({ length: 8 }, (_, k) => Math.round(k * (n - 1) / 7)));
    const rule = {
      base: [() => false, () => null],
      "wide-early": [(i) => i < 8, () => null],
      "all-early": [() => false, (i) => (i < 8 ? "all" : null)],
      "vis-early": [() => false, (i) => (i < 8 ? "vis" : null)],
      "vis-every": [() => false, () => "thin"],
      "vis-spread": [() => false, (i) => (spread.has(i) ? "vis" : null)],
      "vis-late": [() => false, (i) => (i >= 20 ? "vis" : null)],
    }[pattern];
    const H = base + extra + 2;
    let g = "";
    for (let i = 0; i < n; i++) {
      const x = i * (w + gap), hb = rule[0](i) ? wide : base, add = rule[1](i);
      g += `<rect x="${r1(x)}" y="${H - hb}" width="${w}" height="${hb}" rx="1" fill="#c3c8ce"/>`;
      if (add) {
        const he = add === "thin" ? 2.6 : extra - 1.5;
        g += `<rect x="${r1(x)}" y="${r1(H - base - he - 1.2)}" width="${w}" height="${r1(he)}" rx="1" fill="${add === "all" ? "#7d8590" : C.enc}"/>`;
      }
    }
    const W = n * (w + gap) - gap;
    return `<svg class="strip" width="${r1(W)}" height="${H}" viewBox="0 0 ${r1(W)} ${H}" aria-hidden="true">${g}</svg>`;
  }

  // Inline legend marks
  function legendLine(key, o = {}) {
    const rc = RECIPE[key] || o;
    const w = o.noLine ? 16 : 30, color = o.color || rc.color;
    return `<svg class="lkey" width="${w}" height="14" viewBox="0 0 ${w} 14" aria-hidden="true">` +
      (o.noLine ? "" : `<line x1="1" x2="${w - 1}" y1="7" y2="7" stroke="${color}" stroke-width="2.2" ${o.dash ? 'stroke-dasharray="4 3"' : ""}/>`) +
      (o.noMarker ? "" : marker(o.marker || rc.marker, w / 2, 7, 4.6, color, { sw: 1.4 })) + `</svg>`;
  }

  /* Factor labels on compute-gap arrows: always above the arrow and within its span, at the spot that covers the
     least of any plotted line or marker; ties go to the preferred end ("left", "right") or the middle. */
  function placeArrowLabel(x1, y1, x2, y2, label, fs, polys, prefer) {
    const tw = String(label).length * fs * 0.56 + 2, th = fs * 0.74;
    const xa = Math.min(x1, x2) + 4, xb = Math.max(x1, x2) - 4, base = Math.min(y1, y2) - 4;
    const span = xb - xa;
    const cands = span <= tw ? [(xa + xb) / 2] : Array.from({ length: 25 }, (_, k) => xa + tw / 2 + (span - tw) * k / 24);
    const want = prefer === "left" ? 0 : prefer === "right" ? 1 : 0.5;
    let best = null;
    cands.forEach((cx) => {
      const b0 = cx - tw / 2 - 2, b1 = cx + tw / 2 + 2, t0 = base - th - 2, t1 = base + 2;
      let cover = 0;
      polys.forEach((pl) => {
        for (let i = 1; i < pl.length; i++) {
          const [ax, ay] = pl[i - 1], [bx, by] = pl[i];
          const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 1.5));
          for (let k = 0; k <= n; k++) {
            const px = ax + (bx - ax) * k / n, py = ay + (by - ay) * k / n;
            if (px >= b0 && px <= b1 && py >= t0 && py <= t1) cover++;
          }
        }
      });
      const pos = span > tw ? (cx - xa - tw / 2) / (span - tw) : 0.5;
      const score = cover * 100 + Math.abs(pos - want);
      if (!best || score < best.score) best = { score, cx };
    });
    return { x: best.cx, y: base };
  }

  // ------------------------------------------------------------- line charts
  /* spec: {
       panels: [{ title, x: {domain, log, ticks:[[v,label]], label}, y: {domain, ticks, label, fmt},
                  series: [{key, name, color, marker, points:[[x,y]], dash, lw, noMarkers, labelEnd}],
                  ann: [{type:"arrow", from:[x,y], to:[x,y], label, labelDy}, {type:"hline", y, color, label}, {type:"text", x, y, text}],
                  xinfo: (x) => string }],
       minPanelW, height, gap } */
  function lineChart(width, spec) {
    const n = spec.panels.length;
    const gap = spec.gap == null ? 26 : spec.gap;
    const minW = spec.minPanelW || 260;
    const cols = width >= n * minW + (n - 1) * gap ? n : (n > 1 && width >= 2 * minW + gap ? 2 : 1);
    const rows = Math.ceil(n / cols);
    const pw = (width - (cols - 1) * gap) / cols;
    const ph = spec.height || Math.max(210, Math.min(300, pw * 0.78));
    const fs = width < 420 ? 13 : 15;
    const M = Object.assign({ l: 40, r: 14, t: 30, b: 50 }, spec.margin || {});
    const rowGap = 18;
    const H = rows * ph + (rows - 1) * rowGap;
    const defs = [], meta = [];
    let g = "";
    spec.panels.forEach((P, i) => {
      const cx = (i % cols) * (pw + gap), cy = Math.floor(i / cols) * (ph + rowGap);
      const X0 = cx + M.l, X1 = cx + pw - M.r, Y0 = cy + ph - M.b, Y1 = cy + M.t;
      const sx = scale(P.x.domain, [X0, X1], P.x.log), sy = scale(P.y.domain, [Y0, Y1], P.y.log);
      let p = "";
      // grid + y ticks
      (P.y.ticks || []).forEach((t) => {
        const y = sy(t);
        if (y < Y1 - 1 || y > Y0 + 1) return;
        p += `<line x1="${r1(X0)}" x2="${r1(X1)}" y1="${r1(y)}" y2="${r1(y)}" stroke="${C.grid}" stroke-width="1"/>`;
        p += T(X0 - 7, y + fs * .34, P.y.fmt ? P.y.fmt(t) : String(t), { size: fs - 1, anchor: "end", color: C.muted, cls: "tnum" });
      });
      // x ticks
      (P.x.ticks || []).forEach(([v, lab]) => {
        const x = sx(v);
        if (x < X0 - 1 || x > X1 + 1) return;
        p += `<line x1="${r1(x)}" x2="${r1(x)}" y1="${r1(Y0)}" y2="${r1(Y0 + 4)}" stroke="${C.axis}" stroke-width="1"/>`;
        p += T(x, Y0 + fs + 5, lab, { size: fs - 1, anchor: "middle", color: C.muted });
      });
      p += `<line x1="${r1(X0)}" x2="${r1(X1)}" y1="${r1(Y0)}" y2="${r1(Y0)}" stroke="${C.axis}" stroke-width="1"/>`;
      // the y-axis title sits above the chart as text (.ytitle), so it is not drawn rotated here
      if (P.x.label) p += T((X0 + X1) / 2, Y0 + fs * 2 + 14, P.x.label, { size: fs, anchor: "middle", color: C.ink });
      if (P.title) p += `<text x="${r1(X0)}" y="${r1(cy + 16)}" font-size="${fs + 2}" font-weight="700" fill="${C.ink}">${rich(P.title, fs + 2)}` +
        (P.subtitle ? `<tspan dx="7" font-weight="400" font-size="${fs - 1}" fill="${C.faint}">${esc(P.subtitle)}</tspan>` : "") + `</text>`;
      // reference lines + bands
      (P.ann || []).filter((a) => a.type === "hline").forEach((a) => {
        const y = sy(a.y);
        p += `<line x1="${r1(X0)}" x2="${r1(X1)}" y1="${r1(y)}" y2="${r1(y)}" stroke="${a.color || C.faint}" stroke-width="1.6" stroke-dasharray="6 5"/>`;
        if (a.label) p += T(a.labelX != null ? sx(a.labelX) : X1 - 2, y + (a.labelDy || -6), a.label, { size: fs - 1, color: a.labelColor || a.color || C.muted, anchor: a.anchor || "end", halo: true });
      });
      // series
      const smeta = [], polys = [];
      P.series.forEach((s) => {
        const pts = s.points.filter((q) => q[1] != null).map((q) => [sx(q[0]), sy(q[1]), q[0], q[1], q[2]]);
        if (pts.length > 1 && s.line !== false) polys.push(pts.map((q) => [q[0], q[1]]));
        if (!s.noMarkers) pts.forEach((q) => polys.push([[q[0] - 5, q[1] - 5], [q[0] + 5, q[1] - 5], [q[0] + 5, q[1] + 5], [q[0] - 5, q[1] + 5], [q[0] - 5, q[1] - 5]]));
        if (pts.length > 1 && s.line !== false) {
          p += `<path d="${pts.map((q, k) => (k ? "L" : "M") + r1(q[0]) + "," + r1(q[1])).join("")}" fill="none" stroke="${s.color}" stroke-width="${s.lw || 2.2}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}${s.opacity ? ` opacity="${s.opacity}"` : ""}/>`;
        }
        if (!s.noMarkers) pts.forEach((q) => (p += marker(s.marker, q[0], q[1], s.r || 4.6, s.color)));
        if (s.labelEnd && pts.length) {
          const q = pts[pts.length - 1], L = s.labelEnd;
          p += T(q[0] + (L.dx || 8), q[1] + (L.dy || 4), L.text || s.name, { size: fs, color: s.dark || s.color, weight: 700, anchor: L.anchor, halo: true });
        }
        if (!s.noHover) smeta.push({ key: s.key, name: s.name, color: s.color, marker: s.marker, dash: s.dash, pts });
      });
      // annotations
      (P.ann || []).forEach((a) => {
        if (a.type === "arrow") {
          const id = nextId("ah");
          defs.push(arrowDef(id, a.color || C.ink));
          const x1 = sx(a.from[0]), y1 = sy(a.from[1]), x2 = sx(a.to[0]), y2 = sy(a.to[1]);
          p += `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${a.color || C.ink}" stroke-width="1.5" marker-end="url(#${id})"/>`;
          if (a.label) {
            const L = placeArrowLabel(x1, y1, x2, y2, a.label, fs, polys, a.prefer);
            p += T(L.x, L.y, a.label, { size: fs, weight: 700, anchor: "middle", color: a.labelColor || C.ink, halo: true });
          }
        } else if (a.type === "text") {
          const x = a.px ? cx + a.x * pw : sx(a.x), y = a.py ? cy + a.y * ph : sy(a.y);
          (Array.isArray(a.text) ? a.text : [a.text]).forEach((line, k) => {
            p += T(x, y + k * (fs + 3), line, { size: a.size || fs - 0.5, color: a.color || C.muted, anchor: a.anchor, italic: a.italic, weight: a.weight, halo: true });
          });
        } else if (a.type === "floor") {
          // a horizontal segment drawn at the bottom of the plot (e.g., encoder pretraining spent before training starts)
          p += `<line x1="${r1(sx(a.x0))}" x2="${r1(sx(a.x1))}" y1="${r1(Y0 - 1)}" y2="${r1(Y0 - 1)}" stroke="${a.color}" stroke-width="3.2"/>`;
        }
      });
      // hover layer
      p += `<line class="xh" x1="0" x2="0" y1="${r1(Y1)}" y2="${r1(Y0)}" stroke="${C.faint}" stroke-width="1" opacity="0"/>`;
      p += `<g class="hl"></g>`;
      p += `<rect class="hit" data-panel="${i}" x="${r1(X0 - 8)}" y="${r1(Y1 - 8)}" width="${r1(X1 - X0 + 16)}" height="${r1(Y0 - Y1 + 16)}" fill="transparent"/>`;
      g += `<g class="panel" data-panel="${i}">${p}</g>`;
      meta.push({ X0, X1, Y0, Y1, sx, sy, series: smeta, xinfo: P.xinfo, yfmt: P.y.tipFmt || f1, title: P.title, metricName: P.metricName });
    });
    return { svg: svgWrap(width, H, `<defs>${defs.join("")}</defs>${g}`, { label: spec.label }), meta, kind: "line" };
  }

  // --------------------------------------------------------------- dot plots
  /* Rows of dots on one value axis (used where values sit in a narrow range, so bars would need a cut axis).
     spec: { groups:[{title, sub, rows:[{label, sub, icon, value, color, marker, valueText, side, tip, strong}]}],
             x:{domain, ticks, label}, refs:[{value, label, color}], side:{header, fmt}, labelW, iconW } */
  function dotPlot(width, spec) {
    const fs = width < 420 ? 13.5 : 15;
    const stacked = width < (spec.stackBelow || 540);  // narrow screens: each row's label sits above its dot line
    const narrow = width < 640;
    const labelW = stacked ? 0 : (narrow ? (spec.labelWNarrow || spec.labelW * 0.8) : spec.labelW);
    const iconW = stacked ? 0 : (narrow && spec.hideIconsNarrow ? 0 : (spec.iconW || 0));
    const sideW = spec.side && !stacked ? (narrow ? 60 : 66) : 0;
    const X0 = stacked ? 10 : labelW + iconW + 14, X1 = width - sideW - (stacked ? 44 : 26);
    const sx = scale(spec.x.domain, [X0, X1]);
    const rowH = stacked ? 50 : (spec.rowH || 33), top = (spec.refs && spec.refs.some((r) => r.label)) || (spec.side && !stacked) ? 34 : 12;
    let y = top, g = "", hits = [];
    const tips = [];
    spec.groups.forEach((grp, gi) => {
      if (grp.title) {
        y += gi ? 16 : 2;
        g += T(0, y + fs + 1, grp.title, { size: fs + 1, weight: 700, color: C.ink });
        if (grp.sub) g += T(3, y + fs * 2 + 5, grp.sub, { size: fs - 1.5, color: C.faint, italic: true });
        y += grp.sub ? fs * 2 + 12 : fs + 9;
      }
      grp.rows.forEach((row) => {
        const cy = stacked ? y + rowH - 14 : y + rowH / 2;
        g += `<line x1="${r1(X0)}" x2="${r1(X1)}" y1="${r1(cy)}" y2="${r1(cy)}" stroke="${C.grid}" stroke-width="1"/>`;
        if (stacked) {
          g += T(0, y + fs + 2, row.label, { size: fs, color: row.labelColor || C.ink, weight: row.strong ? 700 : undefined });
          if (row.icon) g += `<g transform="translate(${r1(width - 150)},${r1(y + 2)})">${row.icon}</g>`;
          else if (spec.side && row.side != null) g += T(width, y + fs + 2, `${spec.side.short || "Text"} ${row.side}`, { size: fs - 1.5, anchor: "end", color: C.muted, cls: "tnum" });
        } else {
          g += T(labelW - 6, cy + fs * .34, row.label, { size: fs, anchor: "end", color: row.labelColor || C.ink, weight: row.strong ? 700 : undefined });
        }
        if (row.icon && iconW) g += `<g transform="translate(${r1(labelW + 4)},${r1(cy - 10)})">${row.icon}</g>`;
        const x = sx(row.value);
        if (row.from != null) {
          const xf = sx(row.from);
          g += `<line x1="${r1(xf)}" x2="${r1(x)}" y1="${r1(cy)}" y2="${r1(cy)}" stroke="${row.color}" stroke-width="2.4" opacity=".35"/>`;
        }
        g += marker(row.marker || "circle", x, cy, row.r || 6, row.color, { sw: 2 });
        g += T(x + (row.r || 6) + 6, cy + fs * .34, row.valueText || f1(row.value), { size: fs, weight: 700, color: C.ink, halo: true, cls: "tnum" });
        if (spec.side && row.side != null && !stacked) g += T(width - sideW / 2, cy + fs * .34, row.side, { size: fs - 1, anchor: "middle", color: C.muted, cls: "tnum" });
        tips.push(row.tip || null);
        hits.push(`<rect class="hit-row" data-i="${tips.length - 1}" x="0" y="${r1(y)}" width="${r1(width)}" height="${rowH}" fill="transparent"/>`);
        y += rowH;
      });
    });
    const bottom = y;
    let axis = "";
    (spec.x.ticks || []).forEach((t) => {
      axis += `<line x1="${r1(sx(t))}" x2="${r1(sx(t))}" y1="${top - 4}" y2="${r1(bottom)}" stroke="${C.grid}" stroke-width="1"/>`;
      axis += T(sx(t), bottom + fs + 6, String(t), { size: fs - 1, anchor: "middle", color: C.muted, cls: "tnum" });
    });
    axis += `<line x1="${r1(X0)}" x2="${r1(X1)}" y1="${r1(bottom)}" y2="${r1(bottom)}" stroke="${C.axis}" stroke-width="1"/>`;
    if (spec.x.label) axis += T((X0 + X1) / 2, bottom + fs * 2 + 12, spec.x.label, { size: fs, anchor: "middle" });
    if (spec.side && !stacked) axis += T(width - sideW / 2, top - 8, spec.side.header, { size: fs - 1.5, anchor: "middle", color: C.faint });
    (spec.refs || []).forEach((rf) => {
      const x = sx(rf.value);
      axis += `<line x1="${r1(x)}" x2="${r1(x)}" y1="${top - 6}" y2="${r1(bottom)}" stroke="${rf.color}" stroke-width="1.6" stroke-dasharray="5 4"/>`;
      if (rf.label) axis += T(x + (rf.dx || 0), top - 10, rf.label, { size: fs - 1.5, anchor: rf.anchor || "middle", color: rf.labelColor || rf.color, halo: true });
    });
    const H = bottom + (spec.x.label ? fs * 2 + 20 : fs + 14);
    return { svg: svgWrap(width, H, axis + g + hits.join(""), { label: spec.label }), tips, kind: "rows" };
  }

  // ------------------------------------------------------------ stacked bars
  /* Horizontal bars from zero with a shared first segment (Figure 9). */
  function stackedBars(width, spec) {
    const fs = width < 420 ? 13.5 : 15;
    const stacked = width < 540;
    const labelW = stacked ? 0 : spec.labelW;
    const X0 = stacked ? 6 : labelW + 12, X1 = width - (stacked ? 108 : 120);
    const sx = scale([0, spec.max], [X0, X1]);
    const rowH = stacked ? 46 : 34, barH = stacked ? 16 : 20;
    let y = 38, g = "";
    const tips = [], hits = [];
    const hatchId = nextId("hatch");
    g += `<defs><pattern id="${hatchId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${C.motLight}"/><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" stroke-width="2.2"/></pattern></defs>`;
    // first-segment legend
    const bx = sx(spec.prefill);
    spec.groups.forEach((grp, gi) => {
      if (grp.title) {
        y += 6;
        g += T(X0, y + fs - 2, grp.title, { size: fs - 1, color: C.muted, italic: true });
        y += fs + 6;
      }
      grp.rows.forEach((row) => {
        const cy = stacked ? y + rowH - 11 : y + rowH / 2;
        const rc = RECIPE[row.key];
        g += stacked ? T(0, y + fs + 1, row.label, { size: fs, color: C.ink }) : T(labelW, cy + fs * .34, row.label, { size: fs, anchor: "end", color: C.ink });
        g += `<rect x="${r1(X0)}" y="${r1(cy - barH / 2)}" width="${r1(bx - X0)}" height="${barH}" fill="#dfe2e6"/>`;
        if (row.added > 0) {
          const x1 = sx(spec.prefill + row.added);
          g += `<path d="M${r1(bx + 1.5)},${r1(cy - barH / 2)} H${r1(x1 - 4)} a4,4 0 0 1 4,4 V${r1(cy + barH / 2 - 4)} a4,4 0 0 1 -4,4 H${r1(bx + 1.5)} Z" fill="${rc.hatch ? `url(#${hatchId})` : rc.color}"/>`;
        } else {
          g += `<rect x="${r1(bx - 2.5)}" y="${r1(cy - barH / 2)}" width="2.5" height="${barH}" fill="${rc.color}"/>`;
        }
        const xe = sx(spec.prefill + row.added);
        g += T(xe + 7, cy + fs * .34, row.total, { size: fs, weight: 700, color: C.ink, cls: "tnum" }) +
          (row.pct ? T(xe + 7 + (row.total.length * fs * 0.52) + 4, cy + fs * .34, row.pct, { size: fs - 1, color: C.muted, cls: "tnum" }) : "");
        tips.push({ title: row.label, rows: [{ value: row.total, name: "time to first token" }, ...(row.added ? [{ value: `+${f1(row.added)} ms`, name: "over the backbone prefill" }] : [])] });
        hits.push(`<rect class="hit-row" data-i="${tips.length - 1}" x="0" y="${r1(y)}" width="${r1(width)}" height="${rowH}" fill="transparent"/>`);
        y += rowH;
      });
    });
    // axis
    const bottom = y + 4;
    let axis = "";
    spec.ticks.forEach((t) => {
      axis += `<line x1="${r1(sx(t))}" x2="${r1(sx(t))}" y1="30" y2="${r1(bottom)}" stroke="${C.grid}" stroke-width="1"/>`;
      axis += T(sx(t), bottom + fs + 6, String(t), { size: fs - 1, anchor: "middle", color: C.muted, cls: "tnum" });
    });
    axis += `<line x1="${r1(X0)}" x2="${r1(X1)}" y1="${r1(bottom)}" y2="${r1(bottom)}" stroke="${C.axis}" stroke-width="1"/>`;
    axis += T(stacked ? width / 2 : (X0 + X1) / 2, bottom + fs * 2 + 12, spec.xlabel, { size: fs, anchor: "middle" });
    // prefill bracket at top
    const id = nextId("ah");
    axis += `<defs>${arrowDef(id, C.muted)}</defs><line x1="${r1(X0)}" x2="${r1(bx)}" y1="22" y2="22" stroke="${C.muted}" stroke-width="1.2" marker-end="url(#${id})" marker-start="url(#${id})"/>`;
    const pl = `backbone prefill (${Math.round(spec.prefill)} ms)`, fits = pl.length * (fs - 1.5) * 0.5 < bx - X0;
    axis += T(fits ? (X0 + bx) / 2 : X0, 15, pl, { size: fs - 1.5, anchor: fits ? "middle" : "start", color: C.muted });
    const H = bottom + fs * 2 + 20;
    return { svg: svgWrap(width, H, axis + g + hits.join(""), { label: spec.label }), tips, kind: "rows" };
  }

  // ------------------------------------------------------------- schematics
  /* Figure 4, redrawn. (a) In-fusion: one shared residual stream; vision-only modules (blue, pink outline) add to the
     shared modules' outputs. (b) MoT: separate text and vision streams that meet only in attention. */
  function infusionBlock(o = {}) {
    const W = 520, H = 230;
    const Y = 54, Yb = 122, Yd = 186;
    const dk = "#6d7580", ink = "#3d4651";
    const ids = { g: nextId("ag"), b: nextId("ab"), k: nextId("ak") };
    let g = `<defs>${arrowDef(ids.g, dk)}${arrowDef(ids.b, C.enc)}${arrowDef(ids.k, ink)}</defs>`;
    const ln = (d, col, dash, arrow = true, w = 1.8) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${dash ? ' stroke-dasharray="4 3.5"' : ""}${arrow ? ` marker-end="url(#${col === C.enc ? ids.b : col === ink ? ids.k : ids.g})"` : ""}/>`;
    const box = (x, y, w, lab) => `<rect x="${x}" y="${y - 17}" width="${w}" height="34" rx="7" fill="${C.shared}" stroke="${C.sharedStroke}" stroke-width="1.6"/>` + T(x + w / 2, y + 6, lab, { size: 16, anchor: "middle", weight: 700, color: ink });
    const vbox = (x, y, w, lab, dashed) => `<rect class="vmod${dashed ? " attn" : ""}" x="${x}" y="${y - 17}" width="${w}" height="34" rx="7" fill="${C.encFill}" stroke="${C.inf}" stroke-width="1.8"${dashed ? ' stroke-dasharray="4 3"' : ""}/>` + T(x + w / 2, y + 6, lab, { size: 16, anchor: "middle", weight: 700, color: C.encDark, cls: dashed ? "attn" : "" });
    const norm = (x, y) => `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="6" fill="#fff" stroke="${dk}" stroke-width="1.4"/>` + T(x, y + 4.7, "N", { size: 13.5, anchor: "middle", color: ink });
    const plus = (x, y, blue) => `<circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="${blue ? C.enc : ink}" stroke-width="1.6"${blue ? ' stroke-dasharray="3 2.5"' : ""}/>` + T(x, y + 5.2, "+", { size: 16, anchor: "middle", weight: 700, color: blue ? C.enc : ink });
    // stream
    g += `<rect x="6" y="${Y - 15}" width="${W - 12}" height="30" rx="15" fill="#f1f2f4"/>`;
    g += T(W / 2 - 40, Y - 22, "shared residual stream", { size: 14, anchor: "middle", color: C.muted });
    g += T(10, Y - 22, "x_{ℓ}", { size: 16.5, weight: 700 }) + T(W - 10, Y - 22, "x_{ℓ+1}", { size: 16.5, weight: 700, anchor: "end" });
    g += `<rect x="14" y="${Y - 5}" width="9" height="9" rx="2" fill="${C.enc}"/><rect x="25" y="${Y - 5}" width="9" height="9" rx="2" fill="${C.textStroke}"/>`;
    g += ln(`M36,${Y} L302,${Y}`, ink, false, false, 2.2) + ln(`M322,${Y} L460,${Y}`, ink, false, false, 2.2) + ln(`M480,${Y} L${W - 12},${Y}`, ink, false, true, 2.2);
    g += plus(312, Y) + plus(470, Y);
    // attention path
    g += ln(`M52,${Y} L52,${Yb} L68,${Yb}`, dk) + norm(80, Yb) + ln(`M91,${Yb} L106,${Yb}`, dk) + box(108, Yb, 64, "QKV");
    g += ln(`M172,${Yb} L180,${Yb}`, dk, false, false) + plus(190, Yb, true) + ln(`M200,${Yb} L212,${Yb}`, dk);
    g += box(214, Yb, 52, "Attn") + ln(`M266,${Yb} L276,${Yb}`, dk) + box(278, Yb, 34, "O") + ln(`M305,${Yb - 17} L305,${Y + 12}`, dk);
    // ffn path
    g += ln(`M338,${Y} L338,${Yb} L354,${Yb}`, dk) + norm(366, Yb) + ln(`M377,${Yb} L392,${Yb}`, dk) + box(394, Yb, 62, "FFN") + ln(`M456,${Yb} L463,${Yb} L463,${Y + 12}`, dk);
    // vision-only modules
    g += `<g class="v-attn">` + ln(`M80,${Yb + 11} L80,${Yd} L106,${Yd}`, C.enc, true) + vbox(108, Yd, 64, "ΔQKV", true) + ln(`M172,${Yd} L190,${Yd} L190,${Yb + 12}`, C.enc, true) +
      ln(`M240,${Yb + 17} L240,${Yd} L276,${Yd}`, C.enc, true) + vbox(278, Yd, 40, "ΔO", true) + ln(`M318,${Yd} L321,${Yd} L321,${Y + 12}`, C.enc, true) + `</g>`;
    g += ln(`M366,${Yb + 11} L366,${Yd} L392,${Yd}`, C.enc) + vbox(394, Yd, 62, "ΔFFN", false) + ln(`M456,${Yd} L479,${Yd} L479,${Y + 12}`, C.enc);
    return svgWrap(W, H, g, { fluid: true, label: "In-fusion block: shared modules process every token; vision-only modules add to their outputs for vision tokens", cls: "schematic" });
  }

  function motBlock() {
    const W = 420, H = 230;
    const Yt = 52, Yv = 176, Ya = 114;
    const ink = "#3d4651";
    const ids = { t: nextId("at"), v: nextId("av") };
    const tcol = C.textStroke, vcol = C.enc;
    let g = `<defs>${arrowDef(ids.t, tcol)}${arrowDef(ids.v, vcol)}</defs>`;
    const ln = (d, col, arrow = true, w = 1.8) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${arrow ? ` marker-end="url(#${col === tcol ? ids.t : ids.v})"` : ""}/>`;
    const box = (x, y, w, lab, t) => `<rect x="${x}" y="${y - 16}" width="${w}" height="32" rx="7" fill="${t ? C.textFill : C.encFill}" stroke="${t ? tcol : vcol}" stroke-width="1.6"/>` + T(x + w / 2, y + 5.5, lab, { size: 15.5, anchor: "middle", weight: 700, color: t ? C.textDark : C.encDark });
    const norm = (x, y, col) => `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" rx="5.5" fill="#fff" stroke="${col}" stroke-width="1.4"/>` + T(x, y + 4.5, "N", { size: 12.5, anchor: "middle", color: ink });
    const plus = (x, y, col) => `<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${col}" stroke-width="1.6"/>` + T(x, y + 5, "+", { size: 15, anchor: "middle", weight: 700, color: col });
    // streams
    g += `<rect x="6" y="${Yt - 26}" width="${W - 12}" height="22" rx="11" fill="#eef6ea"/>` + T(W / 2, Yt - 31, "text residual stream", { size: 13.5, anchor: "middle", color: C.textDark });
    g += `<rect x="6" y="${Yv + 4}" width="${W - 12}" height="22" rx="11" fill="#eaf0ff"/>` + T(W / 2, Yv + 42, "vision residual stream", { size: 13.5, anchor: "middle", color: C.encDark });
    const ys = Yt - 15, yv = Yv + 15;
    g += ln(`M14,${ys} L250,${ys}`, tcol, false, 2.2) + plus(260, ys, tcol) + ln(`M269,${ys} L360,${ys}`, tcol, false, 2.2) + plus(370, ys, tcol) + ln(`M379,${ys} L${W - 12},${ys}`, tcol, true, 2.2);
    g += ln(`M14,${yv} L250,${yv}`, vcol, false, 2.2) + plus(260, yv, vcol) + ln(`M269,${yv} L360,${yv}`, vcol, false, 2.2) + plus(370, yv, vcol) + ln(`M379,${yv} L${W - 12},${yv}`, vcol, true, 2.2);
    // per-stream modules
    [[Yt + 12, tcol, true, ys], [Yv - 12, vcol, false, yv]].forEach(([y, col, t, sy]) => {
      g += ln(`M26,${sy} L26,${y} L36,${y}`, col) + norm(46, y, col) + ln(`M56,${y} L66,${y}`, col) + box(68, y, 50, "QKV", t) + ln(`M118,${y} L134,${y}`, col);
      g += ln(`M186,${y} L198,${y}`, col) + box(200, y, 34, "O", t) + ln(`M234,${y} L260,${y} L260,${sy + (t ? 9 : -9)}`, col);
      g += ln(`M280,${sy} L280,${y} L290,${y}`, col) + norm(300, y, col) + ln(`M310,${y} L320,${y}`, col) + box(322, y, 44, "FFN", t) + ln(`M366,${y} L370,${y} L370,${sy + (t ? 9 : -9)}`, col);
    });
    // joint attention
    g += `<rect x="136" y="${Yt - 2}" width="50" height="${Yv - Yt + 4}" rx="8" fill="${C.shared}" stroke="${C.sharedStroke}" stroke-width="1.6"/>`;
    g += T(161, Ya + 1, "Attn", { size: 16, anchor: "middle", weight: 700, color: ink }) + T(161, Ya + 18, "joint", { size: 13, anchor: "middle", color: C.muted });
    return svgWrap(W, H, g, { fluid: true, label: "Mixture-of-transformers block: separate text and vision streams that interact only through joint attention", cls: "schematic" });
  }

  window.Viz = { f1, C, RECIPE, T, rich, esc, scale, marker, glyph, layerStrip, legendLine, lineChart, dotPlot, stackedBars, infusionBlock, motBlock, flops, svgWrap, arrowDef, nextId, r1, placeArrowLabel };
})();
