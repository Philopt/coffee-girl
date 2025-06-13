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

## Fonts

The game uses the retro, pixel-style **Press Start 2P** typeface from Google Fonts, located in `assets/fonts/`. Its license is provided in `assets/fonts/OFL.txt`.

## Running tests

Install dependencies and run the automated check:

```bash
npm install
npm test
```

The test script starts a local server and verifies the page responds without errors.

## License

This project is licensed under the [MIT License](LICENSE).

The `Press Start 2P` font included in `assets/fonts` is licensed under the
[SIL Open Font License](assets/fonts/OFL.txt).

