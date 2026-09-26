import { Link } from "wouter";
import { CATALOG } from "@/sets/catalog";
import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    // The footer is always the dark band, in both themes, like the magazine's.
    <footer className="mt-24 bg-[#000] text-[#f5f5f5]">
      <div className="mx-auto grid max-w-page gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.1fr_1.6fr_0.7fr]">
        <div>
          <Wordmark className="text-[44px]" />
          <p className="mt-5 max-w-sm font-serif text-[15px] leading-relaxed text-[#bdbdbd]">
            An expected-value calculator for Magic: The Gathering booster boxes. Card prices are TCGplayer market prices
            by way of Scryfall; box prices come from TCGplayer. Nothing here is financial advice — it's cardboard.
          </p>
        </div>
        <div>
          <h2 className="kicker mb-4 text-[#9a9a9a]">Sets</h2>
          <ul className="columns-2 gap-x-6 text-[14px] sm:columns-3">
            {CATALOG.map((s) => (
              <li key={s.code} className="mb-1.5 break-inside-avoid">
                <Link href={`/sets/${s.code}`} className="hover-rule">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="kicker mb-4 text-[#9a9a9a]">About</h2>
          <ul className="space-y-1.5 text-[14px]">
            <li>
              <Link href="/method" className="hover-rule">
                How the numbers work
              </Link>
            </li>
            <li>
              <a className="hover-rule" href="https://scryfall.com" target="_blank" rel="noreferrer">
                Card data: Scryfall
              </a>
            </li>
            <li>
              <a className="hover-rule" href="https://mtgjson.com" target="_blank" rel="noreferrer">
                Booster sheets: MTGJSON
              </a>
            </li>
            <li>
              <a className="hover-rule" href="https://github.com/Trolltopia/ForClaude" target="_blank" rel="noreferrer">
                Source code
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#2a2a2a]">
        <p className="mx-auto max-w-page px-4 py-5 text-[12px] leading-relaxed text-[#8a8a8a] sm:px-6">
          Crack or Keep is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by
          Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
        </p>
      </div>
    </footer>
  );
}
