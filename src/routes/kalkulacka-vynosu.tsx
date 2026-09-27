import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicGuide } from "@/components/PublicGuide";
import { publicPageHead } from "@/lib/site";
import { calculateRentalScenario } from "@/lib/rental-calculator";

export const Route = createFileRoute("/kalkulacka-vynosu")({
  staticData: { sitemap: true },
  head: () =>
    publicPageHead(
      "/kalkulacka-vynosu",
      "Kalkulačka výnosu z pronájmu",
      "Spočítejte hrubý a čistý provozní výnos z pronájmu. Upravte pořizovací cenu, nájem, náklady majitele a neobsazenost.",
    ),
  component: Calculator,
});
const number = (n: number, digits = 0) =>
  new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
function Calculator() {
  const [values, setValues] = useState(["4500000", "15000", "2250", "5"]);
  const inputs = [
    [
      "Celková pořizovací cena (Kč)",
      "Kupní cena včetně Vašeho rozpočtu na pořízení a rekonstrukci.",
    ],
    ["Měsíční nájem bez služeb (Kč)", "Částka nájemného, ne zálohy na energie a služby."],
    [
      "Měsíční náklady majitele (Kč)",
      "Nepřeúčtované opravy, pojištění, správa a daň z nemovitých věcí; bez hypotéky.",
    ],
    ["Neobsazenost (%)", "Podíl roku bez příjmu z nájmu; 5 % odpovídá přibližně 18 dnům."],
  ];
  const parsed = values.map((v) => (v.trim() ? Number(v) : NaN));
  const result = calculateRentalScenario(parsed[0], parsed[1], parsed[2], parsed[3]);
  return (
    <PublicGuide
      title="Kalkulačka výnosu z pronájmu"
      intro="Vlastní scénář bez registrace. Výchozí hodnoty jsou pouze ilustrační příklad, nikoli odhad tržního nájmu nebo doporučení ke koupi. Nahraďte je ověřenými údaji."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {inputs.map(([label, help], i) => (
          <div key={label}>
            <label htmlFor={"rental-" + i} className="block text-sm font-semibold">
              {label}
            </label>
            <input
              id={"rental-" + i}
              type="number"
              min={i === 0 ? 2 : 0}
              max={i === 3 ? 100 : undefined}
              step="any"
              inputMode="decimal"
              value={values[i]}
              onChange={(e) =>
                setValues(values.map((v, index) => (index === i ? e.target.value : v)))
              }
              aria-describedby={"rental-help-" + i}
              className="mt-2 w-full rounded-lg border border-border bg-card p-3"
            />
            <p id={"rental-help-" + i} className="mt-2 text-xs text-muted-foreground">
              {help}
            </p>
          </div>
        ))}
      </div>
      <section aria-live="polite" className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Výsledek Vašeho scénáře</h2>
        {result ? (
          <div className="mt-3 space-y-3">
            <p className="text-2xl font-bold">
              Čistý provozní výnos {number(result.netYield, 1)} % ročně
            </p>
            <p>
              Hrubý výnos {number(result.grossYield, 1)} % ročně · čistý provozní příjem{" "}
              {number(result.annualNet)} Kč ročně.
            </p>
            <p className="text-sm text-muted-foreground">
              Hrubý: {number(parsed[1])} Kč × 12 = {number(result.annualGross)} Kč ročně ÷{" "}
              {number(parsed[0])} Kč = {number(result.grossYield, 1)} %.
            </p>
            <p className="text-sm text-muted-foreground">
              Čistý: ({number(parsed[1])} Kč × 12 × (1 − {number(parsed[3], 1)} %) −{" "}
              {number(parsed[2])} Kč × 12) ÷ {number(parsed[0])} Kč = {number(result.netYield, 1)}{" "}
              %.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-amber-500">
            Vyplňte platné částky. Cena musí být vyšší než 1 Kč, nájem a náklady nezáporné a
            neobsazenost mezi 0 a 100 %.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Co výsledek neobsahuje</h2>
        <p className="mt-3 text-muted-foreground">
          Splátky hypotéky, daň z příjmů ani budoucí změnu hodnoty nemovitosti. Výnos není cashflow
          po financování. Náklady zadávejte bez neobsazenosti, kterou kalkulačka odečítá zvlášť.
        </p>
        <p className="mt-3 text-muted-foreground">
          Na kartách skeneru je automatický orientační odhad s paušální srážkou 15 %. Zde tuto
          srážku nahrazujete vlastními náklady a neobsazeností, proto se výsledky mohou lišit.{" "}
          <Link to="/metodika" className="text-primary hover:underline">
            Více v metodice.
          </Link>
        </p>
      </section>
    </PublicGuide>
  );
}
