# Crack or Keep

What a Magic: The Gathering booster box, Commander deck or Secret Lair drop is worth once you
open it, priced every morning.

For every paper set since Limited Edition Alpha (1993) that MTGJSON models and TCGplayer sells,
162 of them, the site works out the expected value of each kind of booster box the set was sold
in (Play, Draft, Set and Collector) from the real pack layouts and TCGplayer market prices, compares it with what the box costs, and gives a verdict: crack it,
keep it sealed, or call it a toss-up. It's a sharper, faster take on the kind of data at
[theexpectedvalue.com](https://theexpectedvalue.com/play-ev/fra), starting with **Reality
Fracture (FRA)**.

## What's on a set page

- **A booster switch**: Play Boosters (2024 on) or Draft and Set Boosters (2020–2023), and
  Collector Boosters, each at its own address (`/sets/woe`, `/sets/woe/set`,
  `/sets/woe/collector`) with its return on the tab.
- **Verdict and headline numbers**: expected value per box and pack, the return (+35% means
  $135 of cards for every $100 spent), the share of boxes that beat the price, and the
  median box.
- **Your numbers**: type your own box price (kept in the link, so it can be shared), ignore
  cards under a minimum price (presets from 10¢ to $2, or any amount in 5¢ steps), and take
  selling fees off every card (8% by default, up to 50%). The minimum price and fees are
  site-wide settings: change them on any set page or under Settings in the masthead, and
  every number on the site follows; the browser remembers them.
- **Sealed product**: every sealed item TCGplayer lists for the set (packs, displays,
  cases, bundles, Commander decks) with market and lowest-listing prices. Anything with a
  known number of boosters inside is priced per booster against an average booster of the
  same kind, and can be used as that booster's box price.
- **Where the money is**: value by booster slot.
- **The chase**: the cards that carry the box, ranked by what each adds to an average box
  or by price.
- **Ten thousand boxes**: a Monte Carlo simulation (in a Web Worker) drawn as a
  histogram, with percentiles and an "open a box" button that opens one pack by pack.
- **One box or a hundred**: runs of 1, 3, 10, 30 and 100 boxes drawn from the simulation,
  with the chance each run comes out ahead, where nine runs in ten land, a one-in-twenty bad
  run, and the most you can pay per box and still come out ahead nine times in ten.
- **Every card**: searchable, sortable, with odds per pack and per box.
- **Collation**: the odds of every slot, sources and caveats.

The front page is a board of every tracked set, sortable by name or return, searchable, and
filterable by years, comparing each set's main booster box, its Set Boosters or its
Collector Boosters.

## Commander decks and Secret Lair drops

`/decks` lists every preconstructed Commander deck MTGJSON has a card list for (2011 on,
Secret Lair Commander decks included) and `/secret-lair` every Secret Lair drop. Their
contents are fixed, so there is nothing to simulate: each card is priced at its TCGplayer
market price in the finish the product holds it (foil, etched or regular; from Scryfall, or
from TCGplayer's own price list via TCGCSV when Scryfall has no price for that finish), times
the copies, at your minimum price and fees, and the total is set against the sealed product's
TCGplayer market price. Decks sit under their set; the Set heading sorts sets A to Z. Each
product has a page with its most valuable cards and the full list. Cards with no market price
yet count as nothing, so a partly priced product's value is a floor: it can still show a
gain, but gets no verdict otherwise.

## Where the data comes from

| What | Source |
|---|---|
| Pack layouts, print sheets, weights | [MTGJSON](https://mtgjson.com) booster data (`play`, `draft`, `set` and `collector` boosters) |
| Newest sets before MTGJSON has them | Hand-transcribed collation in [`src/sets/rules/`](src/sets/rules) (FRA's Play Booster today) |
| Card prices (TCGplayer market) and images | [Scryfall API](https://scryfall.com/docs/api) |
| Sealed product prices (TCGplayer market and low) | [TCGCSV](https://tcgcsv.com) |
| What's inside each box, bundle and case; TCGplayer product ids | MTGJSON sealed-product records |
| Commander deck and Secret Lair card lists, with foil and etched finishes | MTGJSON deck lists (`DeckList.json` and each set's `decks`) |

`npm run data` builds one JSON snapshot per set into `public/data/` (every booster of the
set over one shared card pool), plus an `index.json` for the board, and the same for
Commander decks (`decks.json`, `decks/`) and Secret Lair drops (`secret-lair.json`,
`secret-lair/`). The GitHub Actions workflow runs it every morning before deploying. Without
a snapshot, the browser can build a set with a rules file (FRA) straight from Scryfall, and
any set page can refresh its prices live with **Refresh from Scryfall**.

## Running it

Requires Node 22+.

```bash
npm install
npm run data        # fetch prices for everything (or: npm run data -- fra msh)
npm run data -- --decks --secret-lair   # only Commander decks and Secret Lair drops
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

1. Run the **Discover sets** workflow (or `npm run discover`): it lists every set MTGJSON
   models, its booster sheets, and what its displays hold. Add an entry to
   [`src/sets/catalog.ts`](src/sets/catalog.ts): code, name, release date, set type, and
   the boosters it was sold in with their display sizes (optionally a fallback box price).
2. If MTGJSON already has booster data for it, that's all. If not, write a rules file
   like [`src/sets/rules/fra.ts`](src/sets/rules/fra.ts) from the set's "Collecting …"
   article (card pools by rarity and collector number, and each slot's odds) and attach
   it to that booster. MTGJSON takes over automatically once it has the booster.

## How the maths works

Expected value per pack is Σ over slots of Σ over cards of P(card) × price(card). A box is a
display: 12 Collector Boosters, 30 Set Boosters, 36 Draft Boosters, or 36 Play Boosters
(30 from Aetherdrift on). The model is a list of pack layouts with weights, each drawing a number of cards from weighted
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
src/pages/                board, set calculator, decks and drops, method
src/components/           site chrome, charts, set sections, ui primitives
tests/                    Vitest unit tests
```

---

Crack or Keep is unofficial Fan Content permitted under the Fan Content Policy. Not
approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the
Coast. ©Wizards of the Coast LLC. Card images and data courtesy of Scryfall. Not financial
advice.
