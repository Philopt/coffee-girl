# Coffee Clicker Narrative and Endings

This game is about running a coffee truck under Lady Falcon's ownership while balancing money and human connection.

## Core loop

- Customers approach and order drinks.
- You can **Sell**, **Give**, or **Refuse**.
- Your choices move two key stats:
  - **Money** (business pressure)
  - **Love** (community goodwill)

## Endings

### 1) Fired ending (high-money trap)

If money reaches the fired threshold, Lady Falcon arrives and fires you.

- Theme: doing the "right" corporate thing still hurts the worker.
- Badge: `fired_end`

### 2) Falcon loss (money collapse)

If money drops to zero or below before the true-defense condition, Lady Falcon reclaims the truck.

- Theme: total financial collapse gets punished.
- Badge: `falcon_end`

### 3) Customer revolt ending (love collapse)

If love drops to zero or below, customers turn on you.

- Theme: neglecting people leads to backlash.
- Badge: `revolt_end`

### 4) Muse ending (love overflow)

If love grows too high, admiration becomes overwhelming and chaotic.

- Theme: even being beloved has a cost.
- Badge: `muse_victory`

### 5) True ending (community defense)

If Lady Falcon attacks while you've built enough love/support, customers defend you and Lady Falcon can be defeated.

- Theme: solidarity protects workers where money alone does not.
- Badge: `falcon_victory`

## Design intent guardrails

When changing gameplay, preserve these themes:

1. The game should never become a simple "maximize money to win" loop.
2. Love should matter mechanically, not only cosmetically.
3. The true ending should feel earned through care for people, not grindy optimization.
4. Endings should remain bittersweet and political, not purely power-fantasy.
