While testing the new pup cup power-up, the dog's heart emoji continued to block the sparkle animation. The heart text is repositioned in `updateDog`, so hiding it must also set its alpha to `0`. The treat emoji also remained visible briefly. Adding explicit `setVisible(false)` calls resolves this.

Next steps:
- Verify the heart emoji stays hidden for the entire power-up
- Confirm the dog grows noticeably after the animation
