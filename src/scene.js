const canvas = document.createElement('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });

export const baseConfig = {
  type: Phaser.AUTO,
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
