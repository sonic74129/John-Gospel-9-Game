import assert from "node:assert/strict";
import test from "node:test";

import { createViewportResizeTransaction } from "../../src/platform/viewport-resize-transaction.ts";

test("inactive viewport changes coalesce and apply exactly once after resume", () => {
  let ready = false;
  const applied = [];
  const transaction = createViewportResizeTransaction({
    isReady: () => ready,
    apply: (size) => applied.push({ ...size }),
  });

  assert.equal(transaction.queue({ width: 390, height: 844 }), false);
  assert.equal(transaction.queue({ width: 844, height: 390 }), false);
  assert.equal(transaction.queue({ width: 412, height: 915 }), false);
  assert.deepEqual(transaction.pending, { width: 412, height: 915 });
  assert.deepEqual(applied, []);

  ready = true;
  assert.equal(transaction.flush(), true);
  assert.deepEqual(applied, [{ width: 412, height: 915 }]);
  assert.equal(transaction.pending, null);
  assert.equal(transaction.flush(), false);
});

test("a failed camera application remains pending instead of reporting completion", () => {
  let shouldFail = true;
  const transaction = createViewportResizeTransaction({
    isReady: () => true,
    apply: () => {
      if (shouldFail) {
        throw new Error("camera apply failed");
      }
    },
  });

  assert.throws(
    () => transaction.queue({ width: 390, height: 844 }),
    /camera apply failed/,
  );
  assert.deepEqual(transaction.pending, { width: 390, height: 844 });
  shouldFail = false;
  assert.equal(transaction.flush(), true);
  assert.equal(transaction.pending, null);
});

test("teardown cancels pending resize work permanently", () => {
  let ready = false;
  let applications = 0;
  const transaction = createViewportResizeTransaction({
    isReady: () => ready,
    apply: () => {
      applications += 1;
    },
  });

  transaction.queue({ width: 844, height: 390 });
  transaction.cancel();
  ready = true;
  assert.equal(transaction.pending, null);
  assert.equal(transaction.flush(), false);
  assert.equal(transaction.queue({ width: 390, height: 844 }), false);
  assert.equal(applications, 0);
});
