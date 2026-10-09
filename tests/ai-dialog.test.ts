// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AIAnalysisButton } from "../src/components/AIAnalysisDialog";
import type { Listing } from "../src/lib/scanner/types";

const mock = vi.hoisted(() => ({
  analyze: vi.fn(),
  plan: { tier: "premium", free_ai_sample_used: false },
  navigate: vi.fn(),
}));
vi.mock("@/lib/ai/analyze.functions", () => ({ analyzeListing: mock.analyze }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mock.analyze }));
vi.mock("@/hooks/usePlan", () => ({ usePlan: () => ({ data: mock.plan }) }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mock.navigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
    createElement("a", { href: to }, children),
}));

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const listing = {
  id: "6f00a22c-8381-4c91-95f7-4a96af4a18de",
  name: "Prodej bytu",
  locality: "Mělník",
  url: "https://example.test/listing",
} as Listing;
const dialog = () => document.querySelector('[role="dialog"]');
const close = () => document.querySelector<HTMLButtonElement>('[aria-label="Zavřít AI analýzu"]')!;
async function render(value = listing) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          "a",
          {
            id: "card",
            href: listing.url,
            style: { transform: "translateY(-2px)", overflow: "hidden" },
          },
          createElement(AIAnalysisButton, { listing: value }),
        ),
      ),
    ),
  );
}
async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mock.plan = { tier: "premium", free_ai_sample_used: false };
  mock.analyze.mockReset().mockImplementation(() => new Promise(() => {}));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  client.clear();
});

describe("AI analysis modal", () => {
  it("escapes the transformed listing card and closes during loading with focus restored", async () => {
    await render();
    const trigger = container.querySelector("button")!;
    await click(trigger);
    expect(dialog()).not.toBeNull();
    expect(document.querySelector("#card")!.contains(dialog())).toBe(false);
    expect(dialog()?.textContent).toContain("AI vyhodnocuje");
    await click(close());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("closes with Escape and does not reopen after a late server response", async () => {
    let finish!: (value: unknown) => void;
    mock.analyze.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render();
    await click(container.querySelector("button")!);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(dialog()).toBeNull();
    await act(async () => finish({ ok: false, error: "ai_failed", message: "Pozdní odpověď" }));
    expect(dialog()).toBeNull();
  });
  it("does not repeat analysis when refreshed listings keep the same id", async () => {
    await render();
    await click(container.querySelector("button")!);
    await render({ ...listing });
    expect(mock.analyze).toHaveBeenCalledTimes(1);
    expect(mock.analyze).toHaveBeenCalledWith({ data: { listing_id: listing.id } });
  });
  it("closes when clicking outside the modal", async () => {
    await render();
    await click(container.querySelector("button")!);
    await act(async () => {
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0 }),
      );
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(dialog()).toBeNull();
  });
  it("keeps the free result visible after the sample flag changes", async () => {
    mock.plan = { tier: "free", free_ai_sample_used: false };
    mock.analyze.mockResolvedValue({
      ok: false,
      error: "free_sample_used",
      message: "Ukázka již byla použita.",
    });
    await render();
    await click(container.querySelector("button")!);
    mock.plan = { tier: "free", free_ai_sample_used: true };
    await render({ ...listing });
    expect(dialog()?.textContent).toContain("Ukázka již byla použita.");
    expect(mock.analyze).toHaveBeenCalledTimes(1);
    await click(close());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(container.querySelector("button"));
  });
});
