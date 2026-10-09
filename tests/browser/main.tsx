/* eslint-disable react-refresh/only-export-components -- Standalone regression fixture entry point. */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AIAnalysisButton } from "../../src/components/AIAnalysisDialog";
import type { Listing } from "../../src/lib/scanner/types";
import "../../src/styles.css";

function Fixture() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="mb-4 text-xl">RealityScanner — ověření AI okna</h1>
      <p className="mb-6">
        Izolovaná ukázka skutečné komponenty, bez volání AI nebo čerpání kreditu. Obnovení seznamu:{" "}
        {tick}.
      </p>
      <a
        href="https://example.test/listing"
        className="group relative block w-72 overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5"
      >
        <h2 className="mb-6">Testovací inzerát</h2>
        <AIAnalysisButton
          listing={
            {
              id: "6f00a22c-8381-4c91-95f7-4a96af4a18de",
              name: "Testovací byt",
              locality: "Mělník",
              url: "https://example.test/listing",
            } as Listing
          }
        />
      </a>
    </main>
  );
}
const client = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <Fixture />
  </QueryClientProvider>,
);
