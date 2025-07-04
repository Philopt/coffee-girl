const canvas = document.createElement('canvas');

export const baseConfig = {
  // Use WebGL so sprite tinting effects like damage flashes work correctly.
  // Phaser requires an explicit renderer type when providing a custom canvas.
  type: Phaser.WEBGL,
  parent: 'game-container',
  canvas,
  backgroundColor: '#f2e5d7',
  scale: {
    // Fill the screen vertically on mobile and crop the sides
    // instead of adding letterbox bars.
    mode: Phaser.Scale.ENVELOP,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 480,
    height: 640
  },
  pixelArt: true
};
