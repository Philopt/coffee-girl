const canvas = document.createElement('canvas');

export const baseConfig = {
  // Use WebGL so sprite tinting effects like damage flashes work correctly.
  // Phaser requires an explicit renderer type when providing a custom canvas.
  type: Phaser.WEBGL,
  parent: 'game-container',
  canvas,
  backgroundColor: '#f2e5d7',
  scale: {
    // Keep the full play area visible at all aspect ratios.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 480,
    height: 640
  },
  pixelArt: true
};
