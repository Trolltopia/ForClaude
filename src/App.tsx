import { lazy, Suspense, useEffect } from "react";
import { Link, Route, Router, Switch, useLocation } from "wouter";
import { Footer } from "@/components/site/Footer";
import { Masthead } from "@/components/site/Masthead";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BASE } from "@/lib/utils";
import { HomePage } from "@/pages/HomePage";

// The calculator and the long read are split out so the front page loads light.
const SetPage = lazy(() => import("@/pages/SetPage").then((m) => ({ default: m.SetPage })));
const MethodPage = lazy(() => import("@/pages/MethodPage").then((m) => ({ default: m.MethodPage })));

function ScrollToTop() {
  const [path] = useLocation();
  // Switching booster on a set page swaps the numbers in place; only a new page starts at the top.
  const page = path.replace(/^(\/sets\/[^/]+)\/.*$/, "$1");
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [page]);
  return null;
}

function NotFound() {
  return (
    <>
      <Masthead variant="compact" />
      <main className="mx-auto max-w-page px-4 py-24 sm:px-6">
        <p className="kicker text-body">404</p>
        <h1 className="display mt-3 text-[64px] leading-none">Nothing in this pack</h1>
        <p className="mt-5 font-serif text-[19px] text-ink-soft">That page doesn&rsquo;t exist.</p>
        <Link href="/" className="prose-link mt-6 inline-block">
          Back to the board
        </Link>
      </main>
    </>
  );
}

export function App() {
  return (
    <Router base={BASE}>
      <TooltipProvider delayDuration={150}>
        <a
          href="#main"
          className="sr-only z-50 bg-ink px-4 py-2 text-canvas focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <ScrollToTop />
        <div id="main" className="flex min-h-dvh flex-col">
          <div className="flex-1">
            <Suspense fallback={<Masthead variant="compact" />}>
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/sets/:code/:booster?">
                  {(p) => <SetPage key={p.code} code={p.code.toLowerCase()} booster={p.booster?.toLowerCase()} />}
                </Route>
                <Route path="/method" component={MethodPage} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </div>
          <Footer />
        </div>
      </TooltipProvider>
    </Router>
  );
}
