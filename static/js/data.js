/* Chart values, read from the values the paper's own figures plot (each block names its figure or table).
   Compute is in units of 1e21 FLOPs unless noted. Avg. VQA averages the four category means of the
   16 Cambrian benchmarks; Avg. Text averages the four category means of 12 language benchmarks. */
window.DATA = {
  // Figure 2a. 1.7B backbone at a fixed 1.04e22-FLOP lifetime budget. Each pretrained encoder spends a share of that
  // budget on encoder pretraining before the same multimodal training; the scratch encoder spends none.
  upstreamShare: {
    budget: "1.04×10^22",
    shares: [0, 7.4, 15, 30, 60],
    scratch: { vqa: 42.231811, text: 54.312314 },
    series: [
      { key: "metaclip", name: "MetaCLIP", vqa: [41.42, 42.903517, 42.13451, 38.894728], text: [54.37, 54.666414, 53.468052, 52.245724] },
      { key: "webssl", name: "WebSSL", vqa: [42.95, 42.453102, 42.222653, 40.292347], text: [55.39, 54.585385, 53.513248, 52.246444] },
      { key: "cap", name: "Cap", vqa: [42.38, 42.365948, 41.630786, 38.361408], text: [53.89, 54.359882, 53.028305, 51.542391] },
      { key: "cappa", name: "CapPa", vqa: [43.0, 42.730012, 41.128515, 39.281565], text: [55.05, 54.344071, 53.245859, 51.051401] },
    ],
  },

  // Figure 7. MetaCLIP pretrained for longer (not charged), then the same 2.74e21-FLOP multimodal stage at 1.7B.
  freePretraining: {
    multimodal: 2.74,
    rows: [
      { label: "None", note: "scratch", pre: 0, imagenet: null, vqa: 39.12 },
      { label: "1.4", note: "default", pre: 1.38, imagenet: 80.43, vqa: 38.66 },
      { label: "2.8", pre: 2.76, imagenet: 80.62, vqa: 37.26 },
      { label: "5.5", pre: 5.52, imagenet: 82.05, vqa: 37.68 },
      { label: "9.0", pre: 8.98, imagenet: 84.44, vqa: 36.89 },
    ],
  },

  // Figures 3 and 5. Learning-rate-decayed endpoints over lifetime compute. tpp = tokens per (non-embedding) parameter.
  // Figure 3 plots every encoder / encoder-free endpoint; Figure 5 plots the budgets where all three recipes exist.
  trajectories: {
    fig3: {
      "1.7B": {
        x: [0.651, 1.302, 2.604, 5.207, 7.811, 10.414, 13.018],
        tpp: [39, 79, 158, 315, 473, 631, 788],
        encoderFree: { vqa: [29.14, 31.2, 34.61, 36.92, 37.94, 39.46, 40.17], text: [46.38, 48.32, 50.74, 52.6, 53.71, 55.31, 55.66] },
        scratch: { vqa: [31.58, 35.67, 39.47, 40.21, 43.39, 42.23, 42.67], text: [45.32, 47.32, 49.73, 52.55, 54.42, 54.31, 55.29] },
        // encoder-free needs 2.6x the compute to reach the encoder's Avg. VQA (arrow at encoder-free's last point)
        multiplier: { from: 5.016, to: 13.018, y: 40.17, label: "2.6×" },
      },
      "4B": {
        x: [2.895, 5.791, 11.582, 17.372, 28.95],
        tpp: [31, 61, 122, 183, 306],
        encoderFree: { vqa: [36.17, 40.37, 42.62, 44.25, 45.4], text: [51.49, 55.98, 56.96, 59.19, 61.0] },
        scratch: { vqa: [42.54, 44.59, 45.46, 47.73, 48.73], text: [52.02, 56.36, 57.9, 58.95, 60.37] },
        multiplier: { from: 11.041, to: 28.95, y: 45.4, label: "2.6×" },
      },
    },
    fig5: {
      "1.7B": {
        x: [0.651, 1.302, 2.604, 5.207, 13.018],
        tpp: [39, 79, 158, 315, 788],
        encoderFree: { vqa: [29.14, 31.2, 34.61, 36.92, 40.17], text: [46.38, 48.32, 50.74, 52.6, 55.66] },
        scratch: { vqa: [31.58, 35.67, 39.47, 40.21, 42.67], text: [45.32, 47.32, 49.73, 52.55, 55.29] },
        infusion: { vqa: [33.01, 36.52, 38.04, 42.04, 43.91], text: [45.73, 48.11, 50.75, 53.42, 55.93] },
      },
      "4B": {
        x: [2.895, 5.791, 11.582, 28.95],
        tpp: [31, 61, 122, 306],
        encoderFree: { vqa: [36.17, 40.37, 42.62, 45.4], text: [51.49, 55.98, 56.96, 61.0] },
        scratch: { vqa: [42.54, 44.59, 45.46, 48.73], text: [52.02, 56.36, 57.9, 60.37] },
        infusion: { vqa: [40.56, 43.87, 46.52, 49.95], text: [51.9, 55.88, 57.73, 60.68] },
      },
    },
  },

  // Table 2. The encoder's 0.4B parameters given to the encoder-free backbone as width, depth, or both.
  steelman: [
    {
      size: "1.7B", flops: "2.6×10^21", tpp: 158,
      rows: [
        { key: "encoderFree", label: "Encoder-free", params: "1.7B", vqa: 34.6, text: 50.7 },
        { key: "wider", label: "+ wider", params: "2.1B", vqa: 35.0, text: 51.3 },
        { key: "deeper", label: "+ deeper", params: "2.1B", vqa: 34.6, text: 51.2 },
        { key: "both", label: "+ wider and deeper", params: "2.1B", vqa: 35.6, text: 51.4 },
        { key: "scratch", label: "Scratch encoder", params: "2.1B", vqa: 39.5, text: 49.7 },
      ],
    },
    {
      size: "4B", flops: "1.16×10^22", tpp: 122,
      rows: [
        { key: "encoderFree", label: "Encoder-free", params: "4.0B", vqa: 42.6, text: 57.0 },  // Table 2 (the run Fig. 3 plots)
        { key: "wider", label: "+ wider", params: "4.4B", vqa: 43.1, text: 58.3 },
        { key: "scratch", label: "Scratch encoder", params: "4.4B", vqa: 45.5, text: 57.9 },
      ],
    },
  ],

  // Table 3. Every variant adds 0.4B parameters to the 1.7B encoder-free backbone, at 2.6e21 FLOPs (158 TPP).
  capacityDesign: {
    refs: { scratch: { vqa: 39.5, text: 49.7 }, encoderFree: { vqa: 34.6, text: 50.7 } },
    groups: [
      {
        title: "Who uses the added capacity?", sub: "first 8 layers",
        rows: [
          { label: "Shared FFN widening", users: "all", pattern: "wide-early", vqa: 35.2, text: 51.2, ocr: 17.0 },
          { label: "Separate FFN branch", users: "all", pattern: "all-early", vqa: 37.2, text: 51.2, ocr: 18.0 },
          { label: "Vision-only FFN branch", users: "vision", pattern: "vis-early", vqa: 38.8, text: 50.4, ocr: 23.2, best: true },
        ],
      },
      {
        title: "Where does it go?", sub: "vision-only branch",
        rows: [
          { label: "Every layer (narrow)", users: "vision", pattern: "vis-every", vqa: 34.2, text: 50.7, ocr: 20.3 },
          { label: "Spread (8 of 28)", users: "vision", pattern: "vis-spread", vqa: 34.5, text: 50.0, ocr: 18.4 },
          { label: "Last 8 layers", users: "vision", pattern: "vis-late", vqa: 31.9, text: 49.8, ocr: 15.5 },
          { label: "First 8 layers", users: "vision", pattern: "vis-early", vqa: 38.8, text: 50.4, ocr: 23.2, best: true },
        ],
      },
    ],
  },

  // Figure 6. Backbone-size ladder at 128 TPP, vision module grown with the backbone; one fitted law per recipe.
  // x in FLOPs. Curves are the fitted laws evaluated along each recipe's 128-TPP compute.
  ladder: {
    sizes: ["1B", "1.7B", "3.2B", "6.4B"],
    x: [7.32e20, 2.116e21, 7.8225e21, 3.1229e22],
    vqa: {
      encoderFree: [28.62, 34.13, 39.46, 44.66],
      scratch: [33.26, 37.82, 44.87, 50.16],
      infusion: [31.62, 38.04, 45.12, 50.71],
      multipliers: [
        { from: 8.915e20, to: 2.116e21, y: 33.42, label: "2.4×" },
        { from: 2.751e21, to: 7.8225e21, y: 39.0, label: "2.8×" },
        { from: 9.077e21, to: 3.1229e22, y: 44.8, label: "3.4×" },
      ],
    },
    caption: {
      encoderFree: [1.2429, 1.0901, 0.9875, 0.8803],
      scratch: [1.0963, 0.9872, 0.8786, 0.8095],
      infusion: [1.0961, 0.9906, 0.8809, 0.8113],
      multipliers: [
        { from: 7.721e20, to: 2.116e21, y: 1.0994, label: "2.7×" },
        { from: 2.642e21, to: 7.8225e21, y: 0.9667, label: "3.0×" },
        { from: 8.33e21, to: 3.1229e22, y: 0.8802, label: "3.7×" },
      ],
    },
    // vqaCurves / captionCurves: appended at the end of this file
  },

  // Figure 8. Mid-training: continue our 1.7B text-only model from 1T to 1.33T token-equivalents, each recipe added
  // at equal compute; MetaCLIP's encoder pretraining is not counted.
  midtraining: {
    textOnly: 57.25,
    rows: [
      { key: "infusion", label: "In-fusion", vqa: 43.73, text: 56.44 },
      { key: "motEarly", label: "MoT, layers 1–8", vqa: 43.4, text: 56.65 },
      { key: "scratch", label: "Scratch encoder", vqa: 42.66, text: 56.72 },
      { key: "motAll", label: "MoT, all layers", vqa: 40.33, text: 56.56 },
      { key: "metaclip", label: "MetaCLIP (pretraining free)", vqa: 38.71, text: 56.45 },
      { key: "encoderFree", label: "Encoder-free", vqa: 36.48, text: 56.62 },
    ],
  },

  // Figure 9. Time to first token, 1.7B backbone, one H200, 16 concurrent requests with one 224-px image each.
  ttft: {
    prefill: 56.34,
    groups: [
      { title: null, rows: [{ key: "encoderFree", label: "Encoder-free", added: 0, total: "56 ms" }] },
      {
        title: "+0.4B vision-only parameters",
        rows: [
          { key: "infusionFFN", label: "In-fusion (FFN-only)", added: 6.68, total: "63 ms", pct: "+12%" },
          { key: "infusion", label: "In-fusion", added: 10.61, total: "67 ms", pct: "+19%" },
          { key: "motEarly", label: "MoT, layers 1–8", added: 13.16, total: "69 ms", pct: "+23%" },
          { key: "scratch", label: "Scratch encoder", added: 16.04, total: "72 ms", pct: "+28%" },
        ],
      },
      { title: "+1.4B vision-only parameters", rows: [{ key: "motAll", label: "MoT, all layers", added: 44.44, total: "101 ms", pct: "+79%" }] },
    ],
  },
};

/* Figure 6 law curves: the fitted laws exactly as the paper plots them (every other sample point). */
window.DATA.ladder.vqaCurves = {"encoderFree":[[6.016e+20,27.936],[6.662e+20,28.386],[7.379e+20,28.835],[8.174e+20,29.285],[9.057e+20,29.734],[1.004e+21,30.184],[1.113e+21,30.633],[1.234e+21,31.082],[1.368e+21,31.532],[1.517e+21,31.981],[1.683e+21,32.431],[1.867e+21,32.88],[2.072e+21,33.329],[2.3e+21,33.779],[2.554e+21,34.228],[2.835e+21,34.678],[3.149e+21,35.127],[3.497e+21,35.577],[3.885e+21,36.026],[4.317e+21,36.475],[4.797e+21,36.925],[5.332e+21,37.374],[5.927e+21,37.824],[6.59e+21,38.273],[7.328e+21,38.723],[8.15e+21,39.172],[9.065e+21,39.621],[1.008e+22,40.071],[1.122e+22,40.52],[1.249e+22,40.97],[1.39e+22,41.419],[1.547e+22,41.869],[1.722e+22,42.318],[1.917e+22,42.767],[2.135e+22,43.217],[2.377e+22,43.666],[2.648e+22,44.116],[2.95e+22,44.565],[3.286e+22,45.015],[3.662e+22,45.464],[3.865e+22,45.689]],"scratch":[[6.016e+20,31.445],[6.662e+20,31.958],[7.379e+20,32.472],[8.174e+20,32.985],[9.057e+20,33.499],[1.004e+21,34.012],[1.113e+21,34.526],[1.234e+21,35.039],[1.368e+21,35.553],[1.517e+21,36.066],[1.683e+21,36.58],[1.867e+21,37.093],[2.072e+21,37.607],[2.3e+21,38.12],[2.554e+21,38.634],[2.835e+21,39.148],[3.149e+21,39.661],[3.497e+21,40.175],[3.885e+21,40.688],[4.317e+21,41.202],[4.797e+21,41.715],[5.332e+21,42.229],[5.927e+21,42.742],[6.59e+21,43.256],[7.328e+21,43.769],[8.15e+21,44.283],[9.065e+21,44.796],[1.008e+22,45.31],[1.122e+22,45.823],[1.249e+22,46.337],[1.39e+22,46.85],[1.547e+22,47.364],[1.722e+22,47.877],[1.917e+22,48.391],[2.135e+22,48.904],[2.377e+22,49.418],[2.648e+22,49.931],[2.95e+22,50.445],[3.286e+22,50.958],[3.662e+22,51.472],[3.865e+22,51.729]],"infusion":[[6.016e+20,30.735],[6.662e+20,31.268],[7.379e+20,31.801],[8.174e+20,32.334],[9.057e+20,32.866],[1.004e+21,33.399],[1.113e+21,33.932],[1.234e+21,34.465],[1.368e+21,34.998],[1.517e+21,35.53],[1.683e+21,36.063],[1.867e+21,36.596],[2.072e+21,37.129],[2.3e+21,37.662],[2.554e+21,38.194],[2.835e+21,38.727],[3.149e+21,39.26],[3.497e+21,39.793],[3.885e+21,40.326],[4.317e+21,40.859],[4.797e+21,41.391],[5.332e+21,41.924],[5.927e+21,42.457],[6.59e+21,42.99],[7.328e+21,43.523],[8.15e+21,44.055],[9.065e+21,44.588],[1.008e+22,45.121],[1.122e+22,45.654],[1.249e+22,46.187],[1.39e+22,46.719],[1.547e+22,47.252],[1.722e+22,47.785],[1.917e+22,48.318],[2.135e+22,48.851],[2.377e+22,49.383],[2.648e+22,49.916],[2.95e+22,50.449],[3.286e+22,50.982],[3.662e+22,51.515],[3.865e+22,51.781]]};
window.DATA.ladder.captionCurves = {"encoderFree":[[6.016e+20,1.3065],[6.662e+20,1.2857],[7.379e+20,1.2657],[8.174e+20,1.2464],[9.057e+20,1.2278],[1.004e+21,1.2099],[1.113e+21,1.1927],[1.234e+21,1.1762],[1.368e+21,1.1602],[1.517e+21,1.1448],[1.683e+21,1.13],[1.867e+21,1.1158],[2.072e+21,1.1021],[2.3e+21,1.0889],[2.554e+21,1.0761],[2.835e+21,1.0639],[3.149e+21,1.0521],[3.497e+21,1.0407],[3.885e+21,1.0297],[4.317e+21,1.0192],[4.797e+21,1.009],[5.332e+21,0.9992],[5.927e+21,0.9898],[6.59e+21,0.9807],[7.328e+21,0.9719],[8.15e+21,0.9634],[9.065e+21,0.9553],[1.008e+22,0.9475],[1.122e+22,0.9399],[1.249e+22,0.9326],[1.39e+22,0.9256],[1.547e+22,0.9188],[1.722e+22,0.9123],[1.917e+22,0.906],[2.135e+22,0.8999],[2.377e+22,0.8941],[2.648e+22,0.8884],[2.95e+22,0.883],[3.286e+22,0.8778],[3.662e+22,0.8727],[3.865e+22,0.8703]],"scratch":[[6.016e+20,1.1333],[6.662e+20,1.1191],[7.379e+20,1.1054],[8.174e+20,1.092],[9.057e+20,1.0791],[1.004e+21,1.0666],[1.113e+21,1.0544],[1.234e+21,1.0427],[1.368e+21,1.0313],[1.517e+21,1.0202],[1.683e+21,1.0095],[1.867e+21,0.9991],[2.072e+21,0.989],[2.3e+21,0.9792],[2.554e+21,0.9697],[2.835e+21,0.9605],[3.149e+21,0.9515],[3.497e+21,0.9428],[3.885e+21,0.9344],[4.317e+21,0.9262],[4.797e+21,0.9182],[5.332e+21,0.9105],[5.927e+21,0.9029],[6.59e+21,0.8956],[7.328e+21,0.8885],[8.15e+21,0.8816],[9.065e+21,0.8749],[1.008e+22,0.8684],[1.122e+22,0.862],[1.249e+22,0.8558],[1.39e+22,0.8498],[1.547e+22,0.8439],[1.722e+22,0.8382],[1.917e+22,0.8327],[2.135e+22,0.8272],[2.377e+22,0.822],[2.648e+22,0.8168],[2.95e+22,0.8118],[3.286e+22,0.807],[3.662e+22,0.8022],[3.865e+22,0.7999]],"infusion":[[6.016e+20,1.1389],[6.662e+20,1.1242],[7.379e+20,1.11],[8.174e+20,1.0963],[9.057e+20,1.083],[1.004e+21,1.0701],[1.113e+21,1.0576],[1.234e+21,1.0455],[1.368e+21,1.0337],[1.517e+21,1.0223],[1.683e+21,1.0113],[1.867e+21,1.0006],[2.072e+21,0.9903],[2.3e+21,0.9802],[2.554e+21,0.9705],[2.835e+21,0.9611],[3.149e+21,0.952],[3.497e+21,0.9431],[3.885e+21,0.9345],[4.317e+21,0.9262],[4.797e+21,0.9182],[5.332e+21,0.9103],[5.927e+21,0.9028],[6.59e+21,0.8954],[7.328e+21,0.8883],[8.15e+21,0.8814],[9.065e+21,0.8747],[1.008e+22,0.8683],[1.122e+22,0.862],[1.249e+22,0.8559],[1.39e+22,0.85],[1.547e+22,0.8443],[1.722e+22,0.8387],[1.917e+22,0.8333],[2.135e+22,0.8281],[2.377e+22,0.8231],[2.648e+22,0.8182],[2.95e+22,0.8134],[3.286e+22,0.8088],[3.662e+22,0.8043],[3.865e+22,0.8021]]};
