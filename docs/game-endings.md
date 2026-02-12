# Coffee Clicker ending guide

This project has **five story outcomes**. They are intentionally ironic: the
player can be punished for doing the "obvious" thing and rewarded for balancing
money with care.

## Endings

1. **Fired ending (`fired_end`)**
   - Trigger: money reaches the fired threshold (`FIRED_THRESHOLD`, currently
     100) before defeating Lady Falcon.
   - Theme: you made strong profits for the owner, then still got fired.

2. **Lady Falcon loss (`falcon_end`)**
   - Trigger: money falls to zero or below before you build enough support.
   - Theme: Lady Falcon takes the truck back by force.

3. **Customer revolt (`revolt_end`)**
   - Trigger: love falls to zero or below.
   - Theme: customers turn on you when the relationship collapses.

4. **Muse ending (`muse_victory`)**
   - Trigger: love rises above the max love threshold (`MAX_L`).
   - Theme: everyone adores Coffee Girl so intensely it becomes overwhelming.

5. **True ending (`falcon_victory`)**
   - Trigger: Lady Falcon attack sequence begins from low money, but the player
     has built enough support and defeats Lady Falcon.
   - Theme: community care and loyalty protect Coffee Girl.

## Design intent

The intended arc is **control vs. care**:

- Pure profit can backfire.
- Pure generosity can also backfire.
- Lasting success comes from balancing money and human connection.

When adding features, keep those tensions visible in UI text, tutorial hints,
and ending conditions.
