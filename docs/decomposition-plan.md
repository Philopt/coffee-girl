# Decomposition plan for `src/main.js` and `src/intro.js`

## Goals (first pass)
- Extract cohesive subsystems into `src/features/...` modules with **no behavior changes**.
- Keep `src/main.js` as orchestration/bootstrap glue.
- Prioritize **lowest-risk, highest-churn** code first (state transitions + UI state updates).
- Add/adjust unit tests after each extraction, focusing first on pure logic and deterministic state transitions.

## Domain map by distinctive identifiers

### 1) Stat/cloud rendering and animation (high churn, low risk first)
Primary identifiers in `src/main.js`:
- `frameForStat`
- `updateCloudStatus`
- `updateCloudPulse`
- `updateCloudPositions`
- `applyHeartScale`
- `stopHighMoneyEffects`
- `createCloudPuff`
- `cloudExplosion`
- `emitMoneyEmoji`
- `updateHighMoneyEffects`
- `updateMoneyDisplay`
- `updateMoneyStatus`
- `animateStatChange`

### 2) Customer dialog + serving flow
Primary identifiers in `src/main.js`:
- `drawDialogBubble`
- `showDialog`
- nested helpers around dialog clear/reset (`clearDialog`)
- serving/ticket flow (`flingTicketEmojiToCustomer`, `handleAction`)
- button state transitions (`fadeInButtons`, `blowButtonsAway`, `startSellGlowSparkle`, `startGiveSparkle`)

### 3) End-sequence orchestration
Primary identifiers in `src/main.js`:
- `startFiredSequence`
- `startLoveSequence`
- revolt and failover sequences (`showCustomerRevolt`, `showCustomerRevoltLoss`)
- panic/finale helpers (e.g., `panicCustomers`, bark/falcon sequence helpers)
- badge awarding entrypoint (`awardBadge`) when tied to ending transitions

### 4) Achievement + phone/start UI flow
Primary identifiers in `src/intro.js`:
- `hideStartMessages`, `hideStartScreen`
- `updateSongIcons`
- opening/start flow (`playOpening`, `startOpeningAnimation`, `dropOpeningNumber`, `showStartScreen`, `playIntro`)
- layout/UI helpers (`getSlot`)
- scene-level transitions around badges/phone container and song toggles

## Proposed module structure

```text
src/features/
  stats/
    cloudStatus.js          # frame selection, cloud position math, status message resolution
    cloudEffects.js         # high-money pulse/emoji timing orchestration
  customer/
    dialogFlow.js           # dialog model/state transitions and bubble content selection
    servingFlow.js          # action-to-state transition rules, ticket/serve/refuse outcomes
    actionButtons.js        # button visibility/enable/glow transition orchestration
  endings/
    sequenceGuards.js       # threshold checks and transition gating
    firedSequence.js        # fired sequence timeline orchestration
    loveSequence.js         # love/muse sequence timeline orchestration
    revoltSequence.js       # revolt/failure sequence orchestration
  intro/
    openingSequence.js      # title/dog/number drop + confetti timeline wiring
    startPhoneUI.js         # phone container, badges/song icon UI state updates
    startScreenFlow.js      # show/hide/reset/CTA + persistence entrypoints
```

## Extraction order (one domain at a time)

### Phase 0 — Baseline safety net
1. Add characterization tests around current state/UI transition behavior before moving code.
2. Freeze existing public behavior via tests in `test/unit` for pure logic and `test/integration` for key flows.

Suggested initial tests:
- `frameForStat` boundary mapping.
- cloud Y-position mapping from money/love to display range.
- money status message selection (`NO OVERSIGHT`, `NO END`, `NO LIMIT`, hidden case).
- threshold guards that trigger fired/love sequences.

### Phase 1 — Extract stat/cloud subsystem (first)
1. Move pure logic first to `src/features/stats/cloudStatus.js`:
   - `frameForStat`
   - ratio/position calculations currently embedded in `updateCloudPositions`
   - money status text resolution now in `updateMoneyStatus`
2. Export deterministic helpers; keep Phaser object mutation wrappers in `main.js` initially.
3. Then move effect orchestration (`cloudExplosion`, high-money event cadence) into `cloudEffects.js` with explicit dependency injection (`scene`, sprite refs, state accessors).
4. Replace inline function bodies in `main.js` with thin calls into new modules.

Tests after Phase 1:
- Unit tests for pure mapping helpers.
- Unit tests for status-text resolver.
- Targeted integration check that cloud updates still run without regressions.

### Phase 2 — Extract customer dialog/serving flow
1. Pull pure decision logic from `showDialog` / `handleAction` into `src/features/customer/dialogFlow.js` and `servingFlow.js`.
2. Split data derivation from side effects:
   - `deriveDialogState(customer, gameState)` (pure)
   - `resolveActionOutcome(type, customerState, gameState)` (pure)
3. Keep rendering/tween side effects in `main.js` wrappers until logic is validated.
4. Move button transition orchestration to `actionButtons.js` once dialog/serving logic is stable.

Tests after Phase 2:
- Table-driven unit tests for action outcomes by customer mood/state.
- Unit tests for dialog text/emoji selection rules.
- Regression tests for UI enable/disable transitions during action handling.

### Phase 3 — Extract end-sequence orchestration
1. Introduce `sequenceGuards.js` for transition predicates (fired threshold, love threshold, falcon/revolt guards).
2. Move sequence orchestration progressively:
   - `firedSequence.js`
   - `loveSequence.js`
   - `revoltSequence.js`
3. Keep shared cleanup/animation helpers injectable to avoid hidden globals.
4. Preserve exact timing constants on first pass; no tuning changes.

Tests after Phase 3:
- Unit tests for sequence guard predicates.
- Integration tests that only one terminal sequence starts under conflicting conditions.
- Smoke tests for cleanup calls and badge award dispatch.

### Phase 4 — Extract intro achievement/phone UI flow (`src/intro.js`)
1. Move pure slot/layout + icon-state decisions into `src/features/intro/startPhoneUI.js`.
2. Move opening timeline assembly into `openingSequence.js`.
3. Move start screen show/hide/reset orchestration into `startScreenFlow.js`.
4. Keep `src/intro.js` as compatibility facade exporting `playOpening`, `showStartScreen`, `playIntro`.

Tests after Phase 4:
- Unit tests for slot clamping and song-icon selection rules.
- Integration test for start screen visibility toggles and badge/song state sync.

## `main.js` and `intro.js` end-state responsibilities

### `src/main.js`
- Composition root: wire Phaser scene lifecycle, instantiate shared state references, and connect feature module calls.
- Contains minimal imperative glue and explicit imports from `src/features/...`.

### `src/intro.js`
- Thin adapter that wires scene hooks to extracted intro modules.
- Keeps backward-compatible exports used by `main.js`.

## Refactor constraints to enforce each step
- No behavior changes in the first extraction pass.
- Move code in small commits (one domain/module move per commit).
- Prefer explicit dependencies over cross-module mutable globals.
- Preserve constant values and existing timing on first pass.
- Add tests immediately after each extraction before starting next domain.
