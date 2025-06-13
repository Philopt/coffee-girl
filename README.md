# Coffee Clicker

Coffee Clicker is a small browser game built with [Phaser](https://phaser.io/). Serve coffee, earn tips and try to keep your customers happy.

## Getting Started

1. From the repository root, run a simple local HTTP server:

   ```bash
   python3 -m http.server
   ```

   Then navigate to `http://localhost:8000` in your browser.

   The game must be accessed via `http://` either locally or on any static host. Opening `index.html` directly will not load all assets correctly. Fonts and images are served from the `assets` directory, so either `python3 -m http.server` or `npm start` must be running for them to load.

The game uses [Phaser](https://phaser.io/). It will load `lib/phaser.min.js` by default. If you prefer the CDN version, replace the script tag in `index.html` with:

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>
```

If the game fails to start, check your browser's console for errors.

Have fun clicking!

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

Before running the tests, install all dependencies:

```bash
npm install
```

Then run the automated check. `npm test` relies on `node_modules/.bin/http-server` to start a local server and verify the page responds without errors:

```bash
npm test
```

## License

This project is licensed under the [MIT License](LICENSE).

The `Press Start 2P` font is licensed under the
[SIL Open Font License](assets/fonts/OFL.txt). The license text is included in
`assets/fonts/OFL.txt` for reference.

