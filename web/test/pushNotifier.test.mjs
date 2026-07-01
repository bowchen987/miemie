import assert from "node:assert/strict";
import test from "node:test";

import { createPushNotifier } from "../server/pushNotifier.mjs";

test("disables background push when VAPID keys are missing", () => {
  assert.equal(createPushNotifier({ publicKey: "", privateKey: "private" }), null);
  assert.equal(createPushNotifier({ publicKey: "public", privateKey: "" }), null);
});

test("configures VAPID details and sends JSON push payloads", async () => {
  const calls = [];
  const webpush = {
    setVapidDetails: (...args) => calls.push(["setVapidDetails", ...args]),
    sendNotification: async (...args) => calls.push(["sendNotification", ...args])
  };

  const notifier = createPushNotifier({
    publicKey: "public",
    privateKey: "private",
    subject: "mailto:family@example.com",
    webpush
  });

  assert.equal(notifier.publicKey, "public");
  await notifier.sendNotification({ endpoint: "https://push.example/device" }, { title: "miemie", body: "有新留言" });

  assert.deepEqual(calls, [
    ["setVapidDetails", "mailto:family@example.com", "public", "private"],
    [
      "sendNotification",
      { endpoint: "https://push.example/device" },
      JSON.stringify({ title: "miemie", body: "有新留言" })
    ]
  ]);
});
