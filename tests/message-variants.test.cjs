const test = require("node:test");
const assert = require("node:assert/strict");
process.env.DEVICE_TOKEN_SECRET = "unit-test-device-token-secret-at-least-32-chars";
const { parseMessageVariants } = require("../apps/api/dist/message-variants.js");
const { SendingService } = require("../apps/api/dist/sending.service.js");

test("splits variants only on a delimiter line", () => {
  assert.deepEqual(parseMessageVariants("First line\nsecond line\n==\nThird line"), ["First line\nsecond line", "Third line"]);
});
test("accepts whitespace around delimiters and ignores empty variants", () => {
  assert.deepEqual(parseMessageVariants("  Alpha  \n  ==  \n\nBeta\n==\n  "), ["Alpha", "Beta"]);
});
test("keeps ordinary multiline messages intact", () => {
  assert.deepEqual(parseMessageVariants("Hello\nthere"), ["Hello\nthere"]);
});

test("batch preview locks the campaign and keeps multiline message text", async () => {
  let lockQuery = "";
  let createdMessage = "";
  const tx = {
    $queryRawUnsafe: async (query) => { lockQuery = query; return []; },
    campaign: { findUnique: async () => ({ id: "campaign", status: "DRAFT", batchSize: 10, messageSet: "first line\nsecond line\n==\nsecond variant", devices: [{ deviceId: "device" }] }) },
    device: { findUnique: async () => ({ id: "device", active: true }) },
    suppression: { findMany: async () => [] },
    campaignRecipient: { findMany: async () => [{ id: "recipient", phone: "+14155550123" }] },
    batchRecipient: { count: async () => 0 },
    campaignBatch: { create: async ({ data }) => {
      createdMessage = data.recipients.create[0].message;
      return { id: "batch", status: "PENDING_APPROVAL", recipients: [{ id: "item", recipient: { phone: "+14155550123" } }] };
    } },
  };
  const service = new SendingService({ $transaction: (callback) => callback(tx) }, {});
  const result = await service.previewBatch("campaign", "device");
  assert.match(lockQuery, /FOR UPDATE/);
  assert.equal(createdMessage, "first line\nsecond line");
  assert.equal(result.recipient_count, 1);
});

for (const campaignStatus of ["PAUSED", "STOPPED"]) {
  test("accepts already-started device reports when campaign is " + campaignStatus, async () => {
    const recipientUpdates = [];
    const prisma = {
      device: { findUnique: async () => ({ id: "device", active: true }) },
      campaignBatch: {
        findUnique: async () => ({ id: "batch", deviceId: "device", status: "IN_PROGRESS", campaign: { status: campaignStatus } }),
        update: async () => ({}),
      },
      batchRecipient: {
        findMany: async () => [{ id: "item", recipientId: "recipient" }],
        updateMany: async () => ({ count: 1 }),
        count: async () => 0,
      },
      campaignRecipient: { updateMany: async (args) => { recipientUpdates.push(args); return { count: 1 }; } },
    };
    const service = new SendingService(prisma, {});
    const result = await service.report("device-token-for-test", "batch", [{ item_id: "item", status: "SENT" }]);
    assert.equal(result.updated, 1);
    assert.deepEqual(recipientUpdates[0].where.status, { not: "OPTED_OUT" });
  });
}
