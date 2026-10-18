// World-anchored service tags and hold ring (07 §6.4, §4.13).
export const SHOP_UI = { tagBelow: 3, textGap: 1, border: 1, ringDots: 16, ringRadius: 8, ringDot: 1,
  ringAfterTicks: 12, sellTicks: 90, promptAbove: 4, promptH: 32, blinkHz: 8, blinkTicks: 30,
  market: { x: 112, feetY: 320 }, inn: { x: 624, y: 160 }, shopkeeper: { x: 128, y: 320 }, innkeeper: { x: 712, y: 320 }, merchant: { x: 88, y: 320 },
} as const;
