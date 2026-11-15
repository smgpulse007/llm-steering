import assert from "node:assert/strict";
import test from "node:test";
import {
  intervene2D,
  toyHiddenState,
  toyDirection,
} from "../src/lib/vectorMath.ts";

test("zero preserves the state and signed coefficients reverse the displacement", () => {
  assert.deepEqual(intervene2D(toyHiddenState, toyDirection, 0), [1, 1]);
  assert.deepEqual(intervene2D(toyHiddenState, toyDirection, 1), [1.5, 2]);
  assert.deepEqual(intervene2D(toyHiddenState, toyDirection, -2), [0, -1]);
  assert.deepEqual(intervene2D(toyHiddenState, toyDirection, 2), [2, 3]);
  assert.deepEqual(toyHiddenState, [1, 1]);
});

test("invalid numeric input is rejected instead of drawing misleading coordinates", () => {
  assert.throws(() => intervene2D([NaN, 1], toyDirection, 1), /finite/);
  assert.throws(
    () => intervene2D(toyHiddenState, toyDirection, Infinity),
    /finite/,
  );
});
