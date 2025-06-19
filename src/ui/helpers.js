export function flashBorder(rect, scene, color=0x00ff00){
  if(!rect || !rect.setStrokeStyle) return;
  const original=rect.strokeColor||0x000000;
  let on=false;
  const flashes=4;
  scene.time.addEvent({
    repeat:flashes,
    delay:scene.dur ? scene.dur(60) : 60,
    callback:()=>{
      rect.setStrokeStyle(2, on?color:original);
      on=!on;
    }
  });
  scene.time.delayedCall((scene.dur ? scene.dur(60) : 60)*(flashes+1)+(scene.dur?scene.dur(10):10),()=>{
    rect.setStrokeStyle(2, original);
  },[],scene);
}

export function flashFill(rect, scene, color=0x00ff00){
  if(!rect || !rect.setFillStyle) return;
  const original=rect.fillColor||0xffffff;
  let on=false;
  const flashes=4;
  scene.time.addEvent({
    repeat:flashes,
    delay:scene.dur ? scene.dur(60) : 60,
    callback:()=>{
      rect.setFillStyle(on?color:original,1);
      on=!on;
    }
  });
  scene.time.delayedCall((scene.dur?scene.dur(60):60)*(flashes+1)+(scene.dur?scene.dur(10):10),()=>{
    rect.setFillStyle(original,1);
  },[],scene);
}

export function blinkButton(btn, onComplete, inputObj){
  const target = inputObj || btn;
  if (target.input) {
    target.input.enabled = false;
  }
  this.tweens.add({
    targets: btn,
    alpha: 0,
    yoyo: true,
    duration: this.dur ? this.dur(80) : 80,
    repeat: 1,
    onComplete: () => {
      if (target.input) {
        target.input.enabled = true;
      }
      if (onComplete) onComplete();
    }
  });
}

export function applyRandomSkew(obj){
  if(!obj) return;
  const randFloat = Phaser.Math.FloatBetween || ((a,b)=>Phaser.Math.Between(a*1000,b*1000)/1000);
  obj.skewX = randFloat(-0.03, 0.03);
  obj.skewY = randFloat(-0.03, 0.03);
}

export function emphasizePrice(text){
  if(!text || !text.setStyle) return;
  text.setStyle({fontStyle:'bold', stroke:'#fff', strokeThickness:2});
}

/**
 * Briefly flash a colored border around a text object.
 *
 * @param {Phaser.GameObjects.Text} text - Text to outline.
 * @param {Phaser.Scene} scene - Scene providing timers.
 * @param {string} [color="#fff"] - Stroke color used when the border is visible.
 * @param {number} [thickness=2] - Thickness of the temporary border.
 */
export function blinkPriceBorder(text, scene, color="#fff", thickness=2){
  if(!text || !text.setStroke) return;
  const originalColor = text.style.stroke || '#fff';
  const originalThickness = text.style.strokeThickness || 0;
  let on=false;
  const flashes=4;
  scene.time.addEvent({
    repeat:flashes,
    delay:scene.dur ? scene.dur(60) : 60,
    callback:()=>{
      text.setStroke(color, on?thickness:0);
      on=!on;
    }
  });
  scene.time.delayedCall((scene.dur?scene.dur(60):60)*(flashes+1)+(scene.dur?scene.dur(10):10),()=>{
    text.setStroke(originalColor, originalThickness);
  },[],scene);
}

export { blinkButton as default };
