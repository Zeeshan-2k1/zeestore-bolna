export const PROMOTIONAL_OFFERS = [
  "Buy 2 Get 1 Free on selected styles",
  "10% off on your order today",
  "Rupees 200 off on your next order",
] as const;

export function pickRandomPromotionalOffer(): string {
  return PROMOTIONAL_OFFERS[Math.floor(Math.random() * PROMOTIONAL_OFFERS.length)];
}
