const canvas = document.createElement('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });

export const baseConfig = {
  // Explicitly use the Canvas renderer when providing a custom canvas/context.
  // Phaser throws "Must set explicit renderType in custom environment" if
  // `Phaser.AUTO` is used with a predefined canvas or context.
  type: Phaser.CANVAS,
  parent: 'game-container',
  canvas,
  context,
  backgroundColor: '#f2e5d7',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 480,
    height: 640
  },
  pixelArt: true
};
