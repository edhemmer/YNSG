// A configured secret is not evidence that a merchant or a payment works.
// This probe retrieves merchant capabilities only; it never creates a charge.
export async function paymentReadiness(configured: boolean, verifyMerchant: () => Promise<unknown>) {
  if (!configured) return {status: 'connection_required', merchantVerified: false, webhookDeliveryVerified: false} as const;
  try {
    await verifyMerchant();
    return {status: 'merchant_verified', merchantVerified: true, webhookDeliveryVerified: false} as const;
  } catch {
    // Provider errors and credentials stay on the server.
    return {status: 'verification_failed', merchantVerified: false, webhookDeliveryVerified: false} as const;
  }
}
