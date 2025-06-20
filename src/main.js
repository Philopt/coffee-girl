import { debugLog, DEBUG } from './debug.js';
import { dur, scaleForY, articleFor, flashMoney, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_Y, DIALOG_Y } from "./ui.js";
import { ORDER_X, ORDER_Y, WANDER_TOP, WANDER_BOTTOM, WALK_OFF_BASE, MAX_M, MAX_L, calcLoveLevel, queueLimit } from "./customers.js";
import { lureNextWanderer, moveQueueForward, scheduleNextSpawn, spawnCustomer } from './entities/customerQueue.js';
import { baseConfig } from "./scene.js";
import { GameState, floatingEmojis, addFloatingEmoji, removeFloatingEmoji } from "./state.js";
import { CustomerState } from './constants.js';

import { scheduleSparrowSpawn, updateSparrows, cleanupSparrows } from './sparrow.js';
import { DOG_TYPES, DOG_MIN_Y, DOG_COUNTER_RADIUS, sendDogOffscreen, scaleDog, cleanupDogs, updateDog, dogTruckRuckus } from './entities/dog.js';
import { startWander } from './entities/wanderers.js';

import { flashBorder, flashFill, blinkButton, applyRandomSkew, emphasizePrice, setDepthFromBottom, createGrayscaleTexture } from './ui/helpers.js';

import { keys, requiredAssets, preload as preloadAssets, receipt, emojiFor } from './assets.js';
import { showStartScreen, playIntro } from './intro.js';

export let Assets, Scene, Customers, config;
export let showStartScreenFn, handleActionFn, spawnCustomerFn, scheduleNextSpawnFn, showDialogFn, animateLoveChangeFn, blinkButtonFn;
// Minimum duration when a customer dashes to the table
const DART_MIN_DURATION = 300;
// Maximum speed (pixels per second) when dashing to the table
const DART_MAX_SPEED = (560 / 6) * 3;
// Offset for the drink emoji when the customer holds it
// Raise it slightly so it appears near their hands instead of their feet
const DRINK_HOLD_OFFSET = { x: 0, y: -20 };
const HEART_EMOJIS = {
  [CustomerState.NORMAL]: null,
  [CustomerState.BROKEN]: '💔',
  [CustomerState.MENDING]: '❤️‍🩹',
  [CustomerState.GROWING]: '💗',
  [CustomerState.SPARKLING]: '💖',
  [CustomerState.ARROW]: '💘'
};
export function setupGame(){
  if (typeof debugLog === 'function') debugLog('main.js loaded');
  let initCalled = false;
  function init(){
    if (typeof debugLog === 'function') debugLog('init() executing');
    initCalled = true;
    new Phaser.Game(config);
  }
  // full drink menu with prices


  // state is managed in GameState






  function animateStatChange(obj, scene, delta, isLove=false){
    if(delta===0) return;
    const up = delta>0;
    const color = up ? '#0f0' : '#f00';
    const by = up ? -8 : 8;
    const originalY = obj.y;
    const moveDur = isLove && !up ? 160 : 120;
    scene.tweens.add({targets:obj, y:originalY+by, duration:dur(moveDur), yoyo:true});
    let on=true;
    const flashes = isLove && !up ? 4 : 2;
    const flashDelay = isLove && !up ? 120 : 80;
    scene.time.addEvent({
      repeat:flashes,
      delay:dur(flashDelay),
      callback:()=>{
        obj.setColor(on?color:'#fff');
        if(isLove && !up){
          obj.setText((on?'💔':'❤️')+' '+GameState.love);
        }
        on=!on;
      }
    });
    scene.time.delayedCall(dur(flashDelay)*(flashes+1)+dur(10),()=>{
      obj.setColor('#fff');
      if(isLove && !up){
        obj.setText('❤️ '+GameState.love);
        // removed wobble animation for the love counter
      }
    },[],scene);
  }

  function countPrice(text, scene, from, to, baseLeft, baseY=15){
    if(!text || !scene) return;
    const duration = dur(400);
    if(scene.tweens && scene.tweens.addCounter){
      scene.tweens.addCounter({
        from,
        to,
        duration,
        onUpdate:tween=>{
          text.setText(receipt(tween.getValue()));
          text.setPosition(baseLeft + text.displayWidth/2, baseY);
        },
        onComplete:()=>{
          text.setText(receipt(to));
          text.setPosition(baseLeft + text.displayWidth/2, baseY);
        }
      });
    } else {
      text.setText(receipt(to));
      text.setPosition(baseLeft + text.displayWidth/2, baseY);
    }
  }

  function cleanupFloatingEmojis(){
    floatingEmojis.slice().forEach(e=>{
      if(e && e.destroy) e.destroy();
      if (typeof removeFloatingEmoji === 'function') {
        removeFloatingEmoji(e);
      } else if (GameState && typeof GameState.removeFloatingEmoji === 'function') {
        GameState.removeFloatingEmoji(e);
      } else {
        const i = floatingEmojis.indexOf(e);
        if(i !== -1) floatingEmojis.splice(i,1);
      }
    });
  }

  const HEART_EMOJI_LIST = Object.values(HEART_EMOJIS).filter(Boolean);

  function cleanupHeartEmojis(scene){
    const everyone = [];
    if(GameState.activeCustomer) everyone.push(GameState.activeCustomer);
    if(Array.isArray(GameState.queue)) everyone.push(...GameState.queue);
    if(Array.isArray(GameState.wanderers)) everyone.push(...GameState.wanderers);
    everyone.forEach(c=>{
      if(c && c.heartEmoji){
        c.heartEmoji.destroy();
        c.heartEmoji = null;
      }
    });

    if(scene && scene.children){
      scene.children.list.slice().forEach(child=>{
        if(child instanceof Phaser.GameObjects.Text && HEART_EMOJI_LIST.includes(child.text)){
          child.destroy();
        }
      });
    }
  }


  function hideOverlayTexts(){
    if(reportLine1) reportLine1.setVisible(false);
    if(reportLine2) reportLine2.setVisible(false);
    if(reportLine3) reportLine3.setVisible(false);
    if(tipText) tipText.setVisible(false);
    if(paidStamp) paidStamp.setVisible(false);
    if(lossStamp) lossStamp.setVisible(false);
  }


  function fadeInButtons(canSell){
    const buttons = [];
    if (canSell) buttons.push(btnSell);
    buttons.push(btnGive, btnRef);
    buttons.forEach(b => {
      b.setAlpha(0).setVisible(true);
      if (b.input) b.input.enabled = false;
    });
    this.tweens.add({
      targets: buttons,
      alpha: 1,
      duration: dur(150),
        onComplete: () => {
          if (canSell && btnSell.input) btnSell.input.enabled = true;
        if (btnGive.input) btnGive.input.enabled = true;
        if (btnRef.input) btnRef.input.enabled = true;
      }
    });
  }




  let moneyText, loveText, queueLevelText;
  let dialogBg, dialogText, dialogCoins,
      dialogPriceLabel, dialogPriceValue, dialogPriceBox,
      dialogDrinkEmoji, dialogPriceContainer, dialogPriceTicket, dialogPupCup,
      btnSell, btnGive, btnRef;
  let reportLine1, reportLine2, reportLine3, tipText;
  let paidStamp, lossStamp;
  let priceValueYOffset = 15;
  let truck, girl;
  let sideCText;
  let sideCAlpha=0;
  let sideCFadeTween=null;
  let endOverlay=null;
  // hearts or anger symbols currently animating


  function enforceCustomerScaling(){
      const updateHeart = c => {
        if(!c.sprite || !c.sprite.scene) return;
      const state = c.memory && c.memory.state || CustomerState.NORMAL;
      if(state !== CustomerState.NORMAL){
        if(!c.heartEmoji || !c.heartEmoji.scene || !c.heartEmoji.active){
          if (c.heartEmoji && c.heartEmoji.destroy) {
            c.heartEmoji.destroy();
          }
          c.heartEmoji = c.sprite.scene.add.text(c.sprite.x, c.sprite.y, HEART_EMOJIS[state] || '', {font:'28px sans-serif'})
            .setOrigin(0.5)
            .setShadow(0, 0, '#000', 4);
          if(c.isDog){
            c.sprite.heartEmoji = c.heartEmoji;
          }
        }
        if(c.heartEmoji && c.heartEmoji.scene && c.heartEmoji.active){
          const y = c.sprite.y + c.sprite.displayHeight * 0.30;
          const scale = scaleForY(c.sprite.y)*0.8;
          c.heartEmoji.setText(HEART_EMOJIS[state] || '').setPosition(c.sprite.x, y).setScale(scale).setShadow(0, 0, '#000', 4);
          c.heartEmoji.setDepth(c.sprite.depth+1);
          if(c.isDog){
            c.sprite.heartEmoji = c.heartEmoji;
          }
        }
      }else if(c.heartEmoji){
        c.heartEmoji.destroy();
        c.heartEmoji = null;
        if(c.isDog){
          c.sprite.heartEmoji = null;
        }
      }
    };
    GameState.queue.forEach(c=>{
      if(c.sprite){ c.sprite.setScale(scaleForY(c.sprite.y)); setDepthFromBottom(c.sprite,5); }
      if(c.dog) scaleDog(c.dog);
      if(c.isDog) scaleDog(c.sprite);
      updateHeart(c);
      if(c.dogCustomer) updateHeart(c.dogCustomer);
    });
    GameState.wanderers.forEach(c=>{
      if(c.sprite){ c.sprite.setScale(scaleForY(c.sprite.y)); setDepthFromBottom(c.sprite,5); }
      if(c.dog) scaleDog(c.dog);
      if(c.isDog) scaleDog(c.sprite);
      updateHeart(c);
      if(c.dogCustomer) updateHeart(c.dogCustomer);
    });
  }

  function updateDrinkEmojiPosition(){
    if(dialogDrinkEmoji && dialogDrinkEmoji.attachedTo){
      const cust = dialogDrinkEmoji.attachedTo;
      if(cust.active){
        dialogDrinkEmoji.setPosition(cust.x + DRINK_HOLD_OFFSET.x,
                                    cust.y + DRINK_HOLD_OFFSET.y);
      }else{
        dialogDrinkEmoji.setVisible(false);
        dialogDrinkEmoji.attachedTo = null;
      }
    }
  }



  function updateLevelDisplay(){
    const newLength = queueLimit(GameState.love);
    if(queueLevelText){
      if(newLength!==GameState.loveLevel && newLength>=2){
        const sp=queueLevelText.scene.add.text(queueLevelText.x,queueLevelText.y,'✨',
            {font:'18px sans-serif',fill:'#000'})
          .setOrigin(0.5).setDepth(queueLevelText.depth+1);
        queueLevelText.scene.tweens.add({targets:sp,y:queueLevelText.y-20,alpha:0,
            duration:dur(600),onComplete:()=>sp.destroy()});
      }
    }
    GameState.loveLevel=newLength;
      if(GameState.girlReady && queueLevelText && queueLevelText.scene){
        lureNextWanderer(queueLevelText.scene);
      }
  }


  function showSideC(){
    if(sideCText) return;
    const y=this.scale.height*0.15;
    const x=this.scale.width*0.67;
    sideCText=this.add.text(x,y,'Side C',
        {font:'bold 64px serif',fill:'#002a8a'})
      .setOrigin(0.5)
      .setDepth(4)
      .setAlpha(0);
  }

  function updateSideC(){
    if(GameState.servedCount<6) return;
    showSideC.call(this);
    const target=Math.min(1,(GameState.servedCount-5)*0.1);
    if(target<=sideCAlpha) return;
    if(sideCFadeTween){ sideCFadeTween.stop(); }
    let duration=2000;
    if(target>0.5) duration=1000;
    sideCFadeTween=this.tweens.add({targets:sideCText,alpha:target,duration:duration});
    sideCAlpha=target;
    if(sideCAlpha>=1){
      sideCFadeTween=this.tweens.add({targets:sideCText,alpha:0,duration:20000,
        onComplete:()=>{ sideCText.destroy(); sideCText=null; sideCFadeTween=null; sideCAlpha=0; }});
    }
  }




  function preload(){
    preloadAssets.call(this);
  }

  function create(){
    this.assets = Assets;
    this.customers = Customers;
    this.gameState = GameState;
    const missing=requiredAssets.filter(key=>!this.textures.exists(key));
    if(missing.length){
      const msg='Missing assets: '+missing.join(', ');
      if (DEBUG) console.error(msg);
      this.add.text(240,320,msg,{font:'16px sans-serif',fill:'#f00',align:'center',wordWrap:{width:460}})
        .setOrigin(0.5).setDepth(30);
      const retry=this.add.text(240,360,'Retry Loading',{font:'20px sans-serif',fill:'#00f'})
        .setOrigin(0.5).setDepth(30);
      const retryZone=this.add.zone(240,360,retry.width,retry.height).setOrigin(0.5);
      retryZone.setInteractive({ useHandCursor:true });
      retryZone.on('pointerdown',()=>window.location.reload());
      return;
    }
    // background
    let bg=this.add.image(0,0,'bg').setOrigin(0).setDepth(0);
    bg.setDisplaySize(this.scale.width,this.scale.height);

    // HUD
    moneyText=this.add.text(20,20,'🪙 '+receipt(GameState.money),{font:'26px sans-serif',fill:'#fff'}).setDepth(1);
    loveText=this.add.text(20,50,'❤️ '+GameState.love,{font:'26px sans-serif',fill:'#fff'}).setDepth(1);
    moneyText.setInteractive({ useHandCursor:true });
    loveText.setInteractive({ useHandCursor:true });
    moneyText.on('pointerdown',()=>{
      GameState.money = +(GameState.money + 20).toFixed(2);
      moneyText.setText('🪙 '+receipt(GameState.money));
      animateStatChange(moneyText, this, 1);
    });
    loveText.on('pointerdown',()=>{
      GameState.love += 10;
      loveText.setText('❤️ '+GameState.love);
      updateLevelDisplay();
      animateStatChange(loveText, this, 1, true);
    });
    // Indicator for available queue slots
    queueLevelText=this.add.text(156,316,'',{font:'16px sans-serif',fill:'#000'})
      .setOrigin(0.5).setDepth(1).setVisible(false);
    updateLevelDisplay();
    // truck & girl
    const startX=this.scale.width+100;
    truck=this.add.image(startX,245,'truck').setScale(0.462).setDepth(2);
    GameState.truck = truck;

    girl=this.add.image(startX,245,'girl').setScale(0.5).setDepth(3).setVisible(false);
    GameState.girl = girl;

    // create lady falcon animation
    this.anims.create({
      key:'falcon_fly',
      frames:this.anims.generateFrameNumbers('lady_falcon',{start:0,end:1}),
      frameRate:6,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow_fly',
      frames:this.anims.generateFrameNumbers('sparrow',{start:0,end:2}),
      frameRate:8,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow_ground',
      frames:this.anims.generateFrameNumbers('sparrow',{start:3,end:5}),
      frameRate:4,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow_peck',
      frames:this.anims.generateFrameNumbers('sparrow',{start:6,end:8}),
      frameRate:6,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow2_fly',
      frames:this.anims.generateFrameNumbers('sparrow2',{start:0,end:2}),
      frameRate:8,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow2_ground',
      frames:this.anims.generateFrameNumbers('sparrow2',{start:3,end:5}),
      frameRate:4,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow2_peck',
      frames:this.anims.generateFrameNumbers('sparrow2',{start:6,end:8}),
      frameRate:6,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow3_fly',
      frames:this.anims.generateFrameNumbers('sparrow3',{start:0,end:1}),
      frameRate:8,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow3_ground',
      frames:this.anims.generateFrameNumbers('sparrow3',{start:2,end:3}),
      frameRate:4,
      repeat:-1
    });

    // dog animations
    this.anims.create({
      key:'dog_walk',
      frames:this.anims.generateFrameNumbers('dog1',{start:0,end:1}),
      frameRate:4,
      repeat:-1
    });
    this.anims.create({ key:'dog_bark', frames:[{key:'dog1',frame:2}], frameRate:1 });

    // dialog
    dialogBg=this.add.graphics()
      .setVisible(false)
      .setDepth(10);
    dialogBg.x=240;
    dialogBg.y=DIALOG_Y; // raise bubble slightly
    dialogBg.width=360; // starting size, adjusted later
    dialogBg.height=120;

    dialogPriceBox=this.add.rectangle(0,0,120,80,0xffeeb5)
      .setStrokeStyle(2,0x000)
      .setOrigin(0.5);
  dialogPriceTicket=this.add.image(0,0,'price_ticket')
    .setOrigin(0.5)
    .setScale(1.25)
    .setVisible(false);
  createGrayscaleTexture(this, 'price_ticket', 'price_ticket_gray');
  dialogPupCup=this.add.image(0,0,'pupcup')
    .setOrigin(0.5)
    .setScale(0.8)
    .setVisible(false);

    dialogPriceLabel=this.add.text(0,-15,'',{font:'14px sans-serif',fill:'#000',align:'center'})
      .setOrigin(0.5);
    dialogPriceValue=this.add.text(-5,20,'',{font:'40px sans-serif',fill:'#000'})
      .setOrigin(0.5);
    const baseEmoji = this.add.text(0,0,'',{font:'24px sans-serif'}).setOrigin(0.5);
    const extra1 = this.add.text(0,-18,'',{font:'16px sans-serif'}).setOrigin(0.5);
    const extra2 = this.add.text(0,-18,'',{font:'16px sans-serif'}).setOrigin(0.5);
    const extra3 = this.add.text(0,-18,'',{font:'16px sans-serif'}).setOrigin(0.5);
    // Add base first so extras render on top of the drink
    dialogDrinkEmoji=this.add.container(-30,-20,[baseEmoji, extra1, extra2, extra3]);
    dialogDrinkEmoji.base = baseEmoji;
    dialogDrinkEmoji.extras = [extra1, extra2, extra3];
    dialogDrinkEmoji.haloTweens = [];
    dialogDrinkEmoji.stopHalo = function(){
      this.haloTweens.forEach(t=>{ if(t && t.remove) t.remove(); else if(t && t.stop) t.stop(); });
      this.haloTweens = [];
    };
    dialogDrinkEmoji.startHalo = function(){
      this.stopHalo();
      const visibleExtras = this.extras.filter(e=>e.visible && e.text);
      if(!visibleExtras.length) return;
      const radius = 12;
      visibleExtras.forEach((e,i)=>{
        const offset = i/visibleExtras.length * Math.PI*2;
        const tween=this.scene.tweens.addCounter({
          from:0,to:Math.PI*2,duration:2000,repeat:-1,
          onUpdate:t=>{
            const ang=t.getValue()+offset;
            e.x = Math.cos(ang)*radius;
            e.y = this.base.y-12 + Math.sin(ang)*radius;
          }
        });
        this.haloTweens.push(tween);
      });
    };
    dialogDrinkEmoji.setText = function(str){
      const parts = String(str||'').split('\n');
      const base = parts.pop() || '';
      const extras = parts.join(' ').trim().split(/\s+/).filter(Boolean).slice(0,3);
      this.base.setText(base);
      this.extras.forEach((e,i)=>{
        if(extras[i]){
          e.setText(extras[i]).setVisible(true);
        }else{
          e.setText('').setVisible(false);
        }
      });

      const count = extras.length;
      const baseY = count ? 4 : 0;
      this.base.setPosition(0, baseY).setScale(count ? 0.9 : 1.1);
      if(count===1){
        this.extras[0].setScale(0.5).setPosition(0, baseY-16);
      }else if(count===2){
        this.extras[0].setScale(0.4).setPosition(-4, baseY-15);
        this.extras[1].setScale(0.4).setPosition(4, baseY-15);
      }else if(count>=3){
        this.extras[0].setScale(0.35).setPosition(-6, baseY-15);
        this.extras[1].setScale(0.35).setPosition(6, baseY-15);
        this.extras[2].setScale(0.35).setPosition(0, baseY-25);
      }
      this.startHalo();
      return this;
    };
    dialogDrinkEmoji.setLineSpacing = ()=>dialogDrinkEmoji;
    dialogDrinkEmoji.clearTint = function(){
      if(this.base.clearTint) this.base.clearTint();
      this.extras.forEach(e=>{ if(e.clearTint) e.clearTint(); });
      return this;
    };

    dialogPriceContainer=this.add.container(0,0,[dialogPriceTicket, dialogPupCup, dialogPriceBox, dialogDrinkEmoji, dialogPriceLabel, dialogPriceValue])
      .setDepth(11)
      .setVisible(false);

    dialogText=this.add.text(240,410,'',{font:'20px sans-serif',fill:'#000',align:'center'})
                     .setOrigin(0,0.5).setVisible(false).setDepth(11);
    dialogCoins=this.add.text(240,440,'',{font:'20px sans-serif',fill:'#000'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);

    // price label/value are part of dialogPriceContainer and should not
    // also be drawn inside the main dialog. Remove the duplicate texts that
    // caused the total cost to appear in the dialog bubble.


    // helper to create a rounded rectangle button with consistent sizing
    const createButton=(x,label,iconChar,iconSize,color,handler,width=BUTTON_WIDTH,height=BUTTON_HEIGHT)=>{
      const radius=8;
      const g=this.add.graphics();
      // Graphics objects do not support setShadow. Draw a simple shadow
      // manually by rendering a darker rect slightly offset behind the button.
      g.fillStyle(0x000000,0.3);
      g.fillRoundedRect(-width/2+2,-height/2+2,width,height,radius);

      g.fillStyle(color,1);
      g.fillRoundedRect(-width/2,-height/2,width,height,radius);
      let t=this.add.text(-width/2+10,0,label,{font:'20px sans-serif',fill:'#fff'})
        .setOrigin(0,0.5);
      let icon=this.add.text(width/2-10,0,iconChar,{font:`${iconSize}px sans-serif`,fill:'#fff'})
        .setOrigin(1,0.5);
      let children=[g,t,icon];
      if(label==='REFUSE'){
        t.setFontSize(18);
        icon.setX(width/2-4);
        children=[g,icon,t];
      }
      // position the button slightly lower so it peeks out of the dialog box
      const c=this.add.container(x,BUTTON_Y,children)
        .setSize(width,height)
        .setDepth(12)
        .setVisible(false);

      const zone=this.add.zone(0,0,width,height).setOrigin(0.5);
      zone.setInteractive({ useHandCursor:true });
      zone.on('pointerdown',()=>blinkButton.call(this,c,handler,zone));
      c.add(zone);
      return c;
    };

    // buttons evenly spaced

    // Arrange buttons: Refuse on the left, Sell in the middle (largest), Give on the right
    btnRef=createButton(80,'REFUSE','✋',32,0x800000,()=>handleAction.call(this,'refuse'));
    // Make the Sell button wider so it stands out
    btnSell=createButton(240,'SELL','💵',36,0x006400,()=>handleAction.call(this,'sell'), BUTTON_WIDTH*1.3, BUTTON_HEIGHT);
    // The "Give" button should stand out from the sell/refuse buttons. Use a
    // softer pastel pink so it is noticeable without being overwhelming.
    btnGive=createButton(400,'GIVE','💝',28,0xffb6c1,()=>handleAction.call(this,'give'));


    // sliding report texts
    reportLine1=this.add.text(480,moneyText.y,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine2=this.add.text(480,moneyText.y+20,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine3=this.add.text(480,loveText.y,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    tipText=this.add.text(0,0,'',{font:'bold 24px sans-serif',fill:'#fff',strokeThickness:0})
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);
    paidStamp=this.add.text(0,0,'SOLD',{
        font:'bold 32px sans-serif',
        fill:'#fff',
        strokeThickness:0
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);
    lossStamp=this.add.text(0,0,'LOSS',{
        font:'bold 28px sans-serif',
        fill:'#ff0000',
        stroke:'#ff0000',
        strokeThickness:2
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);

    // wait for player to start the shift
    showStartScreen.call(this);
    scheduleSparrowSpawn(this);

    // ensure customer sprites match vertical scale and keep drink emoji attached
    this.events.on('update', (_, dt) => {
      enforceCustomerScaling();
      updateDrinkEmojiPosition();
      updateSparrows(this, dt);
    });


  }





  function drawDialogBubble(targetX, targetY, fillColor=0xffffff){
    if(!dialogBg) return;
    const w=dialogBg.width, h=dialogBg.height;
    dialogBg.clear();
    dialogBg.fillStyle(fillColor,1);
    dialogBg.lineStyle(2,0x000,1);
    dialogBg.fillRoundedRect(-w/2,-h/2,w,h,24); // rounder corners
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
  }

  function showDialog(){
    if (GameState.saleInProgress || GameState.dialogActive) {
      // Defer showing the next order until the current sale animation finishes
      // or while another dialog is already visible
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
    // reset the dialog position in case previous animations moved it
    dialogBg.y = typeof DIALOG_Y === 'number' ? DIALOG_Y : 430;
    dialogBg.setAlpha(1);
    dialogText.setAlpha(1);
    dialogCoins.setAlpha(1);
    GameState.activeCustomer=GameState.queue[0]||null;
    if(!GameState.activeCustomer) return;
    const c=GameState.activeCustomer;
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
      const itemStr=c.orders.map(o=>{
        return o.qty>1 ? `${o.qty} ${o.req}` : o.req;
      }).join(' and ');
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
      if (canAfford) {
        coinLine = `I have $${c.orders[0].coins}`;
      } else if (c.orders[0].coins === 0) {
        const options = ['...but I have nothing', "...I'm poor", "I don't have money"];
        coinLine = Phaser.Utils.Array.GetRandom(options);
      } else {
        coinLine = `...but I only have $${c.orders[0].coins}`;
      }
    }
    dialogCoins
      .setOrigin(0.5)
      .setStyle({fontSize:'24px'})
      .setText(coinLine)
      .setVisible(!c.isDog);

    const maxW=Math.max(dialogText.width, c.isDog?0:dialogCoins.width);
    const hMargin = 20;
    const vMargin = 15;
    const lineGap = 10;
    dialogBg.width = Math.max(maxW + hMargin * 2, 160);
    dialogBg.height = dialogText.height + (c.isDog?0:dialogCoins.height + lineGap) + vMargin * 2;

    const bubbleTop=dialogBg.y - dialogBg.height/2;
    const textY=bubbleTop + vMargin + dialogText.height/2;
    dialogText.setPosition(dialogBg.x, textY);
    if(!c.isDog){
      dialogCoins.setPosition(
        dialogBg.x,
        textY + dialogText.height/2 + lineGap + dialogCoins.height/2
      );
    }

    dialogBg.setScale(0).setVisible(true);
    GameState.dialogActive = true;
    dialogText.setScale(0);
    dialogCoins.setScale(0);
    // use a static bubble color to avoid expensive image analysis
    let bubbleColor = 0xffffff;
    drawDialogBubble(c.sprite.x, c.sprite.y, bubbleColor);


    const ticketW = c.isDog
      ? dialogPriceBox.width
      : (dialogPriceTicket ? dialogPriceTicket.displayWidth : dialogPriceBox.width);
    const ticketH = c.isDog
      ? dialogPriceBox.height
      : (dialogPriceTicket ? dialogPriceTicket.displayHeight : dialogPriceBox.height);
    const ticketOffset = ticketW / 2 + 10;

    const truckRef = (typeof truck !== 'undefined' && truck) ? truck : null;

    const girlRight = (typeof girl !== 'undefined' && girl)
      ? girl.x + girl.displayWidth / 2
      : dialogBg.x;
    const minX = girlRight + ticketOffset;

    let priceTargetX;
    let priceTargetY;
    if (truckRef) {
      const truckRight = truckRef.x + truckRef.displayWidth / 2;
      const truckTop = truckRef.y - truckRef.displayHeight / 2;
      priceTargetX = Math.max(truckRight + ticketOffset, minX) - 10;
      priceTargetY = truckTop + ticketH / 2;
    } else {
      const priceTargetXDefault = dialogBg.x + dialogBg.width/2 - 30; // nudge right
      priceTargetX = Math.max(priceTargetXDefault, minX) - 10;
      priceTargetY = dialogBg.y - dialogBg.height - 20 - (c.isDog ? 30 : 0);
    }

    const startX = (typeof girl !== 'undefined' && girl) ? girl.x : dialogBg.x;
    const startY = (typeof girl !== 'undefined' && girl) ? girl.y - 20 : dialogBg.y;
    dialogPriceContainer
      .setPosition(startX, startY)
      .setScale(0.2)
      .setVisible(false);
    if (dialogDrinkEmoji.parentContainer !== dialogPriceContainer) {
      dialogPriceContainer.add(dialogDrinkEmoji);
    }
    dialogDrinkEmoji.attachedTo = null;
    dialogPriceContainer.alpha = 1;
    if(c.isDog){
      dialogPriceTicket.setVisible(false);
      dialogPupCup.setVisible(true);
      dialogPriceBox.setVisible(false);
      dialogPriceBox.width = dialogPupCup.displayWidth;
      dialogPriceBox.height = dialogPupCup.displayHeight;
      dialogPriceLabel.setVisible(false);
      dialogPriceValue.setVisible(false);
      dialogDrinkEmoji
        .setText('🍨')
        // Lower the dessert emoji slightly so it sits in the cup better
        .setPosition(0,-dialogPriceBox.height/4 + 10)
        .setScale(2)
        .setVisible(true);
      // Give the dessert emoji a dark, heavy shadow outline so it pops
      dialogDrinkEmoji.base
        .setShadow(0, 0, '#000', 8)
        .setStyle({stroke:'#000', strokeThickness:4});


    } else {
      dialogPupCup.setVisible(false);
      dialogPriceTicket.setVisible(true);
      dialogPriceBox.setVisible(false); // hide outline from old ticket
      dialogPriceBox.width = dialogPriceTicket.displayWidth;
      dialogPriceBox.height = dialogPriceTicket.displayHeight;
      dialogPriceLabel.setVisible(false); // remove "Total Cost" text
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
      dialogDrinkEmoji
        .setPosition(0,-dialogPriceBox.height/4 + 8) // slightly lower
        .setScale(2)
        .setVisible(true)
        .setDepth(paidStamp.depth + 1);
      dialogDrinkEmoji.base
        .setShadow(0, 0, '#000', 0)
        .setStyle({strokeThickness:0});
    }

    this.tweens.add({
      targets:[dialogBg, dialogText, dialogCoins],
      scale:1,
      ease:'Back.easeOut',
      duration:dur(300),
      onComplete:()=>{
        const showPrice=()=>{
          dialogPriceContainer.setVisible(true);
          this.tweens.add({
            targets:dialogPriceContainer,
            x:priceTargetX,
            y:priceTargetY,
            scale:1,
            duration:dur(300),
            ease:'Sine.easeOut',
            onComplete:()=>{
              if (typeof fadeInButtons === 'function') {
                fadeInButtons.call(this, canSell);
              } else {
                if (canSell) {
                  btnSell.setVisible(true);
                  if (btnSell.input) btnSell.input.enabled = true;
                } else {
                  btnSell.setVisible(false);
                  if (btnSell.input) btnSell.input.enabled = false;
                }
                btnGive.setVisible(true);
                if (btnGive.input) btnGive.input.enabled = true;
                if (btnRef.input) btnRef.input.enabled = true;
              }
            }
          });
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
    if (!flinging && !dialogDrinkEmoji.attachedTo &&
        dialogDrinkEmoji.parentContainer !== dialogPriceContainer) {
      dialogPriceContainer.add(dialogDrinkEmoji);
    }
    if (dialogPriceValue.parentContainer !== dialogPriceContainer) {
      dialogPriceContainer.add(dialogPriceValue);
    }
    // Keep the drink emoji visible when the price ticket remains on screen
    if(!keepPrice){
      dialogDrinkEmoji.setVisible(false);
    }else{
      dialogDrinkEmoji.setVisible(true);
    }
    if(resetTicket){
      resetPriceBox.call(this);
    }
    btnSell.setVisible(false);
    if (btnSell.input) btnSell.input.enabled = false;
    btnGive.setVisible(false);
    if (btnGive.input) btnGive.input.enabled = false;
    btnRef.setVisible(false);
    if (btnRef.input) btnRef.input.enabled = false;
    tipText.setVisible(false);

  }

  function flingTicketEmojiToCustomer(target){
    if(!dialogDrinkEmoji || !dialogPriceContainer || !dialogPriceContainer.visible || !target) return;
    if(dialogDrinkEmoji.stopHalo) dialogDrinkEmoji.stopHalo();
    let worldX = dialogDrinkEmoji.x;
    let worldY = dialogDrinkEmoji.y;
    if(dialogDrinkEmoji.getWorldTransformMatrix){
      const m = dialogDrinkEmoji.getWorldTransformMatrix();
      worldX = m.tx;
      worldY = m.ty;
    }
    if(dialogDrinkEmoji.parentContainer){
      dialogPriceContainer.remove(dialogDrinkEmoji);
      this.add.existing(dialogDrinkEmoji);
    }
    dialogDrinkEmoji.setPosition(worldX, worldY);
    dialogDrinkEmoji.attachedTo = null;
    this.tweens.add({
      targets: dialogDrinkEmoji,
      x: target.x + DRINK_HOLD_OFFSET.x,
      y: target.y + DRINK_HOLD_OFFSET.y,
      scale: 0,
      alpha: 0,
      duration: dur(300),
      ease: 'Cubic.easeIn',
      onComplete: () => {
        dialogDrinkEmoji.setVisible(false);
        dialogDrinkEmoji.setScale(2).setAlpha(1);
      }
    });
  }

  function handleAction(type){
    const current=GameState.activeCustomer;
    if (current) {
      GameState.saleInProgress = true;
    }
    if ((type==='sell' || type==='give') && dialogDrinkEmoji && dialogPriceContainer && dialogPriceContainer.visible) {
      dialogDrinkEmoji.clearTint();
      flingTicketEmojiToCustomer.call(this, current ? current.sprite : null);
    }
    if(current){
      const bubbleObjs=[];
      if(typeof dialogBg!=='undefined') bubbleObjs.push(dialogBg);
      if(typeof dialogText!=='undefined') bubbleObjs.push(dialogText);
      if(typeof dialogCoins!=='undefined') bubbleObjs.push(dialogCoins);
      const ticket = typeof dialogPriceContainer!=='undefined' ? dialogPriceContainer : null;
      if(this.tweens && (bubbleObjs.length || ticket)){
        if(type==='refuse'){
          if(dialogBg.setTint) dialogBg.setTint(0xff0000);
          if(dialogText.setColor) dialogText.setColor('#f00');
          if(dialogCoins.setColor) dialogCoins.setColor('#f00');
          if(ticket){
            this.tweens.add({targets:ticket, x:520, alpha:0,
                            duration:dur(300), ease:'Cubic.easeIn'});
          }
          // Move each dialog element downward together rather than
          // converging on a single absolute Y position.
          this.tweens.add({targets:bubbleObjs, y:'+=80', scale:1.5, alpha:0,
                          duration:dur(300), ease:'Cubic.easeIn', onComplete:()=>{
            if(dialogBg.clearTint) dialogBg.clearTint();
            if(dialogText.setColor) dialogText.setColor('#000');
            if(dialogCoins.setColor) dialogCoins.setColor('#000');
            clearDialog.call(this, false);
          }});
        } else {
          // Only animate the dialog bubble away. Leave the price ticket
          // visible so it can fly over to the score area.
          this.tweens.add({targets:bubbleObjs, y:current.sprite.y, scale:0, duration:dur(200), onComplete:()=>{
            clearDialog.call(this, true, type!=='give');
          }});
        }
      } else {
        clearDialog.call(this, type!=='refuse');
      }
    } else {
      clearDialog.call(this, type!=='refuse');
    }
    if(!current) return;
    const orderCount=current.orders.length;
    const totalCost=current.orders.reduce((s,o)=>s+o.price*o.qty,0);

    let mD=0, lD=0, tip=0;
    if(type==='sell'){
      lD=Phaser.Math.Between(0,2)*orderCount;
      mD=totalCost; // tip added later based on mood
    } else if(type==='give'){
      lD=Phaser.Math.Between(2,4)*orderCount;
      mD=-totalCost;
    } else {
      lD=-Phaser.Math.Between(1,3)*orderCount;
    }

    const memory = current.memory || {state: CustomerState.NORMAL};
    const baseL = lD;
    switch(memory.state){
      case CustomerState.BROKEN:
        lD = Math.max(baseL - 1, 0);
        if(type==='sell') memory.state = CustomerState.MENDING;
        if(type==='give') memory.state = CustomerState.NORMAL;
        break;
      case CustomerState.MENDING:
        if(type==='sell') memory.state = CustomerState.NORMAL;
        break;
      case CustomerState.GROWING:
        lD = Math.max(baseL,1) + 1;
        if(type==='give') memory.state = CustomerState.SPARKLING;
        break;
      case CustomerState.SPARKLING:
        lD = Math.max(baseL,2) + 2;
        if(type==='give') memory.state = CustomerState.ARROW;
        break;
      case CustomerState.ARROW:
        lD = baseL + 3;
        if(type==='give') GameState.heartWin = HEART_EMOJIS[CustomerState.ARROW];
        break;
      default:
        if(type==='give') memory.state = CustomerState.GROWING;
    }
    if(type==='refuse'){
      memory.state = CustomerState.BROKEN;
      if(current.dog && current.dog.dogCustomer && current.dog.dogCustomer.memory){
        current.dog.dogCustomer.memory.state = CustomerState.BROKEN;
      }
    }
    if(current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active){
      current.heartEmoji.destroy();
    }
    current.heartEmoji=null;
    if(memory.state !== CustomerState.NORMAL && current.sprite){
      const hy = current.sprite.y + current.sprite.displayHeight * 0.30;
      const hs = scaleForY(current.sprite.y) * 0.8;
      current.heartEmoji = current.sprite.scene.add.text(current.sprite.x, hy, HEART_EMOJIS[memory.state]||'',{font:'28px sans-serif'})
        .setOrigin(0.5)
        .setScale(hs)
        .setDepth(current.sprite.depth+1)
        .setShadow(0, 0, '#000', 4);
    }

    if(type==='refuse' && current.dog && current.dog.dogCustomer &&
       current.dog.dogCustomer.memory.state === CustomerState.BROKEN){
      dogTruckRuckus.call(this, current.dog);
    }

    if(type==='sell'){
      let pct=0;
      switch(memory.state){
        case CustomerState.BROKEN:
        case CustomerState.MENDING:
          pct=0;
          break;
        case CustomerState.NORMAL:
          pct = Phaser.Math.Between(0,1)===0 ? 0.25 : 0;
          break;
        case CustomerState.GROWING:
          pct=0.25;
          break;
        case CustomerState.SPARKLING:
          pct=0.50;
          break;
        case CustomerState.ARROW:
          pct=1.00;
          break;
        default:
          pct=0;
      }

      const coins=current.orders[0].coins;
      const maxTip=Math.max(0, coins-totalCost);
      const desiredTip=totalCost*pct;
      tip=+Math.min(desiredTip, maxTip).toFixed(2);
      mD += tip;
    }

    const tipPct=type==='sell'? (totalCost>0? Math.round((tip/totalCost)*100):0):0;
    const customer=current.sprite;
    GameState.activeCustomer=null;

    const finish=()=>{
      GameState.saleInProgress = false;
      const exit=()=>{
        if(dialogDrinkEmoji && dialogDrinkEmoji.attachedTo === current.sprite){
          dialogDrinkEmoji.attachedTo = null;
          dialogDrinkEmoji.setVisible(false);
        }
        if(current.isDog && current.owner && current.owner.waitingForDog){
          const owner=current.owner;
          const dir = Phaser.Math.Between(0,1)?1:-1;
          const startX=owner.sprite.x;
          const targetY=700;
          const distanceX=Phaser.Math.Between(80,160)*dir;
          const amp=Phaser.Math.Between(10,25);
          const freq=Phaser.Math.Between(2,4);
          owner.exitX=startX+distanceX;
          owner.exitY=targetY;
          current.exitX=owner.exitX;
          current.exitY=owner.exitY;
          this.tweens.add({targets:owner.sprite,y:targetY,duration:dur(6000),callbackScope:this,
            onUpdate:(tw,t)=>{const p=tw.progress; t.x=startX+p*distanceX+Math.sin(p*Math.PI*freq)*amp; t.setScale(scaleForY(t.y));
              if(owner.heartEmoji && owner.heartEmoji.scene && owner.heartEmoji.active){
                const hy=t.y+t.displayHeight*0.30;
                const hs=scaleForY(t.y)*0.8;
                owner.heartEmoji.setPosition(t.x,hy).setScale(hs).setDepth(t.depth+1).setShadow(0,0,'#000',4);
              }
            },
            onComplete:owner.exitHandler});
          sendDogOffscreen.call(this,current.sprite,owner.exitX,owner.exitY);
          owner.dog = null;
          return;
        } else if(current.dog){
          if(typeof current.exitX==='number' && typeof current.exitY==='number'){
            sendDogOffscreen.call(this,current.dog,current.exitX,current.exitY);
          } else {
            if(current.dog.followEvent) current.dog.followEvent.remove(false);
            current.dog.destroy();
          }
        }
        if(current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active){
          current.heartEmoji.destroy();
        }
        current.heartEmoji = null;
        const winSpriteKey = current.sprite.texture ? current.sprite.texture.key : current.spriteKey;
        current.sprite.destroy();
        if(GameState.money<=0){
          showFalconAttack.call(this,()=>{
            showEnd.call(this,'Game Over\nYou lost all the money.\nLady Falcon reclaims the coffee truck.', null, {keepTweens:true});
          });
          return;
        }
        if(GameState.love<=0){
          showCustomerRevolt.call(this,()=>{
            showEnd.call(this,'Game Over\nThe Customers Revolt!\n(and they stole your truck)');
          });
          return;
        }
        if(GameState.money>=MAX_M){showEnd.call(this,'Congrats! 💰');return;}
        if(GameState.love>=MAX_L){showEnd.call(this,'Victory! ❤️');return;}
        if(GameState.heartWin){
          showTrueLoveVictory.call(this, winSpriteKey);
          GameState.heartWin = null;
          return;
        }
        scheduleNextSpawn(this);
        GameState.servedCount++;
        updateSideC.call(this);
      };

      const sprite=current.sprite;
      setDepthFromBottom(sprite,5);

      // Remove the current customer from the queue
      GameState.queue.shift();

      if(current.dogCustomer && !current.isDog){
        const dogCust = current.dogCustomer;
        if(current.dog && current.dog.followEvent){
          current.dog.followEvent.remove(false);
          current.dog.followEvent = null;
        }
        if(dogCust.followEvent){ dogCust.followEvent.remove(false); dogCust.followEvent=null; }
        dogCust.atOrder = false;
        dogCust.arrived = true;
        dogCust.arrivalTime = this.time ? this.time.now : Date.now();
        GameState.queue.unshift(dogCust);
        const waitX = ORDER_X + 50;
        this.tweens.add({
          targets: sprite,
          x: waitX,
          duration: dur(300),
          onUpdate: (tw, t) => {
            if (current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active) {
              const hy = t.y + t.displayHeight * 0.30;
              const hs = scaleForY(t.y) * 0.8;
              current.heartEmoji
                .setPosition(t.x, hy)
                .setScale(hs)
                .setDepth(t.depth + 1)
                .setShadow(0, 0, '#000', 4);
            }
          }
        });
        current.waitingForDog = true;
        current.exitHandler = exit;
        GameState.activeCustomer = dogCust;
        showDialog.call(this);
        return;
      }

      moveQueueForward.call(this);

      if(current.dog && !current.dog.followEvent){
        current.dog.followEvent = this.time.addEvent({
          delay: dur(Phaser.Math.Between(800, 1200)),
          loop: true,
          callback: () => { if (typeof updateDog === 'function') updateDog.call(this, current); }
        });
      }

      if(current.isDog && current.owner && current.owner.waitingForDog){
        const owner=current.owner;
        owner.waitingForDog=false;
        const dir = Phaser.Math.Between(0,1)?1:-1;
        const startX=owner.sprite.x;
        const targetY=700;
        const distanceX=Phaser.Math.Between(80,160)*dir;
        const amp=Phaser.Math.Between(10,25);
        const freq=Phaser.Math.Between(2,4);
        owner.exitX=startX+distanceX;
        owner.exitY=targetY;
        current.exitX=owner.exitX;
        current.exitY=owner.exitY;
        this.tweens.add({targets:owner.sprite,y:targetY,duration:dur(6000),callbackScope:this,
          onUpdate:(tw,t)=>{const p=tw.progress; t.x=startX+p*distanceX+Math.sin(p*Math.PI*freq)*amp; t.setScale(scaleForY(t.y));
            if(owner.heartEmoji && owner.heartEmoji.scene && owner.heartEmoji.active){
              const hy=t.y+t.displayHeight*0.30;
              const hs=scaleForY(t.y)*0.8;
              owner.heartEmoji.setPosition(t.x,hy).setScale(hs).setDepth(t.depth+1).setShadow(0,0,'#000',4);
            }
          },
          onComplete:owner.exitHandler});
        sendDogOffscreen.call(this,current.sprite,current.exitX,current.exitY);
        return;
      }

      if(type==='refuse'){
        const dir = sprite.x < girl.x ? -1 : 1;
        const startX = sprite.x;
        const targetY = 700;
        const distanceX = Phaser.Math.Between(80, 160) * dir;
        const amp = Phaser.Math.Between(10, 25);
        const freq = Phaser.Math.Between(2, 4);
        current.exitX = startX + distanceX;
        current.exitY = targetY;
        this.tweens.add({
          targets: sprite,
          y: targetY,
          duration: dur(3000),
          callbackScope: this,
          onUpdate: (tw, t) => {
            const p = tw.progress;
            t.x = startX + p * distanceX + Math.sin(p * Math.PI * freq) * amp;
            t.setScale(scaleForY(t.y));
            if(current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active){
              const hy = t.y + t.displayHeight * 0.30;
              const hs = scaleForY(t.y) * 0.8;
              current.heartEmoji.setPosition(t.x, hy).setScale(hs).setDepth(t.depth+1).setShadow(0, 0, '#000', 4);
            }
          },
          onComplete: exit
        });
      }else{
        const dir = Phaser.Math.Between(0,1)?1:-1;
        const startX=sprite.x;
        const targetY=700;
        const distanceX=Phaser.Math.Between(80,160)*dir;
        const amp=Phaser.Math.Between(10,25);
        const freq=Phaser.Math.Between(2,4);
        current.exitX = startX + distanceX;
        current.exitY = targetY;
        this.tweens.add({targets:sprite,y:targetY,duration:dur(6000),callbackScope:this,
          onUpdate:(tw,t)=>{const p=tw.progress; t.x=startX+p*distanceX+Math.sin(p*Math.PI*freq)*amp; t.setScale(scaleForY(t.y));
            if(current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active){
              const hy = t.y + t.displayHeight * 0.30;
              const hs = scaleForY(t.y) * 0.8;
              current.heartEmoji.setPosition(t.x, hy).setScale(hs).setDepth(t.depth+1).setShadow(0, 0, '#000', 4);
            }
          },
          onComplete:exit});
      }
    };

    // animated report using timelines
    const midX=240, midY=120;

    let pending=(type!=='refuse'?1:0)+(lD!==0?1:0);
    const done=()=>{ if(--pending<=0) finish(); };

    if(type==='sell'){
      const ticket=dialogPriceContainer;
      const t=dialogPriceValue;
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      t.setVisible(true);
      // start below the stamp so the stamp appears on top first
      t.setDepth(paidStamp.depth-1);
      const baseLeft = t.x - t.displayWidth/2;
      t.setText(receipt(totalCost));
      t.setPosition(baseLeft + t.displayWidth/2, t.y);
      // Price border will blink; no additional flash needed
      const ticketH = dialogPriceBox.height;
      let centerX = ticket.x;
      let stampY = ticket.y;
      if (ticket.getWorldTransformMatrix) {
        const m = ticket.getWorldTransformMatrix();
        centerX = m.tx;
        stampY = m.ty;
      }
      if (tip > 0) {
        stampY -= ticketH * 0.2;
      }
      const randFloat = Phaser.Math.FloatBetween || ((a,b)=>Phaser.Math.Between(a*1000,b*1000)/1000);
      const skewFn = typeof applyRandomSkew === 'function' ? applyRandomSkew : ()=>{};
      const finalScale = 1.4 + randFloat(-0.1, 0.1);
      const targetX = centerX + Phaser.Math.Between(-3,3);
      const targetY = stampY + Phaser.Math.Between(-3,3);
      const targetAngle = Phaser.Math.Between(-10,10);
      let startX = t.x;
      let startY = t.y;
      if (t.getWorldTransformMatrix) {
        const m2 = t.getWorldTransformMatrix();
        startX = m2.tx;
        startY = m2.ty;
      }
      paidStamp
        .setText('SOLD')
        .setScale(finalScale * 0.5)
        .setPosition(startX, startY)
        .setAngle(0)
        .setVisible(true);
      this.tweens.add({
        targets: paidStamp,
        x: targetX,
        y: targetY,
        angle: targetAngle,
        scale: finalScale,
        duration: dur(200),
        ease: 'Cubic.easeOut',
        onComplete: () => { skewFn(paidStamp); }
      });
      // raise the price above the stamp after the stamp lands
      this.time.delayedCall(dur(300), () => {
        if (dialogPriceValue.parentContainer) {
          const m = dialogPriceValue.getWorldTransformMatrix();
          dialogPriceContainer.remove(dialogPriceValue);
          this.add.existing(dialogPriceValue);
          dialogPriceValue.setPosition(m.tx, m.ty);
        }
        t.setDepth(paidStamp.depth + 1);
        // Keep the price text green after the sale
        t.setColor('#006400');
        // Removed blinkPriceBorder; no need to flash the price text
      }, [], this);
      // Removed flashing movement of the price text

      let delay=dur(300);
      if(tip>0){
        this.time.delayedCall(delay,()=>{
          const oldLeft = t.x - t.displayWidth/2;
          const randFloat2 = Phaser.Math.FloatBetween || ((a,b)=>Phaser.Math.Between(a*1000,b*1000)/1000);
          tipText
            .setText('TIP')
            .setScale(1.3 + randFloat2(-0.1, 0.1))
            .setPosition(paidStamp.x, paidStamp.y)
            .setAngle(Phaser.Math.Between(-15,15))
            .setVisible(true)
            .setDepth(paidStamp.depth);
          skewFn(tipText);
          const blinkTween = this.tweens.add({
            targets: tipText,
            alpha: 0,
            duration: dur(80),
            yoyo: true,
            repeat: -1
          });
          this.tweens.add({
            targets: tipText,
            x: t.x,
            y: t.y,
            duration: dur(200),
            ease: 'Back.easeOut',
            onComplete: () => {
              blinkTween.stop();
              tipText.setAlpha(1);
              this.tweens.add({
                targets: tipText,
                x: paidStamp.x,
                y: paidStamp.y + tipText.displayHeight,
                angle: Phaser.Math.Between(-15,15),
                duration: dur(300),
                ease: 'Bounce.easeOut'
              });
            }
          });
          countPrice(t, this, totalCost, totalCost + tip, oldLeft, t.y);
          // Removed blinkPriceBorder; price text stays static
          // no scaling or flash animation for price text
        },[],this);
        delay+=dur(300);
      } else {
        tipText.setVisible(false);
      }
      delay+=dur(1000);
      this.time.delayedCall(delay,()=>{
        paidStamp.setVisible(false);
        tipText.setVisible(false);
        const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
            clearDialog.call(this);
            ticket.setVisible(false);
            GameState.money=+(GameState.money+mD).toFixed(2);
            moneyText.setText('🪙 '+receipt(GameState.money));
            animateStatChange(moneyText, this, mD);
            done();
        }});
        tl.add({targets:ticket,x:destX,y:destY,scale:0,duration:dur(400),
          onStart:()=>{
            if(!dialogPriceValue.parentContainer){
              ticket.add(dialogPriceValue);
              dialogPriceValue.setPosition(-5, priceValueYOffset + 5);
            }
            flashBorder(dialogPriceBox,this,0x00ff00);
            flashFill(dialogPriceBox,this,0x00ff00);
            if(this.tweens){
              this.tweens.add({targets:dialogPriceBox,fillAlpha:0,duration:dur(400)});
            }
            if(dialogDrinkEmoji){
              dialogDrinkEmoji.clearTint();
            }
          }});
        tl.play();
      },[],this);
        } else if(type==='give'){
      const ticket=dialogPriceContainer;
      const t=dialogPriceValue;
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      if(current.isDog){
        // Pup cup: keep the ticket visible briefly so the dessert emoji can fly
        // to the dog before the ticket fades away.
        this.time.delayedCall(dur(1000), () => {
          this.tweens.add({
            targets: ticket,
            alpha: 0,
            duration: dur(200),
            ease: 'Cubic.easeIn',
            onComplete: () => {
              clearDialog.call(this);
              ticket.setVisible(false);
              GameState.money = +(GameState.money + mD).toFixed(2);
              moneyText.setText('🪙 ' + receipt(GameState.money));
              animateStatChange(moneyText, this, mD);
              done();
            }
          });
        }, [], this);
      } else {
        t.setVisible(true)
          // start below the stamp so the stamp animation appears on top
          .setDepth(lossStamp.depth-1)
          .setStyle({fontStyle:'bold', strokeThickness:0});
        const ticketH = dialogPriceBox.height;
        let centerX = ticket.x;
        let stampY = ticket.y;
        if (ticket.getWorldTransformMatrix) {
          const m = ticket.getWorldTransformMatrix();
          centerX = m.tx;
          stampY = m.ty;
        }
        stampY -= ticketH * 0.2;
        const stampX = centerX + Phaser.Math.Between(-5,5);
        const stampYFinal = stampY + Phaser.Math.Between(-3,3);
        const randFloat3 = Phaser.Math.FloatBetween || ((a,b)=>Phaser.Math.Between(a*1000,b*1000)/1000);
        const skewFn2 = typeof applyRandomSkew === 'function' ? applyRandomSkew :()=>{};
        lossStamp
          .setText('LOSS')
          .setScale(1.25 + randFloat3(-0.1, 0.1))
          .setPosition(stampX, stampYFinal)
          .setAngle(Phaser.Math.Between(-10,10))
          .setVisible(true);
        skewFn2(lossStamp);
        // Ticket turns grayscale while the price flashes red
        if(dialogPriceTicket){
          if(dialogPriceTicket.setTexture && this.textures.exists('price_ticket_gray')){
            dialogPriceTicket.setTexture('price_ticket_gray');
          }
          if(dialogPriceTicket.setTint){
            dialogPriceTicket.setTint(0xffffff);
            this.tweens.addCounter({
              from:0,
              to:1,
              duration:dur(1000),
              onUpdate:t=>{
                const p=t.getValue();
                const g=Math.round(255*(1-p));
                dialogPriceTicket.setTint(Phaser.Display.Color.GetColor(255,g,g));
              }
            });
          }
        }
        if (dialogPriceValue && dialogPriceValue.setColor) {
          dialogPriceValue.setColor('#ff0000');
        }
        // Keep the emoji in color and fly it over to the customer
        if (dialogDrinkEmoji) {
          if (dialogDrinkEmoji.parentContainer) {
            const m = dialogDrinkEmoji.getWorldTransformMatrix();
            dialogPriceContainer.remove(dialogDrinkEmoji);
            this.add.existing(dialogDrinkEmoji);
            dialogDrinkEmoji.setPosition(m.tx, m.ty);
          }
          dialogDrinkEmoji.setDepth(paidStamp.depth + 1);
          this.tweens.add({
            targets: dialogDrinkEmoji,
            x: customer.x + DRINK_HOLD_OFFSET.x,
            y: customer.y + DRINK_HOLD_OFFSET.y,
            duration: dur(400),
            ease: 'Cubic.easeOut',
            onComplete: () => { dialogDrinkEmoji.attachedTo = customer; }
          });
        }
        // raise the price above the stamp after the stamp lands
        this.time.delayedCall(dur(300), () => {
          t.setDepth(lossStamp.depth + 1);
        }, [], this);
        this.time.delayedCall(dur(1000),()=>{
          lossStamp.setVisible(false);
          dialogBg.setVisible(false);
          dialogText.setVisible(false);
          if(this.tweens){
            this.tweens.add({targets:ticket,x:'+=6',duration:dur(60),yoyo:true,repeat:2});
          }
          const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
              clearDialog.call(this);
              ticket.setVisible(false);
              GameState.money=+(GameState.money+mD).toFixed(2);
              moneyText.setText('🪙 '+receipt(GameState.money));
              animateStatChange(moneyText, this, mD);
              done();
          }});
          if (typeof dialogPriceBox !== 'undefined' && dialogPriceBox) {
            flashBorder(dialogPriceBox,this,0xff0000);
            flashFill(dialogPriceBox,this,0xff0000);
          }
          tl.add({targets:ticket,x:destX,y:destY,scale:0,duration:dur(400),
            onStart:()=>{
              if(!dialogPriceValue.parentContainer){
                ticket.add(dialogPriceValue);
                  dialogPriceValue.setPosition(-5, priceValueYOffset + 5);
              }
              if(this.tweens && typeof dialogPriceBox !== 'undefined' && dialogPriceBox){
                this.tweens.add({targets:dialogPriceBox,fillAlpha:0,duration:dur(400)});
              }

              if(dialogDrinkEmoji){
                dialogDrinkEmoji.clearTint();
              }

            }});
          tl.play();
        },[],this);
      }
} else if(type!=='refuse'){
      const showTip=tip>0;
      const startRX = (typeof girl !== 'undefined' && girl) ? girl.x : customer.x;
      const startRY = (typeof girl !== 'undefined' && girl) ? girl.y : customer.y;
      reportLine1.setStyle({fill:'#fff'})
        .setText(receipt(totalCost))
        .setPosition(startRX, startRY)
        .setScale(1)
        .setVisible(true);
      if(showTip){
        reportLine2.setText(`${receipt(tip)} ${tipPct}% TIP`)
          .setStyle({fontSize:'16px',fill:'#fff'})
          .setScale(1)
          .setPosition(startRX,startRY+24).setVisible(true);
      }else{
        reportLine2.setVisible(false);
      }
      reportLine3.setVisible(false).alpha=1;

      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      const moving=[reportLine1];
      const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
          reportLine1.setVisible(false).alpha=1;
          reportLine2.setVisible(false).alpha=1;
          reportLine3.setVisible(false).alpha=1;
          GameState.money=+(GameState.money+mD).toFixed(2);
          moneyText.setText('🪙 '+receipt(GameState.money));
          animateStatChange(moneyText, this, mD);
          done();
      }});
      tl.add({targets:reportLine1,x:midX,y:midY,duration:dur(300),onComplete:()=>{
            const word='SOLD';
            const color='#8f8';
            reportLine1.setColor(color);
            if(showTip){
              reportLine2.setColor(color);
            }
            reportLine3.setText(word)
              .setStyle({fontSize:'20px'})
              .setColor(color)
              .setPosition(midX,midY)
              .setOrigin(0.5)
              .setAlpha(1)
              .setVisible(true);
            this.tweens.add({targets:reportLine3,alpha:0,duration:dur(600)});
        }});
      if(showTip){
        tl.add({targets:reportLine2,x:midX,y:midY+24,duration:dur(300)},0);
        moving.push(reportLine2);
      }

      flashMoney(reportLine1,this);
      if(showTip) flashMoney(reportLine2,this);

      tl.add({targets:moving,duration:dur(2000)});
      const endDelay = showTip ? 0 : dur(300);
      tl.add({targets:moving,x:destX,y:destY,scale:0,alpha:0,duration:dur(400),delay:endDelay});

      tl.play();
    }

    if(lD!==0){
      animateLoveChange.call(this,lD,customer,done);
    }
    if(pending===0) finish();
  }

  function animateLoveChange(delta, customer, cb){
    const count=Math.abs(delta);
    const emoji=delta>0?'❤️':'😠';

    if(delta<0){
      this.tweens.add({targets:customer,y:customer.y-20,duration:dur(150),yoyo:true});
    }

    const baseX=customer.x - 20*(count-1)/2;
    const baseY=customer.y + 40;

    const hearts=[];
    for(let i=0;i<count;i++){
      const h=this.add.text(customer.x,customer.y,emoji,{font:'24px sans-serif',fill:'#fff'})
        .setOrigin(0.5).setDepth(11);
      hearts.push(h);
      if (typeof addFloatingEmoji === 'function') {
        addFloatingEmoji(h);
      } else if (GameState && typeof GameState.addFloatingEmoji === 'function') {
        GameState.addFloatingEmoji(h);
      } else if (Array.isArray(floatingEmojis)) {
        floatingEmojis.push(h);
      }
      const targetX=baseX+i*20;
      // sparkle or anger flash
      if(delta>0){
        const sp=this.add.text(customer.x,customer.y,'✨',{font:'18px sans-serif',fill:'#fff'})
          .setOrigin(0.5).setDepth(10);
        this.tweens.add({targets:sp,scale:1.5,alpha:0,duration:dur(300),onComplete:()=>sp.destroy()});
      }else{
        const ang=this.add.text(customer.x,customer.y,'💢',{font:'20px sans-serif',fill:'#f00'})
          .setOrigin(0.5).setDepth(12);
        this.tweens.add({targets:ang,alpha:0,duration:dur(300),onComplete:()=>ang.destroy()});
      }
      this.tweens.add({targets:h,x:targetX,y:baseY,duration:dur(400),ease:'Cubic.easeOut'});
    }
    const destX = () => loveText.x + loveText.width + 6;
    const destY = () => loveText.y + loveText.height;

    const popOne=(idx)=>{
      if(idx>=hearts.length){
        if(cb) cb();
        return;
      }
      const h=hearts[idx];
      const tl=this.tweens.createTimeline({callbackScope:this});
      tl.add({
        targets:h,
        x:destX(),
        y:destY(),
        scaleX:0,
        scaleY:1.2,
        duration:dur(125),
        onComplete:()=>{
          GameState.love += delta>0?1:-1;
          loveText.setText('❤️ '+GameState.love);
          updateLevelDisplay();
          animateStatChange(loveText, this, delta>0?1:-1, true);
        }
      });
      tl.add({targets:h,scaleX:1,alpha:0,duration:dur(125),onComplete:()=>{
            if (typeof removeFloatingEmoji === 'function') {
              removeFloatingEmoji(h);
            } else if (GameState && typeof GameState.removeFloatingEmoji === 'function') {
              GameState.removeFloatingEmoji(h);
            } else if (Array.isArray(floatingEmojis)) {
              const i = floatingEmojis.indexOf(h);
              if (i !== -1) floatingEmojis.splice(i, 1);
            }
            h.destroy();
            popOne(idx+1);
        }});
      tl.play();
    };
    this.time.delayedCall(dur(400),()=>popOne(0),[],this);
  }

  function showFalconAttack(cb){
    if (GameState.falconActive) return;
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    // Keep dogs around so they can defend the girl
    cleanupSparrows(scene);
    hideOverlayTexts();
    clearDialog.call(scene);
    GameState.falconActive = true;
    GameState.gameOver = true;
    if (GameState.dogBarkEvent) { GameState.dogBarkEvent.remove(false); }
    GameState.dogBarkEvent = null;
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }

        function panicCustomers(done){
      const fleeing=[...GameState.queue, ...GameState.wanderers];
      if(GameState.activeCustomer && !fleeing.includes(GameState.activeCustomer)){
        fleeing.push(GameState.activeCustomer);
      }
      const known=new Set(fleeing.map(c=>c.sprite));
      scene.children.list.forEach(child=>{
        if(child.texture && keys.includes(child.texture.key) && !known.has(child)){
          fleeing.push({sprite:child});
          known.add(child);
        }
      });
      scene.children.list.forEach(child=>{
        if(child instanceof Phaser.GameObjects.Text &&
           DOG_TYPES.some(d=>d.emoji===child.text) &&
           !fleeing.some(c=>c.dog===child)){
          const dir=child.x<ORDER_X?-1:1;
          const targetX=dir===1?520:-40;
          sendDogOffscreen.call(scene, child, targetX, child.y);
        }
      });

      let remaining=fleeing.length;
      if(remaining===0){ if(done) done(); return; }

      fleeing.forEach(c=>{
        const state=c.memory && c.memory.state || CustomerState.NORMAL;
        if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji=null; }
        if(c.walkTween){ c.walkTween.stop(); c.walkTween=null; }
        const dir=c.sprite.x<ORDER_X?-1:1;
        const targetX=dir===1?520:-40;

        const runOff=()=>scene.tweens.add({targets:c.sprite,x:targetX,duration:dur(WALK_OFF_BASE/1.2),onComplete:()=>{c.sprite.destroy();remaining--;if(remaining===0&&done)done();}});

        if(state===CustomerState.BROKEN){
          runOff();
          if(c.dog){
            if(c.dog.followEvent) c.dog.followEvent.remove(false);
            const ddir=c.dog.x<ORDER_X?-1:1;
            const dx=ddir===1?520:-40;
            sendDogOffscreen.call(scene,c.dog,dx,c.dog.y);
          }
          return;
        }

        if(state===CustomerState.NORMAL){
          const tl=scene.tweens.createTimeline();
          for(let i=0;i<5;i++){
            tl.add({targets:c.sprite,x:Phaser.Math.Between(40,440),y:Phaser.Math.Between(WANDER_TOP,WANDER_BOTTOM),duration:dur(Phaser.Math.Between(300,500)),ease:'Sine.easeInOut'});
          }
          tl.add({targets:c.sprite,x:targetX,duration:dur(WALK_OFF_BASE/1.2),onStart:()=>{if(c.dog){scene.tweens.killTweensOf(c.dog);if(c.dog.followEvent)c.dog.followEvent.remove(false);}},onComplete:()=>{c.sprite.destroy();remaining--;if(remaining===0&&done)done();}});
          tl.play();
          if(c.dog){
            const dog=c.dog;
            if(!dog) { return; }
            if(dog.followEvent) dog.followEvent.remove(false);
            const bark=scene.add.sprite(dog.x,dog.y-20,'dog1',3).setOrigin(0.5).setDepth(dog.depth+1).setScale(Math.abs(dog.scaleX),Math.abs(dog.scaleY));
            scene.tweens.add({targets:bark,y:'-=20',alpha:0,duration:dur(600),onComplete:()=>bark.destroy()});
            const dTl=scene.tweens.createTimeline();
            for(let j=0;j<4;j++){
              const ang=Phaser.Math.FloatBetween(0,Math.PI*2);
              const r=Phaser.Math.Between(40,60);
              const dx=girl.x+Math.cos(ang)*r;
              const dy=girl.y+Math.sin(ang)*r;
              dTl.add({targets:dog,x:dx,y:dy,duration:dur(Phaser.Math.Between(300,450)),ease:'Sine.easeInOut'});
            }
            dTl.setCallback('onUpdate',()=>{
              if(dog.prevX===undefined) dog.prevX=dog.x;
              const dx=dog.x-dog.prevX;
              if(Math.abs(dx)>3){ dog.dir=dx>0?1:-1; }
              dog.prevX=dog.x;
              const s=scaleForY(dog.y)*0.5;
              dog.setScale(s*(dog.dir||1), s);
            });
            dTl.setCallback('onComplete',()=>{ if(dog) dog.setFrame(1); });
            if(dog && dog.anims && dog.play){ dog.play('dog_walk'); }
            dTl.play();
          }
          return;
        }

        if(state===CustomerState.GROWING){
          const tl=scene.tweens.createTimeline();
          tl.add({targets:c.sprite,x:Phaser.Math.Between(40,440),y:Phaser.Math.Between(WANDER_TOP,WANDER_BOTTOM),duration:dur(400)});
          tl.add({targets:c.sprite,x:girl.x+Phaser.Math.Between(-60,60),y:girl.y+Phaser.Math.Between(-40,40),duration:dur(300)});
          tl.add({targets:c.sprite,duration:dur(300)});
          tl.add({targets:c.sprite,x:targetX,duration:dur(WALK_OFF_BASE/1.2),onComplete:()=>{c.sprite.destroy();remaining--;if(remaining===0&&done)done();}});
          tl.play();
          return;
        }

        if(state===CustomerState.SPARKLING||state===CustomerState.ARROW){
          const loops=state===CustomerState.ARROW?5:3;
          const persistent=state===CustomerState.ARROW;
          const attack=a=>{
            scene.tweens.add({targets:a,x:falcon.x+Phaser.Math.Between(-5,5),y:falcon.y+Phaser.Math.Between(-5,5),duration:dur(80),yoyo:true,onComplete:()=>{if(persistent){scene.time.delayedCall(dur(Phaser.Math.Between(200,400)),()=>attack(a),[],scene);} else if(--a.atkLoops>0){scene.time.delayedCall(dur(Phaser.Math.Between(200,400)),()=>attack(a),[],scene);} }});
          };
          c.sprite.atkLoops=loops;
          attack(c.sprite);
          if(!persistent){
            scene.time.delayedCall(dur(2000),runOff,[],scene);
          } else {
            remaining--; if(remaining===0&&done)done();
          }
          return;
        }

        runOff();
      });
    }
function dogsBarkAtFalcon(){
      const dogs=[];
      const gatherDog=c=>{ if(c && c.dog) dogs.push(c.dog); };
      GameState.queue.forEach(gatherDog);
      GameState.wanderers.forEach(gatherDog);
      gatherDog(GameState.activeCustomer);
      if(dogs.length===0) return;
      dogs.forEach(dog=>{
        const mood=dog.dogCustomer && dog.dogCustomer.memory ? dog.dogCustomer.memory.state : CustomerState.NORMAL;
        if(mood===CustomerState.BROKEN || mood===CustomerState.NORMAL){
          if(!dog.fled){
            if(dog.followEvent) dog.followEvent.remove(false);
            const dir=dog.x<ORDER_X?-1:1;
            const targetX=dir===1?520:-40;
            sendDogOffscreen.call(scene,dog,targetX,dog.y);
            dog.fled=true;
          }
          return;
        }
        if(dog.followEvent) dog.followEvent.remove(false);
        scene.tweens.killTweensOf(dog);
        const bark=scene.add.sprite(dog.x,dog.y-20,'dog1',3)
          .setOrigin(0.5)
          .setDepth(dog.depth+1)
          .setScale(Math.abs(dog.scaleX), Math.abs(dog.scaleY));
        scene.tweens.add({targets:bark,y:'-=20',alpha:0,duration:dur(600),onComplete:()=>bark.destroy()});
        let loops=2;
        if(mood===CustomerState.GROWING) loops=3;
        if(mood===CustomerState.SPARKLING) loops=4;
        if(mood===CustomerState.ARROW) loops=5;
        const dTl=scene.tweens.createTimeline();
        for(let j=0;j<loops;j++){
          const ang=Phaser.Math.FloatBetween(0,Math.PI*2);
          const r=Phaser.Math.Between(30,50);
          const dx=falcon.x+Math.cos(ang)*r;
          let dy=falcon.y+Math.sin(ang)*r;
          if(dy < DOG_MIN_Y) dy = DOG_MIN_Y;
          dTl.add({targets:dog,x:dx,y:dy,duration:dur(Phaser.Math.Between(300,500)),ease:'Sine.easeInOut'});
        }
        dTl.setCallback('onUpdate',()=>{
          if(dog.prevX===undefined) dog.prevX=dog.x;
          const dx=dog.x-dog.prevX;
          if(Math.abs(dx)>3){ dog.dir=dx>0?1:-1; }
          dog.prevX=dog.x;
          const s=scaleForY(dog.y)*0.5;
          dog.setScale(s*(dog.dir||1), s);
        });
        dTl.setCallback('onComplete',()=>{dog.setFrame(1);});
        if(dog.anims && dog.play){ dog.play('dog_walk'); }
        dTl.play();
      });
    }


    // send everyone scattering immediately in case a new spawn sneaks in
    let finished=false;
    let falcon=null;
    const endAttack=()=>{
      if(finished) return;
      finished=true;
      if(GameState.dogBarkEvent){
        GameState.dogBarkEvent.remove(false);
        GameState.dogBarkEvent = null;
      }
      cleanupDogs(scene);
      GameState.falconActive = false;
      if(falcon) falcon.destroy();
      if(cb) cb();
    };
    let piecesDone=0;
    const tryEnd=()=>{ if(++piecesDone>=2) endAttack(); };

    falcon=scene.add.sprite(-40,-40,'lady_falcon',0)
      .setScale(1.4,1.68)
      .setDepth(20);
    falcon.anims.play('falcon_fly');
    const targetX=girl.x;
    const targetY=girl.y-40;
    dogsBarkAtFalcon();
    GameState.dogBarkEvent = scene.time.addEvent({
      delay: dur(800),
      loop: true,
      callback: dogsBarkAtFalcon,
      callbackScope: scene
    });
    scene.tweens.add({
      targets:falcon,
      x:targetX,
      y:targetY,
      duration:dur(900),
      ease:'Cubic.easeIn',
      onComplete:()=>{
        panicCustomers(tryEnd);
        blinkAngry(scene);
        const tl=scene.tweens.createTimeline({callbackScope:scene,onComplete:tryEnd});
        for(let i=0;i<4;i++){
          tl.add({targets:falcon,y:targetY+10,duration:dur(80),yoyo:true});
          tl.add({targets:girl,y:girl.y+5,duration:dur(80),yoyo:true,
                   onStart:()=>{ girl.setTint(0xff0000); sprinkleBursts(scene); },
                   onYoyo:()=>{ girl.setTint(0xff0000); sprinkleBursts(scene); },
                   onComplete:()=>girl.clearTint()},'<');
          const debris=createDebrisEmoji(scene, falcon.x, falcon.y);
          tl.add({targets:debris,
                  x:debris.x+Phaser.Math.Between(-60,60),
                  y:debris.y+Phaser.Math.Between(-50,10),
                  angle:Phaser.Math.Between(-180,180),
                  alpha:0,
                  duration:dur(400),
                  onComplete:()=>debris.destroy()},'<');
          scene.time.delayedCall(dur(450),()=>debris.destroy(),[],scene);
        }
        tl.play();
      }
    });

    function blinkAngry(s){
      s.tweens.add({targets:girl,duration:dur(100),repeat:2,yoyo:true,
        onStart:()=>girl.setTint(0xff0000),
        onYoyo:()=>girl.setTint(0xff0000),
        onRepeat:()=>girl.clearTint(),
        onComplete:()=>girl.clearTint()});
    }

    function sprinkleBursts(s){
      for(let b=0;b<3;b++){
        const bx=girl.x+Phaser.Math.Between(-20,20);
        const by=girl.y+Phaser.Math.Between(-40,0);
        const burst=s.add.text(bx,by,'💢',{font:'24px sans-serif',fill:'#f00'})
          .setOrigin(0.5).setDepth(21);
        s.tweens.add({targets:burst,scale:1.5,alpha:0,duration:dur(200),onComplete:()=>burst.destroy()});
      }
    }

    function createDebrisEmoji(s, x, y){
      const chars=['✨','💥','🪶'];
      const ch=chars[Phaser.Math.Between(0,chars.length-1)];
      return s.add.text(x,y,ch,{font:'24px sans-serif',fill:'#555'})
        .setOrigin(0.5).setDepth(21);
    }
  }

  function showCustomerRevolt(cb){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    hideOverlayTexts();
    clearDialog.call(scene);
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
    const attackers=[];
    const gatherStartY = Math.max(WANDER_TOP, girl.y + 60);
    const gather=(arr)=>{
      arr.forEach(c=>{
        if(c.walkTween){ c.walkTween.stop(); c.walkTween=null; }
        if(c.dog){
          if(c.dog.followEvent) c.dog.followEvent.remove(false);
          c.dog.destroy();
          c.dog=null;
        }
        if(c.sprite){
          c.sprite.setDepth(20); // keep attackers above the girl
          if(c.sprite.y < gatherStartY){
            c.sprite.setPosition(c.sprite.x, gatherStartY);
            c.sprite.setScale(scaleForY(gatherStartY));
          }
          attackers.push(c.sprite);
        }
      });
    };
    gather(GameState.queue);
    gather(GameState.wanderers);
    if(GameState.activeCustomer){
      gather([GameState.activeCustomer]);
    }



    const loops=new Map();
    let hits=0;
    let finished=false;

    function blinkGirl(){
      scene.tweens.add({targets:girl,duration:dur(60),repeat:2,yoyo:true,x:'+=4',
        onStart:()=>girl.setTint(0xff0000),
        onYoyo:()=>girl.setTint(0xff0000),
        onRepeat:()=>girl.clearTint(),
        onComplete:()=>girl.clearTint()});
    }

      function sendDriver(driver){
        loops.forEach((ev,a)=>{
          if(ev) ev.remove(false);
          if(a!==driver){
            const dir = a.x < girl.x ? -1 : 1;
            const targetX = dir===1 ? 520 : -40;
            scene.tweens.add({
              targets:a,
              x:targetX,
              duration:dur(WALK_OFF_BASE/1.5),
              onComplete:()=>a.destroy()
            });
          }
        });
        scene.tweens.add({targets:driver,x:truck.x-40,y:truck.y,duration:dur(300),onComplete:()=>driver.destroy()});
        scene.tweens.add({targets:truck,x:-200,duration:dur(800),delay:dur(300),onComplete:()=>{if(cb) cb();}});
      }

    function attack(a){
      if(finished) return;
      scene.tweens.add({
        targets:a,
        x:girl.x+Phaser.Math.Between(-5,5),
        y:girl.y+Phaser.Math.Between(-5,5),
        scale:scaleForY(girl.y),
        duration:dur(80),
        yoyo:true,
        onComplete:()=>{
          if(finished) return;
          hits++;
          blinkGirl();
          if(hits>=10){
            finished=true;
            sendDriver(a);
          } else {
            loops.set(a, scene.time.delayedCall(dur(Phaser.Math.Between(200,400)),()=>attack(a),[],scene));
          }
        }
      });
    }

    attackers.forEach(a=>{
      const tx = Phaser.Math.Between(girl.x - 30, girl.x + 30);
      const ty = Math.max(gatherStartY, girl.y + 20);
      scene.tweens.add({
        targets:a,
        x:tx,
        y:ty,
        scale:scaleForY(ty),
        duration:dur(400),
        onComplete:()=>{
          loops.set(a, scene.time.delayedCall(dur(Phaser.Math.Between(100,300)),()=>attack(a),[],scene));
        }
      });
    });
  }

  function showTrueLoveVictory(spriteKey){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    hideOverlayTexts();
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
      GameState.spawnTimer = null;
    }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay = this.add.rectangle(240,320,480,640,0x000000).setDepth(19);
    const lover = this.add.sprite(240,260, spriteKey)
      .setOrigin(0.5,1)
      .setScale(1.5)
      .setDepth(20);
    const bigGirl = this.add.image(240,320,'girl')
      .setOrigin(0.5,1)
      .setScale(1.5)
      .setDepth(21);
    for(let i=0;i<12;i++){
      const hx = Phaser.Math.Between(220,260);
      const hy = Phaser.Math.Between(200,260);
      const h = this.add.text(hx,hy,'💖',{font:'24px sans-serif'})
        .setOrigin(0.5)
        .setDepth(22);
      addFloatingEmoji(h);
      this.tweens.add({targets:h,y:hy-80,alpha:0,duration:dur(Phaser.Math.Between(800,1200)),
        onComplete:()=>{ removeFloatingEmoji(h); h.destroy(); }});
    }
    const txt=this.add.text(240,480,'You found true love\nTHE END',
      {font:'28px sans-serif',fill:'#fff',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5)
      .setDepth(21);
    const btn=this.add.text(240,560,'Try Again',{font:'20px sans-serif',fill:'#fff',backgroundColor:'#006400',padding:{x:14,y:8}})
      .setOrigin(0.5)
      .setDepth(22);
    const againZone=this.add.zone(240,560,btn.width,btn.height).setOrigin(0.5);
    againZone.setInteractive({ useHandCursor:true });
    againZone.on('pointerdown',()=>{
        lover.destroy();
        bigGirl.destroy();
        txt.destroy();
        btn.destroy();
        if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
        restartGame.call(this);
        againZone.destroy();
      });
    GameState.gameOver=true;
  }

  function showEnd(msg, bigEmoji, opts){
    const scene=this;
    const keepTweens = opts && opts.keepTweens;
    if(!keepTweens){
      scene.tweens.killAll();
      scene.time.removeAllEvents();
    }
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    hideOverlayTexts();
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer=null; }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay=this.add.rectangle(240,320,480,640,0x000000).setDepth(19);
    let bgY=360;
    let img=null;
    if(/lady falcon reclaims the coffee truck/i.test(msg)){
      img=this.add.image(240,200,'falcon_end').setScale(1.2).setDepth(20);
      bgY=480;
    } else if(/customer.*revolt/i.test(msg)){
      img=this.add.image(240,200,'revolt_end').setScale(1.2).setDepth(20);
      bgY=480;
    }
    const bg=this.add.rectangle(240,bgY,480,240,0xffffff).setStrokeStyle(2,0x000).setDepth(20);
    if(bigEmoji){
      this.add.text(240,bgY-80,bigEmoji,{font:'72px sans-serif'}).setOrigin(0.5).setDepth(21);
    }
    const lines=msg.split('\n');
    let offset=bgY-40;
    let titleText=null;
    let startIdx=0;
    if(lines[0].toLowerCase().startsWith('game over')){
      titleText=this.add.text(240,offset,lines[0].toUpperCase(),{
        font:'48px sans-serif',fill:'#f00',stroke:'#000',strokeThickness:4
      }).setOrigin(0.5).setDepth(21);
      startIdx=1;
      offset+=60;
    }
    const txt=this.add.text(240,offset,lines.slice(startIdx).join('\n'),{font:'24px sans-serif',fill:'#000',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5).setDepth(21);
    const btn=this.add.text(240,bgY+80,'Try Again',{font:'20px sans-serif',fill:'#fff',backgroundColor:'#006400',padding:{x:14,y:8}})
      .setOrigin(0.5).setDepth(22);
    const againZone=this.add.zone(240,bgY+80,btn.width,btn.height).setOrigin(0.5);
    againZone.setInteractive({ useHandCursor:true });
    againZone.on('pointerdown',()=>{
        bg.destroy(); txt.destroy(); btn.destroy(); if(titleText) titleText.destroy(); if(img) img.destroy();
        if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
        restartGame.call(this);
        againZone.destroy();
      });
    GameState.gameOver=true;
  }

  function restartGame(){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupSparrows(scene);
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
      GameState.spawnTimer = null;
    }
    if (GameState.dogBarkEvent) {
      GameState.dogBarkEvent.remove(false);
      GameState.dogBarkEvent = null;
    }
    GameState.falconActive = false;
    clearDialog.call(scene);
    dialogDrinkEmoji.attachedTo = null;
    if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
    if(sideCText){ sideCText.destroy(); sideCText=null; }
    reportLine1.setVisible(false);
    reportLine2.setVisible(false);
    reportLine3.setVisible(false);
    tipText.setVisible(false);
    paidStamp.setVisible(false);
    lossStamp.setVisible(false);
    // reset truck and girl to their initial off-screen positions
    if (truck && girl) {
      const startX = scene.scale.width + 100;
      truck.setPosition(startX, 245);
      girl.setPosition(startX, 245).setVisible(false);
    }
    GameState.money=10.00; GameState.love=10;
    moneyText.setText('🪙 '+receipt(GameState.money));
    loveText.setText('❤️ '+GameState.love);
    updateLevelDisplay();
    if(GameState.activeCustomer){
      if(GameState.activeCustomer.heartEmoji){ GameState.activeCustomer.heartEmoji.destroy(); GameState.activeCustomer.heartEmoji=null; }
      GameState.activeCustomer.sprite.destroy();
    }
    GameState.activeCustomer=null;
    cleanupDogs(scene);
    GameState.queue=[];
    GameState.wanderers=[];
    Object.keys(GameState.customerMemory).forEach(k=>{ delete GameState.customerMemory[k]; });
    GameState.heartWin = null;
    GameState.servedCount=0;
    GameState.saleInProgress = false;
    sideCAlpha=0;
    sideCFadeTween=null;
    GameState.gameOver=false;
    showStartScreen.call(this);
    scheduleSparrowSpawn(this);
  }

   Assets = { keys, requiredAssets, preload };
   Scene = { create, showStartScreen, playIntro };
   Customers = { spawnCustomer, lureNextWanderer, moveQueueForward, scheduleNextSpawn,
                      showDialog, clearDialog, handleAction, showFalconAttack,
                      showCustomerRevolt, restartGame };

   config={ ...baseConfig, scene:{ preload: Assets.preload, create: Scene.create } };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('load', init);
    setTimeout(() => {
      if (!initCalled) {
        if (DEBUG) console.error('init() did not execute');
        new Phaser.Game({
          type: Phaser.AUTO,
          parent: 'game-container',
          width: 480,
          height: 640,
          scene: {
            create: function(){
              this.add.text(240, 320,
                'Failed to start game. Check console for errors.',
                {font:'20px sans-serif', fill:'#f00', align:'center', wordWrap:{width:460}})
                .setOrigin(0.5);
            }
          }
        });
      }
    }, 3000);
  }
  showStartScreenFn = showStartScreen;
  handleActionFn = handleAction;
  spawnCustomerFn = spawnCustomer;
  scheduleNextSpawnFn = scheduleNextSpawn;
  showDialogFn = showDialog;
  animateLoveChangeFn = animateLoveChange;
  blinkButtonFn = blinkButton;
}

if (typeof window !== 'undefined') {
  // game.js calls setupGame() when loaded. Avoid running twice.
}

export { showStartScreenFn as showStartScreen, handleActionFn as handleAction, spawnCustomerFn as spawnCustomer, scheduleNextSpawnFn as scheduleNextSpawn, showDialogFn as showDialog, animateLoveChangeFn as animateLoveChange, blinkButtonFn as blinkButton, startWander };
