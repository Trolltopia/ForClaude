---
version: 1
name: Crack or Keep
description: >
  A market page for Magic booster boxes, set like a printed magazine. Derived from the
  getdesign.md "wired" template (https://getdesign.md, MIT): black on white, a tall
  high-contrast display serif, a humanist serif for reading, a grotesk for UI and a mono
  for kickers and ledger figures. Square corners, hairline rules, no shadows, and exactly
  one accent colour.

colors:
  canvas: "#ffffff"
  canvas-soft: "#f5f5f5"
  ink: "#000000"
  ink-soft: "#1a1a1a"
  body: "#707070"        # secondary text, 4.95:1 on canvas
  muted: "#8f8f8f"       # axis ticks and tertiary labels only
  hairline: "#e0e0e0"
  rule: "#000000"
  link: "#057dbc"        # inline links; also the single chart accent
  deemph: "#c7c7c7"      # de-emphasised chart marks
  keep: "#e34948"        # the "above 1.00×" side of the price ÷ value scale
  good-text: "#006300"
  bad-text: "#c8102e"
  rarity:
    common: "#1a1a1a"
    uncommon: "#6d8a96"
    rare: "#a88532"
    mythic: "#d4501e"
    special: "#7b4fa6"
  dark:
    canvas: "#0f0f0f"
    canvas-soft: "#181818"
    ink: "#f5f5f5"
    body: "#a3a3a3"
    hairline: "#2a2a2a"
    link: "#4fa8e0"
    deemph: "#3d3d3d"
    keep: "#e66767"

typography:
  display:   { family: "Playfair 2 — opsz 96, wdth 87.5 (instanced as 'CK Display')", weights: "400 headlines, 800 wordmark" }
  text:      { family: "Source Serif 4 — opsz 20 (instanced as 'CK Text')", use: "deks, long-form, verdict copy" }
  sans:      { family: "Schibsted Grotesk", use: "UI, labels, buttons, hero figures" }
  mono:      { family: "IBM Plex Mono", use: "kickers, market strip, table figures" }
  scale:
    wordmark: "clamp(56px, 11vw, 132px) / 0.86, display 800 + italic 400 'or'"
    set-title: "clamp(52px, 8.4vw, 112px) / 0.9"
    section: "44px / 1.02 (34px on phones)"
    dek: "19–21px / 1.5 serif"
    hero-figure: "52–60px sans 600, proportional figures, -0.02em"
    stat-figure: "36px sans 600"
    body: "15px sans"
    table: "14–15px sans; figures in mono at 0.92em"
    kicker: "11.5px mono 500, uppercase, +0.08em"

rounded:
  none: 0px          # every button, input, panel
  card: "4.6% / 3.3%" # card scans only, to match the physical card
  full: 9999px       # dots on the price ÷ value scale

spacing:
  unit: 4px
  gutter: "16px phones, 24px from sm"
  container: 84rem
  section-gap: "80–96px, opened by a 2px rule"
---

# Crack or Keep — design system

The site answers one question per set: is a sealed box worth more than the cards inside it?
It should read like the markets page of a good magazine, not like a SaaS dashboard.

## Principles

- **Type carries the identity.** The display serif does the talking in headlines; the sans
  does the work in controls and figures. No gradients, glows, emoji or illustration.
- **One accent.** Link blue is the only colour with a job in the chrome. It marks links and
  the "good" side of every chart. The second chart colour (red) exists only for the
  above-1.00× side of the price ÷ value scale, so blue/red always means crack/keep.
- **Square and flat.** Buttons, inputs, segmented controls and panels have square corners.
  Elevation is a hairline or, for emphasis, a polarity flip (black panel, white type — the
  verdict box). No drop shadows.
- **Hairlines organise; heavy rules announce.** 1px `hairline` between rows, 1px `ink` under
  table heads, 2px `rule` to open a section.
- **Numbers are honest.** Hero and stat figures use proportional digits in the sans. Figures
  that line up in columns use the mono (Schibsted's tabular "1" leaves gaps).

## Page anatomy

1. **Dateline** — mono, date left, "prices as of" and theme toggle right.
2. **Nameplate** — the centred wordmark on the front page; a compact left-aligned wordmark
   and nav elsewhere. A 2px rule underneath.
3. **Market strip** — every set as a ticker cell: code, price ÷ value, a 6px square in blue or
   red. Scrolls sideways on narrow screens.
4. **Sections** — numbered, with a mono rail on the left (`01 BY SLOT`) and a display
   headline plus a serif dek on the right.
5. **Footer** — always the black band, in both themes.

## Components

| Component | Notes |
|---|---|
| Button | `primary` black fill, `outline` 1px ink, 44px tall, bold sans, square |
| Segmented | Radix ToggleGroup in a 1px ink frame; the selected cell inverts |
| Slider | 1px track, 3px ink range, filled square thumb |
| Tooltip / InfoTip | Ink panel with canvas text, 13px sans; circled italic "i" trigger |
| Verdict panel | Polarity-flipped block: kicker, 44px display verdict, serif sentence |
| KPI row | Four tiles split by vertical hairlines; exactly one hero figure (expected value) |
| Card scan | Scryfall image with card-shaped corners; foils get a light sweep on hover; a typeset proxy when the scan fails |
| Rarity pip | 7px diamond in the rarity colour, always next to a text label or name |

## Charts

Charts follow the house data-viz rules: thin marks with 3–4px rounded data ends and square
bases, 2px gaps between touching columns, solid hairline gridlines, labels in ink tokens
(never in the series colour), a legend whenever there are two series, hover and keyboard
readouts, and a table twin for every chart (the percentile table beside the histogram, the
slot table under the value bars). The blue/red pair and the text colours were checked with
a colour-vision-deficiency and contrast validator in both themes.

- **Histogram** — simulated box values. Columns at or above the box price are blue, the
  rest grey; a 2px ink line marks the box price and a small ink triangle marks the mean.
- **Share bars** — one series, blue, in table cells beside the value they draw.
- **Price ÷ value scale** — centred on 1.00×: blue to the left, red to the right, dot at the value.
- **Pack bars** — the value of each pack in an opened box.

## Motion

Only three things move: the underline that grows under nav links, the foil sweep on hover,
and cards lifting 4px in the chase grid. All of it turns off under `prefers-reduced-motion`.
