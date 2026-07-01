export function createPushNotifier({ publicKey, privateKey, subject = "mailto:hello@miemie.app", webpush } = {}) {
  const cleanPublicKey = String(publicKey ?? "").trim();
  const cleanPrivateKey = String(privateKey ?? "").trim();

  if (!cleanPublicKey || !cleanPrivateKey) {
    return null;
  }

  webpush.setVapidDetails(subject, cleanPublicKey, cleanPrivateKey);

  return {
    publicKey: cleanPublicKey,
    sendNotification(subscription, payload) {
      return webpush.sendNotification(subscription, JSON.stringify(payload));
    }
  };
}
