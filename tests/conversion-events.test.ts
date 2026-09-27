import { afterEach, expect, it, vi } from "vitest";
import { emitConversion } from "@/lib/conversion-events";

afterEach(() => vi.unstubAllGlobals());
it("is a no-op during SSR", () => {
  expect(() => emitConversion("premium_confirmed")).not.toThrow();
});
it("emits only an event name, without identifiers, persistence or network", () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { dispatchEvent });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  emitConversion("checkout_started");
  expect(dispatchEvent).toHaveBeenCalledOnce();
  const event = dispatchEvent.mock.calls[0][0] as CustomEvent;
  expect(event.type).toBe("realityscanner:conversion");
  expect(event.detail).toEqual({ event: "checkout_started" });
  expect(fetch).not.toHaveBeenCalled();
});
