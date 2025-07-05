# Coffee Clicker

Coffee Clicker is a small browser game built with [Phaser](https://phaser.io/). Serve coffee, earn tips and try to keep your customers happy.

## Getting Started

**Node.js 22.x is required.** Run `scripts/setup.sh` to verify your Node
version and install all dependencies. You can also run `npm install` (or
`npm ci`) directly, which performs the same version check and exits with
an error if your Node version doesn't match `22.x`.

1. From the repository root, start the local development server. If you haven't
   installed the dependencies yet, run `npm install` or `npm ci` (or
   `scripts/setup.sh`):

   ```bash
   npm install
   npm start
   ```

   This runs `http-server` on `http://localhost:8080`. Open that URL in your browser.

  Click **Clock In** when it appears to begin the game.

  Achievements appear as small icons on the phone screen. Empty slots fade in
  as you unlock endings, filling from the bottom row to the top. After every
  badge is earned, a gold coffee cup appears in its own row above the icons to
  launch the mini game. Its shadow only shows when you're one achievement away.

  The game now loads `src/game.js` as an ES module using
  `<script type="module" src="src/game.js"></script>` in `index.html`. If the page
  stays blank, open the browser console and look for messages about missing
  assets.

## Folder Layout

- `src/game.js` bootstraps the Phaser scene and re-exports helpers from `src/main.js`.
- `src/main.js` contains the bulk of the game logic.
- `src/state.js` stores the shared game state.
- `src/entities/` holds modules like `customerQueue.js` and `dog.js`.
- `assets/` stores images and other static files.
- `src/entities/wanderers.js` – wanderer movement helpers.
- `src/ui/helpers.js` – UI animation utilities.



The game uses [Phaser](https://phaser.io/). It loads `node_modules/phaser/dist/phaser.min.js` by default. If you prefer the CDN version, replace the script tag in `index.html` with:

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>
```

## Debugging

Append `?debug=1` to the game URL or set `localStorage.DEBUG = '1'` in the
browser console to enable verbose logging. For example:

```
http://localhost:8080/?debug=1
```

1. Run `npm start` and open the game in a browser.
2. If the truck never moves or "Clock In" does nothing, open the browser's developer console (usually F12).
3. With debug logging enabled (see step 5), look for messages like
   "Asset failed to load" or "init() did not execute."
   When an asset fails to load, a message now appears on the page reminding
   you to start the game with `npm start`.
4. If customers reach the counter but never order, check for
   `showDialog early exit` warnings. This usually means initialization
   failed and some UI elements were never created.
5. Verify all files in `assets/` load correctly and reload the page.
6. To enable verbose logging, add `?debug=1` to the page URL or run
   `localStorage.DEBUG = '1'` in the browser console. For example:

   ```
   http://localhost:8080/?debug=1
   ```

7. If you see errors mentioning `lockdown` or `Symbol.dispose`, disable browser
   extensions that enforce SES or "lockdown" mode. They can prevent the game
   from running.

### Debugging queue issues

When customers seem stuck wandering, enable debug mode with `?debug=1` and
watch the console. Each time a customer spawns or moves, the game logs the
current queue length, wanderer count and active customer. If no wanderers join
the queue, confirm that `lureNextWanderer` runs when the queue is empty.

## Controls

When you choose to sell or give a drink, the button briefly blinks.
After the animation finishes, the button automatically becomes
clickable again so you can quickly serve the next customer.

You can also use the keyboard:

* **A** - Refuse a customer
* **S** - Sell the order
* **D** - Give the order for free

The price text used to flash green when a sale completed. That effect
has been removed so the amount simply updates without flashing.

## Menu

Customers can now order any of the following drinks:

* Lady Roaster Drip - $3.90
* Falcon's Crest - $4.83
* Espresso - $4.25
* Macchiato - $5.00
* Petite Latte - $5.75
* Cappuccino - $6.23
* Latte - $6.97
* Mocha - $6.97
* Starry Night Latte - $6.56
* Hot Chocolate - $5.70
* Under the Pink - $5.70
* Rose Tea - $5.70
* Starry Night Tea - $5.70
* Cold Brew Iced Coffee - $6.10
* Black N' Tan - $6.80
* Chocolate Cold Brew - $6.85
* Iced Latte - $6.23
* Iced Mocha - $6.90
* Iced Hot Chocolate - $6.58
* Pink Crush - $5.70
* Iced Under the Pink - $6.10
* Iced Rose Tea - $5.70
* Iced Starry Night Tea - $5.70

## Running tests

Before running `npm test`, **you must** install all dependencies. Run `npm ci`
(or `npm install`) first, or execute `scripts/setup.sh` to do it automatically:

```bash
npm ci
```

This step installs all dev dependencies, including `eslint` and `puppeteer`.
`eslint` is executed automatically via the `pretest` script and `puppeteer`
drives a headless browser for the integration tests.

After installing the dependencies, run the automated check. `npm test` relies on
`node_modules/.bin/http-server` to start a local server and verify the page
responds without errors:

```bash
npm test
```

The test runner automatically runs `npm run lint` as part of the `pretest`
script before executing the tests.

If you only want to run the quick unit tests, set `SKIP_PUPPETEER=1` or use the
`test:unit` script. This skips the browser-based integration tests driven by
Puppeteer:

```bash
SKIP_PUPPETEER=1 npm test
# or
npm run test:unit
```

Use this when running offline or on systems without a working browser.

## GitHub Actions

This project runs a continuous integration workflow defined in
[`.github/workflows/node.yml`](.github/workflows/node.yml). The workflow runs on
pushes and pull requests, caches npm modules, then runs `npm ci` and `npm test`.

## License

This project is released under the MIT License.

The bundled copy of Phaser is also MIT licensed. See [PHASER_LICENSE.md](PHASER_LICENSE.md) for details.


