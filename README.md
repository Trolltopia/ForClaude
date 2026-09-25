# Crack or Keep

What a Magic: The Gathering booster box is worth once you open it, priced every morning.

For every Play Booster set, the site works out the expected value of a Play Booster box from the
real pack layout and TCGplayer market prices, compares it with what the box costs, and gives
a verdict: crack it, keep it sealed, or call it a toss-up. It's a sharper, faster take on the
kind of data at [theexpectedvalue.com](https://theexpectedvalue.com/play-ev/fra), starting
with **Reality Fracture (FRA)**.

## What's on a set page

- **Verdict and headline numbers**: expected value per box and pack, price ÷ value, the
  share of boxes that beat the price, and the median box.
- **Your numbers**: type your own box price, ignore bulk below a floor ($0.25–$5), and
  subtract selling costs. Settings live in the URL, so a configured page can be shared.
- **Where the money is**: value by booster slot.
- **The chase**: the cards that carry the box, ranked by what each adds to an average box
  or by price.
- **Ten thousand boxes**: a Monte Carlo simulation (in a Web Worker) drawn as a
  histogram, with percentiles and an "open a box" button that opens one pack by pack.
- **Every card**: searchable, sortable, with odds per pack and per box.
- **Collation**: the odds of every slot, sources and caveats.

The front page is a board of every tracked set, sortable by price ÷ value.

## Where the data comes from

| What | Source |
|---|---|
| Pack layouts, print sheets, weights | [MTGJSON](https://mtgjson.com) booster data (`play` boosters) |
| Newest sets before MTGJSON has them | Hand-transcribed collation in [`src/sets/rules/`](src/sets/rules) (FRA today) |
| Card prices (TCGplayer market) and images | [Scryfall API](https://scryfall.com/docs/api) |
| Sealed box price (TCGplayer market) | [TCGCSV](https://tcgcsv.com) |

`npm run data` builds one JSON snapshot per set into `public/data/`, plus an `index.json`
for the board. The GitHub Actions workflow runs it every morning before deploying. Without
a snapshot, the browser can build a set with a rules file (FRA) straight from Scryfall, and
any set page can refresh its prices live with **Refresh from Scryfall**.

## Running it

Requires Node 22+.

```bash
npm install
npm run data        # fetch prices for every set (or: npm run data -- fra msh)
npm run dev         # http://localhost:5173
```

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run build`, `npm run preview`.

## Deploying

`.github/workflows/deploy.yml` builds the snapshots, runs the tests, builds the site and
publishes it to GitHub Pages on every push to `main`, daily at 06:17 UTC (on the default
branch), and on demand from the Actions tab. Turn Pages on once under **Settings → Pages →
Build and deployment → Source: GitHub Actions**; until then the workflow skips itself. The
site handles the `/<repo>/` base path and deep links (`404.html` is a copy of the app).

`.github/workflows/data-check.yml` builds a few sets against the live APIs and prints each
slot and the top cards, without deploying — handy after touching the pipeline or a rules file.

Any static host works: `npm run data && npm run build`, then serve `dist/`. Set `BASE_PATH`
if the site doesn't live at the domain root.

## Adding a set

1. Add an entry to [`src/sets/catalog.ts`](src/sets/catalog.ts): code, name, release date,
   and a fallback box price.
2. If MTGJSON already has Play Booster data for it, that's all. If not, write a rules file
   like [`src/sets/rules/fra.ts`](src/sets/rules/fra.ts) from the set's "Collecting …"
   article: card pools by rarity and collector number, and each slot's odds.

## How the maths works

Expected value per pack is Σ over slots of Σ over cards of P(card) × price(card); a box is 30
packs (36 for Bloomburrow, Duskmourn and Foundations; Aetherdrift cut displays to 30). The
model is a list of pack layouts with weights, each drawing a number of cards from weighted
sheets, so MTGJSON data and hand-written rules end up in the same shape
([`src/lib/engine`](src/lib/engine)). The [Method page](src/pages/MethodPage.tsx) explains
the assumptions in plain English.

## Design

The visual system is in [`DESIGN.md`](DESIGN.md). It started from the
[getdesign.md](https://getdesign.md) "wired" template (a magazine broadsheet: black on
white, a high-contrast display serif, mono kickers, square corners) and adds a ledger-style
figure treatment and the Magic rarity colours. Components are
[shadcn/ui](https://ui.shadcn.com)-style wrappers around [Radix](https://www.radix-ui.com)
primitives, styled with [Tailwind CSS](https://tailwindcss.com) v4. Type: Playfair 2 and
Source Serif 4 (instanced and subset by `scripts/fonts/build_fonts.py`), Schibsted Grotesk
and IBM Plex Mono.

## Project layout

```
scripts/build-data.ts     daily snapshot builder (MTGJSON + Scryfall + TCGCSV)
src/lib/engine/           expected value, alias sampling, box simulation, worker
src/lib/data/             Scryfall, MTGJSON and TCGCSV adapters; rules-based collation
src/sets/                 set catalog and hand-written collations
src/pages/                board, set calculator, method
src/components/           site chrome, charts, set sections, ui primitives
tests/                    Vitest unit tests
```

---

Crack or Keep is unofficial Fan Content permitted under the Fan Content Policy. Not
approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the
Coast. ©Wizards of the Coast LLC. Card images and data courtesy of Scryfall. Not financial
advice.
