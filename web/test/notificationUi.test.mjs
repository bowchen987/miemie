import assert from "node:assert/strict";
import test from "node:test";

import { notificationButtonText } from "../public/notificationUi.js";

test("keeps the enabled label when notification permission and push subscription already exist", () => {
  assert.equal(
    notificationButtonText({
      supported: true,
      permission: "granted",
      hasSubscription: true,
      pushConfigured: true
    }),
    "后台通知已开"
  );
});

test("asks to enable notifications when permission exists but subscription is missing", () => {
  assert.equal(
    notificationButtonText({
      supported: true,
      permission: "granted",
      hasSubscription: false,
      pushConfigured: true
    }),
    "开启通知"
  );
});

test("shows unavailable states for unsupported, denied, and unconfigured push", () => {
  assert.equal(notificationButtonText({ supported: false }), "不支持通知");
  assert.equal(notificationButtonText({ supported: true, permission: "denied" }), "通知未开");
  assert.equal(
    notificationButtonText({
      supported: true,
      permission: "granted",
      hasSubscription: true,
      pushConfigured: false
    }),
    "后台通知未配置"
  );
});
