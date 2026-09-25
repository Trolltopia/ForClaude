import type { RulesConfig } from "@/lib/data/rules";

// Reality Fracture Play Booster, transcribed from "Collecting Reality Fracture" and
// cross-checked against the MTG Scribe fact sheet. FRA breaks from the usual Play
// Booster layout: one regular uncommon, a common-or-uncommon slot, three Echoed Pair
// cards, and no separate non-foil wildcard.
//
// Collector numbers:
//   1–194    main set (71 C, 43 U, 50 R, 20 M, plus 10 common dual lands)
//   195–280  Echoed Pairs (33 uncommon, 7 rare and 3 mythic pairs)
//   281–290  basic lands
//   291–320  borderless Echoed Pairs      321–333  Shattered Mirror (non-foil only)
//   334–358  Sculptor's Stronghold        359–381  Braintwister Series
//   382–396  Tower basics                 397–401  Portal view lands
//   SPG 159–168  Special Guests
const DUALS: [number, number][] = [
  [175, 175],
  [177, 178],
  [182, 184],
  [190, 190],
  [192, 194],
];

export const fraRules: RulesConfig = {
  sheets: {
    common: { label: "Common", rarity: ["common"], cn: [[1, 174], [188, 188]], basicLand: false },
    uncommon: { label: "Uncommon", rarity: ["uncommon"], cn: [[1, 194]] },
    rare: { label: "Rare", rarity: ["rare"], cn: [[1, 194]] },
    mythic: { label: "Mythic", rarity: ["mythic"], cn: [[1, 194]] },

    echoedUncommon: { label: "Echoed Pair uncommon", rarity: ["uncommon"], cn: [[195, 280]] },
    echoedRare: { label: "Echoed Pair rare", rarity: ["rare"], cn: [[195, 280]] },
    echoedMythic: { label: "Echoed Pair mythic", rarity: ["mythic"], cn: [[195, 280]] },
    echoedUncommonBorderless: { label: "Borderless Echoed Pair uncommon", rarity: ["uncommon"], cn: [[291, 320]], relabel: "Borderless" },
    echoedRareBorderless: { label: "Borderless Echoed Pair rare", rarity: ["rare"], cn: [[291, 320]], relabel: "Borderless" },
    echoedMythicBorderless: { label: "Borderless Echoed Pair mythic", rarity: ["mythic"], cn: [[291, 320]], relabel: "Borderless" },

    shatteredMirrorRare: { label: "Shattered Mirror rare", rarity: ["rare"], cn: [[321, 333]], relabel: "Shattered Mirror" },
    shatteredMirrorMythic: { label: "Shattered Mirror mythic", rarity: ["mythic"], cn: [[321, 333]], relabel: "Shattered Mirror" },
    strongholdRare: { label: "Sculptor's Stronghold rare", rarity: ["rare"], cn: [[334, 358]], relabel: "Sculptor's Stronghold" },
    strongholdMythic: { label: "Sculptor's Stronghold mythic", rarity: ["mythic"], cn: [[334, 358]], relabel: "Sculptor's Stronghold" },
    braintwisterUncommon: { label: "Braintwister uncommon", rarity: ["uncommon"], cn: [[359, 381]], relabel: "Braintwister" },
    braintwisterRare: { label: "Braintwister rare", rarity: ["rare"], cn: [[359, 381]], relabel: "Braintwister" },
    braintwisterMythic: { label: "Braintwister mythic", rarity: ["mythic"], cn: [[359, 381]], relabel: "Braintwister" },
    portalViewLand: { label: "Portal view land", rarity: ["rare"], cn: [[397, 401]], relabel: "Portal view" },

    // The traditional foil slot draws echoed and non-echoed cards alike.
    allUncommon: { label: "Uncommon", rarity: ["uncommon"], cn: [[1, 280]] },
    allRare: { label: "Rare", rarity: ["rare"], cn: [[1, 280]] },
    allMythic: { label: "Mythic", rarity: ["mythic"], cn: [[1, 280]] },

    dualLand: { label: "Common dual land", rarity: ["common"], cn: DUALS, basicLand: false },
    basicLand: { label: "Basic land", cn: [[281, 290]], basicLand: true },
    towerBasic: { label: "Tower basic", cn: [[382, 396]], basicLand: true, relabel: "Tower basic" },

    specialGuest: { label: "Special Guest", set: "spg", cn: [[159, 168]] },
  },

  slots: [
    { label: "Commons", count: 5, outcomes: [{ sheet: "common", p: 1 }] },
    {
      label: "Common or Special Guest",
      count: 1,
      outcomes: [
        { sheet: "common", p: 54 / 55 },
        { sheet: "specialGuest", p: 1 / 55 },
      ],
    },
    {
      label: "Uncommon",
      count: 1,
      outcomes: [
        { sheet: "uncommon", p: 0.962 },
        { sheet: "braintwisterUncommon", p: 0.038 },
      ],
    },
    {
      label: "Common or uncommon",
      count: 1,
      outcomes: [
        { sheet: "common", p: 0.23 },
        { sheet: "uncommon", p: 0.74 },
        { sheet: "braintwisterUncommon", p: 0.03 },
      ],
    },
    {
      // Two of the three are a matched pair; per-card marginals are what EV needs.
      label: "Echoed Pairs",
      count: 3,
      outcomes: [
        { sheet: "echoedUncommon", p: 0.889424 },
        { sheet: "echoedRare", p: 0.067308 },
        { sheet: "echoedMythic", p: 0.014423 },
        { sheet: "echoedUncommonBorderless", p: 0.01717 },
        { sheet: "echoedRareBorderless", p: 0.009615 },
        { sheet: "echoedMythicBorderless", p: 0.00206 },
      ],
    },
    {
      label: "Rare or mythic",
      count: 1,
      outcomes: [
        { sheet: "rare", p: 0.744 },
        { sheet: "mythic", p: 0.148 },
        { sheet: "strongholdRare", p: 0.038 },
        { sheet: "strongholdMythic", p: 0.01 },
        { sheet: "braintwisterRare", p: 0.031 },
        { sheet: "braintwisterMythic", p: 0.0025 },
        { sheet: "shatteredMirrorRare", p: 0.01 },
        { sheet: "shatteredMirrorMythic", p: 0.0065 },
        { sheet: "portalViewLand", p: 0.01 },
      ],
    },
    {
      label: "Traditional foil",
      count: 1,
      outcomes: [
        { sheet: "common", p: 0.495, foil: true },
        { sheet: "allUncommon", p: 0.405, foil: true },
        { sheet: "allRare", p: 0.06, foil: true },
        { sheet: "allMythic", p: 0.012, foil: true },
        { sheet: "echoedUncommonBorderless", p: 0.0084, foil: true },
        { sheet: "echoedRareBorderless", p: 0.0029, foil: true },
        { sheet: "echoedMythicBorderless", p: 0.0007, foil: true },
        { sheet: "braintwisterUncommon", p: 0.0059, foil: true },
        { sheet: "braintwisterRare", p: 0.0035, foil: true },
        { sheet: "braintwisterMythic", p: 0.0004, foil: true },
        { sheet: "strongholdRare", p: 0.0042, foil: true },
        { sheet: "strongholdMythic", p: 0.0008, foil: true },
        { sheet: "portalViewLand", p: 0.0012, foil: true },
      ],
    },
    {
      label: "Land",
      count: 1,
      outcomes: [
        { sheet: "dualLand", p: 0.436 },
        { sheet: "dualLand", p: 0.109, foil: true },
        { sheet: "basicLand", p: 0.146 },
        { sheet: "basicLand", p: 0.036, foil: true },
        { sheet: "towerBasic", p: 0.218 },
        { sheet: "towerBasic", p: 0.055, foil: true },
      ],
    },
  ],

  sources: [
    { label: "Collecting Reality Fracture — Wizards of the Coast", url: "https://magic.wizards.com/en/news/feature/collecting-reality-fracture" },
    { label: "Reality Fracture Play Booster fact sheet — MTG Scribe", url: "https://mtgscribe.com/2026/09/08/reality-fracture-play-booster-fact-sheet/" },
  ],

  notes: [
    "Wizards publishes several Booster Fun rates only as “less than 1%”. Those splits (borderless Echoed rares and mythics, Shattered Mirror and Braintwister mythics, and the Booster Fun share of the foil slot) are estimates that add up to the published totals.",
    "The Echoed Pair slots give two cards from one matched pair plus one from another pair. Expected value only needs the per-card rates, which are exact; the simulation treats the three cards as independent draws.",
  ],
};
