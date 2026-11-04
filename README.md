# unbundling.github.io

Project page for **Unbundling Multimodal Vision Encoding**, live at <https://unbundling.github.io>. It is a static site: plain HTML, CSS and JS, with no build step and no external requests.

GitHub Pages serves the `main` branch from the repository root, so every push to `main` publishes. Preview changes locally first.

## Preview locally

```bash
cd unbundling.github.io
python3 -m http.server 8971 --bind 127.0.0.1
# open http://127.0.0.1:8971 (forward port 8971 in VS Code when working remotely)
```

- Add `?static` to the URL to show every animated element in its final state. Use it for screenshots and print.
- Add `?static&bundle=infusion` (or `pretrained`, `scratch`, `free`) to pin the recipe diagram to one recipe.

## Layout

| What | Where |
|---|---|
| Text, section order, captions, links | `index.html` |
| Every plotted number (each block names its paper figure or table) | `static/js/data.js` |
| Glyphs, schematics and chart drawing | `static/js/viz.js` |
| Figure assembly, tooltips, toggles, animations, contents list | `static/js/main.js` |
| Colors, type and layout (`:root` holds the paper palette) | `static/css/style.css` |
| Logos, favicon, social card | `static/img/` |
| TeX Gyre Pagella (Palatino clone, GUST Font License) | `static/fonts/` |

Charts are drawn as SVG for the width of their container and redrawn on resize, so they stay sharp on every screen. Palatino is used where it is installed; elsewhere the page falls back to the bundled Pagella.

## Social card

`static/img/social-card.png` (1200×630, rendered at 2×) is a screenshot of `tools/social-card.html`. To regenerate it, serve the repo as above and screenshot that page at 1200×630 with a device scale factor of 2. Any headless Chrome works.

## Before the arXiv release

- [ ] Paper button: arXiv abstract URL (`data-todo="arxiv"` in `index.html`).
- [ ] PDF button: arXiv PDF URL, or a hosted copy (`data-todo="pdf"`).
- [ ] Thread button: tweet thread URL (`data-todo="thread"`).
- [ ] BibTeX: replace `arXiv:2611.XXXXX`.
- [ ] Re-check numbers in `static/js/data.js` against the final paper.

## Planned

- [ ] Dark mode, after the co-author feedback round. Follow the system setting (`prefers-color-scheme`) with no toggle. Use a near-black blue-gray surface rather than pure black, and lighten each recipe color and the teal accent one step. Move every chart and diagram color in `viz.js` and `main.js` into CSS variables so the SVGs follow the theme. Check the dark palette for contrast and color-blind separation, and review every chart in both themes.
