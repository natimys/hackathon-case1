import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney } from "../src/shared/ui/format";

test("money keeps exactly two decimal places from backend amounts", () => {
  assert.match(formatMoney("1234.5"), /1\s?234,50/);
  assert.match(formatMoney("0.01"), /0,01/);
});

test("invalid financial values are not rendered as numbers", () => {
  assert.equal(formatMoney("not-money"), "—");
});
