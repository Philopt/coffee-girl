# Coffee Clicker

Coffee Clicker is a small browser game built with [Phaser](https://phaser.io/). Serve coffee, earn tips and try to keep your customers happy.

## Getting Started

1. From the repository root, run a simple local HTTP server:

   ```bash
   python3 -m http.server
   ```

   Then navigate to `http://localhost:8000` in your browser.

   The game must be accessed via `http://` either locally or on any static host. Opening `index.html` directly will not load all assets correctly.

The game uses [Phaser](https://phaser.io/). It will load `lib/phaser.min.js` by default. If you prefer the CDN version, replace the script tag in `index.html` with:

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>
```

If the game fails to start, check your browser's console for errors.

Have fun clicking!

## Running tests

Install dependencies and run the headless test:

```bash
npm install
npm test
```

This uses Puppeteer to launch the game in a headless browser and checks that all assets load without errors.

## License

This project is licensed under the [MIT License](LICENSE).

