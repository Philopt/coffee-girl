export const CustomerState = {
  NORMAL: 'normal',
  BROKEN: 'broken',
  MENDING: 'mending',
  GROWING: 'growing',
  SPARKLING: 'sparkling',
  ARROW: 'arrow',
};

export const BirdState = {
  IDLE_GROUND: 'IdleGround',
  WANDER_GROUND: 'WanderGround',
  FLY: 'Fly',
  LAND: 'Land',
  ALERT: 'Alert',
  FLEE: 'Flee',
  PERCH: 'Perch',
};

// Base scale applied to all customer sprites. Dogs use a proportion of this
// scale so shrinking customers automatically reduces dog size as well.
export const CUSTOMER_SCALE = 0.8;
// Default scale for dogs when no specific factor is provided.
export const DOG_DEFAULT_SCALE = 0.48; // 20% smaller than the previous 0.6

// San Francisco sales tax rate used for order calculations
export const SALES_TAX = 0.08625;
