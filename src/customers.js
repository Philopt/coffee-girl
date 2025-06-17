export const MENU = [
  {name:"Lady Roaster Drip", price:3.90},
  {name:"Falcon's Crest", price:4.83},
  {name:"Espresso", price:4.25},
  {name:"Macchiato", price:5.00},
  {name:"Petite Latte", price:5.75},
  {name:"Cappuccino", price:6.23},
  {name:"Latte", price:6.97},
  {name:"Mocha", price:6.97},
  {name:"Starry Night Latte", price:6.56},
  {name:"Hot Chocolate", price:5.70},
  {name:"Under the Pink", price:5.70},
  {name:"Rose Tea", price:5.70},
  {name:"Starry Night Tea", price:5.70},
  {name:"Cold Brew Iced Coffee", price:6.10},
  {name:"Black N' Tan", price:6.80},
  {name:"Chocolate Cold Brew", price:6.85},
  {name:"Iced Latte", price:6.23},
  {name:"Iced Mocha", price:6.90},
  {name:"Iced Hot Chocolate", price:6.58},
  {name:"Pink Crush", price:5.70},
  {name:"Iced Under the Pink", price:6.10},
  {name:"Iced Rose Tea", price:5.70},
  {name:"Iced Starry Night Tea", price:5.70}
];

export const SPAWN_DELAY = 2000;
export const SPAWN_VARIANCE = 1500;
export const QUEUE_SPACING = 36;
export const ORDER_X = 230;
export const ORDER_Y = 310;
export const QUEUE_X = ORDER_X - QUEUE_SPACING - 10;
export const QUEUE_OFFSET = 8;
export const QUEUE_Y = ORDER_Y + 5;
export const WANDER_TOP = ORDER_Y + 50;
export const WANDER_BOTTOM = 580;
// Number of wanderers that can roam around at love level 1.
// Increasing this to 5 lets more customers appear when testing
// the expanded queue capacity.
export const BASE_WAITERS = 5;
export const WALK_OFF_BASE = 800;
export const MAX_M = 100;
export const MAX_L = 100;

// Base queue capacity when the game starts. Previously the queue limit
// depended solely on the player's love level, which meant only two
// customers could line up at the beginning (love level 1). For testing
// purposes we want a larger starting capacity so we can more easily
// observe queue behaviour. Setting this to 5 allows up to five people to
// queue right away.
export const MIN_QUEUE_LIMIT = 5;

export function calcLoveLevel(v) {
  if (v >= 100) return 4;
  if (v >= 50) return 3;
  if (v >= 20) return 2;
  return 1;
}

export function maxWanderers(love) {
  return BASE_WAITERS + calcLoveLevel(love) - 1;
}

export function queueLimit(love) {
  // allow one person waiting even at level 1 and ensure a minimum
  // queue size for easier debugging during early gameplay
  return Math.max(MIN_QUEUE_LIMIT, calcLoveLevel(love) + 1);
}
