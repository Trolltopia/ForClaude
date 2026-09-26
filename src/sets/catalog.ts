import type { RulesConfig } from "@/lib/data/rules";
import type { BoosterType } from "@/lib/types";
import { fraRules } from "./rules/fra";

export interface BoosterSpec {
  type: BoosterType;
  /** Packs in a sealed display, as MTGJSON records the display's contents. */
  packsPerBox: number;
  /**
   * Fallback display price in USD, used only when TCGplayer has no market price for it.
   * Rough street price, shown in the UI as an estimate.
   */
  estimate?: number;
  /** Hand-written collation, for when MTGJSON hasn't modelled this booster yet. */
  rules?: RulesConfig;
}

/** MTGJSON's set types: the premier expansions and core sets, and Masters and other draft sets. */
export type SetType = "expansion" | "core" | "masters" | "draft_innovation";

export interface CatalogEntry {
  code: string;
  name: string;
  releasedAt: string;
  setType: SetType;
  /** Booster products to price, main one first. */
  boosters: BoosterSpec[];
}

const play = (packsPerBox: number, estimate?: number, rules?: RulesConfig): BoosterSpec => ({ type: "play", packsPerBox, estimate, rules });
const draft = (packsPerBox = 36): BoosterSpec => ({ type: "draft", packsPerBox });
const setBooster = (packsPerBox = 30): BoosterSpec => ({ type: "set", packsPerBox });
const collector = (packsPerBox = 12): BoosterSpec => ({ type: "collector", packsPerBox });

// Every paper set since 1993 that MTGJSON models a booster for and TCGplayer sells a box of,
// newest first. Generated with `npm run discover`: a booster is listed when MTGJSON has its
// print sheets and a recorded display with a TCGplayer product, and the display size is
// the number of packs MTGJSON records inside it. Reality Fracture's Play Booster comes from
// the hand-written collation until MTGJSON adds it.
export const CATALOG: CatalogEntry[] = [
  // Play Boosters, from Murders at Karlov Manor (2024)
  { code: "fra", name: "Reality Fracture", releasedAt: "2026-10-02", setType: "expansion", boosters: [play(30, 140, fraRules), collector()] },
  { code: "hob", name: "The Hobbit", releasedAt: "2026-08-14", setType: "expansion", boosters: [play(30, 165), collector()] },
  { code: "msh", name: "Marvel Super Heroes", releasedAt: "2026-06-26", setType: "expansion", boosters: [play(30, 165), collector()] },
  { code: "sos", name: "Secrets of Strixhaven", releasedAt: "2026-04-24", setType: "expansion", boosters: [play(30, 140), collector()] },
  { code: "tmt", name: "Teenage Mutant Ninja Turtles", releasedAt: "2026-03-06", setType: "expansion", boosters: [play(30, 160), collector()] },
  { code: "ecl", name: "Lorwyn Eclipsed", releasedAt: "2026-01-23", setType: "expansion", boosters: [play(30, 140), collector()] },
  { code: "tla", name: "Avatar: The Last Airbender", releasedAt: "2025-11-21", setType: "expansion", boosters: [play(30, 160), collector()] },
  { code: "spm", name: "Marvel's Spider-Man", releasedAt: "2025-09-26", setType: "expansion", boosters: [play(30, 160), collector()] },
  { code: "eoe", name: "Edge of Eternities", releasedAt: "2025-08-01", setType: "expansion", boosters: [play(30, 135), collector()] },
  { code: "fin", name: "Final Fantasy", releasedAt: "2025-06-13", setType: "expansion", boosters: [play(30, 220), collector()] },
  { code: "tdm", name: "Tarkir: Dragonstorm", releasedAt: "2025-04-11", setType: "expansion", boosters: [play(30, 135), collector()] },
  { code: "dft", name: "Aetherdrift", releasedAt: "2025-02-14", setType: "expansion", boosters: [play(30, 125), collector()] },
  { code: "inr", name: "Innistrad Remastered", releasedAt: "2025-01-24", setType: "masters", boosters: [play(36), collector()] },
  { code: "fdn", name: "Foundations", releasedAt: "2024-11-15", setType: "core", boosters: [play(36, 130), collector()] },
  { code: "dsk", name: "Duskmourn: House of Horror", releasedAt: "2024-09-27", setType: "expansion", boosters: [play(36, 125), collector()] },
  { code: "blb", name: "Bloomburrow", releasedAt: "2024-08-02", setType: "expansion", boosters: [play(36, 140), collector()] },
  { code: "mb2", name: "Mystery Booster 2", releasedAt: "2024-08-02", setType: "masters", boosters: [draft(24)] },
  { code: "mh3", name: "Modern Horizons 3", releasedAt: "2024-06-14", setType: "draft_innovation", boosters: [play(36), collector()] },
  { code: "otj", name: "Outlaws of Thunder Junction", releasedAt: "2024-04-19", setType: "expansion", boosters: [play(36), collector()] },
  { code: "mkm", name: "Murders at Karlov Manor", releasedAt: "2024-02-09", setType: "expansion", boosters: [play(36), collector()] },

  // Draft and Set Boosters, from Zendikar Rising (2020) to 2023
  { code: "rvr", name: "Ravnica Remastered", releasedAt: "2024-01-12", setType: "masters", boosters: [draft(), collector()] },
  { code: "lci", name: "The Lost Caverns of Ixalan", releasedAt: "2023-11-17", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "woe", name: "Wilds of Eldraine", releasedAt: "2023-09-08", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "cmm", name: "Commander Masters", releasedAt: "2023-08-04", setType: "masters", boosters: [draft(24), setBooster(24), collector(4)] },
  { code: "ltr", name: "The Lord of the Rings: Tales of Middle-earth", releasedAt: "2023-06-23", setType: "draft_innovation", boosters: [draft(), setBooster(), collector()] },
  { code: "mom", name: "March of the Machine", releasedAt: "2023-04-21", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "one", name: "Phyrexia: All Will Be One", releasedAt: "2023-02-10", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "dmr", name: "Dominaria Remastered", releasedAt: "2023-01-13", setType: "masters", boosters: [draft(), collector()] },
  { code: "bro", name: "The Brothers' War", releasedAt: "2022-11-18", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "dmu", name: "Dominaria United", releasedAt: "2022-09-09", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "2x2", name: "Double Masters 2022", releasedAt: "2022-07-08", setType: "masters", boosters: [draft(24), collector(4)] },
  { code: "clb", name: "Commander Legends: Battle for Baldur's Gate", releasedAt: "2022-06-10", setType: "draft_innovation", boosters: [draft(24), setBooster(18), collector()] },
  { code: "snc", name: "Streets of New Capenna", releasedAt: "2022-04-29", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "neo", name: "Kamigawa: Neon Dynasty", releasedAt: "2022-02-18", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "dbl", name: "Innistrad: Double Feature", releasedAt: "2022-01-28", setType: "draft_innovation", boosters: [draft(24)] },
  { code: "vow", name: "Innistrad: Crimson Vow", releasedAt: "2021-11-19", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "mid", name: "Innistrad: Midnight Hunt", releasedAt: "2021-09-24", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "afr", name: "Adventures in the Forgotten Realms", releasedAt: "2021-07-23", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "mh2", name: "Modern Horizons 2", releasedAt: "2021-06-18", setType: "draft_innovation", boosters: [draft(), setBooster(), collector()] },
  { code: "stx", name: "Strixhaven: School of Mages", releasedAt: "2021-04-23", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "tsr", name: "Time Spiral Remastered", releasedAt: "2021-03-19", setType: "masters", boosters: [draft()] },
  { code: "khm", name: "Kaldheim", releasedAt: "2021-02-05", setType: "expansion", boosters: [draft(), setBooster(), collector()] },
  { code: "cmr", name: "Commander Legends", releasedAt: "2020-11-20", setType: "draft_innovation", boosters: [draft(24), collector()] },
  { code: "znr", name: "Zendikar Rising", releasedAt: "2020-09-25", setType: "expansion", boosters: [draft(), setBooster(), collector()] },

  // 2010 to 2020
  { code: "2xm", name: "Double Masters", releasedAt: "2020-08-07", setType: "masters", boosters: [draft(24)] },
  { code: "m21", name: "Core Set 2021", releasedAt: "2020-07-03", setType: "core", boosters: [draft(), collector()] },
  { code: "iko", name: "Ikoria: Lair of Behemoths", releasedAt: "2020-04-24", setType: "expansion", boosters: [draft(), collector()] },
  { code: "thb", name: "Theros Beyond Death", releasedAt: "2020-01-24", setType: "expansion", boosters: [draft(), collector()] },
  { code: "eld", name: "Throne of Eldraine", releasedAt: "2019-10-04", setType: "expansion", boosters: [draft(), collector()] },
  { code: "m20", name: "Core Set 2020", releasedAt: "2019-07-12", setType: "core", boosters: [draft()] },
  { code: "mh1", name: "Modern Horizons", releasedAt: "2019-06-14", setType: "draft_innovation", boosters: [draft()] },
  { code: "war", name: "War of the Spark", releasedAt: "2019-05-03", setType: "expansion", boosters: [draft()] },
  { code: "rna", name: "Ravnica Allegiance", releasedAt: "2019-01-25", setType: "expansion", boosters: [draft()] },
  { code: "uma", name: "Ultimate Masters", releasedAt: "2018-12-07", setType: "masters", boosters: [draft(24)] },
  { code: "grn", name: "Guilds of Ravnica", releasedAt: "2018-10-05", setType: "expansion", boosters: [draft()] },
  { code: "m19", name: "Core Set 2019", releasedAt: "2018-07-13", setType: "core", boosters: [draft()] },
  { code: "bbd", name: "Battlebond", releasedAt: "2018-06-08", setType: "draft_innovation", boosters: [draft()] },
  { code: "dom", name: "Dominaria", releasedAt: "2018-04-27", setType: "expansion", boosters: [draft()] },
  { code: "a25", name: "Masters 25", releasedAt: "2018-03-16", setType: "masters", boosters: [draft(24)] },
  { code: "rix", name: "Rivals of Ixalan", releasedAt: "2018-01-19", setType: "expansion", boosters: [draft()] },
  { code: "ima", name: "Iconic Masters", releasedAt: "2017-11-17", setType: "masters", boosters: [draft(24)] },
  { code: "xln", name: "Ixalan", releasedAt: "2017-09-29", setType: "expansion", boosters: [draft()] },
  { code: "hou", name: "Hour of Devastation", releasedAt: "2017-07-14", setType: "expansion", boosters: [draft()] },
  { code: "akh", name: "Amonkhet", releasedAt: "2017-04-28", setType: "expansion", boosters: [draft()] },
  { code: "mm3", name: "Modern Masters 2017", releasedAt: "2017-03-17", setType: "masters", boosters: [draft(24)] },
  { code: "aer", name: "Aether Revolt", releasedAt: "2017-01-20", setType: "expansion", boosters: [draft()] },
  { code: "kld", name: "Kaladesh", releasedAt: "2016-09-30", setType: "expansion", boosters: [draft()] },
  { code: "cn2", name: "Conspiracy: Take the Crown", releasedAt: "2016-08-26", setType: "draft_innovation", boosters: [draft()] },
  { code: "emn", name: "Eldritch Moon", releasedAt: "2016-07-22", setType: "expansion", boosters: [draft()] },
  { code: "ema", name: "Eternal Masters", releasedAt: "2016-06-10", setType: "masters", boosters: [draft(24)] },
  { code: "soi", name: "Shadows over Innistrad", releasedAt: "2016-04-08", setType: "expansion", boosters: [draft()] },
  { code: "ogw", name: "Oath of the Gatewatch", releasedAt: "2016-01-22", setType: "expansion", boosters: [draft()] },
  { code: "bfz", name: "Battle for Zendikar", releasedAt: "2015-10-02", setType: "expansion", boosters: [draft()] },
  { code: "ori", name: "Magic Origins", releasedAt: "2015-07-17", setType: "core", boosters: [draft()] },
  { code: "mm2", name: "Modern Masters 2015", releasedAt: "2015-05-22", setType: "masters", boosters: [draft(24)] },
  { code: "dtk", name: "Dragons of Tarkir", releasedAt: "2015-03-27", setType: "expansion", boosters: [draft()] },
  { code: "frf", name: "Fate Reforged", releasedAt: "2015-01-23", setType: "expansion", boosters: [draft()] },
  { code: "ktk", name: "Khans of Tarkir", releasedAt: "2014-09-26", setType: "expansion", boosters: [draft()] },
  { code: "m15", name: "Magic 2015", releasedAt: "2014-07-18", setType: "core", boosters: [draft()] },
  { code: "cns", name: "Conspiracy", releasedAt: "2014-06-06", setType: "draft_innovation", boosters: [draft()] },
  { code: "jou", name: "Journey into Nyx", releasedAt: "2014-05-02", setType: "expansion", boosters: [draft()] },
  { code: "bng", name: "Born of the Gods", releasedAt: "2014-02-07", setType: "expansion", boosters: [draft()] },
  { code: "ths", name: "Theros", releasedAt: "2013-09-27", setType: "expansion", boosters: [draft()] },
  { code: "m14", name: "Magic 2014", releasedAt: "2013-07-19", setType: "core", boosters: [draft()] },
  { code: "mma", name: "Modern Masters", releasedAt: "2013-06-07", setType: "masters", boosters: [draft(24)] },
  { code: "dgm", name: "Dragon's Maze", releasedAt: "2013-05-03", setType: "expansion", boosters: [draft()] },
  { code: "gtc", name: "Gatecrash", releasedAt: "2013-02-01", setType: "expansion", boosters: [draft()] },
  { code: "rtr", name: "Return to Ravnica", releasedAt: "2012-10-05", setType: "expansion", boosters: [draft()] },
  { code: "m13", name: "Magic 2013", releasedAt: "2012-07-13", setType: "core", boosters: [draft()] },
  { code: "avr", name: "Avacyn Restored", releasedAt: "2012-05-04", setType: "expansion", boosters: [draft()] },
  { code: "dka", name: "Dark Ascension", releasedAt: "2012-02-03", setType: "expansion", boosters: [draft()] },
  { code: "isd", name: "Innistrad", releasedAt: "2011-09-30", setType: "expansion", boosters: [draft()] },
  { code: "m12", name: "Magic 2012", releasedAt: "2011-07-15", setType: "core", boosters: [draft()] },
  { code: "nph", name: "New Phyrexia", releasedAt: "2011-05-13", setType: "expansion", boosters: [draft()] },
  { code: "mbs", name: "Mirrodin Besieged", releasedAt: "2011-02-04", setType: "expansion", boosters: [draft()] },
  { code: "som", name: "Scars of Mirrodin", releasedAt: "2010-10-01", setType: "expansion", boosters: [draft()] },
  { code: "m11", name: "Magic 2011", releasedAt: "2010-07-16", setType: "core", boosters: [draft()] },
  { code: "roe", name: "Rise of the Eldrazi", releasedAt: "2010-04-23", setType: "expansion", boosters: [draft()] },
  { code: "wwk", name: "Worldwake", releasedAt: "2010-02-05", setType: "expansion", boosters: [draft()] },

  // 2000 to 2009
  { code: "zen", name: "Zendikar", releasedAt: "2009-10-02", setType: "expansion", boosters: [draft()] },
  { code: "m10", name: "Magic 2010", releasedAt: "2009-07-17", setType: "core", boosters: [draft()] },
  { code: "arb", name: "Alara Reborn", releasedAt: "2009-04-30", setType: "expansion", boosters: [draft()] },
  { code: "con", name: "Conflux", releasedAt: "2009-02-06", setType: "expansion", boosters: [draft()] },
  { code: "ala", name: "Shards of Alara", releasedAt: "2008-10-03", setType: "expansion", boosters: [draft()] },
  { code: "eve", name: "Eventide", releasedAt: "2008-07-25", setType: "expansion", boosters: [draft()] },
  { code: "shm", name: "Shadowmoor", releasedAt: "2008-05-02", setType: "expansion", boosters: [draft()] },
  { code: "mor", name: "Morningtide", releasedAt: "2008-02-01", setType: "expansion", boosters: [draft()] },
  { code: "lrw", name: "Lorwyn", releasedAt: "2007-10-12", setType: "expansion", boosters: [draft()] },
  { code: "10e", name: "Tenth Edition", releasedAt: "2007-07-13", setType: "core", boosters: [draft()] },
  { code: "fut", name: "Future Sight", releasedAt: "2007-05-04", setType: "expansion", boosters: [draft()] },
  { code: "plc", name: "Planar Chaos", releasedAt: "2007-02-02", setType: "expansion", boosters: [draft()] },
  { code: "tsp", name: "Time Spiral", releasedAt: "2006-10-06", setType: "expansion", boosters: [draft()] },
  { code: "csp", name: "Coldsnap", releasedAt: "2006-07-21", setType: "expansion", boosters: [draft()] },
  { code: "dis", name: "Dissension", releasedAt: "2006-05-05", setType: "expansion", boosters: [draft()] },
  { code: "gpt", name: "Guildpact", releasedAt: "2006-02-03", setType: "expansion", boosters: [draft()] },
  { code: "rav", name: "Ravnica: City of Guilds", releasedAt: "2005-10-07", setType: "expansion", boosters: [draft()] },
  { code: "9ed", name: "Ninth Edition", releasedAt: "2005-07-29", setType: "core", boosters: [draft()] },
  { code: "sok", name: "Saviors of Kamigawa", releasedAt: "2005-06-03", setType: "expansion", boosters: [draft()] },
  { code: "bok", name: "Betrayers of Kamigawa", releasedAt: "2005-02-04", setType: "expansion", boosters: [draft()] },
  { code: "chk", name: "Champions of Kamigawa", releasedAt: "2004-10-01", setType: "expansion", boosters: [draft()] },
  { code: "5dn", name: "Fifth Dawn", releasedAt: "2004-06-04", setType: "expansion", boosters: [draft()] },
  { code: "dst", name: "Darksteel", releasedAt: "2004-02-06", setType: "expansion", boosters: [draft()] },
  { code: "mrd", name: "Mirrodin", releasedAt: "2003-10-02", setType: "expansion", boosters: [draft()] },
  { code: "8ed", name: "Eighth Edition", releasedAt: "2003-07-28", setType: "core", boosters: [draft()] },
  { code: "scg", name: "Scourge", releasedAt: "2003-05-26", setType: "expansion", boosters: [draft()] },
  { code: "lgn", name: "Legions", releasedAt: "2003-02-03", setType: "expansion", boosters: [draft()] },
  { code: "ons", name: "Onslaught", releasedAt: "2002-10-07", setType: "expansion", boosters: [draft()] },
  { code: "jud", name: "Judgment", releasedAt: "2002-05-27", setType: "expansion", boosters: [draft()] },
  { code: "tor", name: "Torment", releasedAt: "2002-02-04", setType: "expansion", boosters: [draft()] },
  { code: "ody", name: "Odyssey", releasedAt: "2001-10-01", setType: "expansion", boosters: [draft()] },
  { code: "apc", name: "Apocalypse", releasedAt: "2001-06-04", setType: "expansion", boosters: [draft()] },
  { code: "7ed", name: "Seventh Edition", releasedAt: "2001-04-11", setType: "core", boosters: [draft()] },
  { code: "pls", name: "Planeshift", releasedAt: "2001-02-05", setType: "expansion", boosters: [draft()] },
  { code: "inv", name: "Invasion", releasedAt: "2000-10-02", setType: "expansion", boosters: [draft()] },
  { code: "pcy", name: "Prophecy", releasedAt: "2000-06-05", setType: "expansion", boosters: [draft()] },
  { code: "nem", name: "Nemesis", releasedAt: "2000-02-14", setType: "expansion", boosters: [draft()] },

  // 1993 to 1999
  { code: "mmq", name: "Mercadian Masques", releasedAt: "1999-10-04", setType: "expansion", boosters: [draft()] },
  { code: "uds", name: "Urza's Destiny", releasedAt: "1999-06-07", setType: "expansion", boosters: [draft()] },
  { code: "6ed", name: "Classic Sixth Edition", releasedAt: "1999-04-21", setType: "core", boosters: [draft()] },
  { code: "ulg", name: "Urza's Legacy", releasedAt: "1999-02-15", setType: "expansion", boosters: [draft()] },
  { code: "usg", name: "Urza's Saga", releasedAt: "1998-10-12", setType: "expansion", boosters: [draft()] },
  { code: "exo", name: "Exodus", releasedAt: "1998-06-15", setType: "expansion", boosters: [draft()] },
  { code: "sth", name: "Stronghold", releasedAt: "1998-03-02", setType: "expansion", boosters: [draft()] },
  { code: "tmp", name: "Tempest", releasedAt: "1997-10-14", setType: "expansion", boosters: [draft()] },
  { code: "wth", name: "Weatherlight", releasedAt: "1997-06-09", setType: "expansion", boosters: [draft()] },
  { code: "5ed", name: "Fifth Edition", releasedAt: "1997-03-24", setType: "core", boosters: [draft()] },
  { code: "vis", name: "Visions", releasedAt: "1997-02-03", setType: "expansion", boosters: [draft()] },
  { code: "mir", name: "Mirage", releasedAt: "1996-10-08", setType: "expansion", boosters: [draft()] },
  { code: "all", name: "Alliances", releasedAt: "1996-06-10", setType: "expansion", boosters: [draft(45)] },
  { code: "hml", name: "Homelands", releasedAt: "1995-10-01", setType: "expansion", boosters: [draft(60)] },
  { code: "chr", name: "Chronicles", releasedAt: "1995-07-01", setType: "masters", boosters: [draft(45)] },
  { code: "ice", name: "Ice Age", releasedAt: "1995-06-03", setType: "expansion", boosters: [draft()] },
  { code: "4ed", name: "Fourth Edition", releasedAt: "1995-04-01", setType: "core", boosters: [draft()] },
  { code: "fem", name: "Fallen Empires", releasedAt: "1994-11-01", setType: "expansion", boosters: [draft(60)] },
  { code: "drk", name: "The Dark", releasedAt: "1994-08-01", setType: "expansion", boosters: [draft(60)] },
  { code: "leg", name: "Legends", releasedAt: "1994-06-01", setType: "expansion", boosters: [draft()] },
  { code: "3ed", name: "Revised Edition", releasedAt: "1994-04-11", setType: "core", boosters: [draft()] },
  { code: "atq", name: "Antiquities", releasedAt: "1994-03-04", setType: "expansion", boosters: [draft(60)] },
  { code: "arn", name: "Arabian Nights", releasedAt: "1993-12-17", setType: "expansion", boosters: [draft(60)] },
  { code: "2ed", name: "Unlimited Edition", releasedAt: "1993-12-01", setType: "core", boosters: [draft()] },
  { code: "leb", name: "Limited Edition Beta", releasedAt: "1993-10-04", setType: "core", boosters: [draft()] },
  { code: "lea", name: "Limited Edition Alpha", releasedAt: "1993-08-05", setType: "core", boosters: [draft()] },
];

export function catalogEntry(code: string): CatalogEntry | undefined {
  return CATALOG.find((s) => s.code === code.toLowerCase());
}

export function boosterSpec(entry: CatalogEntry, type: BoosterType): BoosterSpec | undefined {
  return entry.boosters.find((b) => b.type === type);
}
