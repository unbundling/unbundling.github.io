/* Chart values, read from the values the paper's own figures plot (each block names its figure or table), as arXiv v1
   builds them: Avg. VQA after 448×448 instruction tuning (raw/resolution.py's default), except where a block says 224.
   Compute is in units of 1e21 FLOPs unless noted. Avg. VQA averages the four category means of the
   16 Cambrian benchmarks; Avg. Text averages the four category means of 12 language benchmarks. */
window.DATA = {
  // Figure 2a. 1.7B backbone at a fixed 1.04e22-FLOP lifetime budget. Each pretrained encoder spends a share of that
  // budget on encoder pretraining before the same multimodal training; the scratch encoder spends none.
  upstreamShare: {
    budget: "1.04×10^22",
    shares: [0, 7.4, 15, 30, 60],
    scratch: { vqa: 49.0405, text: 54.312314 },
    series: [
      { key: "metaclip", name: "MetaCLIP", vqa: [47.3119, 47.5362, 46.3506, 44.3519], text: [54.37, 54.666414, 53.468052, 52.245724] },
      { key: "webssl", name: "WebSSL", vqa: [48.282, 49.3196, 47.4208, 44.8246], text: [55.39, 54.585385, 53.513248, 52.246444] },
      { key: "cap", name: "Cap", vqa: [48.5421, 48.2502, 46.3558, 44.4297], text: [53.89, 54.359882, 53.028305, 51.542391] },
      { key: "cappa", name: "CapPa", vqa: [47.0194, 47.1561, 46.465, 42.8421], text: [55.0459, 54.344071, 53.245859, 51.051401] },
    ],
  },

  // Figure 7. MetaCLIP pretrained for longer (not charged), then the same 2.74e21-FLOP multimodal stage at 1.7B.
  freePretraining: {
    multimodal: 2.74,
    rows: [
      { label: "None", note: "scratch", pre: 0, imagenet: null, vqa: 43.521 },
      { label: "1.4", note: "default", pre: 1.38, imagenet: 80.43, vqa: 43.1589 },
      { label: "2.8", pre: 2.76, imagenet: 80.62, vqa: 42.2233 },
      { label: "5.5", pre: 5.52, imagenet: 82.048, vqa: 42.7159 },
      { label: "9.0", pre: 8.98, imagenet: 84.44, vqa: 41.6336 },
    ],
  },

  // Figures 3 and 5. Learning-rate-decayed endpoints over lifetime compute. tpp = tokens per (non-embedding) parameter.
  // Figure 3 plots every encoder / encoder-free endpoint; Figure 5 plots the budgets where all three recipes exist.
  trajectories: {
    fig3: {
      "1.7B": {
        x: [0.651, 1.302, 2.604, 5.207, 7.811, 10.414, 13.018],
        tpp: [39, 79, 158, 315, 473, 631, 788],
        encoderFree: { vqa: [31.98, 34.77, 39, 41.88, 43.01, 43.83, 44.81], text: [46.38, 48.32, 50.74, 52.6, 53.71, 55.31, 55.66] },
        scratch: { vqa: [37.29, 41.21, 44.41, 46.54, 47.54, 49.04, 48.89], text: [45.32, 47.32, 49.73, 52.5468, 54.42, 54.31, 55.29] },
        // encoder-free needs 4.4x (1.7B) and 3.0x (4B) the compute to reach the encoder's Avg. VQA (arrow at encoder-free's last
        // point)
        multiplier: { from: 2.9659, to: 13.018, y: 44.81, label: "4.4×" },
      },
      "4B": {
        x: [2.895, 5.791, 11.582, 17.372, 28.95],
        tpp: [31, 61, 122, 183, 306],
        encoderFree: { vqa: [41.01, 44.86, 48.4487, 50.19, 51.73], text: [51.49, 55.98, 56.96, 59.19, 61.0] },
        scratch: { vqa: [47.84, 51.18, 51.91, 54.16, 54.51], text: [52.02, 56.36, 57.9, 58.9457, 60.37] },
        multiplier: { from: 9.7624, to: 28.954, y: 51.73, label: "3.0×" },
      },
    },
    fig5: {
      "1.7B": {
        x: [0.651, 1.302, 2.604, 5.207, 13.018],
        tpp: [39, 79, 158, 315, 788],
        encoderFree: { vqa: [31.98, 34.77, 39, 41.88, 44.81], text: [46.38, 48.32, 50.74, 52.6, 55.66] },
        scratch: { vqa: [37.29, 41.21, 44.41, 46.54, 48.89], text: [45.32, 47.32, 49.73, 52.5468, 55.29] },
        infusion: { vqa: [37.41, 40.4, 42.62, 46.47, 49.19], text: [45.73, 48.11, 50.7472, 53.42, 55.93] },
      },
      "4B": {
        x: [2.895, 5.791, 11.582, 28.95],
        tpp: [31, 61, 122, 306],
        encoderFree: { vqa: [41.01, 44.86, 48.4487, 51.73], text: [51.49, 55.98, 56.96, 61.0] },
        scratch: { vqa: [47.84, 51.18, 51.91, 54.51], text: [52.02, 56.36, 57.9, 60.37] },
        infusion: { vqa: [45.52, 49.03, 51.84, 54.3], text: [51.9, 55.88, 57.73, 60.68] },
      },
    },
  },

  // Table 2 (1.7B) and its 4B companion in the appendix (tab:appx:encoder-free:4b). The encoder's 0.4B parameters given
  // to the encoder-free backbone as width, depth, or both.
  steelman: [
    {
      size: "1.7B", flops: "2.6×10^21", tpp: 158,
      rows: [
        { key: "encoderFree", label: "Encoder-free", params: "1.7B", vqa: 39.0, text: 50.7 },
        { key: "wider", label: "+ wider", params: "2.1B", vqa: 38.6, text: 51.3 },
        { key: "deeper", label: "+ deeper", params: "2.1B", vqa: 38.7, text: 51.2 },
        { key: "both", label: "+ wider and deeper", params: "2.1B", vqa: 38.8, text: 51.4 },
        { key: "scratch", label: "Scratch encoder", params: "2.1B", vqa: 44.4, text: 49.7 },
      ],
    },
    {
      size: "4B", flops: "1.16×10^22", tpp: 122,
      rows: [
        { key: "encoderFree", label: "Encoder-free", params: "4.0B", vqa: 48.4487, text: 56.9616 },  // the run Fig. 3 plots
        { key: "wider", label: "+ wider", params: "4.4B", vqa: 48.1, text: 58.3 },
        { key: "scratch", label: "Scratch encoder", params: "4.4B", vqa: 51.9, text: 57.9 },
      ],
    },
  ],

  // Table 3. Every variant adds 0.4B parameters to the 1.7B encoder-free backbone, at 2.6e21 FLOPs (158 TPP).
  capacityDesign: {
    refs: { scratch: { vqa: 44.4, text: 49.7 }, encoderFree: { vqa: 39.0, text: 50.7 } },
    groups: [
      {
        title: "Who uses the added capacity?", sub: "first 8 layers",
        rows: [
          { label: "Shared FFN widening", users: "all", pattern: "wide-early", vqa: 40.1, text: 51.2, ocr: 29.6 },
          { label: "Separate FFN branch", users: "all", pattern: "all-early", vqa: 42.3, text: 51.2, ocr: 30.8 },
          { label: "Vision-only FFN branch", users: "vision", pattern: "vis-early", vqa: 45.0, text: 50.4, ocr: 36.0, best: true },
        ],
      },
      {
        title: "Where does it go?", sub: "vision-only branch",
        rows: [
          { label: "Every layer (narrow)", users: "vision", pattern: "vis-every", vqa: 39.4, text: 50.7, ocr: 31.3 },
          { label: "Spread (8 of 28)", users: "vision", pattern: "vis-spread", vqa: 37.6, text: 50.0, ocr: 28.1 },
          { label: "Last 8 layers", users: "vision", pattern: "vis-late", vqa: 35.1, text: 49.8, ocr: 23.3 },
          { label: "First 8 layers", users: "vision", pattern: "vis-early", vqa: 45.0, text: 50.4, ocr: 36.0, best: true },
        ],
      },
    ],
  },

  // Figure 6. Backbone-size ladder at 64 TPP (the paper moved from 128 on 2026-11-10), vision module grown with the backbone; one fitted law per recipe.
  // x in FLOPs. Curves are the fitted laws evaluated along each recipe's 128-TPP compute.
  ladder: {
    sizes: ["1B", "1.7B", "3.2B", "6.4B"],
    x: [3.6598e20, 1.0582e21, 3.9112e21, 1.5614e22],
    vqa: {
      encoderFree: [29.1457, 34.88, 39.92, 47.49],
      scratch: [32.93, 39.94, 46.42, 52.81],
      infusion: [33.58, 38.36, 45.87, 51.97],
      // one arrow, at the middle size, as the paper draws it since 2026-11-09 (an arrow per size hinted at a trend in the
      // factor that the ladder does not support); the text gives the range over every size
      multipliers: [{ from: 1.3635e+21, to: 3.9112e+21, y: 40.13, label: "2.9×" }],
    },
    caption: {
      encoderFree: [1.3879, 1.1979, 1.064, 0.9233],
      scratch: [1.2292, 1.0798, 0.9353, 0.842],
      infusion: [1.196, 1.0661, 0.9344, 0.8426],
      multipliers: [{ from: 1.3391e+21, to: 3.9112e+21, y: 1.0501, label: "2.9×" }],
    },
    // vqaCurves / captionCurves: appended at the end of this file
  },

  // Figure 8. Mid-training: continue our 1.7B text-only model from 1T to 1.33T token-equivalents, each recipe added
  // at equal compute; MetaCLIP's encoder pretraining is not counted.
  midtraining: {
    textOnly: 57.2532,
    rows: [
      { key: "infusion", label: "In-fusion", vqa: 50.07, text: 56.44 },
      { key: "scratch", label: "Scratch encoder", vqa: 48.5506, text: 56.7159 },
      { key: "motEarly", label: "MoT, layers 1–8", vqa: 48.46, text: 56.6524 },
      { key: "metaclip", label: "MetaCLIP (pretraining free)", vqa: 43.51, text: 56.4547 },
      { key: "motAll", label: "MoT, all layers", vqa: 43.29, text: 56.56 },
      { key: "encoderFree", label: "Encoder-free", vqa: 39.79, text: 56.62 },
    ],
  },

  // Figure 9. Time to first token added over encoder-free, 1.7B backbone, one H200, 16 concurrent requests, each with one
  // 448-px image and 256 text tokens (the paper's fig:capacity:systems: raw/arxiv_ttft_added_ms.py -> arxiv_ttft_main, from
  // raw/data/ttft_grid_matched_1p7b.v1.csv, one job). Each design is matched to the vision-only parameters of MoT copies
  // of the first k layers. Points are [vision-only parameters (B), ms added over encoder-free].
  ttft: {
    encoderFree: 144.65,
    k: [2, 4, 8, 16, 20, 28],
    series: {
      scratch: [[0.1018, 27.22], [0.2018, 41.63], [0.4012, 64.1], [0.8089, 108.32], [0.9994, 131.39], [1.3946, 162.92]],
      motEarly: [[0.1007, 7.87], [0.2013, 15.06], [0.4027, 28.55], [0.8054, 56.61], [1.0067, 70.57], [1.4094, 99.52]],
      infusion: [[0.1019, 21.02], [0.2013, 27.56], [0.4027, 36.85], [0.8053, 55.98], [1.0066, 66.19], [1.4093, 85.51]],
      infusionFFN: [[0.1007, 10.45], [0.2013, 15.39], [0.4027, 25.81], [0.8053, 45.12], [1.0066, 55.12], [1.4093, 74.93]],
    },
  },
};

/* Figure 6 law curves: the fitted laws exactly as the paper plots them (every other sample point). */
window.DATA.ladder.vqaCurves = {"encoderFree":[[3.008e+20,27.446],[3.331e+20,27.961],[3.689e+20,28.477],[4.087e+20,28.992],[4.529e+20,29.508],[5.019e+20,30.023],[5.563e+20,30.539],[6.168e+20,31.054],[6.84e+20,31.57],[7.586e+20,32.085],[8.415e+20,32.601],[9.337e+20,33.116],[1.036e+21,33.632],[1.15e+21,34.147],[1.277e+21,34.663],[1.418e+21,35.178],[1.574e+21,35.694],[1.749e+21,36.209],[1.943e+21,36.725],[2.158e+21,37.24],[2.399e+21,37.756],[2.666e+21,38.271],[2.964e+21,38.787],[3.295e+21,39.302],[3.664e+21,39.818],[4.075e+21,40.333],[4.532e+21,40.849],[5.042e+21,41.364],[5.61e+21,41.88],[6.243e+21,42.395],[6.948e+21,42.911],[7.734e+21,43.426],[8.61e+21,43.942],[9.586e+21,44.458],[1.067e+22,44.973],[1.189e+22,45.489],[1.324e+22,46.004],[1.475e+22,46.52],[1.643e+22,47.035],[1.831e+22,47.551],[1.933e+22,47.808]],"scratch":[[3.008e+20,32.189],[3.331e+20,32.732],[3.689e+20,33.275],[4.087e+20,33.818],[4.529e+20,34.362],[5.019e+20,34.905],[5.563e+20,35.448],[6.168e+20,35.991],[6.84e+20,36.534],[7.586e+20,37.078],[8.415e+20,37.621],[9.337e+20,38.164],[1.036e+21,38.707],[1.15e+21,39.251],[1.277e+21,39.794],[1.418e+21,40.337],[1.574e+21,40.88],[1.749e+21,41.423],[1.943e+21,41.967],[2.158e+21,42.51],[2.399e+21,43.053],[2.666e+21,43.596],[2.964e+21,44.14],[3.295e+21,44.683],[3.664e+21,45.226],[4.075e+21,45.769],[4.532e+21,46.312],[5.042e+21,46.856],[5.61e+21,47.399],[6.243e+21,47.942],[6.948e+21,48.485],[7.734e+21,49.028],[8.61e+21,49.572],[9.586e+21,50.115],[1.067e+22,50.658],[1.189e+22,51.201],[1.324e+22,51.745],[1.475e+22,52.288],[1.643e+22,52.831],[1.831e+22,53.374],[1.933e+22,53.646]],"infusion":[[3.008e+20,32.545],[3.331e+20,33.065],[3.689e+20,33.585],[4.087e+20,34.106],[4.529e+20,34.626],[5.019e+20,35.146],[5.563e+20,35.666],[6.168e+20,36.186],[6.84e+20,36.706],[7.586e+20,37.227],[8.415e+20,37.747],[9.337e+20,38.267],[1.036e+21,38.787],[1.15e+21,39.307],[1.277e+21,39.827],[1.418e+21,40.348],[1.574e+21,40.868],[1.749e+21,41.388],[1.943e+21,41.908],[2.158e+21,42.428],[2.399e+21,42.948],[2.666e+21,43.469],[2.964e+21,43.989],[3.295e+21,44.509],[3.664e+21,45.029],[4.075e+21,45.549],[4.532e+21,46.069],[5.042e+21,46.59],[5.61e+21,47.11],[6.243e+21,47.63],[6.948e+21,48.15],[7.734e+21,48.67],[8.61e+21,49.19],[9.586e+21,49.711],[1.067e+22,50.231],[1.189e+22,50.751],[1.324e+22,51.271],[1.475e+22,51.791],[1.643e+22,52.311],[1.831e+22,52.832],[1.933e+22,53.092]]};
window.DATA.ladder.captionCurves = {"encoderFree":[[4.087e+20,1.39],[4.529e+20,1.3687],[5.019e+20,1.348],[5.563e+20,1.328],[6.168e+20,1.3086],[6.84e+20,1.2898],[7.586e+20,1.2716],[8.415e+20,1.2539],[9.337e+20,1.2368],[1.036e+21,1.2202],[1.15e+21,1.2041],[1.277e+21,1.1885],[1.418e+21,1.1734],[1.574e+21,1.1588],[1.749e+21,1.1446],[1.943e+21,1.1309],[2.158e+21,1.1176],[2.399e+21,1.1046],[2.666e+21,1.0921],[2.964e+21,1.08],[3.295e+21,1.0683],[3.664e+21,1.0569],[4.075e+21,1.0458],[4.532e+21,1.0351],[5.042e+21,1.0248],[5.61e+21,1.0147],[6.243e+21,1.005],[6.948e+21,0.9955],[7.734e+21,0.9864],[8.61e+21,0.9775],[9.586e+21,0.9689],[1.067e+22,0.9606],[1.189e+22,0.9526],[1.324e+22,0.9447],[1.475e+22,0.9372],[1.643e+22,0.9298],[1.831e+22,0.9227],[1.933e+22,0.9192]],"scratch":[[3.008e+20,1.2972],[3.331e+20,1.2755],[3.689e+20,1.2547],[4.087e+20,1.2346],[4.529e+20,1.2153],[5.019e+20,1.1966],[5.563e+20,1.1786],[6.168e+20,1.1613],[6.84e+20,1.1446],[7.586e+20,1.1285],[8.415e+20,1.1129],[9.337e+20,1.0979],[1.036e+21,1.0835],[1.15e+21,1.0695],[1.277e+21,1.056],[1.418e+21,1.043],[1.574e+21,1.0305],[1.749e+21,1.0183],[1.943e+21,1.0066],[2.158e+21,0.9953],[2.399e+21,0.9844],[2.666e+21,0.9738],[2.964e+21,0.9636],[3.295e+21,0.9537],[3.664e+21,0.9442],[4.075e+21,0.935],[4.532e+21,0.926],[5.042e+21,0.9174],[5.61e+21,0.9091],[6.243e+21,0.901],[6.948e+21,0.8932],[7.734e+21,0.8856],[8.61e+21,0.8782],[9.586e+21,0.8711],[1.067e+22,0.8643],[1.189e+22,0.8576],[1.324e+22,0.8512],[1.475e+22,0.8449],[1.643e+22,0.8388],[1.831e+22,0.833],[1.933e+22,0.8301]],"infusion":[[3.008e+20,1.2462],[3.331e+20,1.2286],[3.689e+20,1.2116],[4.087e+20,1.195],[4.529e+20,1.1789],[5.019e+20,1.1634],[5.563e+20,1.1482],[6.168e+20,1.1335],[6.84e+20,1.1193],[7.586e+20,1.1054],[8.415e+20,1.092],[9.337e+20,1.079],[1.036e+21,1.0663],[1.15e+21,1.054],[1.277e+21,1.0421],[1.418e+21,1.0305],[1.574e+21,1.0193],[1.749e+21,1.0083],[1.943e+21,0.9978],[2.158e+21,0.9875],[2.399e+21,0.9775],[2.666e+21,0.9678],[2.964e+21,0.9584],[3.295e+21,0.9492],[3.664e+21,0.9403],[4.075e+21,0.9317],[4.532e+21,0.9233],[5.042e+21,0.9152],[5.61e+21,0.9073],[6.243e+21,0.8996],[6.948e+21,0.8922],[7.734e+21,0.885],[8.61e+21,0.8779],[9.586e+21,0.8711],[1.067e+22,0.8645],[1.189e+22,0.858],[1.324e+22,0.8518],[1.475e+22,0.8457],[1.643e+22,0.8398],[1.831e+22,0.834],[1.933e+22,0.8312]]};
