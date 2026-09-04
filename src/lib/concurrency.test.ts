import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";

describe("mapWithConcurrency", () => {
  it("runs work concurrently while preserving result order", async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrency([30, 10, 20], 2, async (delayMs, index) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(delayMs);
      active -= 1;
      return `item-${index}`;
    });

    expect(maxActive).toBe(2);
    expect(results).toEqual(["item-0", "item-1", "item-2"]);
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
