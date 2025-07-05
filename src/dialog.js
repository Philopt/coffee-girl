// Dialog helpers extracted from main.js
import { debugLog, DEBUG } from './debug.js';
import { dur, scaleForY, articleFor, BUTTON_Y, DIALOG_Y } from './ui.js';
import { ORDER_X, ORDER_Y } from './customers.js';
import { DOG_COUNTER_RADIUS, animateDogPowerUp, PUP_CUP_TINT } from './entities/dog.js';
import { receipt, emojiFor } from './assets.js';
import { GameState } from './state.js';
import { blinkButton, createGrayscaleTexture, playIfNotEmpty } from './ui/helpers.js';

export const DART_MIN_DURATION = 300;
export const DART_MAX_SPEED = (560 / 6) * 3;
export const DRINK_HOLD_OFFSET = { x: 0, y: -10 };

// Asset references populated by initDialogAssets
export let dialogBg, dialogText, dialogCoins,
  dialogPriceLabel, dialogPriceValue, dialogPriceBox,
  dialogDrinkEmoji, dialogPriceContainer, dialogPriceTicket, dialogPriceShadow, dialogPupCup,
  ticketShadowMask,
  btnSell, btnGive, btnRef,
  reportLine1, reportLine2, reportLine3, tipText,
  paidStamp, lossStamp,
  truckRef, girlRef;
export let priceValueYOffset = 15;

export function initDialogAssets(obj){
  dialogBg = obj.dialogBg;
  dialogText = obj.dialogText;
  dialogCoins = obj.dialogCoins;
  dialogPriceLabel = obj.dialogPriceLabel;
  dialogPriceValue = obj.dialogPriceValue;
  dialogPriceBox = obj.dialogPriceBox;
  dialogDrinkEmoji = obj.dialogDrinkEmoji;
  dialogPriceContainer = obj.dialogPriceContainer;
  dialogPriceTicket = obj.dialogPriceTicket;
  dialogPriceShadow = obj.dialogPriceShadow;
  dialogPupCup = obj.dialogPupCup;
  ticketShadowMask = obj.ticketShadowMask;
  btnSell = obj.btnSell;
  btnGive = obj.btnGive;
  btnRef = obj.btnRef;
  reportLine1 = obj.reportLine1;
  reportLine2 = obj.reportLine2;
  reportLine3 = obj.reportLine3;
  tipText = obj.tipText;
  paidStamp = obj.paidStamp;
  lossStamp = obj.lossStamp;
  truckRef = obj.truck;
  girlRef = obj.girl;
  if(obj.priceValueYOffset !== undefined) priceValueYOffset = obj.priceValueYOffset;
}

function fadeInButtons(canSell){
  const startY = BUTTON_Y + 50;
  if(!this.textures.exists('sell_gray')){
    createGrayscaleTexture(this, 'sell', 'sell_gray');
  }
  const SELL_X = 240;
  const WITH_SELL = {
    sell:{x:SELL_X, scale:1.15, depth:13, angle:180},
    give:{x:360, scale:1.0, depth:12, angle:20},
    ref:{x:120, scale:1.0, depth:12, angle:-20}
  };
  const WITHOUT_SELL = {
    give:{x:320, scale:1.0, depth:13, angle:20},
    ref:{x:160, scale:1.0, depth:13, angle:-20}
  };
  const FINAL = canSell ? WITH_SELL : WITHOUT_SELL;
  const buttonImage = btn => {
    if(!btn || !btn.list) return null;
    return btn.list.find(child => typeof child.setTexture === 'function');
  };
  const resetBtn = (btn, info)=>{
    if(!btn) return;
    buttonImage(btn);
    btn.setPosition(SELL_X, startY);
    if(btn.image){
      btn.image.setScale(info.scale);
      btn.setSize(btn.image.displayWidth, btn.image.displayHeight);
    }
    btn.setDepth(info.depth);
    btn.setAngle(info.angle || 0);
    btn.setAlpha(0).setVisible(true);
    if(btn.zone && btn.zone.input) btn.zone.input.enabled = false;
    if(btn.glow){
      if(btn.glowTween && btn.glowTween.remove) btn.glowTween.remove();
      btn.glowTween=null;
      btn.glow.setVisible(false);
    }
  };
  if(btnSell && btnSell.image){
    btnSell.image.setTexture('sell');
    btnSell.image.setAlpha(1);
  }
  if(canSell){
    resetBtn(btnSell, FINAL.sell);
  }else if(btnSell){
    btnSell.setVisible(false);
  }
  resetBtn(btnGive, FINAL.give);
  resetBtn(btnRef, FINAL.ref);
  const timeline = this.tweens.chain({paused:true});
  if(canSell){
    timeline.add({ targets: btnSell, y: BUTTON_Y, angle: 0, alpha: 1, ease: 'Sine.easeOut', duration: dur(250) });
  }
  timeline.add({ targets: btnGive, x: FINAL.give.x, y: BUTTON_Y, angle:0, alpha:1, ease:'Sine.easeOut', duration:dur(200) });
  timeline.add({ targets: btnRef, x: FINAL.ref.x, y: BUTTON_Y, angle:0, alpha:1, ease:'Sine.easeOut', duration:dur(200), offset:'-=200' });
  timeline.setCallback('onComplete', () => {
    if(canSell && btnSell.zone && btnSell.zone.input) btnSell.zone.input.enabled = true;
    if(btnGive.zone && btnGive.zone.input) btnGive.zone.input.enabled = true;
    if(btnRef.zone && btnRef.zone.input) btnRef.zone.input.enabled = true;
    if(canSell && btnSell.glow){
      if(btnSell.glowTween && btnSell.glowTween.remove) btnSell.glowTween.remove();
      btnSell.glowTween=null;
      btnSell.glow.setVisible(false);
    }
    if(btnGive.glow){
      if(btnGive.glowTween && btnGive.glowTween.remove) btnGive.glowTween.remove();
      btnGive.glow.setVisible(true).setAlpha(0.1);
      btnGive.glowTween = this.tweens.add({ targets: btnGive.glow, alpha: {from:0.1, to:0.05}, duration: dur(800), yoyo: true, repeat: -1 });
    }
  }, []);
  playIfNotEmpty(timeline);
}

function blowButtonsAway(except){
  const buttons=[btnSell,btnGive,btnRef].filter(b=>b&&b!==except);
  buttons.forEach(btn=>{
    if(btn.input) btn.input.enabled=false;
    if(this.tweens){
      this.tweens.add({ targets:btn, y:btn.y+200, x:btn.x+Phaser.Math.Between(-40,40), angle:Phaser.Math.Between(-90,90), alpha:0, duration:dur(300), ease:'Cubic.easeIn', onComplete:()=>{btn.setVisible(false); btn.setAngle(0);} });
    }else{
      btn.setVisible(false);
      btn.setAngle(0);
    }
  });
}

function drawDialogBubble(targetX, targetY, fillColor=0xffffff){
  if(!dialogBg) return;
  const w=dialogBg.width, h=dialogBg.height;
  dialogBg.clear();
  dialogBg.fillStyle(fillColor,1);
  dialogBg.lineStyle(2,0x000,1);
  dialogBg.fillRoundedRect(-w/2,-h/2,w,h,24);
  dialogBg.strokeRoundedRect(-w/2,-h/2,w,h,24);
  if (targetX !== undefined && targetY !== undefined) {
    const tx = targetX - dialogBg.x;
    const ty = targetY - dialogBg.y;
    const bx1 = -10;
    const bx2 = 10;
    const by = -h / 2;
    const tipX = tx * 0.5;
    const tipY = by + (ty - by) * 0.5;
    dialogBg.fillTriangle(bx1, by + 1, bx2, by + 1, tipX, tipY);
    dialogBg.beginPath();
    dialogBg.moveTo(tipX, tipY);
    dialogBg.lineTo(bx1, by + 1);
    dialogBg.moveTo(tipX, tipY);
    dialogBg.lineTo(bx2, by + 1);
    dialogBg.strokePath();
  }
}

function resetPriceBox(){
  if(!dialogPriceBox) return;
  if(dialogPriceBox.setFillStyle){
    dialogPriceBox.setFillStyle(0xffeeb5,1);
  } else if(dialogPriceBox.fillStyle){
    dialogPriceBox.fillStyle(0xffeeb5,1);
  }
  if(dialogPriceBox.setStrokeStyle){
    dialogPriceBox.setStrokeStyle(2,0x000000);
  }
  dialogPriceBox.fillAlpha = 1;
  if(dialogPriceTicket){
    if(dialogPriceTicket.clearTint) dialogPriceTicket.clearTint();
    if(dialogPriceTicket.setTexture && this.textures.exists('price_ticket')){
      dialogPriceTicket.setTexture('price_ticket');
    }
  }
  if(dialogDrinkEmoji && dialogDrinkEmoji.setAlpha){
    dialogDrinkEmoji.setAlpha(1);
  }
  if(dialogPriceContainer){
    dialogPriceContainer
      .setAngle(0)
      .setScale(1)
      .setAlpha(1);
  }
}

function showDialog(){
  if (GameState.falconActive) return;
  if (GameState.saleInProgress || GameState.dialogActive) {
    return;
  }
  if (typeof debugLog === 'function') {
    debugLog('showDialog start', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
  }
  const missingElems = [];
  if (!dialogBg) missingElems.push('dialogBg');
  if (!dialogText) missingElems.push('dialogText');
  if (!dialogCoins) missingElems.push('dialogCoins');
  if (!dialogPriceLabel) missingElems.push('dialogPriceLabel');
  if (!dialogPriceValue) missingElems.push('dialogPriceValue');
  if (!btnSell) missingElems.push('btnSell');
  if (!btnGive) missingElems.push('btnGive');
  if (!btnRef) missingElems.push('btnRef');
  if (missingElems.length){
    if (typeof debugLog === 'function') {
      debugLog('showDialog early exit, missing:', missingElems.join(', '));
    }
    if (DEBUG) {
      console.warn(`showDialog skipped: missing ${missingElems.join(', ')}`);
    }
    return;
  }
  if (typeof resetPriceBox === 'function') {
    resetPriceBox.call(this);
  }
  dialogBg.y = typeof DIALOG_Y === 'number' ? DIALOG_Y : 430;
  dialogBg.setAlpha(1);
  dialogText.setAlpha(1);
  dialogCoins.setAlpha(1);
  GameState.activeCustomer=GameState.queue[0]||null;
  if(!GameState.activeCustomer) return;
  const c=GameState.activeCustomer;
  if(c.isDog && c.owner && c.owner.dogWaitEvent){
    c.owner.dogWaitEvent.remove(false);
    c.owner.dogWaitEvent=null;
  }
  if(!c.isDog && c.dog && c.dog.followEvent){
    const dist = Phaser.Math.Distance.Between(c.dog.x, c.dog.y,
                                              c.sprite.x, c.sprite.y);
    if(dist <= DOG_COUNTER_RADIUS * 1.2){
      c.dog.followEvent.remove(false);
      c.dog.followEvent=null;
    }
  }
  if(!c.atOrder && (c.sprite.y!==ORDER_Y || c.sprite.x!==ORDER_X)){
    c.atOrder=true;
    const dist = Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, ORDER_X, ORDER_Y);
    const duration = dur(Math.max(DART_MIN_DURATION, (dist / DART_MAX_SPEED) * 1000));
    this.tweens.add({
      targets: c.sprite,
      x: ORDER_X,
      y: ORDER_Y,
      scale: scaleForY(ORDER_Y),
      duration,
      onComplete: ()=>{ showDialog.call(this); }
    });
    return;
  }
  let wantLine;
  if(c.isDog){
    const sounds=['woof woof!','bark bark!','arf arf!','ruff ruff!','awoo!','🐶🐶'];
    const sound=Phaser.Utils.Array.GetRandom(sounds);
    wantLine=sound;
  } else {
    const itemStr=c.orders.map(o=> o.qty>1 ? `${o.qty} ${o.req}` : o.req).join(' and ');
    wantLine=(c.orders.length===1 && c.orders[0].qty===1)
      ? `I want ${articleFor(c.orders[0].req)} ${c.orders[0].req}`
      : `I want ${itemStr}`;
  }
  dialogText
    .setOrigin(0.5)
    .setStyle({fontSize:'24px'})
    .setText(wantLine)
    .setVisible(true);
  const totalCost=c.isDog?0:c.orders.reduce((s,o)=>s+o.price*o.qty,0);
  const canAfford = c.isDog ? true : (c.orders[0].coins >= totalCost);
  const canSell = !c.isDog && canAfford;
  let coinLine='';
  if(!c.isDog){
    if (!canAfford) {
      const options = [
        "I forgot my wallet",
        "I'll pay you tomorrow",
        "My card got declined",
        "Can I Venmo you later?",
        "I'm good for it, promise"
      ];
      coinLine = Phaser.Utils.Array.GetRandom(options);
    }
  }
  dialogCoins
    .setOrigin(0.5)
    .setStyle({fontSize:'24px'})
    .setText(coinLine)
    .setVisible(!c.isDog && !!coinLine);
  const coinW = (!c.isDog && coinLine) ? dialogCoins.width : 0;
  const maxW = Math.max(dialogText.width, coinW);
  const hMargin = 20;
  const vMargin = 15;
  const lineGap = 10;
  dialogBg.width = Math.max(maxW + hMargin * 2, 160);
  dialogBg.height = dialogText.height + (coinLine ? dialogCoins.height + lineGap : 0) + vMargin * 2;
  const bubbleTop=dialogBg.y - dialogBg.height/2;
  const textY=bubbleTop + vMargin + dialogText.height/2;
  dialogText.setPosition(dialogBg.x, textY);
  if(!c.isDog && coinLine){
    dialogCoins.setPosition(dialogBg.x, textY + dialogText.height/2 + lineGap + dialogCoins.height/2);
  }
  dialogBg.setScale(0).setVisible(true);
  GameState.dialogActive = true;
  dialogText.setScale(0);
  if (coinLine) {
    dialogCoins.setScale(0);
  } else {
    dialogCoins.setScale(1);
  }
  let bubbleColor = 0xffffff;
  drawDialogBubble(c.sprite.x, c.sprite.y, bubbleColor);
  const ticketW = c.isDog ? dialogPriceBox.width : (dialogPriceTicket ? dialogPriceTicket.displayWidth : dialogPriceBox.width);
  const ticketH = c.isDog ? dialogPriceBox.height : (dialogPriceTicket ? dialogPriceTicket.displayHeight : dialogPriceBox.height);
  const truck = truckRef;
  const startX = girlRef ? girlRef.x : dialogBg.x;
  const startY = girlRef ? girlRef.y - 30 : dialogBg.y - 10;
  const priceTargetX = startX;
  const priceTargetY = startY - ticketH * 0.5 + 10;
  const peekY = startY - ticketH * 0.5 + 12;
  dialogPriceContainer.setPosition(startX, startY).setScale(0.2).setVisible(false);
  if (dialogDrinkEmoji.parentContainer !== dialogPriceContainer) {
    dialogPriceContainer.add(dialogDrinkEmoji);
  }
  dialogDrinkEmoji.attachedTo = null;
  dialogPriceContainer.alpha = 1;
  if(c.isDog){
    dialogPriceTicket.setVisible(false);
    dialogPriceShadow.setVisible(false);
    dialogPupCup.setTexture('pupcup2');
    dialogPupCup.setVisible(true);
    dialogPriceBox.setVisible(false);
    dialogPriceBox.width = dialogPupCup.displayWidth;
    dialogPriceBox.height = dialogPupCup.displayHeight;
    dialogPriceLabel.setVisible(false);
    dialogPriceValue.setVisible(false);
    dialogDrinkEmoji
      .setText('🍨')
      .setPosition(0,-dialogPriceBox.height/4 + 14)
      .setScale(2)
      .setVisible(true);
    dialogDrinkEmoji.base.setShadow(0, 0, '#000', 8).setStyle({stroke:'#000', strokeThickness:4});
  } else {
    dialogPupCup.setVisible(false);
    dialogPriceTicket.setVisible(true);
    dialogPriceShadow.setVisible(true);
    dialogPriceBox.setVisible(false);
    dialogPriceBox.width = dialogPriceTicket.displayWidth;
    dialogPriceBox.height = dialogPriceTicket.displayHeight;
    dialogPriceLabel.setVisible(false);
    dialogPriceValue
      .setStyle({fontSize:'42px'})
      .setText(receipt(totalCost))
      .setColor('#006400')
      .setOrigin(0.5)
      .setScale(0.9)
      .setAlpha(1)
      .setVisible(true);
    priceValueYOffset = dialogPriceBox.height/2 - 34;
    const orderEmoji = emojiFor(c.orders[0].req);
    dialogPriceValue.setPosition(-5, priceValueYOffset + 5);
    dialogDrinkEmoji.setText(orderEmoji);
    dialogDrinkEmoji.setPosition(0,-dialogPriceBox.height/4 + 8).setScale(2).setVisible(true).setDepth(paidStamp.depth + 1);
    dialogDrinkEmoji.base.setShadow(0, 0, '#000', 0).setStyle({strokeThickness:0});
    dialogDrinkEmoji.extras.forEach(e=>e.setShadow(0, 0, '#000', 0));
  }
  this.tweens.add({
    targets:[dialogBg, dialogText, dialogCoins],
    scale:1,
    ease:'Back.easeOut',
    duration:dur(300),
    onComplete:()=>{
      const showPrice=()=>{
        dialogPriceContainer.setVisible(true);
        const frontDepth = dialogPriceContainer.depth;
        const behindDepth = truck && truck.depth ? truck.depth - 1 : frontDepth - 1;
        dialogPriceContainer.setDepth(behindDepth);
        const midY = truck ? truck.y - (truck.displayHeight||0)/2 - 40 : priceTargetY - 40;
        const tl = this.tweens.chain({paused:true});
        tl.add({ targets: dialogPriceContainer, y: peekY, scale: 0.3, duration: dur(100), ease: 'Sine.easeOut' });
        tl.add({ targets: dialogPriceContainer, x: priceTargetX, y: midY, scale: 0.5, duration: dur(250), ease: 'Sine.easeOut' });
        tl.add({ targets: dialogPriceContainer, x: priceTargetX, y: priceTargetY, scale: 0.8, duration: dur(250), ease: 'Sine.easeOut', onStart: ()=> dialogPriceContainer.setDepth(frontDepth) });
        tl.setCallback('onComplete', () => {
          if (typeof fadeInButtons === 'function') {
            fadeInButtons.call(this, canSell);
          } else {
            if (canSell) {
              btnSell.setVisible(true);
              if (btnSell.zone && btnSell.zone.input) btnSell.zone.input.enabled = true;
            } else {
              btnSell.setVisible(false);
              if (btnSell.zone && btnSell.zone.input) btnSell.zone.input.enabled = false;
            }
            btnGive.setVisible(true);
            if (btnGive.zone && btnGive.zone.input) btnGive.zone.input.enabled = true;
            if (btnRef.zone && btnRef.zone.input) btnRef.zone.input.enabled = true;
          }
        });
        playIfNotEmpty(tl);
      };
      if(this.time && this.time.delayedCall){
        this.time.delayedCall(dur(250), showPrice, [], this);
      }else{
        showPrice();
      }
    }
  });
  tipText.setVisible(false);
  if (typeof debugLog === 'function') debugLog('showDialog end');
}

function clearDialog(keepPrice=false, resetTicket=true){
  GameState.dialogActive = false;
  if(!keepPrice){
    dialogBg.setVisible(false);
    dialogText.setVisible(false);
    dialogCoins.setVisible(false);
    dialogPriceContainer.setVisible(false);
    dialogPriceValue.setColor('#006400').setStyle({fontStyle:'', strokeThickness:0});
    if(dialogDrinkEmoji && dialogDrinkEmoji.stopHalo) dialogDrinkEmoji.stopHalo();
  }else{
    dialogBg.setVisible(true);
    dialogText.setVisible(false);
    dialogCoins.setVisible(false);
    dialogPriceContainer.setVisible(true);
  }
  const flinging = this.tweens && this.tweens.isTweening && this.tweens.isTweening(dialogDrinkEmoji);
  if (!flinging && !dialogDrinkEmoji.attachedTo && dialogDrinkEmoji.parentContainer !== dialogPriceContainer) {
    dialogPriceContainer.add(dialogDrinkEmoji);
  }
  if (dialogPriceValue.parentContainer !== dialogPriceContainer) {
    dialogPriceContainer.add(dialogPriceValue);
  }
  if(!keepPrice){
    dialogDrinkEmoji.setVisible(false);
  }else{
    dialogDrinkEmoji.setVisible(true);
  }
  if(resetTicket){
    resetPriceBox.call(this);
  }
  btnSell.setVisible(false);
  if (btnSell.zone && btnSell.zone.input) btnSell.zone.input.enabled = false;
  if(btnSell.glow){
    if(btnSell.glowTween && btnSell.glowTween.remove) btnSell.glowTween.remove();
    btnSell.glowTween=null;
    btnSell.glow.setVisible(false);
  }
  btnGive.setVisible(false);
  if (btnGive.zone && btnGive.zone.input) btnGive.zone.input.enabled = false;
  if(btnGive.glow){
    btnGive.glow.setVisible(false);
  }
  btnRef.setVisible(false);
  if (btnRef.zone && btnRef.zone.input) btnRef.zone.input.enabled = false;
  tipText.setVisible(false);
}

export { fadeInButtons, blowButtonsAway, drawDialogBubble, resetPriceBox, showDialog, clearDialog };
