/* ==========================================================================
   Page behavior: draws every figure from DATA, wires tooltips and toggles, builds figures when they reach the middle of
   the screen, animates the bundle diagram, and runs the contents list and tab bar. The teaser and the protocol grid are
   anim.js.
   ========================================================================== */
(function () {
  "use strict";
  const V = window.Viz, D = window.DATA, C = V.C, RC = V.RECIPE;
  // ?static renders every animated element in its final state (screenshots, print); ?bundle=<recipe> picks the diagram state.
  const params = new URLSearchParams(location.search);
  const STATIC = params.has("static");
  const reduceMotion = STATIC || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (STATIC) document.documentElement.classList.add("static");

  // ---------------------------------------------------------------- tooltip
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "status");
  document.body.appendChild(tip);
  const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  const plainFlops = (v) => {
    const e = Math.floor(Math.log10(v) + 1e-9), m = +(v / 10 ** e).toPrecision(3);
    return (m === 1 ? "" : `${m}×`) + "10" + String(e).split("").map((c) => SUP[c]).join("");
  };
  // one decimal, rounding half up on the decimal value (56.65 -> 56.7, as in the paper's tables)
  const f1 = (v) => (Math.round(v * 10 + 1e-6) / 10).toFixed(1);
  const tag = V.tag;
  function showTip(ev, content) {
    tip.textContent = "";
    if (content.title) {
      const t = document.createElement("div");
      t.className = content.text ? "tip-title tip-name" : "tip-title";
      t.textContent = content.title;
      tip.appendChild(t);
    }
    if (content.text) {
      const p = document.createElement("div");
      p.className = "tip-text";
      p.textContent = content.text;
      tip.appendChild(p);
    }
    (content.rows || []).forEach((r) => {
      const row = document.createElement("div");
      row.className = "tip-row";
      if (r.color) {
        const k = document.createElement("span");
        k.className = "tip-key";
        k.innerHTML = V.legendLine(null, { color: r.color, marker: r.marker || "circle", dash: r.dash });
        row.appendChild(k);
      }
      const v = document.createElement("b");
      v.textContent = r.value;
      row.appendChild(v);
      const n = document.createElement("span");
      n.textContent = r.name;
      row.appendChild(n);
      tip.appendChild(row);
    });
    tip.classList.add("on");
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  const hideTip = () => tip.classList.remove("on");

  // ------------------------------------------------------- responsive mount
  function mount(el, draw) {
    let lastW = 0;
    const render = (force) => {
      const w = Math.floor(el.clientWidth);
      if (!w || (!force && Math.abs(w - lastW) < 2)) return;
      lastW = w;
      const out = draw(w);
      el.innerHTML = out.svg;
      if (out.ytitle) {
        const yt = document.querySelector(`[data-ytitle-for="${el.dataset.chart}"]`);
        if (yt) yt.textContent = out.ytitle;
      }
      if (out.kind === "line") attachLineHover(el, out);
      if (out.kind === "rows") attachRowHover(el, out);
    };
    el._render = () => render(true);
    if ("ResizeObserver" in window) new ResizeObserver(() => render(false)).observe(el);
    else window.addEventListener("resize", () => render(false));
    render(true);
  }

  function attachLineHover(el, out) {
    const svg = el.querySelector("svg");
    el.querySelectorAll("rect.hit").forEach((hit) => {
      const m = out.meta[+hit.dataset.panel];
      const panel = hit.closest("g.panel"), xh = panel.querySelector(".xh"), hl = panel.querySelector(".hl");
      const move = (ev) => {
        const box = svg.getBoundingClientRect();
        const px = (ev.clientX - box.left) * (svg.viewBox.baseVal.width / box.width);
        let best = null;
        m.series.forEach((s) => s.pts.forEach((q) => {
          const d = Math.abs(q[0] - px);
          if (!best || d < best.d) best = { d, x: q[0], xv: q[2] };
        }));
        if (!best) return;
        xh.setAttribute("x1", best.x);
        xh.setAttribute("x2", best.x);
        xh.setAttribute("opacity", 1);
        const rows = [];
        let ring = "";
        m.series.forEach((s) => {
          const q = s.pts.find((p) => Math.abs(p[0] - best.x) < 0.8);
          if (!q) return;
          rows.push({ v: q[3], value: m.yfmt(q[3]), name: s.name, color: s.color, marker: s.marker, dash: s.dash });
          ring += V.marker(s.marker, q[0], q[1], 6.6, s.color, { sw: 2.6 });
        });
        hl.innerHTML = ring;
        rows.sort((a, b) => (m.ascending ? a.v - b.v : b.v - a.v));
        showTip(ev, { title: m.xinfo ? m.xinfo(best.xv) : "", rows });
      };
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerdown", move);
      hit.addEventListener("pointerleave", () => { xh.setAttribute("opacity", 0); hl.innerHTML = ""; hideTip(); });
    });
  }

  function attachRowHover(el, out) {
    el.querySelectorAll("rect.hit-row").forEach((hit) => {
      const t = out.tips[+hit.dataset.i];
      if (!t) return;
      const move = (ev) => { hit.classList.add("on"); showTip(ev, t); };
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerdown", move);
      hit.addEventListener("pointerleave", () => { hit.classList.remove("on"); hideTip(); });
    });
  }

  // metric toggles: <div class="seg" data-for="figId"><button data-metric="vqa">…</button></div>
  function metricOf(id) {
    const f = document.getElementById(id);
    return (f && f.dataset.metric) || "vqa";
  }
  document.querySelectorAll(".seg").forEach((seg) => {
    seg.addEventListener("click", (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      const fig = document.getElementById(seg.dataset.for);
      fig.dataset.metric = b.dataset.metric;
      fig.querySelectorAll("[data-chart]").forEach((c) => c._render && c._render());
    });
  });

  const xFlops = (lo, hi) => [[1, plainF(1)], [3, plainF(3)], [10, plainF(10)], [30, plainF(30)]].filter(([v]) => v >= lo && v <= hi);
  function plainF(z) { return V.flops(z * 1e21); }
  const metricLabel = (m) => (m === "vqa" ? "Avg. VQA (%)" : "Avg. Text (%)");

  // ------------------------------------------------------------ figures
  const FIG = {};

  // The two Figure 2 charts sit side by side at one height.
  const priorH = (w) => Math.min(330, Math.max(256, w * 0.68));

  // Figure 2a: share of a fixed lifetime budget spent on encoder pretraining
  FIG.upstream = (w, el) => {
    const m = metricOf("fig-prior"), U = D.upstreamShare;
    const yd = m === "vqa" ? [36, 44] : [50, 56];
    const ref = U.scratch[m];
    const series = U.series.map((s) => ({
      key: s.key, name: s.name, color: RC[s.key].color, marker: RC[s.key].marker,
      points: s[m].map((v, i) => [i + 1, v]),
    }));
    series.push({ key: "scratch", name: "Scratch encoder", color: C.enc, marker: "circle", points: [[0, ref]], line: false, r: 5.4 });
    return Object.assign(V.lineChart(w, {
      label: `Average ${m === "vqa" ? "VQA" : "text"} score versus the share of a fixed budget spent on encoder pretraining`,
      minPanelW: 240, height: priorH(w), margin: { l: 40, r: 16, t: 16, b: 52 },
      panels: [{
        x: { domain: [-0.35, 4.35], ticks: U.shares.map((s, i) => [i, s === 0 ? "0" : String(s)]), label: "Share of budget on encoder pretraining (%)" },
        y: { domain: yd, ticks: m === "vqa" ? [36, 38, 40, 42, 44] : [50, 52, 54, 56], label: metricLabel(m) },
        series,
        ann: [{ type: "hline", y: ref, color: C.enc, label: "scratch encoder", labelX: 4.3, labelDy: -6, labelColor: C.encDark }],
        xinfo: (i) => (i === 0 ? "No separate pretraining" : `${U.shares[i]}% of the ${U.budget.replace("^22", "²²")}-FLOP budget on pretraining`),
      }],
    }), { ytitle: metricLabel(m) });
  };

  // Figure 7: longer (free) MetaCLIP pretraining raises ImageNet accuracy but not VQA.
  // Drawn at the height of the Figure 2a chart beside it; the compute bars' key is the HTML legend above.
  FIG.free = (w, el) => {
    const F = D.freePretraining;
    const rows = F.rows.slice().reverse(); // most pretraining on top, scratch at the bottom (as in the paper)
    const fs = w < 420 ? 13 : 15;
    const showBars = w >= 400;
    const key = el.parentElement.querySelector(".legend");
    if (key) key.hidden = !showBars;
    const labelW = 60, gap = 20;
    const avail = w - labelW - 8;
    const barW = showBars ? Math.max(76, avail * 0.22) : 0;
    const panW = (avail - barW - (showBars ? 2 : 1) * gap) / 2;
    const H = priorH(w), top = 56, bottom = H - fs - 18;
    const rowH = (bottom - top) / rows.length;
    const yOf = (i) => top + i * rowH + rowH / 2;
    let g = "";
    // row labels
    g += V.T(labelW - 6, top - 16, "×10^{21}", { size: fs - 1.5, anchor: "end", color: C.faint });
    rows.forEach((r, i) => {
      g += V.T(labelW - 6, yOf(i) + fs * .34, r.label, { size: fs, anchor: "end", color: r.pre ? C.preDark : C.encDark, weight: 700 });
      if (r.note) g += V.T(labelW - 6, yOf(i) + fs * .34 + fs, r.note, { size: fs - 2.5, anchor: "end", color: C.faint, italic: true });
    });
    let x0 = labelW + 4;
    // compute bars
    if (showBars) {
      const sx = V.scale([0, 12], [x0, x0 + barW]), bh = Math.min(22, rowH * 0.5);
      g += V.T(x0, top - 34, "Compute", { size: fs, weight: 700 }) + V.T(x0, top - 16, "FLOPs", { size: fs - 1.5, color: C.faint });
      rows.forEach((r, i) => {
        const y = yOf(i) - bh / 2;
        if (r.pre) g += `<rect data-b="bar" data-r="${i}" x="${V.r1(sx(0))}" y="${V.r1(y)}" width="${V.r1(sx(r.pre) - sx(0) - 1)}" height="${V.r1(bh)}" fill="${C.pre}"/>`;
        g += `<rect data-b="bar" data-r="${i}" x="${V.r1(sx(r.pre))}" y="${V.r1(y)}" width="${V.r1(sx(r.pre + F.multimodal) - sx(r.pre))}" height="${V.r1(bh)}" rx="2" fill="#c3c8ce"/>`;
      });
      x0 += barW + gap;
    }
    // dot panels
    const panel = (title, sub, key, domain, ticks) => {
      const sx = V.scale(domain, [x0 + 6, x0 + panW - 6]);
      let p = V.T(x0, top - 34, title, { size: fs, weight: 700 }) + V.T(x0, top - 16, sub, { size: fs - 1.5, color: C.faint });
      ticks.forEach((t) => {
        p += `<line x1="${V.r1(sx(t))}" x2="${V.r1(sx(t))}" y1="${top - 4}" y2="${V.r1(bottom)}" stroke="${C.grid}"/>`;
        p += V.T(sx(t), bottom + fs + 6, String(t), { size: fs - 1, anchor: "middle", color: C.muted, cls: "tnum" });
      });
      p += `<line x1="${V.r1(x0)}" x2="${V.r1(x0 + panW)}" y1="${V.r1(bottom)}" y2="${V.r1(bottom)}" stroke="${C.axis}"/>`;
      const pts = rows.map((r, i) => (r[key] == null ? null : [sx(r[key]), yOf(i), r, i])).filter(Boolean);
      const pre = pts.filter((q) => q[2].pre);
      p += `<path data-b="line" d="${pre.map((q, k) => (k ? "L" : "M") + V.r1(q[0]) + "," + V.r1(q[1])).join("")}" fill="none" stroke="${C.pre}" stroke-width="2.2"/>`;
      pts.forEach((q) => {
        const isScratch = !q[2].pre;
        p += tag(V.marker(isScratch ? "circle" : "diamond", q[0], q[1], 6.5, isScratch ? C.enc : C.pre), `data-b="pt" data-r="${q[3]}"`);
        p += tag(V.T(q[0] + (key === "vqa" ? -11 : 11), q[1] + fs * .34, f1(q[2][key]), { size: fs - 0.5, anchor: key === "vqa" ? "end" : "start", color: C.ink, halo: true, cls: "tnum" }), `data-b="val" data-r="${q[3]}"`);
      });
      if (key === "imagenet") p += tag(V.T(x0 + 8, yOf(rows.length - 1) + fs * .34, "—", { size: fs, color: C.faint }), `data-b="val" data-r="${rows.length - 1}"`);
      x0 += panW + gap;
      return p;
    };
    g += panel("ImageNet probe (%)", "after pretraining", "imagenet", [79.5, 86], [80, 82, 84]);
    g += panel("Avg. VQA (%)", "after all training", "vqa", [35.6, 39.8], [36, 37, 38, 39]);
    const tips = rows.map((r) => ({
      title: r.pre ? `MetaCLIP pretrained with ${r.label}×10²¹ FLOPs` : "Encoder trained from scratch",
      rows: [...(r.imagenet != null ? [{ value: f1(r.imagenet), name: "ImageNet linear probe (%)" }] : []), { value: f1(r.vqa), name: "Avg. VQA (%)" }, { value: "2.7×10²¹", name: "multimodal FLOPs (same for every row)" }],
    }));
    const hits = rows.map((r, i) => `<rect class="hit-row" data-i="${i}" x="0" y="${V.r1(top + i * rowH)}" width="${w}" height="${V.r1(rowH)}" fill="transparent"/>`).join("");
    return { svg: V.svgWrap(w, H, g + hits, { label: "More encoder pretraining raises ImageNet accuracy but not VQA" }), tips, kind: "rows" };
  };

  // Figures 3 and 5: recipes over lifetime compute at 1.7B and 4B
  function trajectory(w, figId, set, keys, arrows) {
    const m = metricOf(figId);
    const sizes = ["1.7B", "4B"];
    const dom = { "1.7B": [0.56, 15.4], "4B": [2.45, 34.2] };
    const yd = m === "vqa" ? { "1.7B": [28, 45], "4B": [35, 51] } : { "1.7B": [44, 57], "4B": [50, 62] };
    const yt = m === "vqa" ? { "1.7B": [30, 35, 40, 45], "4B": [35, 40, 45, 50] } : { "1.7B": [45, 50, 55], "4B": [50, 55, 60] };
    return Object.assign(V.lineChart(w, {
      label: `${m === "vqa" ? "Average VQA" : "Average text"} score over lifetime compute`,
      minPanelW: 250, height: Math.min(320, Math.max(256, w * 0.39)), margin: { l: 40, r: 16, t: 30, b: 52 },
      panels: sizes.map((sz) => {
        const S = set[sz];
        const series = keys.map((k) => ({ key: k, name: RC[k].name, color: RC[k].color, dark: RC[k].dark, marker: RC[k].marker, points: S.x.map((x, i) => [x, S[k][m][i]]) }));
        const ann = [];
        if (arrows && m === "vqa" && S.multiplier) {
          const M = S.multiplier;
          ann.push({ type: "arrow", from: [M.to * 0.97, M.y], to: [M.from * 1.03, M.y], label: M.label });
        }
        return {
          title: sz, subtitle: "backbone",
          x: { domain: dom[sz], log: true, ticks: xFlops(dom[sz][0], dom[sz][1]), label: "Lifetime FLOPs" },
          y: { domain: yd[sz], ticks: yt[sz], label: metricLabel(m), always: false },
          series, ann,
          xinfo: (x) => `${plainFlops(x * 1e21)} FLOPs · ${S.tpp[S.x.indexOf(x)]} tokens per parameter`,
        };
      }),
    }), { ytitle: metricLabel(m) });
  }
  FIG.trajEF = (w) => trajectory(w, "fig-ef", D.trajectories.fig3, ["encoderFree", "scratch"], true);
  FIG.trajInf = (w) => trajectory(w, "fig-inf", D.trajectories.fig5, ["encoderFree", "scratch", "infusion"], false);

  // Table 2: encoder-free with the encoder's parameters added to its backbone
  // Each variant row shows the gap from encoder-free to the scratch encoder as a track, filled as far as the variant gets.
  FIG.steelman = (w) => {
    const groups = D.steelman.map((g) => ({
      title: `${g.size} backbone`, sub: `${g.flops} FLOPs · ${g.tpp} tokens per parameter`,
      rows: g.rows.map((r) => {
        const isEnc = r.key === "scratch", ef = g.rows.find((q) => q.key === "encoderFree").vqa, sc = g.rows.find((q) => q.key === "scratch").vqa;
        const variant = r.key !== "scratch" && r.key !== "encoderFree";
        return {
          key: r.key, label: r.label, value: r.vqa, side: f1(r.text), track: variant ? [ef, sc] : null, from: variant ? ef : null,
          color: isEnc ? C.enc : (r.key === "encoderFree" ? C.ef : "#f3b95c"), marker: isEnc ? "circle" : "square",
          strong: isEnc || r.key === "encoderFree",
          tip: { title: `${r.label} · ${g.size} · ${r.params} parameters`, rows: [{ value: f1(r.vqa), name: "Avg. VQA (%)" }, { value: f1(r.text), name: "Avg. Text (%)" }] },
        };
      }),
    }));
    return V.dotPlot(w, {
      label: "Encoder-free variants with the encoder's parameters added versus the scratch encoder",
      groups, labelW: 190, labelWNarrow: 160, rowH: 33,
      x: { domain: [33.5, 46.5], ticks: [34, 36, 38, 40, 42, 44, 46], label: "Avg. VQA (%)" },
      side: { header: "Avg. Text" },
    });
  };

  // Table 3: how and where to add in-fusion capacity
  FIG.capDesign = (w) => {
    const CD = D.capacityDesign;
    const groups = CD.groups.map((g) => ({
      title: g.title, sub: g.sub,
      rows: g.rows.map((r) => ({
        label: r.label, value: r.vqa, side: f1(r.text), icon: V.layerStrip(r.pattern),
        color: r.users === "vision" ? C.infFFN : "#9aa1ab", marker: r.users === "vision" ? "tri-up" : "circle", strong: !!r.best,
        tip: { title: `${r.label} · ${r.users === "vision" ? "vision tokens only" : "all tokens"}`, rows: [{ value: f1(r.vqa), name: "Avg. VQA (%)" }, { value: f1(r.ocr), name: "OCR & chart VQA (%)" }, { value: f1(r.text), name: "Avg. Text (%)" }] },
      })),
    }));
    return V.dotPlot(w, {
      label: "Added capacity by who uses it and where it sits",
      groups, labelW: 200, labelWNarrow: 184, iconW: 122, hideIconsNarrow: true, rowH: 33,
      x: { domain: [31, 41], ticks: [31, 33, 35, 37, 39, 41], label: "Avg. VQA (%)" },
      refs: [
        { key: "encoderFree", value: CD.refs.encoderFree.vqa, label: "encoder-free", color: C.ef, labelColor: C.efDark, anchor: "end", dx: 4 },
        { key: "scratch", value: CD.refs.scratch.vqa, label: "scratch encoder", color: C.enc, labelColor: C.encDark, anchor: "end", dx: 4 },
      ],
      side: { header: "Avg. Text" },
    });
  };

  // Figure 6: per-recipe laws on the backbone-size ladder
  FIG.ladder = (w) => {
    const L = D.ladder, keys = ["encoderFree", "scratch", "infusion"];
    const xdom = [5.86e20, 3.9e22];
    const xt = [[1e21, "10^{21}"], [3e21, "3×10^{21}"], [1e22, "10^{22}"], [3e22, "3×10^{22}"]];
    const mk = (metric) => {
      const isV = metric === "vqa";
      const vals = isV ? L.vqa : L.caption, curves = isV ? L.vqaCurves : L.captionCurves;
      const series = [];
      keys.forEach((k) => {
        series.push({ key: k + "-law", name: RC[k].name, color: RC[k].color, points: curves[k].map((q) => [q[0], q[1]]), noMarkers: true, noHover: true, lw: 1.7, dash: k === "infusion" ? "6 4" : undefined });
        series.push({ key: k, name: RC[k].name, color: RC[k].color, marker: RC[k].marker, points: L.x.map((x, i) => [x, vals[k][i]]), line: false, r: 4.8 });
      });
      const ann = vals.multipliers.map((M) => ({ type: "arrow", from: [M.to / 1.04, M.y], to: [M.from * 1.04, M.y], label: M.label, prefer: isV ? "right" : "left" }));
      if (isV) L.sizes.forEach((s, i) => ann.push({ type: "text", x: L.x[i], y: 26.7, text: s, anchor: "middle", size: 13, color: C.faint }));
      return {
        title: isV ? "Avg. VQA (%)" : "Held-out caption loss", subtitle: isV ? "higher is better" : "lower is better",
        x: { domain: xdom, log: true, ticks: xt, label: "Lifetime compute (FLOPs)" },
        y: isV ? { domain: [25, 53], ticks: [25, 30, 35, 40, 45, 50], label: "" } : { domain: [0.79, 1.27], log: true, ticks: [0.8, 0.9, 1.0, 1.1, 1.2], label: "", fmt: (v) => f1(v), tipFmt: (v) => v.toFixed(3) },
        series, ann, ascending: !isV,
        xinfo: (x) => `${L.sizes[L.x.findIndex((v) => Math.abs(v / x - 1) < 0.01)] || ""} backbone · ${plainFlops(x)} FLOPs`,
      };
    };
    const out = V.lineChart(w, { label: "Per-recipe scaling laws from 1B to 6.4B backbones", minPanelW: 320, height: Math.min(330, Math.max(260, w * 0.37)), margin: { l: 40, r: 14, t: 30, b: 52 }, panels: [mk("vqa"), mk("caption")] });
    out.meta[1].ascending = true;
    return out;
  };

  // Figure 8: mid-training from a pretrained text-only model
  FIG.mid = (w) => {
    const M = D.midtraining;
    const rows = M.rows.map((r) => {
      const rc = RC[r.key];
      return {
        key: r.key, label: r.label, value: r.vqa, side: f1(r.text), color: rc.color, marker: rc.marker,
        strong: r.key === "infusion" || r.key === "scratch" || r.key === "encoderFree",
        tip: { title: r.label, rows: [{ value: f1(r.vqa), name: "Avg. VQA (%)" }, { value: f1(r.text), name: "Avg. Text (%)" }, { value: f1(M.textOnly), name: "Avg. Text, text-only control" }] },
      };
    });
    return V.dotPlot(w, {
      label: "Mid-training: average VQA by recipe after continuing a pretrained 1.7B text model",
      groups: [{ rows }], labelW: 218, labelWNarrow: 204, rowH: 34,
      x: { domain: [35, 46], ticks: [35, 37, 39, 41, 43, 45], label: "Avg. VQA (%)" },
      refs: [{ key: "encoderFree", value: M.rows.find((r) => r.key === "encoderFree").vqa, label: "encoder-free", color: C.ef, labelColor: C.efDark, anchor: "start", dx: -4 }],
      side: { header: "Avg. Text" },
    });
  };

  // Figure 9: time to first token
  FIG.ttft = (w) => V.stackedBars(w, {
    label: "Time to first token by recipe", labelW: 190, max: 108, prefill: D.ttft.prefill,
    groups: D.ttft.groups, ticks: [0, 20, 40, 60, 80, 100], xlabel: "Time to first token (ms), lower is better",
  });

  document.querySelectorAll("[data-chart]").forEach((el) => {
    const f = FIG[el.dataset.chart];
    if (f) mount(el, (w) => f(w, el));
  });

  // ------------------------------------------------------------ figure builds
  /* The first time a chart marked data-build reaches the middle of the screen, its marks land in order (its BUILD
     story); after that it is the same interactive chart. Every animation starts from hidden or undrawn and ends on the
     chart as drawn, so nothing is left behind. Charts in one figure build one after another, and the figure's Replay
     runs them again. */
  const pop = (el, at) => el.animate([{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "scale(1.15)", offset: 0.65 }, { opacity: 1, transform: "scale(1)" }],
    { duration: 380, delay: at, easing: "ease-out", fill: "backwards" });
  const fade = (el, at, dur = 380) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, delay: at, easing: "ease-out", fill: "backwards" });
  const grow = (el, at, dur = 380, easing = "cubic-bezier(.3, .7, .3, 1)") => el.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: dur, delay: at, easing, fill: "backwards" });
  // appears dx px from where it is drawn, then slides into place
  const slide = (el, at, dx) => el.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: `translateX(${dx}px)`, offset: 0.2, easing: "cubic-bezier(.3, .7, .3, 1)" }, { opacity: 1, transform: "translateX(0)" }],
    { duration: 650, delay: at, fill: "backwards" });
  // reveals a mark from its left edge to its right (or right to left) by clipping it
  function wipe(el, at, dur, rtl) {
    const w = el.getBBox().width + 12;
    return el.animate([{ clipPath: rtl ? `inset(-12px -12px -12px ${w}px)` : `inset(-12px ${w}px -12px -12px)` }, { clipPath: "inset(-12px -12px -12px -12px)" }],
      { duration: dur, delay: at, easing: "linear", fill: "backwards" });
  }
  // reveals a mark as a sweep passes over it; the sweep crosses x0 at time at and moves v px per ms
  const sweepIn = (el, x0, at, v) => { const b = el.getBBox(); return wipe(el, at + (b.x - 12 - x0) / v, (b.width + 24) / v); };
  // draws a polyline vertex by vertex: vertex k is reached at reach[k] ms, each segment taking segMs; reverse draws from the end
  function drawPath(el, reach, reverse, segMs) {
    const P = (el.getAttribute("d").match(/-?[\d.]+,-?[\d.]+/g) || []).map((q) => q.split(",").map(Number));
    if (P.length < 2) return null;
    const cum = [0];
    for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const L = cum[cum.length - 1], dash = `${L}px ${L}px`;
    const order = P.map((_, k) => (reverse ? P.length - 1 - k : k));
    const off = (k) => `${reverse ? -cum[k] : L - cum[k]}px`; // the dash offset that shows the path up to vertex k
    const t0 = reach[order[1]] - segMs, span = reach[order[order.length - 1]] - t0;
    const kf = [{ strokeDasharray: dash, strokeDashoffset: off(order[0]), offset: 0 }];
    for (let n = 1; n < order.length; n++) {
      kf.push({ strokeDasharray: dash, strokeDashoffset: off(order[n - 1]), offset: (reach[order[n]] - segMs - t0) / span });
      kf.push({ strokeDasharray: dash, strokeDashoffset: off(order[n]), offset: (reach[order[n]] - t0) / span });
    }
    return el.animate(kf, { duration: span, delay: t0, easing: "linear", fill: "backwards" });
  }
  const BUILD = {};
  // Figure 2a: the scratch encoder and its reference line first, then each share of the budget in turn
  BUILD.upstream = (el, at0) => {
    const q = (sel) => [...el.querySelectorAll(sel)], A = [];
    const T = (x) => at0 + 520 + (x - 1) * 330; // x = 1..4: the four shares
    q('[data-b="pt"][data-s="scratch"]').forEach((m) => A.push(pop(m, at0)));
    q('[data-b="ref"]').forEach((m, k) => A.push(fade(m, at0 + 150 + 150 * k, 450)));
    q('[data-b="pt"]:not([data-s="scratch"])').forEach((m) => A.push(pop(m, T(+m.dataset.x) + 120)));
    q('[data-b="line"]').forEach((l) => A.push(drawPath(l, [1, 2, 3, 4].map((x) => T(x) + 120), false, 240)));
    return { anims: A.filter(Boolean), dur: 520 + 3 * 330 + 520 };
  };
  // Figure 7: rows land from the bottom (no pretraining) to the top (the most); the pretraining line climbs with them
  BUILD.free = (el, at0) => {
    const q = (sel) => [...el.querySelectorAll(sel)], A = [];
    const n = D.freePretraining.rows.length, T = (r) => at0 + (n - 1 - r) * 260; // row r, counted from the top
    q('[data-b="bar"]').forEach((b) => A.push(grow(b, T(+b.dataset.r))));
    q('[data-b="pt"]').forEach((m) => A.push(pop(m, T(+m.dataset.r) + 140)));
    q('[data-b="val"]').forEach((v) => A.push(fade(v, T(+v.dataset.r) + 280, 300)));
    q('[data-b="line"]').forEach((l) => A.push(drawPath(l, [...Array(n - 1).keys()].map((r) => T(r) + 140), true, 220)));
    return { anims: A.filter(Boolean), dur: (n - 1) * 260 + 600 };
  };
  // Figure 3: a sweep draws each panel's lines from left to right, and markers land as it passes; then the compute
  // arrows draw in, each followed by its factor
  const sweepStory = (ms) => (el, at0) => {
    const A = [];
    let end = at0 + ms;
    el.querySelectorAll("g.panel").forEach((p) => {
      const hit = p.querySelector("rect.hit"), x0 = +hit.getAttribute("x") + 8, v = (+hit.getAttribute("width") - 16) / ms;
      const when = (x) => at0 + Math.max(0, x - x0) / v;
      p.querySelectorAll('[data-b="line"]').forEach((l) => A.push(sweepIn(l, x0, at0, v)));
      p.querySelectorAll('[data-b="pt"]').forEach((m) => A.push(pop(m, when(m.getBBox().x))));
      p.querySelectorAll('[data-b="note"]').forEach((t) => A.push(fade(t, when(t.getBBox().x))));
      p.querySelectorAll('line[data-b="arrow"]').forEach((ln, k) => {
        const t = at0 + ms + 200 + k * 320, lab = ln.nextElementSibling;
        A.push(wipe(ln, t, 420, +ln.getAttribute("x1") > +ln.getAttribute("x2")));
        if (lab && lab.dataset.b === "arrow") A.push(fade(lab, t + 320, 320));
        end = Math.max(end, t + 640);
      });
    });
    return { anims: A, dur: end - at0 };
  };
  BUILD.trajEF = sweepStory(1500);
  // Figure 5: encoder-free and the scratch encoder (Figure 3's comparison) come in first; then a sweep draws in-fusion,
  // which lands on the encoder
  BUILD.trajInf = (el, at0) => {
    const A = [], ms = 1500;
    el.querySelectorAll("g.panel").forEach((p) => {
      const hit = p.querySelector("rect.hit"), x0 = +hit.getAttribute("x") + 8, v = (+hit.getAttribute("width") - 16) / ms, t0 = at0 + 650;
      p.querySelectorAll('[data-b="line"]:not([data-s="infusion"]), [data-b="pt"]:not([data-s="infusion"])').forEach((m) => A.push(fade(m, at0, 450)));
      p.querySelectorAll('[data-b="line"][data-s="infusion"]').forEach((l) => A.push(sweepIn(l, x0, t0, v)));
      p.querySelectorAll('[data-b="pt"][data-s="infusion"]').forEach((m) => A.push(pop(m, t0 + Math.max(0, m.getBBox().x - x0) / v)));
    });
    return { anims: A, dur: 650 + ms + 300 };
  };
  // Figure 6: encoder-free's and the encoder's laws and runs sweep in, then the arrows show encoder-free's compute gap
  // growing with size; last, in-fusion's law sweeps in on top of the encoder's
  BUILD.ladder = (el, at0) => {
    const A = [], ms = 1400, isInf = (m) => (m.dataset.s || "").startsWith("infusion");
    let end = at0;
    el.querySelectorAll("g.panel").forEach((p) => {
      const hit = p.querySelector("rect.hit"), x0 = +hit.getAttribute("x") + 8, v = (+hit.getAttribute("width") - 16) / ms;
      const arrows = [...p.querySelectorAll('line[data-b="arrow"]')], t1 = at0 + ms + 200 + arrows.length * 320 + 200;
      const when = (x, t) => t + Math.max(0, x - x0) / v;
      p.querySelectorAll('[data-b="line"]').forEach((l) => A.push(sweepIn(l, x0, isInf(l) ? t1 : at0, v)));
      p.querySelectorAll('[data-b="pt"]').forEach((m) => A.push(pop(m, when(m.getBBox().x, isInf(m) ? t1 : at0))));
      p.querySelectorAll('[data-b="note"]').forEach((t) => A.push(fade(t, when(t.getBBox().x, at0))));
      arrows.forEach((ln, k) => {
        const t = at0 + ms + 200 + k * 320, lab = ln.nextElementSibling;
        A.push(wipe(ln, t, 420, +ln.getAttribute("x1") > +ln.getAttribute("x2")));
        if (lab && lab.dataset.b === "arrow") A.push(fade(lab, t + 320, 320));
      });
      end = Math.max(end, t1 + ms + 300);
    });
    return { anims: A, dur: end - at0 };
  };
  // Table 2: per backbone size, encoder-free and the scratch encoder land; then each variant row's track shows the gap
  // between them, and the variant fills only a little of it
  BUILD.steelman = (el, at0) => {
    const A = [], mid = (m) => { const b = m.getBBox(); return b.x + b.width / 2; };
    let end = at0;
    const values = (r, t) => {
      el.querySelectorAll(`[data-b="val"][data-r="${r}"]`).forEach((v) => A.push(fade(v, t, 260)));
      end = Math.max(end, t + 260);
    };
    const groups = [...new Set([...el.querySelectorAll('[data-b="pt"]')].map((m) => m.dataset.g))];
    groups.forEach((g, gi) => {
      const pts = [...el.querySelectorAll(`[data-b="pt"][data-g="${g}"]`)], t0 = at0 + 300 * gi;
      const ef = pts.find((m) => m.dataset.s === "encoderFree"), ends = (m) => m === ef || m.dataset.s === "scratch";
      pts.filter(ends).forEach((m) => { A.push(pop(m, t0)); values(m.dataset.r, t0 + 200); });
      pts.filter((m) => !ends(m)).forEach((m, k) => {
        const r = m.dataset.r, t = t0 + 450 + 90 * k, q = (b) => el.querySelector(`[data-b="${b}"][data-r="${r}"]`);
        if (q("track")) A.push(wipe(q("track"), t, 420));
        A.push(slide(m, t + 520, mid(ef) - mid(m)));
        if (q("fill")) A.push(grow(q("fill"), t + 650, 520));
        values(r, t + 1150);
      });
    });
    return { anims: A, dur: end - at0 };
  };
  // Table 3: the reference lines, then each row's layer strip fills in, then each score slides to its place from
  // encoder-free's, since every row adds its capacity to the encoder-free backbone
  BUILD.capDesign = (el, at0) => {
    const q = (sel) => [...el.querySelectorAll(sel)], A = [];
    q('[data-b="ref"]').forEach((r) => A.push(fade(r, at0, 400)));
    const strips = q('[data-b="strip"]');
    strips.forEach((s) => A.push(wipe(s, at0 + 200 + 60 * +s.dataset.r, 300)));
    const t0 = at0 + (strips.length ? 200 + 60 * (strips.length - 1) + 360 : 250);
    const ef = el.querySelector('line[data-b="ref"][data-s="encoderFree"]'), xEF = ef && +ef.getAttribute("x1");
    let end = t0;
    q('[data-b="pt"]').forEach((m) => {
      const r = +m.dataset.r, t = t0 + 90 * r, b = m.getBBox();
      A.push(ef ? slide(m, t, xEF - (b.x + b.width / 2)) : pop(m, t));
      q(`[data-b="val"][data-r="${r}"]`).forEach((v) => A.push(fade(v, t + 560, 260)));
      end = Math.max(end, t + 820);
    });
    return { anims: A, dur: end - at0 };
  };
  // Figure 9: the backbone prefill every recipe shares, then each recipe's added vision time grows at one speed, so the
  // quickest finishes first
  BUILD.ttft = (el, at0) => {
    const q = (sel) => [...el.querySelectorAll(sel)], A = [];
    q('[data-b="bar"]').forEach((b) => A.push(grow(b, at0 + 30 * +b.dataset.r, 450)));
    q('[data-b="ref"]').forEach((r) => A.push(fade(r, at0 + 250, 400)));
    const t0 = at0 + 750;
    let end = t0;
    q('[data-b="add"]').forEach((b) => {
      const d = +b.dataset.v * 28; // 28 ms of animation per ms of added time
      A.push(d ? grow(b, t0, d, "linear") : fade(b, t0, 200));
      q(`[data-b="val"][data-r="${b.dataset.r}"]`).forEach((v) => A.push(fade(v, t0 + d, 260)));
      end = Math.max(end, t0 + d + 260);
    });
    return { anims: A, dur: end - at0 };
  };
  // Figure 8: encoder-free and its reference line land first; then every other recipe starts at encoder-free's score
  // and slides to its own, from the bottom row up, showing what dedicated capacity adds
  BUILD.mid = (el, at0) => {
    const A = [], pts = [...el.querySelectorAll('[data-b="pt"]')], n = pts.length, mid = (m) => { const b = m.getBBox(); return b.x + b.width / 2; };
    const ef = pts.find((m) => m.dataset.s === "encoderFree");
    const values = (r, t) => el.querySelectorAll(`[data-b="val"][data-r="${r}"]`).forEach((v) => A.push(fade(v, t, 280)));
    el.querySelectorAll('[data-b="ref"]').forEach((r) => A.push(fade(r, at0 + 150, 400)));
    if (ef) { A.push(pop(ef, at0)); values(ef.dataset.r, at0 + 200); }
    pts.filter((m) => m !== ef).forEach((m) => {
      const t = at0 + 500 + (n - 1 - m.dataset.r) * 110;
      A.push(ef ? slide(m, t, mid(ef) - mid(m)) : pop(m, t));
      values(m.dataset.r, t + 560);
    });
    return { anims: A, dur: 500 + (n - 1) * 110 + 840 };
  };
  const story = (el) => BUILD[el.dataset.chart];
  const running = new Map(); // chart -> its animations
  function build(el, at) {
    (running.get(el) || []).forEach((a) => a.cancel());
    el.classList.remove("pre-build");
    const { anims, dur } = story(el)(el, at);
    running.set(el, anims);
    return at + dur;
  }
  document.querySelectorAll("figure").forEach((fig) => {
    const charts = [...fig.querySelectorAll("[data-build]")].filter(story);
    if (!charts.length) return;
    const btn = fig.querySelector(".replay");
    if (reduceMotion || !document.body.animate) { if (btn) btn.hidden = true; return; }
    let freeAt = 0; // when the figure's last build ends, on the performance.now() clock
    const started = new Set();
    charts.forEach((el) => {
      el.classList.add("pre-build");
      V.whenCentered(el, () => {
        if (started.has(el)) return;
        started.add(el);
        const now = performance.now(), at = Math.max(0, freeAt - 250 - now);
        freeAt = now + build(el, at);
      });
    });
    if (btn) btn.addEventListener("click", () => {
      charts.forEach((el) => started.add(el));
      let at = 0;
      charts.forEach((el) => { at = build(el, at) - 250; });
      freeAt = performance.now() + at + 250;
    });
  });

  // schematics + glyphs
  document.querySelectorAll("[data-schematic]").forEach((el) => {
    el.innerHTML = el.dataset.schematic === "infusion" ? V.infusionBlock() : V.motBlock();
  });

  // ------------------------------------------------------------ schematics: what each part does
  /* Pointing at a part of Figure 4 explains it; pointing at a token also dims what that token skips. A touch shows the
     explanation until the next touch elsewhere. */
  const PART = {
    infusion: {
      stream: ["Shared residual stream", "Vision and text tokens share one stream of hidden states. Each module's output is added back into it."],
      vision: ["Vision token", "Passes through every shared module and the vision-only ones too."],
      text: ["Text token", "Passes through the shared modules only, so text-only inputs are processed exactly as by the shared backbone."],
      out: ["Layer output", "The same tokens, passed on to the next layer."],
      add: ["Residual add", "Adds the module's output back into the shared stream."],
      norm: ["Norm", "Normalizes each token's hidden state before the module."],
      qkv: ["Shared attention projections", "Queries, keys and values for every token, from weights all tokens share."],
      dplus: ["Vision-only add", "For vision tokens, adds the vision-only projections to the shared ones."],
      attn: ["Joint attention", "Every token attends to vision and text tokens alike; attention itself stays shared."],
      o: ["Shared output projection", "Projects attention's output for every token."],
      ffn: ["Shared FFN", "The feed-forward network every token goes through."],
      dqkv: ["Vision-only attention projections", "Added to the shared queries, keys and values for vision tokens only. In-fusion (FFN-only) leaves these out."],
      do: ["Vision-only output projection", "Added to the shared output projection for vision tokens only. In-fusion (FFN-only) leaves it out."],
      dffn: ["Vision-only FFN branch", "Runs on vision tokens only and adds to the shared FFN's output. With the vision-only projections, these modules hold the encoder's 0.4B-parameter budget, in the first eight layers."],
    },
    mot: {
      tstream: ["Text residual stream", "Text tokens keep their own stream, with no weights shared with vision."],
      vstream: ["Vision residual stream", "Vision tokens keep their own stream, with their own copy of every module."],
      text: ["Text token", "Uses only the text modules; it meets vision tokens only in attention."],
      vision: ["Vision token", "Uses only the vision modules; it meets text tokens only in attention."],
      out: ["Layer output", "Each stream passes its tokens on to the next layer."],
      add: ["Residual add", "Adds the module's output back into its own stream."],
      norm: ["Norm", "Normalizes each token's hidden state; each modality has its own."],
      tqkv: ["Text attention projections", "Queries, keys and values for text tokens, from text-only weights."],
      vqkv: ["Vision attention projections", "Queries, keys and values for vision tokens, from vision-only weights."],
      joint: ["Joint attention", "The only place the two streams meet: every token attends to text and vision tokens alike."],
      to: ["Text output projection", "Projects attention's output for text tokens."],
      vo: ["Vision output projection", "Projects attention's output for vision tokens."],
      tffn: ["Text FFN", "A feed-forward network only text tokens use."],
      vffn: ["Vision FFN", "A feed-forward network only vision tokens use."],
    },
  };
  let pinned = null;
  const unpoint = () => {
    document.querySelectorAll(".schematic .tip-on").forEach((g) => g.classList.remove("tip-on"));
    document.querySelectorAll(".schematic").forEach((svg) => svg.classList.remove("follow-vision", "follow-text"));
    hideTip();
  };
  document.querySelectorAll("[data-schematic]").forEach((el) => {
    const svg = el.querySelector("svg"), parts = PART[el.dataset.schematic];
    el.querySelectorAll("[data-tip]").forEach((g) => {
      const [title, text] = parts[g.dataset.tip];
      const point = (ev) => {
        if (!g.classList.contains("tip-on")) { unpoint(); g.classList.add("tip-on"); if (g.dataset.follow) svg.classList.add(`follow-${g.dataset.follow}`); }
        showTip(ev, { title, text });
      };
      g.addEventListener("pointermove", (ev) => { if (ev.pointerType === "mouse") point(ev); });
      g.addEventListener("pointerdown", (ev) => { point(ev); pinned = ev.pointerType === "mouse" ? null : g; });
      g.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") unpoint(); });
    });
  });
  document.addEventListener("pointerdown", (ev) => { if (pinned && !pinned.contains(ev.target)) { pinned = null; unpoint(); } }, true);
  // a tooltip explains what is under the pointer, so scrolling clears it and its marks (some browsers send no
  // pointerleave when the page scrolls under a still pointer)
  window.addEventListener("scroll", () => {
    if (!tip.classList.contains("on")) return;
    pinned = null;
    unpoint();
    document.querySelectorAll(".hit-row.on").forEach((h) => h.classList.remove("on"));
    document.querySelectorAll(".chart .xh").forEach((x) => x.setAttribute("opacity", 0));
    document.querySelectorAll(".chart g.hl").forEach((g) => { g.innerHTML = ""; });
  }, { passive: true });
  document.querySelectorAll("[data-glyph]").forEach((el) => {
    el.innerHTML = V.glyph(el.dataset.glyph, { height: +(el.dataset.h || 40) });
  });
  document.querySelectorAll("[data-key]").forEach((el) => {
    const k = el.dataset.key;
    el.innerHTML = V.legendLine(k, { noLine: el.hasAttribute("data-noline") });
  });
  document.querySelectorAll("[data-strip]").forEach((el) => { el.innerHTML = V.layerStrip(el.dataset.strip); });

  // ------------------------------------------------------------ bundle diagram
  /* One glyph that morphs between the four recipes: pills (dedicated capacity) change color when the prior is dropped,
     disappear for encoder-free, and slide into the backbone for in-fusion. */
  const bundleEl = document.getElementById("bundle");
  if (bundleEl) {
    const W = 492, H = 276, cy = 134;
    const S = {
      pretrained: { fill: C.preLight, stroke: C.pre, op: 1, pw: 25, ph: 66, px: 88, pg: 8, a1: 80, c0: 173, c1: 226, bd: 200, bx: 226, bw: 254, Bx: 353, keep: [1, 1, 1] },
      scratch: { fill: C.encLight, stroke: C.enc, op: 1, pw: 25, ph: 66, px: 88, pg: 8, a1: 80, c0: 173, c1: 226, bd: 200, bx: 226, bw: 254, Bx: 353, keep: [0, 1, 1] },
      free: { fill: C.encLight, stroke: C.enc, op: 0, pw: 14, ph: 30, px: 186, pg: 5, a1: 62, c0: 62, c1: 226, bd: 213, bx: 226, bw: 254, Bx: 353, keep: [0, 0, 0] },
      infusion: { fill: C.encLight, stroke: C.enc, op: 1, pw: 21, ph: 52, px: 124, pg: 7, a1: 62, c0: 62, c1: 108, bd: 94, bx: 108, bw: 372, Bx: 404, keep: [0, 1, 0] },
    };
    const ah = V.nextId("bah");
    bundleEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A vision encoder glyph that morphs between the four recipes">
      <defs>${V.arrowDef(ah, C.muted)}</defs>
      <g class="b-img"><rect x="10" y="${cy - 29}" width="46" height="58" rx="7" fill="#eef0f2" stroke="#b7bcc3" stroke-width="2"/>
        <path d="M15,${cy + 22} L27,${cy + 2} L35,${cy + 12} L41,${cy + 5} L51,${cy + 22} z" fill="#b7bcc3"/><circle cx="44" cy="${cy - 14}" r="5" fill="#c9cdd2"/></g>
      <line class="b-a" y1="${cy}" y2="${cy}" stroke="#9aa1ab" stroke-width="5" stroke-linecap="round"/>
      <line class="b-c" y1="${cy}" y2="${cy}" stroke="#9aa1ab" stroke-width="5" stroke-linecap="round"/>
      <rect class="b-box" y="${cy - 45}" height="90" rx="20" fill="#fff" stroke="#3a4048" stroke-width="3"/>
      <g class="b-pills"><rect/><rect/><rect/></g>
      <text class="b-B" y="${cy + 17}" font-size="50" font-weight="700" text-anchor="middle" fill="${C.ink}">B</text>
      <line class="b-t" x1="446" x2="446" y1="${cy + 94}" y2="${cy + 50}" stroke="#9aa1ab" stroke-width="2.4" marker-end="url(#${ah})"/>
      <text x="446" y="${cy + 114}" font-size="17" text-anchor="middle" fill="${C.faint}" font-style="italic">text tokens</text>
      <g class="b-bd"><line y1="${cy - 72}" y2="${cy + 74}" stroke="${C.ink}" stroke-width="1.8" stroke-dasharray="6 5"/>
        <text class="b-bdl" y="${cy + 95}" font-size="16.5" fill="${C.muted}" text-anchor="middle">fusion boundary</text></g>
      <g class="b-call" data-i="0"><text x="6" y="22" font-size="20.5" font-weight="700"><tspan class="mk"></tspan> Visual prior</text>
        <text x="6" y="43" font-size="17" fill="${C.muted}">from separate pretraining</text><line class="ld" x1="64" y1="51" stroke="${C.muted}" stroke-width="1.5" marker-end="url(#${ah})"/></g>
      <g class="b-call" data-i="1"><text x="6" y="${H - 27}" font-size="20.5" font-weight="700"><tspan class="mk"></tspan> Dedicated capacity</text>
        <text x="6" y="${H - 6}" font-size="17" fill="${C.muted}">parameters only vision tokens use</text><line class="ld" x1="94" y1="${H - 47}" stroke="${C.muted}" stroke-width="1.5" marker-end="url(#${ah})"/></g>
      <g class="b-call" data-i="2"><text x="246" y="22" font-size="20.5" font-weight="700"><tspan class="mk"></tspan> Pre-fusion placement</text>
        <text x="246" y="43" font-size="17" fill="${C.muted}">runs before vision meets text</text><line class="ld" x1="250" y1="50" stroke="${C.muted}" stroke-width="1.5" marker-end="url(#${ah})"/></g>
    </svg>`;
    const q = (s) => bundleEl.querySelector(s);
    const pills = [...bundleEl.querySelectorAll(".b-pills rect")];
    const calls = [...bundleEl.querySelectorAll(".b-call")];
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; };
    const lerp = (a, b, t) => a + (b - a) * t;
    let cur = Object.assign({}, S.pretrained), anim = null, curName = "pretrained";
    function draw(s) {
      q(".b-a").setAttribute("x1", 62); q(".b-a").setAttribute("x2", s.a1);
      q(".b-a").setAttribute("opacity", s.a1 - 62 > 3 ? 1 : 0);
      q(".b-c").setAttribute("x1", s.c0); q(".b-c").setAttribute("x2", s.c1);
      q(".b-box").setAttribute("x", s.bx); q(".b-box").setAttribute("width", s.bw);
      q(".b-B").setAttribute("x", s.Bx);
      pills.forEach((p, i) => {
        p.setAttribute("x", s.px + i * (s.pw + s.pg)); p.setAttribute("y", cy - s.ph / 2);
        p.setAttribute("width", s.pw); p.setAttribute("height", s.ph); p.setAttribute("rx", s.pw / 2);
        p.setAttribute("fill", s.fillC || s.fill); p.setAttribute("stroke", s.strokeC || s.stroke); p.setAttribute("stroke-width", 2.6);
        p.setAttribute("opacity", s.op);
      });
      const bd = q(".b-bd line"), bl = q(".b-bdl");
      bd.setAttribute("x1", s.bd); bd.setAttribute("x2", s.bd); bl.setAttribute("x", s.bd);
      // leaders follow the parts they point at
      const p0 = s.px + s.pw / 2, p1 = s.px + (s.pw + s.pg) + s.pw / 2;
      const L = calls.map((c) => c.querySelector(".ld"));
      L[0].setAttribute("x2", p0); L[0].setAttribute("y2", cy - s.ph / 2 - 6);
      L[1].setAttribute("x2", p1); L[1].setAttribute("y2", cy + s.ph / 2 + 6);
      L[2].setAttribute("x2", s.bd + 1); L[2].setAttribute("y2", cy - 74);
    }
    function setCalls(keep) {
      calls.forEach((c, i) => {
        c.classList.toggle("dropped", !keep[i]);
        c.querySelector(".mk").textContent = keep[i] ? "✓" : "✗";
      });
    }
    function go(name) {
      const from = Object.assign({}, cur), to = S[name];
      curName = name;
      setCalls(to.keep);
      let t0 = null;
      const dur = reduceMotion ? 1 : 720;
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      if (anim) cancelAnimationFrame(anim);
      const fromFill = from.fillC || from.fill, fromStroke = from.strokeC || from.stroke;
      const step = (now) => {
        if (t0 === null) t0 = now;
        const t = Math.max(0, Math.min(1, (now - t0) / dur)), e = ease(t);
        const s = {};
        ["op", "pw", "ph", "px", "pg", "a1", "c0", "c1", "bd", "bx", "bw", "Bx"].forEach((k) => (s[k] = lerp(from[k], to[k], e)));
        s.fillC = mix(rgbHex(fromFill), to.fill, e); s.strokeC = mix(rgbHex(fromStroke), to.stroke, e);
        draw(s);
        cur = Object.assign({}, s, { fill: to.fill, stroke: to.stroke });
        if (t < 1) anim = requestAnimationFrame(step);
        else { cur = Object.assign({}, to); anim = null; }
      };
      if (reduceMotion) { draw(Object.assign({}, to)); cur = Object.assign({}, to); }
      else anim = requestAnimationFrame(step);
      document.querySelectorAll("#recipes tr[data-recipe]").forEach((tr) => tr.classList.toggle("sel", tr.dataset.recipe === name));
    }
    function rgbHex(c) {
      if (c[0] === "#") return c;
      const m = c.match(/\d+/g).map(Number);
      return "#" + m.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
    }
    draw(cur); setCalls(S.pretrained.keep);
    let touched = false, timer = null;
    const order = ["pretrained", "scratch", "free", "infusion"];
    document.querySelectorAll("#recipes tr[data-recipe]").forEach((tr) => {
      const pick = () => { touched = true; clearTimeout(timer); go(tr.dataset.recipe); };
      tr.addEventListener("click", pick);
      tr.addEventListener("mouseenter", pick);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
    go(S[params.get("bundle")] ? params.get("bundle") : "pretrained");
    // play the four recipes once when the diagram first reaches the middle of the screen
    if (!reduceMotion) {
      V.whenCentered(bundleEl, () => {
        if (touched) return;
        let k = 0;
        const next = () => {
          if (touched) return;
          k += 1;
          if (k < order.length) { go(order[k]); timer = setTimeout(next, 1900); }
          else timer = setTimeout(() => !touched && go("pretrained"), 2200);
        };
        timer = setTimeout(next, 1400);
      });
    }
  }

  // ------------------------------------------------------------ contents: side list and tab bar
  /* Each list marks the last of its own entries the reader has passed, so the tab bar, which lists only top-level
     sections, keeps §5 marked while the side list marks §5.4. */
  const navs = [...document.querySelectorAll(".toc, .tabs")].map((n) => {
    const links = [...n.querySelectorAll("a")];
    return { n, links, secs: links.map((a) => document.querySelector(a.getAttribute("href"))), cur: -1 };
  });
  if (navs.length) {
    const onScroll = () => {
      const y = window.scrollY + window.innerHeight * 0.3;
      navs.forEach((v) => {
        let c = 0;
        v.secs.forEach((s, i) => { if (s && s.offsetTop <= y) c = i; });
        if (c === v.cur) return;
        v.cur = c;
        v.links.forEach((a, i) => a.classList.toggle("on", i === c));
        // keep the marked tab in view when the tab bar scrolls sideways
        const a = v.links[c];
        if (v.n.classList.contains("tabs") && v.n.offsetParent) {
          const ol = a.closest("ol"), r = a.getBoundingClientRect(), rr = ol.getBoundingClientRect();
          if (r.left < rr.left || r.right > rr.right - 40) ol.scrollBy({ left: r.left - rr.left - 8, behavior: reduceMotion ? "auto" : "smooth" });
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ------------------------------------------------------------ heading anchors (a ¶ link shows on hover)
  document.querySelectorAll("section[id] > h2").forEach((h) => {
    const a = document.createElement("a");
    a.className = "hanchor";
    a.href = "#" + h.parentElement.id;
    a.textContent = "¶";
    a.setAttribute("aria-label", "Link to this section");
    h.appendChild(a);
  });

  // ------------------------------------------------------------ BibTeX copy
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = document.querySelector(btn.dataset.copy);
      const done = () => { const t = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = t), 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(src.textContent.trim()).then(done);
    });
  });
})();
