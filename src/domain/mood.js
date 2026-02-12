import { CustomerState } from '../constants.js';

/**
 * Saturating mood progression for successful drink interactions.
 *
 * Policy decision: ARROW is terminal for growth and remains ARROW.
 */
export function advanceMood(state) {
  switch (state) {
    case CustomerState.BROKEN:
      return CustomerState.MENDING;
    case CustomerState.MENDING:
      return CustomerState.NORMAL;
    case CustomerState.NORMAL:
      return CustomerState.GROWING;
    case CustomerState.GROWING:
      return CustomerState.SPARKLING;
    case CustomerState.SPARKLING:
      return CustomerState.ARROW;
    case CustomerState.ARROW:
      return CustomerState.ARROW;
    default:
      return state;
  }
}

/**
 * Looping mood progression used where continuous rotation is desired.
 *
 * Policy decision: ARROW cycles back to BROKEN so every state can reappear.
 */
export function cycleMood(state) {
  switch (state) {
    case CustomerState.BROKEN:
      return CustomerState.MENDING;
    case CustomerState.MENDING:
      return CustomerState.NORMAL;
    case CustomerState.NORMAL:
      return CustomerState.GROWING;
    case CustomerState.GROWING:
      return CustomerState.SPARKLING;
    case CustomerState.SPARKLING:
      return CustomerState.ARROW;
    case CustomerState.ARROW:
      return CustomerState.BROKEN;
    default:
      return CustomerState.NORMAL;
  }
}

// Backwards-compatible alias for existing usage/tests that refer to nextMood.
export const nextMood = advanceMood;
