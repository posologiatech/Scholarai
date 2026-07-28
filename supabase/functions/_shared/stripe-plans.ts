// Stripe Product ID -> internal plan key.
// Verified against the live Product catalog (2026-07-28): each plan has a
// separate monthly and annual Product (4 products total), not one product
// with two prices. Keep this in sync if products are ever recreated.
export const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U6tEyDaPN1jKj3": "pro",   // Arca Research Pro (Mensal)
  "prod_U6tFGYtgF4owef": "pro",   // Arca Research Pro (Anual)
  "prod_U6tGI9ClLU529W": "team",  // Arca Research Team (Mensal)
  "prod_U6tHTLdjcNy4g1": "team",  // Arca Research Team (Anual)
};

export function planFromProductId(productId: string | null | undefined): string {
  if (!productId) return "pro";
  const plan = PRODUCT_TO_PLAN[productId];
  if (!plan) {
    console.error(`[stripe-plans] Unrecognized Stripe product ID "${productId}" — defaulting to "pro". Update PRODUCT_TO_PLAN if a new price was added.`);
    return "pro";
  }
  return plan;
}
