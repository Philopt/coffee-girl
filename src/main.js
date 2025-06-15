import { debugLog } from './debug.js';
(() => {
  if (typeof debugLog === 'function') debugLog('main.js loaded');
  let initCalled = false;
  function init(){
    if (typeof debugLog === 'function') debugLog('init() executing');
    initCalled = true;
    new Phaser.Game(config);
  }
  // full drink menu with prices
  const MENU=[
    {name:"Lady Roaster Drip", price:3.90},
    {name:"Falcon's Crest", price:4.83},
    {name:"Espresso", price:4.25},
    {name:"Macchiato", price:5.00},
    {name:"Petite Latte", price:5.75},
    {name:"Cappuccino", price:6.23},
    {name:"Latte", price:6.97},
    {name:"Mocha", price:6.97},
    {name:"Starry Night Latte", price:6.56},
    {name:"Hot Chocolate", price:5.70},
    {name:"Under the Pink", price:5.70},
    {name:"Rose Tea", price:5.70},
    {name:"Starry Night Tea", price:5.70},
    {name:"Cold Brew Iced Coffee", price:6.10},
    {name:"Black N' Tan", price:6.80},
    {name:"Chocolate Cold Brew", price:6.85},
    {name:"Iced Latte", price:6.23},
    {name:"Iced Mocha", price:6.90},
    {name:"Iced Hot Chocolate", price:6.58},
    {name:"Pink Crush", price:5.70},
    {name:"Iced Under the Pink", price:6.10},
    {name:"Iced Rose Tea", price:5.70},
    {name:"Iced Starry Night Tea", price:5.70}
  ];

  // spawn new customers slowly to keep things manageable
  // at least a few seconds between arrivals
  const SPAWN_DELAY=2000;
  const SPAWN_VARIANCE=1500;
  const QUEUE_SPACING=36; // distance between queued customers (horizontal)
  const ORDER_X=230; // ordering spot
  const ORDER_Y=310; // ordering spot Y
  // base position for the waiting line to the left of the order spot
  const QUEUE_X=ORDER_X-QUEUE_SPACING-10; // nudge line left of ordering spot
  // each waiting customer stands slightly higher than the one in front
  const QUEUE_OFFSET=8;
  // vertical position of the first waiting customer (slightly lower than order spot)
  const QUEUE_Y=ORDER_Y+5;
  const WANDER_TOP=ORDER_Y+50; // wander up to 50px below the order window
  const WANDER_BOTTOM=580; // near bottom of the screen
  // base number of customers that can linger nearby
  const BASE_WAITERS=3;
  const WALK_OFF_BASE=800;
  const MAX_M=100, MAX_L=100;

  // dimensions for the phone graphic shown on the start screen
  const START_PHONE_W = 260;
  const START_PHONE_H = 500;

  // dimensions/positioning for the action buttons
  const BUTTON_WIDTH = 120;
  const BUTTON_HEIGHT = 80;
  const BUTTON_Y = 560;


  let money=10.00, love=10, gameOver=false;
  let queue=[], activeCustomer=null, wanderers=[];
  let spawnTimer = null;
  let falconActive = false;
  let loveLevel=1;
  const keys=[];
  const requiredAssets=['bg','truck','girl','lady_falcon','falcon_end','revolt_end'];
  const genzSprites=[
    'new_kid_0_0','new_kid_0_1','new_kid_0_2','new_kid_0_4','new_kid_0_5',
    'new_kid_1_0','new_kid_1_1','new_kid_1_2','new_kid_1_3','new_kid_1_4','new_kid_1_5',
    'new_kid_2_0','new_kid_2_1','new_kid_2_2','new_kid_2_3','new_kid_2_4','new_kid_2_5',
    'new_kid_3_0','new_kid_3_1','new_kid_3_2','new_kid_3_3','new_kid_3_4','new_kid_3_5',
    'new_kid_4_0','new_kid_4_1','new_kid_4_2','new_kid_4_3','new_kid_4_4','new_kid_4_5'
  ];

  const dur=v=>v;

  const supers={
    '0':'\u2070','1':'\u00b9','2':'\u00b2','3':'\u00b3','4':'\u2074',
    '5':'\u2075','6':'\u2076','7':'\u2077','8':'\u2078','9':'\u2079'
  };

  function scaleForY(y){
    const minY = ORDER_Y;
    const maxY = WANDER_BOTTOM;
    const t = Phaser.Math.Clamp((y - minY) / (maxY - minY), 0, 1);
    return 0.7 + t * 0.4; // grow larger toward the bottom
  }

  function receipt(value){
    const [d,c]=value.toFixed(2).split('.');
    const cents=c.split('').map(ch=>supers[ch]||ch).join('');
    return `$${d}${cents}`;
  }

  function articleFor(name){
    const first=name.trim()[0].toLowerCase();
    return 'aeiou'.includes(first)?'an':'a';
  }

  function flashMoney(obj, scene, color='#0f0'){
    let on=true;
    obj.setStyle({stroke:'#000', strokeThickness:3});
    const flashes=5;
    scene.time.addEvent({
      repeat:flashes,
      delay:dur(60),
      callback:()=>{
        obj.setColor(on?'#fff':color);
        on=!on;
      }
    });
    scene.time.delayedCall(dur(60)*(flashes+1)+dur(10),()=>{
      obj.setColor('#000');
      obj.setStyle({strokeThickness:0});
    },[],scene);
  }

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
          obj.setText((on?'💔':'❤️')+' '+love);
        }
        on=!on;
      }
    });
    scene.time.delayedCall(dur(flashDelay)*(flashes+1)+dur(10),()=>{
      obj.setColor('#fff');
      if(isLove && !up){
        obj.setText('❤️ '+love);
        // removed wobble animation for the love counter
      }
    },[],scene);
  }

  function blinkButton(btn, onComplete){
    // Temporarily disable input while the button blinks.
    // Recalculate the hit area afterwards in case the button
    // changed size or scale during the tween.

    btn.disableInteractive();
    this.tweens.add({
      targets: btn,
      alpha: 0,
      yoyo: true,
      duration: dur(80),
      repeat: 1,
      onComplete: () => {
        if (btn.setInteractive) {

          const w = btn.width !== undefined ? btn.width : (btn.displayWidth || 0);
          const h = btn.height !== undefined ? btn.height : (btn.displayHeight || 0);
          const area = new Phaser.Geom.Rectangle(-w/2, -h/2, w, h);
          btn.myHitArea = area;

          btn.setInteractive({
            hitArea: area,
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true
          });
          btn.myHitArea = area;
          if (btn.input && btn.input.hitArea) {
            btn.input.hitArea.x = area.x;
            btn.input.hitArea.y = area.y;
            if (typeof btn.input.hitArea.setTo === 'function') {
              btn.input.hitArea.setTo(area.x, area.y, area.width, area.height);
            }
          }
        }
        if (onComplete) onComplete();
      }
    });
  }


  let moneyText, loveText, queueLevelText;
  let dialogBg, dialogText, dialogCoins,
      dialogPriceLabel, dialogPriceValue, dialogPriceBox,
      dialogPriceContainer,
      btnSell, btnGive, btnRef;
  let reportLine1, reportLine2, reportLine3, reportLine4, tipText;
  let paidStamp, lossStamp;
  let truck, girl;
  let activeBubble=null;
  let sideCText;
  let servedCount=0;
  let sideCAlpha=0;
  let sideCFadeTween=null;
  let endOverlay=null;
  let startOverlay=null;
  let startButton=null;
  let phoneContainer=null;
  let startMsgTimers=[];
  let startMsgBubbles=[];

  function calcLoveLevel(v){
    if(v>=100) return 4;
    if(v>=50) return 3;
    if(v>=20) return 2;
    return 1;
  }

  function maxWanderers(){
    return BASE_WAITERS + calcLoveLevel(love) - 1;
  }

  function queueLimit(){
    // allow one person waiting even at level 1
    return calcLoveLevel(love) + 1;
  }


  function lureNextWanderer(scene){
    if(wanderers.length && queue.length < queueLimit()){
      if(queue.some(c=>c.walkTween)) return;
      let closestIdx=0;
      let minDist=Number.MAX_VALUE;
      for(let i=0;i<wanderers.length;i++){
        const d=Math.abs(wanderers[i].sprite.x-ORDER_X);
        if(d<minDist){ closestIdx=i; minDist=d; }
      }
      const c=wanderers.splice(closestIdx,1)[0];
      if(c.walkTween){
        c.walkTween.stop();
        c.walkTween.remove();
        c.walkTween=null;
      }
      const idx=queue.length;
      c.atOrder=false;
      queue.push(c);
      activeCustomer=queue[0];
      const targetX = idx===0 ? ORDER_X : QUEUE_X - QUEUE_SPACING*(idx-1);
      const targetY = idx===0 ? ORDER_Y : QUEUE_Y - QUEUE_OFFSET*(idx-1);
      const dist=Phaser.Math.Distance.Between(c.sprite.x,c.sprite.y,targetX,targetY);
      c.sprite.setDepth(5);
      c.walkTween=scene.tweens.add({targets:c.sprite,x:targetX,y:targetY,scale:scaleForY(targetY),duration:dur(600+dist*2),ease:'Sine.easeIn',callbackScope:scene,
        onComplete:()=>{c.walkTween=null; if(idx===0) showDialog.call(scene);} });
    }
  }

  function moveQueueForward(){
    const scene=this;
    let willShow=false;
    queue.forEach((cust, idx)=>{
      const tx = idx===0 ? ORDER_X : QUEUE_X - QUEUE_SPACING*(idx-1);
      const ty = idx===0 ? ORDER_Y : QUEUE_Y - QUEUE_OFFSET*(idx-1);
      if(cust.sprite.y!==ty || cust.sprite.x!==tx){
        const cfg={targets:cust.sprite,x:tx,y:ty,scale:scaleForY(ty),duration:dur(300)};
        if(idx===0){
          cfg.onComplete=()=>{ showDialog.call(scene); };
          willShow=true;
        }
        scene.tweens.add(cfg);
      }
    });
    activeCustomer=queue[0]||null;
    if(activeCustomer){
      if(!willShow && activeCustomer.sprite.y===ORDER_Y && activeCustomer.sprite.x===ORDER_X){
        showDialog.call(scene);
      }
    }
    if(queue.length < queueLimit()){
      lureNextWanderer(scene);
    }
  }

  function updateLevelDisplay(){
    const newLevel=calcLoveLevel(love);
    if(queueLevelText){
      queueLevelText.setText('Lv. '+newLevel);
      queueLevelText.setVisible(newLevel>=2);
      if(newLevel!==loveLevel && newLevel>=2){
        const sp=queueLevelText.scene.add.text(queueLevelText.x,queueLevelText.y,'✨',
            {font:'18px sans-serif',fill:'#000'})
          .setOrigin(0.5).setDepth(queueLevelText.depth+1);
        queueLevelText.scene.tweens.add({targets:sp,y:queueLevelText.y-20,alpha:0,
            duration:dur(600),onComplete:()=>sp.destroy()});
      }
    }
    loveLevel=newLevel;
    if(queueLevelText && queueLevelText.scene){
      lureNextWanderer(queueLevelText.scene);
    }
  }

  function scheduleNextSpawn(scene){
    if(falconActive) return;
    if (spawnTimer) {
      spawnTimer.remove(false);
    }
    const needed = queueLimit() - (queue.length + wanderers.length);
    let delay;
    if(needed > 0){
      delay = 500;
    }else{
      delay = SPAWN_DELAY + Phaser.Math.Between(0, SPAWN_VARIANCE);
    }
    // use real-time delay to ensure customers never spawn too quickly,
    // regardless of game speed adjustments
    spawnTimer = scene.time.delayedCall(delay, spawnCustomer, [], scene);
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
    if(servedCount<6) return;
    showSideC.call(this);
    const target=Math.min(1,(servedCount-5)*0.1);
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

  function showStartScreen(scene){
    scene = scene || this;
    if (typeof debugLog === 'function') debugLog('showStartScreen called');
    // reset any pending timers or bubbles from a previous session
    startMsgTimers.forEach(t => t.remove(false));
    startMsgTimers = [];
    startMsgBubbles.forEach(b => b.destroy());
    startMsgBubbles = [];
    startOverlay = scene.add.rectangle(240,320,480,640,0x000000,0.5)
      .setDepth(14);

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
    startButton = scene.add.container(0,offsetY,[btnBg,btnLabel])
      .setSize(bw,bh);
    startButton.myHitArea = new Phaser.Geom.Rectangle(-bw/2, -bh/2, bw, bh);
    startButton.setInteractive({
        hitArea: startButton.myHitArea,
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
    });
    if (startButton.input && startButton.input.hitArea) {
      startButton.input.hitArea.x = startButton.myHitArea.x;
      startButton.input.hitArea.y = startButton.myHitArea.y;
      if (typeof startButton.input.hitArea.setTo === 'function') {
        startButton.input.hitArea.setTo(startButton.myHitArea.x, startButton.myHitArea.y,
          startButton.myHitArea.width, startButton.myHitArea.height);
      }
    }

    // position the phone closer to the center of the screen
    const containerY = 320;
    phoneContainer = scene.add.container(240,containerY,[caseG,blackG,whiteG,homeG,startButton])
      .setDepth(15)
      .setInteractive();

    // track where to place the first start message
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

    startButton.on('pointerdown',()=>{

        // Log click registration to help debug input issues
        if (typeof debugLog === 'function') debugLog('start button clicked');

        // cancel any pending start messages
        startMsgTimers.forEach(t=>t.remove(false));
        startMsgTimers=[];
        startMsgBubbles=[];

        const tl=scene.tweens.createTimeline({callbackScope:scene,onComplete:()=>{
          if(startButton) startButton.destroy();
          phoneContainer.destroy(); phoneContainer=null;
        }});
        tl.add({targets:phoneContainer,y:-320,duration:600,ease:'Sine.easeIn'});
        tl.add({targets:startOverlay,alpha:0,duration:600,onComplete:()=>{ if(startOverlay){startOverlay.destroy(); startOverlay=null;} }});
        tl.play();
        // playIntro will kick off the intro tween sequence
        playIntro.call(scene);
      });
  }

  function playIntro(scene){
    if(!truck || !girl) {
      console.warn('playIntro skipped: missing truck or girl');
      return;
    }
    if (typeof debugLog === 'function') debugLog('playIntro starting');
    scene = scene || this;
    if(!truck || !girl) return;
    truck.setPosition(560,245);
    girl.setPosition(560,260).setVisible(false);
    const intro=scene.tweens.createTimeline({callbackScope:scene,
      onComplete:()=>{
        if (typeof debugLog === 'function') debugLog('intro finished');
        if (typeof debugLog === 'function') debugLog('playIntro finished');
        spawnCustomer.call(scene);
        scheduleNextSpawn(scene);
      }});
    intro.add({targets:[truck,girl],x:240,duration:dur(600)});
    intro.add({targets:girl,y:292,duration:dur(300),onStart:()=>girl.setVisible(true)});
    intro.play();
  }

  function preload(){
    const loader=this.load;
    loader.on('loaderror', file=>{
      console.error('Asset failed to load:', file.key || file.src);
    });
    loader.image('bg','assets/bg.png');
    loader.image('truck','assets/truck.png');
    loader.image('girl','assets/coffeegirl.png');
    loader.spritesheet('lady_falcon','assets/lady_falcon.png',{frameWidth:64,frameHeight:64});
    loader.image('falcon_end','assets/ladyfalconend.png');
    loader.image('revolt_end','assets/revolt.png');
    for(const k of genzSprites){
      keys.push(k);
      requiredAssets.push(k);
      loader.image(k,`assets/genz/${k}.png`);
    }
  }

  function create(){
    this.assets = Assets;
    this.customers = Customers;
    const missing=requiredAssets.filter(key=>!this.textures.exists(key));
    if(missing.length){
      const msg='Missing assets: '+missing.join(', ');
      console.error(msg);
      this.add.text(240,320,msg,{font:'16px sans-serif',fill:'#f00',align:'center',wordWrap:{width:460}})
        .setOrigin(0.5).setDepth(30);
      const retry=this.add.text(240,360,'Retry Loading',{font:'20px sans-serif',fill:'#00f'})
        .setOrigin(0.5).setDepth(30);
      retry.setInteractive({
        hitArea:new Phaser.Geom.Rectangle(-retry.width/2,-retry.height/2,retry.width,retry.height),
        hitAreaCallback:Phaser.Geom.Rectangle.Contains,
        useHandCursor:true
      });
      if (retry.input && retry.input.hitArea) {
        retry.input.hitArea.x = -retry.width / 2;
        retry.input.hitArea.y = -retry.height / 2;
        if (typeof retry.input.hitArea.setTo === 'function') {
          retry.input.hitArea.setTo(-retry.width / 2, -retry.height / 2,
            retry.width, retry.height);
        }
      }
      retry.on('pointerdown',()=>window.location.reload());
      return;
    }
    // background
    let bg=this.add.image(0,0,'bg').setOrigin(0).setDepth(0);
    bg.setDisplaySize(this.scale.width,this.scale.height);

    // HUD
    moneyText=this.add.text(20,20,'🪙 '+receipt(money),{font:'26px sans-serif',fill:'#fff'}).setDepth(1);
    loveText=this.add.text(20,50,'❤️ '+love,{font:'26px sans-serif',fill:'#fff'}).setDepth(1);
    queueLevelText=this.add.text(304,316,'Lv. '+loveLevel,{font:'16px sans-serif',fill:'#000'})
      .setOrigin(0.5).setDepth(1);
    updateLevelDisplay();
    // truck & girl
    truck=this.add.image(560,245,'truck').setScale(0.924).setDepth(2);

    girl=this.add.image(560,260,'girl').setScale(0.5).setDepth(3).setVisible(false);

    // create lady falcon animation
    this.anims.create({
      key:'falcon_fly',
      frames:this.anims.generateFrameNumbers('lady_falcon',{start:0,end:1}),
      frameRate:6,
      repeat:-1
    });

    // dialog
    dialogBg=this.add.graphics()
      .setVisible(false)
      .setDepth(10);
    dialogBg.x=240;
    dialogBg.y=430; // raise bubble slightly
    dialogBg.width=360; // starting size, adjusted later
    dialogBg.height=120;

    dialogPriceBox=this.add.rectangle(0,0,120,80,0xdddddd)
      .setStrokeStyle(2,0x000)
      .setOrigin(0.5);

    dialogPriceLabel=this.add.text(0,-20,'',{font:'14px sans-serif',fill:'#000',align:'center'})
      .setOrigin(0.5);
    dialogPriceValue=this.add.text(0,10,'',{font:'32px sans-serif',fill:'#000'})
      .setOrigin(0.5);

    dialogPriceContainer=this.add.container(0,0,[dialogPriceBox, dialogPriceLabel, dialogPriceValue])
      .setDepth(11)
      .setVisible(false);

    dialogText=this.add.text(240,410,'',{font:'20px sans-serif',fill:'#000',align:'center',wordWrap:{width:300}})
                     .setOrigin(0,0.5).setVisible(false).setDepth(11);
    dialogCoins=this.add.text(240,440,'',{font:'20px sans-serif',fill:'#000'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);

    // price label/value are part of dialogPriceContainer and should not
    // also be drawn inside the main dialog. Remove the duplicate texts that
    // caused the total cost to appear in the dialog bubble.


    // helper to create a rounded rectangle button with consistent sizing
    const createButton=(x,label,iconChar,iconSize,color,handler)=>{
      const width=BUTTON_WIDTH, height=BUTTON_HEIGHT, radius=8;
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
      c.myHitArea = new Phaser.Geom.Rectangle(-width/2,-height/2,width,height);
      // Explicitly specify the hit area so the pointer box aligns with the
      // visible button.
      c.setInteractive({
        hitArea: c.myHitArea,
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      });
      if (c.input && c.input.hitArea) {
        // containers don't respect negative hitArea offsets unless we
        // explicitly adjust the input shape after setInteractive
        c.input.hitArea.x = c.myHitArea.x;
        c.input.hitArea.y = c.myHitArea.y;
        if (typeof c.input.hitArea.setTo === 'function') {
          c.input.hitArea.setTo(c.myHitArea.x, c.myHitArea.y,
            c.myHitArea.width, c.myHitArea.height);
        }
      }
      c.on('pointerdown',()=>blinkButton.call(this,c,handler));
      return c;
    };

    // buttons evenly spaced

    btnSell=createButton(80,'SELL','💵',32,0x006400,()=>handleAction.call(this,'sell'));
    btnGive=createButton(240,'GIVE','💝',28,0x008000,()=>handleAction.call(this,'give'));
    btnRef=createButton(400,'REFUSE','✋',32,0x800000,()=>handleAction.call(this,'refuse'));


    // sliding report texts
    reportLine1=this.add.text(480,moneyText.y,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine2=this.add.text(480,moneyText.y+20,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine3=this.add.text(480,loveText.y,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine4=this.add.text(0,0,'',{font:'14px sans-serif',fill:'#fff'})
      .setVisible(false).setDepth(11);
    tipText=this.add.text(0,0,'',{font:'24px sans-serif',fill:'#0a0'})
      .setOrigin(0.5).setDepth(12).setVisible(false);
    paidStamp=this.add.text(0,0,'PAID',{font:'24px sans-serif',fill:'#0a0'})
      .setOrigin(0.5).setDepth(12).setVisible(false);
    lossStamp=this.add.text(0,0,'LOSS',{font:'24px sans-serif',fill:'#a00'})
      .setOrigin(0.5).setDepth(12).setVisible(false);

    // wait for player to start the shift
    showStartScreen.call(this);
  }

  function spawnCustomer(){
    if(gameOver) return;
    const createOrder=()=>{
      const coins=Phaser.Math.Between(0,20);
      const item=Phaser.Utils.Array.GetRandom(MENU);
      const qty=1; // single drink for every customer
      return {coins, req:item.name, price:item.price, qty};
    };

    const c={ orders:[] };
    const k=Phaser.Utils.Array.GetRandom(keys);
    const order=createOrder();

    if(wanderers.length>=maxWanderers()){
      scheduleNextSpawn(this);
      return;
    }
    const dir=Phaser.Math.Between(0,1)?1:-1;
    const startX=dir===1?-40:520;
    const targetX=dir===1?520:-40;
    const startY=Phaser.Math.Between(WANDER_TOP,WANDER_BOTTOM);
    const distScale=scaleForY(startY);
    c.orders.push(order);
    c.atOrder=false;
    c.sprite=this.add.sprite(startX,startY,k).setScale(distScale).setDepth(4);
    const amp=Phaser.Math.Between(10,25);
    const freq=Phaser.Math.Between(2,4);
    c.walkTween=this.tweens.add({targets:c.sprite,x:targetX,duration:dur(6000),onUpdate:(tw,t)=>{
        const p=tw.progress;
        t.y=startY+Math.sin(p*Math.PI*freq)*amp;
      },onComplete:()=>{
        const idx=wanderers.indexOf(c);
        if(idx>=0) wanderers.splice(idx,1);
        c.sprite.destroy();
      }});
    wanderers.push(c);
    lureNextWanderer(this);
    scheduleNextSpawn(this);

  }

  function drawDialogBubble(targetX, targetY){
    if(!dialogBg) return;
    const w=dialogBg.width, h=dialogBg.height;
    dialogBg.clear();
    dialogBg.fillStyle(0xffffff,1);
    dialogBg.lineStyle(2,0x000,1);
    dialogBg.fillRoundedRect(-w/2,-h/2,w,h,24); // rounder corners
    dialogBg.strokeRoundedRect(-w/2,-h/2,w,h,24);
    if(targetX!==undefined && targetY!==undefined){
      const tx = targetX - dialogBg.x;
      const ty = targetY - dialogBg.y;
      const bx1 = -10;
      const bx2 = 10;
      const by = -h / 2;
      const tipX = tx * 0.5;
      const tipY = by + (ty - by) * 0.5;
      dialogBg.fillTriangle(bx1, by, bx2, by, tipX, tipY);
      dialogBg.beginPath();
      dialogBg.moveTo(tipX, tipY);
      dialogBg.lineTo(bx1, by);
      dialogBg.moveTo(tipX, tipY);
      dialogBg.lineTo(bx2, by);
      dialogBg.strokePath();
    }
  }

  function showDialog(){
    if(!dialogBg || !dialogText || !dialogCoins || !dialogPriceLabel ||
       !dialogPriceValue || !btnSell || !btnGive || !btnRef){
      return;
    }
    activeCustomer=queue[0]||null;
    if(!activeCustomer) return;
    const c=activeCustomer;
    if(!c.atOrder && (c.sprite.y!==ORDER_Y || c.sprite.x!==ORDER_X)){
      c.atOrder=true;
      this.tweens.add({
        targets: c.sprite,
        x: ORDER_X,
        y: ORDER_Y,
        scale: scaleForY(ORDER_Y),
        duration: dur(300),
        onComplete: ()=>{ showDialog.call(this); }
      });
      return;
    }
    const itemStr=c.orders.map(o=>{
      return o.qty>1 ? `${o.qty} ${o.req}` : o.req;
    }).join(' and ');
    const wantLine=(c.orders.length===1 && c.orders[0].qty===1)
      ? `I want ${articleFor(c.orders[0].req)} ${c.orders[0].req}`
      : `I want ${itemStr}`;

    if(activeBubble){
      activeBubble.destroy();
      activeBubble=null;
    }
    const bubble=this.add.text(c.sprite.x,c.sprite.y-50,'💬',{font:'32px sans-serif',fill:'#000'})
      .setOrigin(0.5).setDepth(11);
    activeBubble=bubble;
    this.tweens.add({targets:bubble,y:c.sprite.y-70,alpha:0,duration:dur(600),onComplete:()=>{bubble.destroy(); activeBubble=null;}});

    dialogText
      .setOrigin(0,0)
      .setText(wantLine)
      .setVisible(true);

    const totalCost=c.orders.reduce((s,o)=>s+o.price*o.qty,0);
    const canAfford = c.orders[0].coins >= totalCost;
    let coinLine;
    if (canAfford) {
      coinLine = `I have $${c.orders[0].coins}`;
    } else if (c.orders[0].coins === 0) {
      const options = ['...but I have nothing', "...I'm poor", "I don't have money"];
      coinLine = Phaser.Utils.Array.GetRandom(options);
    } else {
      coinLine = `...but I only have $${c.orders[0].coins}`;
    }
    dialogCoins
      .setOrigin(0,0)
      .setStyle({fontSize:'20px'})
      .setText(coinLine)
      .setVisible(true);

    const maxW=Math.max(dialogText.width, dialogCoins.width);
    dialogBg.width=Math.max(maxW+80,160);
    dialogBg.height=dialogText.height+dialogCoins.height+60;

    const bubbleTop=dialogBg.y - dialogBg.height/2;
    dialogText.setPosition(dialogBg.x - dialogBg.width/2 + 40, bubbleTop + 30);
    dialogCoins.setPosition(dialogBg.x - dialogBg.width/2 + 40, bubbleTop + 30 + dialogText.height + 10);

    dialogBg.setScale(0).setVisible(true);
    dialogText.setScale(0);
    dialogCoins.setScale(0);
    drawDialogBubble(c.sprite.x, c.sprite.y);

    const priceTargetX = dialogBg.x + dialogBg.width/2 - 60;
    const priceTargetY = dialogBg.y - dialogBg.height;
    dialogPriceContainer
      .setPosition(dialogBg.x, dialogBg.y)
      .setScale(0)
      .setVisible(false);
    dialogPriceContainer.alpha = 1;
    dialogPriceLabel
      .setStyle({fontSize:'14px'})
      .setText('Total\nCost');
    dialogPriceValue
      .setStyle({fontSize:'32px'})
      .setText(`$${totalCost.toFixed(2)}`)
      .setColor('#000')
      .setScale(1)
      .setAlpha(1);

    this.tweens.add({
      targets:[dialogBg, dialogText, dialogCoins],
      scale:1,
      ease:'Back.easeOut',
      duration:dur(300),
      onComplete:()=>{
        dialogPriceContainer.setVisible(true);
        this.tweens.add({
          targets:dialogPriceContainer,
          x:priceTargetX,
          y:priceTargetY,
          scale:1,
          duration:dur(300),
          ease:'Sine.easeOut'
        });
      }
    });

    tipText.setVisible(false);
    btnSell.setVisible(canAfford);
    if (btnSell.input) btnSell.input.enabled = canAfford;
    btnGive.setVisible(true);
    if (btnGive.input) btnGive.input.enabled = true;
    btnRef.setVisible(true);
    if (btnRef.input) btnRef.input.enabled = true;
  }

  function clearDialog(keepPrice=false){
    if(!keepPrice){
      dialogBg.setVisible(false);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
      dialogPriceContainer.setVisible(false);
      dialogPriceValue.setColor('#000');
        if(dialogPriceBox){
          if(dialogPriceBox.setFillStyle){
            dialogPriceBox.setFillStyle(0xdddddd,1);
          }else if(dialogPriceBox.fillStyle){
            dialogPriceBox.fillStyle(0xdddddd,1);
          }
        }
    }else{
      dialogBg.setVisible(true);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
      dialogPriceContainer.setVisible(true);
    }
    btnSell.setVisible(false);
    if (btnSell.input) btnSell.input.enabled = false;
    btnGive.setVisible(false);
    if (btnGive.input) btnGive.input.enabled = false;
    btnRef.setVisible(false);
    if (btnRef.input) btnRef.input.enabled = false;
    tipText.setVisible(false);

  }

  function handleAction(type){
    clearDialog(type!=='refuse');
    const current=activeCustomer;
    if(!current) return;
    const orderCount=current.orders.length;
    const totalCost=current.orders.reduce((s,o)=>s+o.price*o.qty,0);

    let mD=0, lD=0, tip=0;
    if(type==='sell'){
      lD=Phaser.Math.Between(0,2)*orderCount;
      tip=+(totalCost*0.15*lD).toFixed(2);
      const coins=current.orders[0].coins;
      const maxTip=Math.max(0, coins-totalCost);
      if(tip>maxTip) tip=+maxTip.toFixed(2);
      mD=totalCost+tip;
    } else if(type==='give'){
      lD=Phaser.Math.Between(2,4)*orderCount;
      mD=-totalCost;
    } else {
      lD=-Phaser.Math.Between(1,3)*orderCount;
    }

    const tipPct=type==='sell'?lD*15:0;
    const customer=current.sprite;
    activeCustomer=null;

    const finish=()=>{
      const targets=[current.sprite];
      targets.forEach(t=>t.setDepth(5));
      this.tweens.add({ targets: targets, x: (type==='refuse'? -50:520), alpha:0, duration:dur(WALK_OFF_BASE), callbackScope:this,
        onComplete:()=>{
          current.sprite.destroy();
          queue.shift();
          moveQueueForward.call(this);
          if(money<=0){
            showFalconAttack.call(this,()=>{
              showEnd.call(this,'Game Over\nYou lost all the money.\nLady Falcon reclaims the coffee truck.');
            });
            return;
          }
          if(love<=0){
            showCustomerRevolt.call(this,()=>{
              showEnd.call(this,'Game Over\nThe Customers Revolt!\n(and they stole your truck)');
            });
            return;
          }
          if(money>=MAX_M){showEnd.call(this,'Congrats! 💰');return;}
          if(love>=MAX_L){showEnd.call(this,'Victory! ❤️');return;}
          scheduleNextSpawn(this);
          servedCount++;
          updateSideC.call(this);
        }
      });
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
      t.setDepth(paidStamp.depth+1);
      t.setText(receipt(totalCost));
      const stampX=ticket.x + t.x * ticket.scaleX;
      const stampY=ticket.y + t.y * ticket.scaleY;
      paidStamp
        .setText('PAID')
        .setScale(1.5)
        .setPosition(stampX - 20, stampY)
        .setAngle(Phaser.Math.Between(-10,10))
        .setVisible(true);

      if(this.add && this.add.text){
        const cha = this.add.text(ticket.x, ticket.y - 30, '💸',
            {font:'28px sans-serif',fill:'#0f0'})
          .setOrigin(0.5)
          .setDepth(ticket.depth+2)
          .setAlpha(0);
        this.tweens.add({targets:cha,alpha:1,y:cha.y-10,duration:dur(200),yoyo:true,
          onComplete:()=>cha.destroy()});
      }

      const flashPrice=()=>{
        const oy=t.y;
        this.tweens.add({targets:t,y:oy-30,duration:dur(100),yoyo:true});
      };
      flashPrice();
      flashMoney(t,this);

      let delay=dur(300);
      if(tip>0){
        this.time.delayedCall(delay,()=>{
          tipText
            .setText('TIP')
            .setScale(1.6)
            .setPosition(paidStamp.x, paidStamp.y-40)
            .setVisible(true);
          t.setText(receipt(totalCost + tip));
          flashPrice();
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
            clearDialog();
            ticket.setVisible(false);
            money=+(money+mD).toFixed(2);
            moneyText.setText('🪙 '+receipt(money));
            animateStatChange(moneyText, this, mD);
            done();
        }});
        tl.add({targets:ticket,x:destX,y:destY,scale:0,alpha:0,duration:dur(400),
          onStart:()=>{
            if(dialogPriceBox && Phaser && Phaser.Display && Phaser.Display.Color){
              this.tweens.addCounter({from:0,to:100,duration:dur(400),onUpdate:(tw)=>{
                const c=Phaser.Display.Color.Interpolate.ColorWithColor(
                  {r:255,g:255,b:255},{r:0,g:255,b:0},100,tw.getValue());
                const col=Phaser.Display.Color.GetColor(c.r,c.g,c.b);
                if(dialogPriceBox.setFillStyle){
                  dialogPriceBox.setFillStyle(col,1);
                }else if(dialogPriceBox.fillStyle){
                  dialogPriceBox.fillStyle(col,1);
                }
              }});
            }
          }});
        tl.play();
      },[],this);
    } else if(type==='give'){
      const ticket=dialogPriceContainer;
      const t=dialogPriceValue;
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      t.setVisible(true)
        .setDepth(lossStamp.depth+1);
      const stampX=ticket.x + t.x * ticket.scaleX;
      const stampY=ticket.y + t.y * ticket.scaleY;
      lossStamp
        .setText('LOSS')
        .setScale(1.5)
        .setPosition(stampX - 20, stampY)
        .setAngle(Phaser.Math.Between(-10,10))
        .setVisible(true);
      this.time.delayedCall(dur(1000),()=>{
        lossStamp.setVisible(false);
        dialogBg.setVisible(false);
        dialogText.setVisible(false);
        if(dialogPriceBox){
          if(dialogPriceBox.setFillStyle){
            dialogPriceBox.setFillStyle(0xff0000,1);
          }else if(dialogPriceBox.fillStyle){
            dialogPriceBox.fillStyle(0xff0000,1);
          }
        }
        if(this.tweens){
          this.tweens.add({targets:ticket,x:'+=6',duration:dur(60),yoyo:true,repeat:2});
        }
        const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
            clearDialog();
            ticket.setVisible(false);
            money=+(money+mD).toFixed(2);
            moneyText.setText('🪙 '+receipt(money));
            animateStatChange(moneyText, this, mD);
            done();
        }});
        flashMoney(t,this,'#f00');
        tl.add({targets:ticket,x:destX,y:destY,scale:0,alpha:0,duration:dur(400)});
        tl.play();
      },[],this);
    } else if(type!=='refuse'){
      const showTip=tip>0;
      reportLine1.setStyle({fill:'#fff'})
        .setText(`$${totalCost.toFixed(2)}`)
        .setPosition(customer.x, customer.y)
        .setScale(1)
        .setVisible(true);
      if(showTip){
        reportLine2.setText(`${receipt(tip)} ${tipPct}% TIP`)
          .setStyle({fontSize:'16px',fill:'#fff'})
          .setScale(1)
          .setPosition(customer.x,customer.y+24).setVisible(true);
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
          money=+(money+mD).toFixed(2);
          moneyText.setText('🪙 '+receipt(money));
          animateStatChange(moneyText, this, mD);
          done();
      }});
      tl.add({targets:reportLine1,x:midX,y:midY,duration:dur(300),onComplete:()=>{
            const word='PAID';
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

    const baseX=customer.x - 20*(count-1)/2;
    const baseY=customer.y + 40;

    const hearts=[];
    for(let i=0;i<count;i++){
      const h=this.add.text(customer.x,customer.y,emoji,{font:'24px sans-serif',fill:'#fff'})
        .setOrigin(0.5).setDepth(11);
      hearts.push(h);
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
    const popOne=(idx)=>{
      if(idx>=hearts.length){
        animateStatChange(loveText, this, delta, true);
        if(cb) cb();
        return;
      }
      const h=hearts[idx];
      const tl=this.tweens.createTimeline({callbackScope:this});
      tl.add({targets:h,x:loveText.x,y:loveText.y,scaleX:0,scaleY:1.2,duration:dur(125)});
      tl.add({targets:h,scaleX:1,alpha:0,duration:dur(125),onComplete:()=>{
            love+=delta>0?1:-1;
            loveText.setText('❤️ '+love);
            updateLevelDisplay();
            h.destroy();
            popOne(idx+1);
        }});
      tl.play();
    };
    this.time.delayedCall(dur(400),()=>popOne(0),[],this);
  }

  function showFalconAttack(cb){
    if (falconActive) return;
    const scene=this;
    clearDialog();
    if(activeBubble){ activeBubble.destroy(); activeBubble=null; }
    falconActive = true;
    gameOver = true;
    if (spawnTimer) { spawnTimer.remove(false); spawnTimer = null; }

    function panicCustomers(){
      const fleeing=[...queue, ...wanderers];
      fleeing.forEach(c=>{
        if(c.walkTween){ c.walkTween.stop(); c.walkTween=null; }
        const dir=c.sprite.x<ORDER_X? -1:1;
        const targetX=dir===1?520:-40;
        const tl=scene.tweens.createTimeline();
        for(let i=0;i<3;i++){
          tl.add({targets:c.sprite,
                  x:Phaser.Math.Between(40,440),
                  y:Phaser.Math.Between(WANDER_TOP,WANDER_BOTTOM),
                  duration:dur(Phaser.Math.Between(200,400)),
                  ease:'Sine.easeInOut'});
        }
        tl.add({targets:c.sprite,
                x:targetX,
                duration:dur(WALK_OFF_BASE/1.5),
                onComplete:()=>c.sprite.destroy()});
        tl.play();
      });
      queue.length=0; wanderers.length=0;
    }

    const falcon=scene.add.sprite(-40,-40,'lady_falcon',0)
      .setScale(1.4,1.68)
      .setDepth(20);
    falcon.anims.play('falcon_fly');
    const targetX=girl.x;
    const targetY=girl.y-40;
    scene.tweens.add({
      targets:falcon,
      x:targetX,
      y:targetY,
      duration:dur(900),
      ease:'Cubic.easeIn',
      onComplete:()=>{
        panicCustomers();
        blinkAngry(scene);
        const tl=scene.tweens.createTimeline({callbackScope:scene,onComplete:()=>{
            falcon.destroy();
            if(cb) cb();
        }});
        for(let i=0;i<5;i++){
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
    const attackers=[];
    const gatherStartY = Math.max(WANDER_TOP, girl.y + 60);
    const gather=(arr)=>{
      arr.forEach(c=>{
        if(c.walkTween){ c.walkTween.stop(); c.walkTween=null; }
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
    gather(queue);
    gather(wanderers);

    while(attackers.length<3){
      const k=Phaser.Utils.Array.GetRandom(keys);
      const ay=Phaser.Math.Between(gatherStartY, WANDER_BOTTOM);
      const a=scene.add.sprite(Phaser.Math.Between(-40,520), ay, k)
        .setScale(scaleForY(ay)).setDepth(20);
      attackers.push(a);
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

  function showEnd(msg){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    if (spawnTimer) { spawnTimer.remove(false); spawnTimer=null; }
    clearDialog();
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
    btn.setInteractive({
      hitArea:new Phaser.Geom.Rectangle(-btn.width/2,-btn.height/2,btn.width,btn.height),
      hitAreaCallback:Phaser.Geom.Rectangle.Contains,
      useHandCursor:true
    });
    if (btn.input && btn.input.hitArea) {
      btn.input.hitArea.x = -btn.width / 2;
      btn.input.hitArea.y = -btn.height / 2;
      if (typeof btn.input.hitArea.setTo === 'function') {
        btn.input.hitArea.setTo(-btn.width / 2, -btn.height / 2,
          btn.width, btn.height);
      }
    }
    btn.on('pointerdown',()=>{
        bg.destroy(); txt.destroy(); btn.destroy(); if(titleText) titleText.destroy(); if(img) img.destroy();
        if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
        restartGame.call(this);
      });
    gameOver=true;
  }

  function restartGame(){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    if (spawnTimer) {
      spawnTimer.remove(false);
      spawnTimer = null;
    }
    falconActive = false;
    clearDialog();
    if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
    if(sideCText){ sideCText.destroy(); sideCText=null; }
    if(activeBubble){ activeBubble.destroy(); activeBubble=null; }
    reportLine1.setVisible(false);
    reportLine2.setVisible(false);
    reportLine3.setVisible(false);
    reportLine4.setVisible(false);
    tipText.setVisible(false);
    paidStamp.setVisible(false);
    lossStamp.setVisible(false);
    money=10.00; love=10;
    moneyText.setText('🪙 '+receipt(money));
    loveText.setText('❤️ '+love);
    updateLevelDisplay();
    if(activeCustomer){
      activeCustomer.sprite.destroy();
    }
    activeCustomer=null;
    Phaser.Actions.Call(queue,c=>{ c.sprite.destroy(); });
    queue=[];
    Phaser.Actions.Call(wanderers,c=>{ c.sprite.destroy(); });
    wanderers=[];
    servedCount=0;
    sideCAlpha=0;
    sideCFadeTween=null;
    gameOver=false;
    showStartScreen.call(this);
  }

  const Assets = { keys, requiredAssets, preload };
  const Scene = { create, showStartScreen, playIntro };
  const Customers = { spawnCustomer, lureNextWanderer, moveQueueForward, scheduleNextSpawn,
                      showDialog, clearDialog, handleAction, showFalconAttack,
                      showCustomerRevolt, restartGame };

  const config={ type:Phaser.AUTO, parent:'game-container', backgroundColor:'#f2e5d7',
    scale:{ mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width:480, height:640 },
    pixelArt:true, scene:{ preload: Assets.preload, create: Scene.create } };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('load', init);
    setTimeout(() => {
      if (!initCalled) {
        console.error('init() did not execute');
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
})();
