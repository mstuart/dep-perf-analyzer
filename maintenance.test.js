import test from "ava";
import analyzeDep from "./index.js";

test("module stdout cannot corrupt measurement results", async (t) => {
  const result = await analyzeDep(
    new URL("./fixtures/noisy.mjs", import.meta.url).href,
    {
      iterations: 1,
      warmup: false,
    }
  );
  t.true(Number.isFinite(result.startupTime));
  t.true(Number.isFinite(result.memoryDelta.heapUsed));
});

test("completed measurement exits despite a module's live timer", async (t) => {
  const result = await analyzeDep(
    new URL("./fixtures/live-timer.mjs", import.meta.url).href,
    {
      iterations: 1,
      warmup: true,
    }
  );
  t.true(Number.isFinite(result.startupTime));
});
