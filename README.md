# Coffee Clicker

Coffee Clicker is a small browser game built with [Phaser](https://phaser.io/). Serve coffee, earn tips and try to keep your customers happy.

## Getting Started

1. From the repository root, start the local development server. If you haven't
   installed the dependencies yet, run `npm install` or `npm ci` (or
   `scripts/setup.sh`):

   ```bash
   npm install
   npm start
   ```

   This runs `http-server` on `http://localhost:8080`. Open that URL in your browser.

   Click **Clock In** when it appears to begin the game.

   The game now loads `src/main.js` with a standard `<script src="src/main.js" defer></script>` tag
   in `index.html`. If the page stays blank, open the browser console and look for
   messages about missing assets.



The game uses [Phaser](https://phaser.io/). It will load `lib/phaser.min.js` by default. If you prefer the CDN version, replace the script tag in `index.html` with:

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>
```

## Debugging

1. Run `npm start` and open the game in a browser.
2. If the truck never moves or "Clock In" does nothing, open the browser's developer console (usually F12).
3. With debug logging enabled (see step 5), look for messages like
   "Asset failed to load" or "init() did not execute."
4. Verify all files in `assets/` load correctly and reload the page.
5. To enable verbose logging, add `?debug=1` to the page URL or run
   `localStorage.DEBUG = '1'` in the browser console. For example:

   ```
   http://localhost:8080/?debug=1
   ```

## Controls

When you choose to sell or give a drink, the button briefly blinks.
After the animation finishes, the button automatically becomes
clickable again so you can quickly serve the next customer.

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

## GitHub Actions

This project runs a continuous integration workflow defined in
[`.github/workflows/node.yml`](.github/workflows/node.yml). The workflow runs on
pushes and pull requests, caches npm modules, then runs `npm ci` and `npm test`.

## License

This project is released under the MIT License.

The bundled copy of Phaser is also MIT licensed. See [PHASER_LICENSE.md](PHASER_LICENSE.md) for details.


