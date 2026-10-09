export function isFlutterwaveCheckoutConfigured(env:unknown){
  const values=env as Record<string,unknown>|null|undefined;
  return Boolean(
    String(values?.FLUTTERWAVE_CHECKOUT_BROKER_URL||"").trim() &&
    String(values?.FLUTTERWAVE_CHECKOUT_BROKER_SECRET||"").trim()
  );
}
