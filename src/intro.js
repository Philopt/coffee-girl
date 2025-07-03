import { START_PHONE_W, START_PHONE_H } from './ui.js';
import { lureNextWanderer, scheduleNextSpawn, queueLimit } from './entities/customerQueue.js';
import { resumeWanderer } from './entities/wanderers.js';
import { GameState } from './state.js';
import { debugLog, DEBUG } from './debug.js';
import { dur } from './ui.js';
import { spawnSparrow, scatterSparrows } from './sparrow.js';
import { createGrayscaleTexture } from './ui/helpers.js';

let startOverlay = null;
let startButton = null;
let phoneContainer = null;
let startWhite = null;
let startMsgTimers = [];
let startMsgBubbles = [];
let openingTitle = null;
let openingNumber = null;
let openingDog = null;
let badgeIcons = [];
let miniGameCup = null;

function hideStartMessages(){
  startMsgTimers.forEach(t=>t.remove(false));
  startMsgTimers=[];
  startMsgBubbles.forEach(b=>b.destroy());
  startMsgBubbles=[];
}

function playOpening(scene){
  scene = scene || this;
  startWhite = scene.add.rectangle(240,320,480,640,0xffffff,1)
    .setDepth(14);

  // Title card image starts large so it can shrink with the phone later
  openingTitle = scene.add.image(240,320,'titlecard')
    .setOrigin(0.5)
    .setDepth(15)
    .setAlpha(0)
    .setScale(2);

  // Girl and dog initially hidden behind the title card
  openingDog = scene.add.image(240,320,'girldog')
    .setOrigin(0.5)
    .setDepth(14)
    .setAlpha(0)
    .setScale(1.5);

  // Number 2 graphic enters like a shooting star
  const startX = (scene.scale && scene.scale.width) ? -80 : -80;
  const startY = -80;
  openingNumber = scene.add.image(startX, startY, 'title2')
    .setOrigin(0.5)
    .setDepth(16)
    .setAlpha(1)
    .setScale(2.6)
    .setAngle(-45);

  const tl = scene.tweens.createTimeline({callbackScope:scene,onComplete:()=>{
    if (startWhite) { startWhite.destroy(); startWhite = null; }
  }});

  // Reveal the title card with a burst of coffee cups
  tl.add({targets:openingTitle,alpha:1,duration:400,ease:'Sine.easeOut',delay:100});
  tl.setCallback('onStart',()=>{
    for(let i=0;i<8;i++){
      const angle = Phaser.Math.DegToRad(Phaser.Math.Between(0,360));
      const dist = Phaser.Math.Between(80,200);
      const cup = scene.add.image(openingTitle.x,openingTitle.y,'coffeecup2')
        .setDepth(17)
        .setScale(1.2);
      scene.tweens.add({
        targets:cup,
        x:openingTitle.x + Math.cos(angle)*dist,
        y:openingTitle.y + Math.sin(angle)*dist,
        angle:Phaser.Math.Between(-360,360),
        alpha:0,
        duration:1000,
        ease:'Cubic.easeOut',
        onComplete:()=>cup.destroy()
      });
    }
    // Spawn the minigame button cup during the explosion
    // Position it where the "2" lands so it bursts from the right
    miniGameCup = scene.add
      .image(finalX, finalY, 'coffeecup2')
      .setDepth(17)
      .setScale(0.1)
      .setAlpha(0);
  }, []);

  tl.add({
    targets: openingDog,
    alpha: 1,
    scale: 2,
    y: openingTitle.y - 101,
    duration: 600,
    ease: 'Sine.easeOut',
    onComplete: () => openingDog.setDepth(16)
  });

  // Shift the landing position slightly so the 2 settles a bit further
  // to the right and lower on the title card. Round the coordinates to
  // avoid fractional positions that sometimes caused the sprite to land
  // inconsistently relative to the phone container.
  const finalX = Math.round(
    openingTitle.x +
    openingTitle.displayWidth / 2 -
    openingNumber.displayWidth / 2 +
    25
  ); // shift further right
  const finalY = Math.round(
    openingTitle.y +
    openingTitle.displayHeight / 2 -
    openingNumber.displayHeight / 2 +
    10
  );
  // Save for later so we can reposition the number after the phone zooms out
  openingNumber.finalPos = { x: finalX, y: finalY };

  const spawnThrust = (scale=2) => {
    const ang = Phaser.Math.DegToRad(Phaser.Math.Between(240, 300));
    const dist = Phaser.Math.Between(80, 160);
    const cup = scene.add.image(openingNumber.x, openingNumber.y, 'coffeecup2')
      .setDepth(17)
      .setScale(scale);
    scene.tweens.add({
      targets: cup,
      x: cup.x + Math.cos(ang) * dist,
      y: cup.y + Math.sin(ang) * dist,
      angle: Phaser.Math.Between(-360, 360),
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => cup.destroy()
    });
  };

  let thrustEvent = null;
  tl.add({
    targets: openingNumber,
    x: finalX,
    y: finalY - 40,
    angle: -20,
    duration: 800,
    ease: 'Cubic.easeIn',
    onStart: () => {
      thrustEvent = scene.time.addEvent({ delay: 80, loop: true, callback: spawnThrust });
    },
    onComplete: () => {
      if (thrustEvent) thrustEvent.remove(false);
    }
  });

  tl.add({
    targets: openingNumber,
    y: finalY,
    angle: 0,
    duration: 300,
    ease: 'Bounce.easeOut',
    onStart: () => {
      for (let i = 0; i < 4; i++) spawnThrust();
    },
    onComplete: () => {
      for (let i = 0; i < 8; i++) spawnThrust(3);
    }
  });
  tl.add({
    targets: startWhite,
    alpha: 0,
    duration: 600,
    onStart: () => {
      showStartScreen.call(scene);
      if (scene.children && scene.children.bringToTop) {
        scene.children.bringToTop(startWhite);
      }
    }
  });
  tl.play();
}

function showStartScreen(scene){
  scene = scene || this;
  if (typeof debugLog === 'function') debugLog('showStartScreen called');
  if(startButton){ startButton.destroy(); startButton = null; }
  if(typeof phoneContainer !== 'undefined' && phoneContainer){
    if(scene.tweens && scene.tweens.killTweensOf){
      scene.tweens.killTweensOf(phoneContainer);
    }
    phoneContainer.destroy();
    phoneContainer = null;
  }
  if(startOverlay){ startOverlay.destroy(); startOverlay = null; }
  if(startWhite){ startWhite.destroy(); startWhite = null; }
  startMsgTimers.forEach(t => t.remove(false));
  startMsgTimers = [];
  startMsgBubbles.forEach(b => b.destroy());
  startMsgBubbles = [];
  startOverlay = scene.add.rectangle(240,320,480,640,0x000000,0.75)
    .setDepth(13);

  const phoneW = (typeof START_PHONE_W === 'number') ? START_PHONE_W : 260;
  const phoneH = (typeof START_PHONE_H === 'number') ? START_PHONE_H : 500;
  const caseG = scene.add.graphics();
  caseG.fillStyle(0x5c3b2a,1);
  caseG.fillRoundedRect(-phoneW/2-10,-phoneH/2-10,phoneW+20,phoneH+20,40);
  const blackG = scene.add.graphics();
  blackG.fillStyle(0x000000,1);
  blackG.fillRoundedRect(-phoneW/2,-phoneH/2,phoneW,phoneH,30);
  const whiteG = scene.add.graphics();
  whiteG.fillStyle(0xffffff,1);
  whiteG.fillRoundedRect(-phoneW/2+6,-phoneH/2+6,phoneW-12,phoneH-12,24);
  const homeH = 100;
  const homeG = scene.add.graphics();
  homeG.fillStyle(0xf0f0f0,1);
  homeG.fillRoundedRect(-phoneW/2+12,phoneH/2-homeH-12,phoneW-24,homeH,20);

  const btnLabel = scene.add.text(0,0,'Clock In',{
      font:'32px sans-serif',fill:'#fff'})
    .setOrigin(0.5);
  const bw = btnLabel.width + 60;
  const bh = btnLabel.height + 20;
  const btnBg = scene.add.graphics();
  btnBg.fillStyle(0x007bff,1);
  btnBg.fillRoundedRect(-bw/2,-bh/2,bw,bh,15);
  const offsetY = phoneH/2 - homeH/2 - 12;
  const containerY = 320;
  phoneContainer = scene.add
    .container(240, containerY, [caseG, blackG, whiteG, homeG])
    .setDepth(15)
    .setVisible(true)
    .setAlpha(1)
    .setSize(phoneW + 20, phoneH + 20)
    .setInteractive({ useHandCursor: true })
    .setScale(2);
  if(!phoneContainer.visible || phoneContainer.alpha === 0){
    console.warn('phoneContainer not visible after creation');
  }
  GameState.phoneContainer = phoneContainer;

  // Removed animated bird sprites so the start button remains clickable

  // Using setInteractive on the container caused misaligned hit areas on some
  // mobile browsers. Create a separate zone for input instead so the clickable
  // region always matches the visible button graphics.
  startButton = scene.add.container(0, offsetY, [btnBg, btnLabel])
    .setSize(bw, bh)
    .setVisible(true)
    .setAlpha(1);

  const startZone = scene.add.zone(0, 0, bw, bh).setOrigin(0.5);
  startZone.setInteractive({ useHandCursor: true });
  startButton.add(startZone);

  phoneContainer.add(startButton);

  // Mini game cup drops into place above the Clock In button
  if (miniGameCup) {
    const pcScale = phoneContainer.scale || phoneContainer.scaleX || 1;
    const m = phoneContainer.getWorldTransformMatrix();
    const localX = (miniGameCup.x - m.tx) / m.a;
    const localY = (miniGameCup.y - m.ty) / m.d;
    miniGameCup
      .setPosition(localX, localY)
      .setScale(miniGameCup.scale / pcScale)
      .setDepth(16)
      .setAlpha(0);
    phoneContainer.add(miniGameCup);
    const cupTL = scene.tweens.createTimeline();
    cupTL.add({
      targets: miniGameCup,
      x: 0,
      y: offsetY - bh - 20,
      scale: 1,
      alpha: 1,
      angle: -360,
      duration: 800,
      ease: 'Bounce.easeOut'
    });
    cupTL.add({ targets: miniGameCup, angle: -15, duration: 120, ease: 'Sine.easeInOut' });
    cupTL.add({ targets: miniGameCup, angle: 10, duration: 140, ease: 'Sine.easeInOut' });
    cupTL.add({ targets: miniGameCup, angle: -5, duration: 140, ease: 'Sine.easeInOut' });
    cupTL.add({
      targets: miniGameCup,
      angle: 0,
      duration: 100,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        miniGameCup.setInteractive({ useHandCursor: true });
        miniGameCup.on('pointerdown', () => {
          if (window.showMiniGame) window.showMiniGame();
        });
      }
    });
    cupTL.play();
  }

  badgeIcons.forEach(i=>i.destroy());
  badgeIcons=[];
  const iconY = 80; // place badges above the Clock In button
  const badgeScale = 0.3;
  const badgeSlots = {
    falcon_end: { x: -60, y: iconY },
    revolt_end: { x:  60, y: iconY }
  };
  const iconStartX = -phoneW/2 + 30; // fallback for unknown badges
  GameState.badges.forEach((key, idx) => {
    const grayKey = `${key}_gray`;
    if(!scene.textures.exists(grayKey)) createGrayscaleTexture(scene, key, grayKey);
    const slot = badgeSlots[key] || { x: iconStartX + idx*36, y: offsetY + bh/2 + 20 };
    const iconImg = scene.add.image(0, 0, grayKey)
      .setScale(badgeScale);
    const container = scene.add.container(slot.x, slot.y, [iconImg])
      .setDepth(16);
    if(GameState.badgeCounts[key] > 1){
      const txt = scene.add.text(0, 0, String(GameState.badgeCounts[key]), {
        font: '16px sans-serif', fill: '#fff'
      }).setOrigin(0.5);
      container.add(txt);
    }
    phoneContainer.add(container);
    badgeIcons.push(container);
  });

  if(GameState.carryPortrait && GameState.lastEndKey){
    const idx = GameState.badges.indexOf(GameState.lastEndKey);
    if(idx !== -1){
      badgeIcons[idx].setAlpha(0);
      const slot = badgeSlots[GameState.lastEndKey] || { x: iconStartX + idx*36, y: offsetY + bh/2 + 20 };
      const destX = phoneContainer.x + slot.x;
      const destY = phoneContainer.y + slot.y;
      const p = GameState.carryPortrait;
      const icon = badgeIcons[idx];
      scene.children.bringToTop(p);
      scene.tweens.add({
        targets:p,
        x:destX,
        y:destY,
        scale:badgeScale,
        alpha:0,
        duration:600,
        ease:'Sine.easeIn',
        onComplete:()=>{
          p.destroy();
          GameState.carryPortrait=null;
        }
      });
      scene.tweens.add({
        targets:icon,
        alpha:1,
        duration:600,
        ease:'Sine.easeIn'
      });
    } else {
      GameState.carryPortrait.destroy();
      GameState.carryPortrait=null;
    }
  }

  // Add intro graphics for the sequel intro
  const pcScale = phoneContainer.scale || phoneContainer.scaleX || 1;
  const pcX = phoneContainer.x;
  const pcY = phoneContainer.y;

  // store the opening number's target coords relative to the phone

  if(openingTitle){
    const localX = (openingTitle.x - pcX) / pcScale;
    const localY = (openingTitle.y - pcY) / pcScale;
    openingTitle
      .setPosition(localX, localY)
      .setScale(openingTitle.scale / pcScale)
      .setDepth(16)
      .setAlpha(1);
    phoneContainer.add(openingTitle);
  }

  if (openingNumber) {
    if (scene.tweens && scene.tweens.killTweensOf) {
      scene.tweens.killTweensOf(openingNumber);
    }
    const m = phoneContainer.getWorldTransformMatrix();
    const worldX = openingNumber.finalPos ? openingNumber.finalPos.x : openingNumber.x;
    const worldY = openingNumber.finalPos ? openingNumber.finalPos.y : openingNumber.y;
    const localX = (worldX - m.tx) / m.a;
    const localY = (worldY - m.ty) / m.d;
    openingNumber
      .setPosition(localX, localY)
      .setScale(openingNumber.scale / pcScale)
      .setDepth(16)
      .setAlpha(1);
    phoneContainer.add(openingNumber);
  }

  if(openingDog){
    const localX = (openingDog.x - pcX) / pcScale;
    const localY = (openingDog.y - pcY) / pcScale;
    openingDog
      .setPosition(localX, localY)
      .setScale(openingDog.scale / pcScale)
      .setDepth(15)
      .setAlpha(1);
    phoneContainer.add(openingDog);
  }

  // Zoom out from the white screen at the start
  if (scene.tweens && scene.tweens.add) {
    scene.tweens.add({
      targets: phoneContainer,
      scale: 1,
      duration: 800,
      delay: 200,
      ease: 'Sine.easeOut'
    });
  }

  if(scene.time && scene.tweens){
    scene.time.delayedCall(5000,()=>{
      const targets=[];
      if(openingTitle) targets.push(openingTitle);
      if(openingNumber) targets.push(openingNumber);
      if(openingDog) targets.push(openingDog);
      if(targets.length){
        scene.tweens.add({targets,alpha:0,duration:600});
      }
    },[],scene);
  }

  let startMsgY = -phoneH/2 + 20;

  const addStartMessage=(text)=>{
    if(!phoneContainer) return;
    const pad = 10;
    const wrapWidth = phoneW - 60;
    const txt = scene.add.text(0,0,text,{font:'20px sans-serif',fill:'#fff',wordWrap:{width:wrapWidth}})
      .setOrigin(0,0.5);
    const bw = txt.width + pad*2;
    const bh = txt.height + pad*2;
    const bg = scene.add.graphics();
    bg.fillStyle(0x8bd48b,1);
    bg.fillRoundedRect(-bw/2,-bh/2,bw,bh,10);
    txt.setPosition(-bw/2 + pad, 0);
    const xPos = -phoneW/2 + bw/2 + 20;
    const yPos = startMsgY + bh/2;
    const bubble = scene.add.container(xPos,yPos,[bg,txt]).setDepth(16).setAlpha(0);
    phoneContainer.add(bubble);
    startMsgBubbles.push(bubble);
    startMsgY += bh + 10;
    scene.tweens.add({targets:bubble,alpha:1,duration:300,ease:'Cubic.easeOut'});
  };

  if(scene.time && scene.time.delayedCall){
    const msgOptions=[
      ['u coming in? 🤔', 'where u at??', 'mornin ☀️'],
      ['better not still be in bed 😜', 'yo coffee girl ☕', 'stop ghostin me'],
      ['late night? 🥱💃', 'phone dead again? 🔋', 'omg wait till u hear about this guy 😏'],
      ['u good?', 'hope everythin\'s chill', '…sry 😬']
    ];
    let delay=0;
    for(const opts of msgOptions){
      delay += Phaser.Math.Between(5000,15000);
      const msg = Phaser.Utils.Array.GetRandom(opts);
      startMsgTimers.push(scene.time.delayedCall(delay,()=>addStartMessage(msg),[],scene));
    }
  }
  startZone.on('pointerdown',()=>{
    // Disable further clicks as soon as the intro begins
    if (window.hideMiniGame) window.hideMiniGame();
    startZone.disableInteractive();
    if (phoneContainer && phoneContainer.disableInteractive) {
      phoneContainer.disableInteractive();
    }
    if (phoneContainer && phoneContainer.off) {
      phoneContainer.off('pointerdown');
    }
    if (typeof debugLog === 'function') debugLog('start button clicked');
    startMsgTimers.forEach(t=>t.remove(false));
    startMsgTimers=[];
    startMsgBubbles=[];
    for(let i=0;i<2;i++){
      spawnSparrow(scene,{ground:true});
    }
    const tl=scene.tweens.createTimeline({callbackScope:scene,onComplete:()=>{
      if(startButton) startButton.destroy();
      if(startOverlay){startOverlay.destroy(); startOverlay=null;}
      if(startWhite){startWhite.destroy(); startWhite=null;}
      if(openingTitle){ openingTitle.destroy(); openingTitle=null; }
      if(openingNumber){ openingNumber.destroy(); openingNumber=null; }
      if(openingDog){ openingDog.destroy(); openingDog=null; }
      badgeIcons.forEach(i=>i.destroy());
      badgeIcons=[];
      if (phoneContainer) {
        phoneContainer.destroy();
        phoneContainer = null;
      }
      miniGameCup = null;
      GameState.phoneContainer = null;
      playIntro.call(scene);
    }});
    tl.add({targets:phoneContainer,y:-320,duration:600,ease:'Sine.easeIn'});
    const fadeTargets = [startOverlay, openingTitle, openingNumber, openingDog].filter(Boolean);
    if (fadeTargets.length) {
      tl.add({targets:fadeTargets,alpha:0,duration:600});
    }
    tl.play();
  });

  // Fallback: allow tapping anywhere on the phone to start
  phoneContainer.on('pointerdown', () => {
    if (startZone && startZone.emit) startZone.emit('pointerdown');
  });
}

function pauseWanderersForTruck(scene){
  const threshold = 60;
  GameState.wanderers.slice().forEach(c => {
    if(!c.sprite) return;

    if(GameState.truck && Math.abs(c.sprite.x - GameState.truck.x) < threshold){

      if(c.walkTween){
        c.walkTween.stop();
        c.walkTween.remove();
        c.walkTween=null;
      }
      if(c.pauseEvent){ c.pauseEvent.remove(); c.pauseEvent=null; }
      scene.tweens.add({targets:c.sprite,y:'-=20',duration:dur(150),yoyo:true});
      scene.time.delayedCall(dur(1000),()=>{
        if(GameState.girlReady && GameState.queue.length < queueLimit() + 3 && GameState.wanderers.includes(c)){
          lureNextWanderer(scene, c);
        }else{
          resumeWanderer(scene, c);
        }
      },[],scene);
    }
  });
}

function playIntro(scene){

  const truck = GameState.truck;
  const girl = GameState.girl;
  if(!truck || !girl) {

    if (DEBUG) console.warn('playIntro skipped: missing truck or girl');
    return;
  }
  if (typeof debugLog === 'function') debugLog('playIntro starting');
  scene = scene || this;
  if(!GameState.truck || !GameState.girl) return;
  GameState.girlReady = false;
  if(typeof debugLog==='function') debugLog('customers start spawning');
  scheduleNextSpawn(scene);
  const width = (scene.scale && scene.scale.width) ? scene.scale.width : 480;
  const offscreenX = width + 100;
  GameState.truck.setPosition(offscreenX,245).setScale(0.462);
  GameState.girl.setPosition(offscreenX,245).setVisible(false);
  scatterSparrows(scene);
  const vibrateAmp = { value: 2 * (GameState.truck.scaleX / 0.924) };
  const vibrateTween = (scene.tweens && scene.tweens.addCounter) ? scene.tweens.addCounter({
    from: 0,
    to: Math.PI * 2,
    duration: dur(100),
    repeat: -1,
    onUpdate: t => {
      const y = 245 + Math.sin(t.getValue()) * vibrateAmp.value;
      if (GameState.truck.setY) {
        GameState.truck.setY(y);
      } else {
        GameState.truck.y = y;
      }
    }
  }) : { stop: ()=>{} };
  if (scene.tweens && scene.tweens.add) {
    scene.tweens.add({
      targets: vibrateAmp,
      value: 0,
      duration: dur(600),
      delay: dur(900),
      ease: 'Sine.easeOut'
    });
  }
  let smokeDelay = 100;
  let smokeEvent = { remove: ()=>{} };
  if (scene.time && scene.time.addEvent) {
    smokeEvent = scene.time.addEvent({
      delay: dur(smokeDelay),
      loop: true,
      callback: () => {
        const puff = scene.add.text(GameState.truck.x + 60, GameState.truck.y + 20, '💨', { font: '20px sans-serif', fill: '#fff' })
          .setDepth(1);
        if (scene.tweens && scene.tweens.add) {
          scene.tweens.add({
            targets: puff,
            x: puff.x + 30,
            y: puff.y - 10,
            alpha: 0,
            duration: dur(800),
            onComplete: () => puff.destroy()
          });
        } else {
          puff.destroy();
        }
        smokeDelay += 125;
        smokeEvent.delay = dur(smokeDelay);
      }
    });
    scene.time.delayedCall(dur(1300), () => smokeEvent.remove(), [], scene);
  }
  const intro=scene.tweens.createTimeline({callbackScope:scene});
  const hopOut=()=>{
    const startX = GameState.truck.x + GameState.truck.displayWidth / 2 - 20;
    const startY = GameState.truck.y - 10;
    // After hopping out the girl should land closer to the middle of the screen
    const endX = scene.scale && scene.scale.width
      ? scene.scale.width / 2
      : GameState.truck.x + 40;
    const endY = 292;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(startX, startY),
      new Phaser.Math.Vector2(startX + 60, startY - 60),
      new Phaser.Math.Vector2(endX, endY)
    );
    const follower={t:0,vec:new Phaser.Math.Vector2()};
    scene.tweens.add({
      targets:follower,
      t:1,
      duration:dur(700),
      ease:'Sine.easeInOut',
      onStart:()=>GameState.girl.setVisible(true),
      onUpdate:()=>{
        curve.getPoint(follower.t,follower.vec);
        GameState.girl.setPosition(follower.vec.x,follower.vec.y);
      },
      onComplete:()=>{
        GameState.girl.setPosition(endX,endY);
        scene.tweens.add({
          targets:GameState.girl,
          y:endY-10,
          duration:dur(200),
          yoyo:true,
          ease:'Quad.easeOut',
          onComplete:()=>{
            if(typeof debugLog==='function') debugLog('intro finished');
            GameState.girlReady = true;
            lureNextWanderer(scene);
          }
        });
      }
    });
  };
  intro.add({
    targets:GameState.truck,
    x:240,
    scale:0.924,
    duration:dur(1500),
    ease:'Sine.easeOut',
    onComplete:()=>{
      smokeEvent.remove();
      vibrateTween.stop();
      if(GameState.truck.setY){
        GameState.truck.setY(245);
      }else{
        GameState.truck.y=245;
      }
      pauseWanderersForTruck(scene);
      hopOut();
    }
  });
  intro.play();
}

export { playOpening, showStartScreen, playIntro, hideStartMessages };

if (typeof window !== 'undefined') {
  window.hideStartMessages = hideStartMessages;
}
