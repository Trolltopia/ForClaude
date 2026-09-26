import { Link } from "wouter";
import { useSnapshotIndex } from "@/hooks/useSnapshotIndex";
import { ago, stamp, today } from "@/lib/format";
import { MarketStrip } from "./MarketStrip";
import { SetMenu } from "./SetMenu";
import { SettingsMenu } from "./SettingsMenu";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

const REPO = "https://github.com/Trolltopia/ForClaude";

function NavLinks() {
  return (
    <>
      <Link href="/" className="hover-rule hidden font-sans text-[14px] font-bold tracking-[0.02em] sm:inline">
        The Board
      </Link>
      <SetMenu />
      <SettingsMenu />
      <Link href="/method" className="hover-rule hidden font-sans text-[14px] font-bold tracking-[0.02em] sm:inline">
        Method
      </Link>
    </>
  );
}

function Dateline() {
  const { index } = useSnapshotIndex();
  return (
    <div className="border-b border-hairline">
      <div className="mx-auto flex h-9 max-w-page items-center justify-between gap-4 px-4 text-body sm:px-6">
        <span className="kicker truncate">{today()}</span>
        <div className="flex items-center gap-5">
          {index && (
            <span className="kicker hidden md:inline" title={`Prices collected ${stamp(index.generatedAt)}`}>
              Prices collected {ago(index.generatedAt)}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

/** Front-page nameplate: the big centred wordmark, like a paper's first page. */
export function Masthead({ variant = "full" }: { variant?: "full" | "compact" }) {
  if (variant === "compact") {
    return (
      <header>
        <Dateline />
        <div className="border-b-2 border-rule">
          <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-6 px-4 sm:px-6">
            <Link href="/" aria-label="Crack or Keep, home">
              <Wordmark className="text-[30px] sm:text-[40px]" />
            </Link>
            <div className="flex items-center gap-4 sm:gap-7">
              <NavLinks />
              <a href={REPO} className="hover-rule hidden font-sans text-[14px] font-bold sm:inline" target="_blank" rel="noreferrer">
                Source
              </a>
            </div>
          </div>
        </div>
        <MarketStrip />
      </header>
    );
  }

  return (
    <header>
      <Dateline />
      <div className="mx-auto max-w-page px-4 pt-8 pb-6 text-center sm:px-6 sm:pt-12">
        <Link href="/" aria-label="Crack or Keep, home" className="inline-block">
          <Wordmark className="text-[clamp(56px,11vw,132px)]" />
        </Link>
        <p className="mt-4 font-serif text-[17px] text-body italic sm:text-[19px]">
          What a Magic booster box is worth once you open it. Priced every morning.
        </p>
      </div>
      <div className="border-y-2 border-rule">
        <div className="mx-auto flex h-12 max-w-page items-center justify-center gap-8 px-4 sm:px-6">
          <NavLinks />
          <a href={REPO} className="hover-rule hidden font-sans text-[14px] font-bold sm:inline" target="_blank" rel="noreferrer">
            Source
          </a>
        </div>
      </div>
      <MarketStrip />
    </header>
  );
}
