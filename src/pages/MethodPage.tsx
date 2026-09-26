import { useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { Masthead } from "@/components/site/Masthead";

function H({ children, id }: { children: ReactNode; id: string }) {
  return (
    <h2 id={id} className="display mt-14 scroll-mt-20 text-[32px] leading-[1.05] sm:text-[38px]">
      {children}
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-5 font-serif text-[19px] leading-[1.6] text-ink-soft">{children}</p>;
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="my-7 overflow-x-auto border-y border-ink py-4 font-mono text-[14px] leading-relaxed whitespace-pre text-ink">
      {children}
    </div>
  );
}

const TOC: [string, string][] = [
  ["ev", "What expected value means here"],
  ["boosters", "Play, Draft, Set and Collector"],
  ["sheets", "Slots, sheets and odds"],
  ["prices", "Where the prices come from"],
  ["return", "The return, and the verdict"],
  ["realism", "Bulk floors and selling costs"],
  ["simulation", "Why simulate at all"],
  ["bulk", "One box or a hundred"],
  ["limits", "What this doesn't know"],
];

export function MethodPage() {
  useEffect(() => {
    document.title = "How the numbers work — Crack or Keep";
  }, []);

  return (
    <>
      <Masthead variant="compact" />
      <main className="mx-auto max-w-page px-4 sm:px-6">
        <div className="grid gap-12 pt-12 lg:grid-cols-[220px_minmax(0,680px)] lg:gap-20">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <p className="kicker text-body">Method</p>
            <nav aria-label="On this page" className="mt-4">
              <ol className="space-y-2 text-[14px]">
                {TOC.map(([id, label], i) => (
                  <li key={id} className="flex gap-3">
                    <span className="font-mono text-[12px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <a href={`#${id}`} className="hover-rule">
                      {label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article>
            <p className="kicker text-body">How the numbers work</p>
            <h1 className="display mt-3 text-[clamp(44px,6vw,76px)] leading-[0.95]">Opening a box, on paper</h1>
            <p className="mt-6 font-serif text-[22px] leading-[1.5] text-ink">
              Every number on this site comes from one question: if you opened this box a very large number of times, what would
              the cards be worth on average? The answer is arithmetic, not magic — though the inputs deserve a closer look.
            </p>

            <H id="ev">What expected value means here</H>
            <P>
              A booster is a handful of slots. Each slot draws a card from a pool — a <em>sheet</em> — with known odds. Multiply
              every card&rsquo;s price by the chance it lands in a slot, add it all up, and you have the value of an average pack.
              A box is a display of those packs: twelve of them for Collector Boosters, thirty or thirty-six for the rest.
            </P>
            <Formula>
              {`value of a pack = Σ slots  Σ cards in slot   P(card) × price(card)
value of a box  = packs per box × value of a pack`}
            </Formula>
            <P>
              Because averages add up neatly, this number is exact for the model — no sampling, no noise. It isn&rsquo;t what your box
              will be worth. It&rsquo;s the centre of gravity of every box that could exist.
            </P>

            <H id="boosters">Play, Draft, Set and Collector</H>
            <P>
              The site covers every paper set since Limited Edition Alpha in 1993 that MTGJSON models and TCGplayer sells: expansions,
              core sets, Masters sets and the special draft sets. Each set page prices every booster the set was sold in, with a
              switch at the top to move between them. From Murders at Karlov Manor (2024) on, that means Play Boosters, thirty-six
              to a display until Aetherdrift cut it to thirty. Before that came Draft Boosters (plain &ldquo;boosters&rdquo; until
              2020), and from Zendikar Rising (2020) to The Lost Caverns of Ixalan (2023) also Set Boosters. Collector Boosters
              arrived with Throne of Eldraine (2019): twelve packs of foils, alternate art and the rarest printings.
            </P>
            <P>
              How many packs a display holds comes from MTGJSON&rsquo;s record of what&rsquo;s inside it, not from a rule of thumb:
              thirty-six for most sets, twenty-four for Masters sets, sixty eight-card packs for Arabian Nights and The Dark, four
              for a Commander Masters Collector display. The same records say how many boosters a bundle or a case holds and which
              TCGplayer listing is the display, so its price is the exact product.
            </P>
            <P>
              The board compares one kind of box at a time: each set&rsquo;s main booster (Play, or Draft before 2024), Set
              Boosters, or Collector Boosters. A booster we can&rsquo;t model yet — Reality Fracture&rsquo;s Collector Booster,
              until MTGJSON publishes its print sheets — is listed on the set page as not priced, rather than guessed at.
            </P>

            <H id="sheets">Slots, sheets and odds</H>
            <P>
              For most sets the pack layouts and print sheets come from{" "}
              <a className="prose-link" href="https://mtgjson.com" target="_blank" rel="noreferrer">
                MTGJSON
              </a>
              , which records every sheet, the weight of each card on it, and how often each pack layout occurs — the one-in-sixty
              pack with a Special Guest in place of a common, for example. For the newest sets, before that data exists, we
              transcribe the slot-by-slot odds Wizards of the Coast publishes in its &ldquo;Collecting&rdquo; articles.
            </P>
            <P>
              Within a slot, cards of the same kind are equally likely: every regular rare as likely as every other regular rare.
              Where Wizards only says &ldquo;less than 1%&rdquo;, we split the published total between the treatments it covers, and
              say so on the set page.
            </P>

            <H id="prices">Where the prices come from</H>
            <P>
              Card prices are TCGplayer market prices, fetched through{" "}
              <a className="prose-link" href="https://scryfall.com/docs/api" target="_blank" rel="noreferrer">
                Scryfall
              </a>
              , which refreshes them daily. Foils are priced as foils. The box price is TCGplayer&rsquo;s market price for that
              booster&rsquo;s display, via TCGCSV&rsquo;s daily mirror. When there isn&rsquo;t one, you&rsquo;ll see an
              estimate marked as such, or no price at all — type in what you&rsquo;d actually pay.
            </P>
            <P>
              The same daily pull lists every sealed product TCGplayer carries for the set — packs, displays, bundles, cases,
              Commander decks — with market and lowest-listing prices. Anything with a known number of boosters inside is priced
              per booster against an average booster of the same kind, and any of them can stand in as that booster&rsquo;s box
              price. Special editions and Omega packs share a name with ordinary Collector Boosters but not their contents, so they
              aren&rsquo;t compared.
            </P>
            <P>
              A new card with no sales yet has no market price. It counts as zero and the set page tells you what share of the
              pack that affects. Before release, prices are preorders: thin, jumpy, and usually higher than where they settle.
            </P>

            <H id="return">The return, and the verdict</H>
            <P>
              The return compares what the cards are worth with what the box costs. +35% means an average box holds $135 of cards
              for every $100 you pay; −12% means $88. Zero is break-even. We call anything within 5% either way a toss-up,
              anything better a <strong className="font-semibold">crack</strong>, and anything worse a{" "}
              <strong className="font-semibold">keep</strong> — as in, keep it sealed, or keep your money.
            </P>

            <H id="realism">Bulk floors and selling costs</H>
            <P>
              Market value assumes you can sell every card at its market price. You can&rsquo;t. Nobody buys a nine-cent common by
              itself, and every sale pays fees and postage. Two settings bring the number closer to what you&rsquo;d pocket. They
              live under Settings at the top of every page and in the bar on each set page, apply to every number on the site, and
              your browser remembers them:
            </P>
            <ul className="mt-5 list-disc space-y-3 pl-6 font-serif text-[19px] leading-[1.6] text-ink-soft marker:text-muted">
              <li>
                <strong className="font-semibold text-ink">Ignore cards under</strong> treats anything cheaper as worth
                nothing. The cards are still opened — they just stop counting.
              </li>
              <li>
                <strong className="font-semibold text-ink">Selling fees per card</strong> takes a percentage off every card that does
                count. It starts at 8%; set it to 0% for raw market value, or higher to cover postage.
              </li>
            </ul>

            <H id="simulation">Why simulate at all</H>
            <P>
              The average is dragged upward by rare, expensive pulls, so most boxes land below it. To show the spread, each set page
              opens ten thousand boxes at random — slot by slot, pack by pack, with the same odds and prices — and draws the
              distribution. The share of those boxes worth at least the box price is the closest thing here to &ldquo;will I make my
              money back?&rdquo;.
            </P>
            <P>
              The simulation runs in your browser, in a background thread, with a fixed seed so the numbers don&rsquo;t jitter
              between visits. The &ldquo;open a box&rdquo; button uses a fresh seed every time.
            </P>

            <H id="bulk">One box or a hundred</H>
            <P>
              Expected value is exact, but it is a long-run average. A single box is a lottery ticket: most land below the average
              and a few land far above it. Open more boxes and the lucky and unlucky ones cancel out, so the average box across
              your run settles toward the expected value. The spread shrinks with the square root of the number of boxes: a hundred
              boxes swing about a tenth as much per box as one does.
            </P>
            <P>
              The &ldquo;one box or a hundred&rdquo; table on each set page shows this with the simulated boxes, for runs of 1, 3, 10,
              30 and 100. For each it gives the chance the whole run comes out ahead of what it cost, the range where nine runs in
              ten land, a bad run (one in twenty does this badly or worse), and the most you could pay per box and still come out
              ahead nine times in ten. That last number is the useful one for a store: below it, buying the box is close to a sure
              thing; between it and the expected value you win on average but can lose on the run; above the expected value you
              lose on average, however many boxes you open.
            </P>
            <P>
              For a store the bigger question is often what the cards are really worth to you. Market price is what singles sell for
              one at a time. Selling that way costs fees and postage, and the slow cards sit in stock. Selling the lot on to another
              store returns roughly half to two thirds of market. The selling-fees slider goes to 50% for that, and the minimum-price
              setting drops the bulk nobody pays for.
            </P>

            <H id="limits">What this doesn&rsquo;t know</H>
            <ul className="mt-5 list-disc space-y-3 pl-6 font-serif text-[19px] leading-[1.6] text-ink-soft marker:text-muted">
              <li>Condition, language and centring. Everything is priced near-mint English.</li>
              <li>Collation quirks. Real print runs group cards in ways that make some packs streakier than independent draws.</li>
              <li>The token or art card in each pack, which we value at zero.</li>
              <li>Where the market goes next. Prices move daily; the page tells you when they were collected.</li>
            </ul>
            <P>
              If a number looks wrong, the{" "}
              <a className="prose-link" href="https://github.com/Trolltopia/ForClaude" target="_blank" rel="noreferrer">
                source is public
              </a>
              , booster model and all. Or start from{" "}
              <Link href="/" className="prose-link">
                the board
              </Link>
              .
            </P>
          </article>
        </div>
      </main>
    </>
  );
}
