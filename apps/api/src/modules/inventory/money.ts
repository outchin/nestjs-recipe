/**
 * Money arrives from MySQL DECIMAL as a string ("199.00"). Do the arithmetic in
 * integer cents so 0.1 + 0.2 problems never reach a total.
 */
export const toCents = (amount: string): number => Math.round(Number(amount) * 100);
export const fromCents = (cents: number): string => (cents / 100).toFixed(2);
export const multiply = (unitPrice: string, quantity: number): string => fromCents(toCents(unitPrice) * quantity);
