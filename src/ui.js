import { ORDER_Y, WANDER_BOTTOM } from './customers.js';

export const START_PHONE_W = 260;
export const START_PHONE_H = 500;

export const BUTTON_WIDTH = 120;
export const BUTTON_HEIGHT = 80;
export const BUTTON_Y = 545;

// Default vertical position for the order dialog bubble
export const DIALOG_Y = 400;

// Wraps timing values so any global speed adjustments can be made here
let speedMultiplier = 1;
export function setSpeedMultiplier(m = 1) {
  speedMultiplier = m || 1;
}
export function getSpeedMultiplier() {
  return speedMultiplier;
}
export function dur(v) {
  return v / speedMultiplier;
}

export function scaleForY(y) {
  const minY = ORDER_Y;
  const maxY = WANDER_BOTTOM;
  const t = Phaser.Math.Clamp((y - minY) / (maxY - minY), 0, 1);
  return 0.7 + t * 0.4;
}

export function articleFor(name) {
  const first = name.trim()[0].toLowerCase();
  return 'aeiou'.includes(first) ? 'an' : 'a';
}

export function flashMoney(obj, scene, color = '#0f0') {
  let on = true;
  obj.setStyle({ stroke: '#000', strokeThickness: 3 });
  const flashes = 5;
  scene.time.addEvent({
    repeat: flashes,
    delay: dur(60),
    callback: () => {
      obj.setColor(on ? '#fff' : color);
      on = !on;
    }
  });
  scene.time.delayedCall(dur(60) * (flashes + 1) + dur(10), () => {
    obj.setColor('#000');
    obj.setStyle({ strokeThickness: 0 });
  }, [], scene);
}
