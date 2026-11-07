const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMessageVariants } = require("../apps/api/dist/message-variants.js");

test("splits variants only on a delimiter line", () => {
  assert.deepEqual(parseMessageVariants("First line\nsecond line\n==\nThird line"), ["First line\nsecond line", "Third line"]);
});
test("accepts whitespace around delimiters and ignores empty variants", () => {
  assert.deepEqual(parseMessageVariants("  Alpha  \n  ==  \n\nBeta\n==\n  "), ["Alpha", "Beta"]);
});
test("keeps ordinary multiline messages intact", () => {
  assert.deepEqual(parseMessageVariants("Hello\nthere"), ["Hello\nthere"]);
});
