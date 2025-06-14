(() => {
  const DEBUG = false;
  const debugLog = (...args) => { if (DEBUG) console.log(...args); };
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
  const WALK_OFF_BASE=1000;
  const MAX_M=100, MAX_L=100;
  const MIN_ATTACK_SPACING=25;


  let money=10.00, love=10, gameOver=false;
  let queue=[], activeCustomer=null, wanderers=[];
  let spawnTimer = null;
  let falconActive = false;
  let loveLevel=1;
  const keys=[];
  const requiredAssets=['bg','truck','girl','lady_falcon','falcon_end','revolt_end'];

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
    btn.disableInteractive();
    this.tweens.add({
      targets: btn,
      alpha: 0,
      yoyo: true,
      duration: dur(80),
      repeat: 1,
      onComplete: () => {
        if (btn.setInteractive) {
          const w = btn._hitWidth !== undefined ? btn._hitWidth : btn.width;
          const h = btn._hitHeight !== undefined ? btn._hitHeight : btn.height;
          if (w !== undefined && h !== undefined && Phaser && Phaser.Geom && Phaser.Geom.Rectangle) {
            btn.setInteractive(
              new Phaser.Geom.Rectangle(0, 0, w, h),
              Phaser.Geom.Rectangle.Contains
            );
          } else {
            btn.setInteractive();
          }
        }
        if (onComplete) onComplete();
      }
    });
  }


  let moneyText, loveText, queueLevelText;
  let dialogBg, dialogText, dialogCoins, dialogPriceLabel, dialogPriceValue,
      btnSell, btnGive, btnRef;
  let reportLine1, reportLine2, reportLine3, reportLine4, tipText;
  let paidStamp, lossStamp;
  let truck, girl;
  let activeBubble=null;
  let sideCText;
  let spawnCount=0;
  let servedCount=0;
  let sideCAlpha=0;
  let sideCFadeTween=null;
  let endOverlay=null;
  let startOverlay=null;
  let startButton=null;
  let phoneContainer=null;

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


  function wanderOff(c, scene){
    const dir = Phaser.Math.Between(0,1)?1:-1;
    const targetX = dir===1?520:-40;
    const targets=[c.sprite];

    wanderers.splice(wanderers.indexOf(c),1);
    scene.tweens.add({targets:c.sprite,x:targetX,duration:dur(WALK_OFF_BASE),onComplete:()=>{
        c.sprite.destroy();
    }});
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
      c.walkTween=scene.tweens.add({targets:c.sprite,x:targetX,y:targetY,scale:scaleForY(targetY),duration:dur(1200+dist*4),ease:'Sine.easeIn',callbackScope:scene,
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
    // Log when the start screen is shown so we know the overlay is active
    console.log('showStartScreen called');
    startOverlay = scene.add.rectangle(240,320,480,640,0x000000,0.5)
      .setDepth(14);

    const phoneW = 260;
    const phoneH = 500;
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
      .setSize(bw,bh)
      .setInteractive({useHandCursor:true});

    const containerY = 320 - offsetY;
    phoneContainer = scene.add.container(240,containerY,[caseG,blackG,whiteG,homeG,startButton])
      .setDepth(15)
      .setInteractive();

    startButton.on('pointerdown',()=>{

        // Log click registration to help debug input issues
        console.log('start button clicked');

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
        console.log('intro finished');
        console.log('playIntro finished');
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
    for(let r=0;r<5;r++)for(let c=0;c<6;c++){
      if(r===0 && c===3) continue; // skip missing sprite
      const k=`new_kid_${r}_${c}`;
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
      this.add.text(240,360,'Retry Loading',{font:'20px sans-serif',fill:'#00f'})
        .setOrigin(0.5).setDepth(30).setInteractive({useHandCursor:true})
        .on('pointerdown',()=>window.location.reload());
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
    dialogBg=this.add.rectangle(240,460,460,110,0xffffff)
      .setStrokeStyle(2,0x000)
      .setVisible(false)
      .setDepth(10);
    dialogText=this.add.text(0,0,'',{font:'20px sans-serif',fill:'#000',align:'center',wordWrap:{width:420}})
                     .setOrigin(0,0.5).setVisible(false).setDepth(11);
    dialogCoins=this.add.text(0,0,'',{font:'20px sans-serif',fill:'#000'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    dialogPriceLabel=this.add.text(0,0,'',{font:'14px sans-serif',fill:'#000',align:'center'})
      .setOrigin(1,0.5).setVisible(false).setDepth(11);
    dialogPriceValue=this.add.text(0,0,'',{font:'32px sans-serif',fill:'#000'})
      .setOrigin(1,0.5).setVisible(false).setDepth(11);

    // helper to create a rounded rectangle button with consistent sizing
    const createButton=(x,label,iconChar,iconSize,color,handler)=>{
      const width=120, height=60, radius=8;
      const g=this.add.graphics();
      // Graphics objects do not support setShadow. Draw a simple shadow
      // manually by rendering a darker rect slightly offset behind the button.
      g.fillStyle(0x000000,0.3);
      g.fillRoundedRect(2,2,width,height,radius);

      g.fillStyle(color,1);
      g.fillRoundedRect(0,0,width,height,radius);
      let t=this.add.text(10,height/2,label,{font:'20px sans-serif',fill:'#fff'})
        .setOrigin(0,0.5);
      let icon=this.add.text(width-10,height/2,iconChar,{font:`${iconSize}px sans-serif`,fill:'#fff'})
        .setOrigin(1,0.5);
      let children=[g,t,icon];
      if(label==='REFUSE'){
        t.setFontSize(18);
        icon.setX(width-4);
        children=[g,icon,t];
      }
      // position the button below the dialog box
      const c=this.add.container(x - width/2,560 - height/2,children)
        .setSize(width,height)
        .setDepth(12)
        .setVisible(false);
      // store hit area dimensions for later reactivation
      c._hitWidth = width;
      c._hitHeight = height;
      // Explicitly specify the hit area so the pointer box aligns with the
      // visible button. Using the direct form prevents Phaser from shifting the
      // rectangle when enabling input.
      c.setInteractive(
        new Phaser.Geom.Rectangle(0,0,width,height),
        Phaser.Geom.Rectangle.Contains
      );
      if (c.input) {
        c.input.cursor='pointer';
      }
      c.on('pointerdown',()=>blinkButton.call(this,c,handler));
      return c;
    };

    // buttons evenly spaced

    btnSell=createButton(100,'SELL','💵',32,0x006400,()=>handleAction.call(this,'sell'));
    btnGive=createButton(240,'GIVE','💝',28,0x87cefa,()=>handleAction.call(this,'give'));
    btnRef=createButton(380,'REFUSE','✋',32,0x800000,()=>handleAction.call(this,'refuse'));


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
    const used=new Set();
    if(typeof queue!=='undefined') queue.forEach(cu=>used.add(cu.key));
    if(typeof wanderers!=='undefined') wanderers.forEach(cu=>used.add(cu.key));
    const avail=keys.filter(key=>!used.has(key));
    const k=Phaser.Utils.Array.GetRandom(avail.length?avail:keys);
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
    c.key=k;
    c.sprite=this.add.sprite(startX,startY,k).setScale(distScale).setDepth(4);
    const amp=Phaser.Math.Between(10,25);
    const freq=Phaser.Math.Between(2,4);
    c.walkTween=this.tweens.add({targets:c.sprite,x:targetX,duration:dur(12000),onUpdate:(tw,t)=>{
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

    spawnCount++;
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
    dialogBg.setVisible(true);
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
    const textY = dialogBg.y - 20;
    const coinsY = dialogBg.y + 10;
    dialogText
      .setOrigin(0,0.5)
      .setPosition(dialogBg.x-dialogBg.width/2+40,textY)
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
      .setOrigin(0,0.5)
      .setPosition(dialogBg.x-dialogBg.width/2+40,coinsY)
      .setStyle({fontSize:'20px'})
      .setText(coinLine)
      .setVisible(true);
    dialogPriceLabel
      .setOrigin(1,0.5)
      .setPosition(dialogBg.x+dialogBg.width/2-60,textY)
      .setStyle({fontSize:'14px'})
      .setText('Total\nCost')
      .setVisible(true);
    dialogPriceValue
      .setOrigin(1,0.5)
      .setPosition(dialogBg.x+dialogBg.width/2-60,coinsY)
      .setStyle({fontSize:'32px'})
      .setText(`$${totalCost.toFixed(2)}`)
      .setColor('#000')
      .setScale(1)
      .setAlpha(1)
      .setVisible(true);
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
      dialogPriceLabel.setVisible(false);
      dialogPriceValue.setVisible(false).setColor('#000');
    }else{
      dialogBg.setVisible(true);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
      dialogPriceLabel.setVisible(true);
      dialogPriceValue.setVisible(true);
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
      const t=dialogPriceValue;
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      t.setVisible(true);
      t.setDepth(paidStamp.depth+1);
      t.setText(receipt(totalCost));
      paidStamp
        .setText('PAID')
        .setScale(1.8)
        .setPosition(t.x - 20, t.y)
        .setAngle(Phaser.Math.Between(-15,15))
        .setVisible(true);

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
            t.setVisible(false);
            money=+(money+mD).toFixed(2);
            moneyText.setText('🪙 '+receipt(money));
            animateStatChange(moneyText, this, mD);
            done();
        }});
        tl.add({targets:t,x:destX,y:destY,scale:0,alpha:0,duration:dur(400)});
        tl.play();
      },[],this);
    } else if(type==='give'){
      const t=dialogPriceValue;
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      t.setVisible(true)
        .setDepth(lossStamp.depth+1);
      lossStamp
        .setText('LOSS')
        .setScale(1.8)
        .setPosition(t.x - 20, t.y)
        .setAngle(Phaser.Math.Between(-15,15))
        .setVisible(true);
      this.time.delayedCall(dur(1000),()=>{
        lossStamp.setVisible(false);
        dialogBg.setVisible(false);
        dialogText.setVisible(false);
        const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
            clearDialog();
            t.setVisible(false);
            money=+(money+mD).toFixed(2);
            moneyText.setText('🪙 '+receipt(money));
            animateStatChange(moneyText, this, mD);
            done();
        }});
        flashMoney(t,this,'#f00');
        tl.add({targets:t,x:destX,y:destY,scale:0,alpha:0,duration:dur(400)});
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
          tl.add({targets:girl,y:girl.y+5,duration:dur(80),yoyo:true},'<');
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
    const placed=[];
    const randomPos=()=>({
      x:Phaser.Math.Between(girl.x-40,girl.x+40),
      y:Math.max(gatherStartY,girl.y+20+Phaser.Math.Between(-10,10))
    });
    const pickPos=()=>{
      let pos=randomPos();
      let tries=0;
      while(tries<10 && placed.some(p=>Phaser.Math.Distance.Between(p.x,p.y,pos.x,pos.y)<MIN_ATTACK_SPACING)){
        pos=randomPos();
        tries++;
      }
      placed.push(pos);
      return pos;
    };
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
      const used=new Set(attackers.map(a=>a.texture.key));
      queue.forEach(c=>used.add(c.key));
      wanderers.forEach(c=>used.add(c.key));
      const avail=keys.filter(key=>!used.has(key));
      if(!avail.length) break;
      const k=Phaser.Utils.Array.GetRandom(avail);
      const {x, y}=pickPos();
      const a=scene.add.sprite(x, y, k)
        .setScale(scaleForY(y)).setDepth(20);
      attackers.push(a);
    }

    const loops=new Map();
    let hits=0;
    let finished=false;

    const repositionIfTooClose=sprite=>{
      for(const other of attackers){
        if(other===sprite) continue;
        if(Phaser.Math.Distance.Between(sprite.x,sprite.y,other.x,other.y)<MIN_ATTACK_SPACING){
          const {x,y}=pickPos();
          sprite.setPosition(x,y);
          sprite.setScale(scaleForY(y));
          break;
        }
      }
    };

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
        scene.tweens.add({
          targets:driver,
          x:truck.x-40,
          y:truck.y,
          duration:dur(300),
          onComplete:()=>{
            driver.destroy();
            scene.tweens.add({
              targets:truck,
              x:-200,
              duration:dur(800),
              onComplete:()=>{if(cb) cb();}
            });
          }
        });
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
            repositionIfTooClose(a);
            loops.set(a, scene.time.delayedCall(dur(Phaser.Math.Between(200,400)),()=>attack(a),[],scene));
          }
        }
      });
    }

    attackers.forEach(a=>{
      const {x:tx, y:ty}=pickPos();
      scene.tweens.add({
        targets:a,
        x:tx,
        y:ty,
        scale:scaleForY(ty),
        duration:dur(400),
        onComplete:()=>{
          repositionIfTooClose(a);
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
      .setOrigin(0.5).setDepth(22).setInteractive()
      .on('pointerdown',()=>{
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
    spawnCount=0;
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
