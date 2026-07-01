export function notificationButtonText({ supported, permission = "default", hasSubscription = false, pushConfigured = true }) {
  if (!supported) {
    return "不支持通知";
  }
  if (permission === "denied") {
    return "通知未开";
  }
  if (permission === "granted" && !pushConfigured) {
    return "后台通知未配置";
  }
  if (permission === "granted" && hasSubscription) {
    return "后台通知已开";
  }
  return "开启通知";
}
