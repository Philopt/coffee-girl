After adding logging around the start screen and intro sequence, running the game shows that the pointerdown event fires when the "Clock In" button is clicked. `playIntro` begins immediately and the timeline completes, triggering the spawn of the first customer. These logs help confirm input registration and intro flow.

When debug mode is enabled, `lureNextWanderer` now prints a message when an
active `walkTween` blocks another wanderer from moving into the queue. This
helps explain why the queue might appear stuck.
