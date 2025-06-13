window.onload = function(){
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
  const QUEUE_SPACING=36;
  // waiting spot to the left of the truck
  const QUEUE_X=220; // base position for the waiting line
  const QUEUE_OFFSET=8; // stack each waiting customer slightly left
  const ORDER_X=230; // ordering spot shifted right
  const QUEUE_Y=320; // matches new order position
  // step forward when ordering
  const ORDER_Y=310; // moved down a bit
  const FRIEND_OFFSET=40;
  const WANDER_TOP=ORDER_Y+50; // wander up to 50px below the order window
  const WANDER_BOTTOM=580; // near bottom of the screen
  // base number of customers that can linger nearby
  const BASE_WAITERS=3;
  const WALK_OFF_BASE=1000;
  const WALK_OFF_SLOW=200;
  const MAX_M=100, MAX_L=100;


  let money=10.00, love=10, gameOver=false;
  let queue=[], activeCustomer=null, wanderers=[];
  let spawnTimer = null;
  let loveLevel=1;
  const keys=[];

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
    scene.tweens.add({targets:obj, y:originalY+by, duration:dur(120), yoyo:true});
    let on=true;
    const flashes = isLove && !up ? 4 : 2;
    scene.time.addEvent({
      repeat:flashes,
      delay:dur(80),
      callback:()=>{
        obj.setColor(on?color:'#fff');
        if(isLove && !up){
          obj.setText((on?'💔':'❤️')+' '+love);
        }
        on=!on;
      }
    });
    scene.time.delayedCall(dur(80)*(flashes+1)+dur(10),()=>{
      obj.setColor('#fff');
      if(isLove && !up){
        obj.setText('❤️ '+love);
      }
    },[],scene);
  }

  const config={ type:Phaser.AUTO, parent:'game-container', backgroundColor:'#f2e5d7',
    scale:{ mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width:480, height:640 },
    pixelArt:true, scene:{ preload, create } };
  new Phaser.Game(config);

  let moneyText, loveText, queueLevelText;
  let dialogBg, dialogText, dialogCoins, dialogPriceLabel, dialogPriceValue,
      btnSell, btnGive, btnRef;
  let iconSell, iconGive, iconRef;
  let reportLine1, reportLine2, reportLine3, reportLine4, tipText;
  let paidStamp, lossStamp;
  let truck, girl;
  let activeBubble=null;
  let sideCText;
  let spawnCount=0;
  let endOverlay=null;

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
    if(c.friend) targets.push(c.friend);
    wanderers.splice(wanderers.indexOf(c),1);
    scene.tweens.add({targets:targets,x:targetX,duration:dur(WALK_OFF_BASE),onComplete:()=>{
        targets.forEach(t=>t.destroy());
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
      if(c.walkTween) c.walkTween.stop();
      const idx=queue.length;
      c.atOrder=false;
      queue.push(c);
      activeCustomer=queue[0];
      const targetY=QUEUE_Y+idx*QUEUE_SPACING;
      const targetX = idx===0 ? ORDER_X : QUEUE_X - QUEUE_OFFSET*(idx-1);
      const dist=Phaser.Math.Distance.Between(c.sprite.x,c.sprite.y,targetX,targetY);
      c.sprite.setDepth(5);
      c.walkTween=scene.tweens.add({targets:c.sprite,x:targetX,y:targetY,scale:scaleForY(targetY),duration:dur(1200+dist*4),ease:'Sine.easeIn',callbackScope:scene,
        onComplete:()=>{c.walkTween=null; if(idx===0) showDialog.call(scene);} });
      if(c.friend){
        scene.tweens.add({targets:c.friend,x:targetX+FRIEND_OFFSET,y:targetY,scale:scaleForY(targetY),duration:dur(1200+dist*4),ease:'Sine.easeIn'});
      }
    }
  }

  function moveQueueForward(){
    const scene=this;
    let willShow=false;
    queue.forEach((cust, idx)=>{
      const ty=QUEUE_Y+idx*QUEUE_SPACING;
      const tx=idx===0?ORDER_X:QUEUE_X - QUEUE_OFFSET*(idx-1);
      if(cust.sprite.y!==ty || cust.sprite.x!==tx){
        const cfg={targets:cust.sprite,x:tx,y:ty,scale:scaleForY(ty),duration:dur(300)};
        if(idx===0){
          cfg.onComplete=()=>{ showDialog.call(scene); };
          willShow=true;
        }
        scene.tweens.add(cfg);
        if(cust.friend) scene.tweens.add({targets:cust.friend,x:tx+FRIEND_OFFSET,y:ty,scale:scaleForY(ty),duration:dur(300)});
      }
    });
    activeCustomer=queue[0]||null;
    if(activeCustomer){
      if(!willShow && activeCustomer.sprite.y===QUEUE_Y && activeCustomer.sprite.x===ORDER_X){
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
    this.tweens.timeline({
      targets: sideCText,
      tweens: [
        { alpha: 1, duration: 20000 },
        { alpha: 0, duration: 20000, onComplete:()=>{ sideCText.destroy(); sideCText=null; } }
      ]
    });
  }

  function playIntro(scene){
    if(!truck || !girl) return;
    truck.setPosition(520,245);
    girl.setPosition(520,260).setVisible(false);
    const intro=scene.tweens.createTimeline({callbackScope:scene,
      onComplete:()=>{
        spawnCustomer.call(scene);
        scheduleNextSpawn(scene);
      }});
    intro.add({targets:[truck,girl],x:240,duration:dur(600)});
    intro.add({targets:girl,y:292,duration:dur(300),onStart:()=>girl.setVisible(true)});
    intro.play();
  }

  function preload(){
    this.load.image('bg','assets/bg.png');
    this.load.image('truck','assets/truck.png');
    this.load.image('girl','assets/coffeegirl.png');
    this.load.spritesheet('lady_falcon','assets/lady_falcon.png',{frameWidth:64,frameHeight:64});
    this.load.image('falcon_end','assets/ladyfalconend.png');
    for(let r=0;r<5;r++)for(let c=0;c<6;c++){
      if(r===0 && c===3) continue; // skip missing sprite
      const k=`new_kid_${r}_${c}`; keys.push(k);
      this.load.image(k,`assets/genz/${k}.png`);
    }
  }

  function create(){
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
    truck=this.add.image(520,245,'truck').setScale(0.924).setDepth(2);

    girl=this.add.image(520,260,'girl').setScale(0.5).setDepth(3).setVisible(false);

    // create lady falcon animation
    this.anims.create({
      key:'falcon_fly',
      frames:this.anims.generateFrameNumbers('lady_falcon',{start:0,end:1}),
      frameRate:6,
      repeat:-1
    });

    playIntro(this);

    // dialog
    dialogBg=this.add.rectangle(240,460,460,120,0xffffff).setStrokeStyle(2,0x000).setVisible(false).setDepth(10);
    dialogText=this.add.text(240,440,'',{font:'20px sans-serif',fill:'#000',align:'center',wordWrap:{width:420}})
                     .setOrigin(0.5).setVisible(false).setDepth(11);
    dialogCoins=this.add.text(240,470,'',{font:'20px sans-serif',fill:'#000'})
      .setOrigin(0.5).setVisible(false).setDepth(11);
    dialogPriceLabel=this.add.text(240,456,'',{font:'14px sans-serif',fill:'#000',align:'center'})
      .setOrigin(0.5).setVisible(false).setDepth(11);
    dialogPriceValue=this.add.text(240,480,'',{font:'32px sans-serif',fill:'#000'})
      .setOrigin(0.5).setVisible(false).setDepth(11);

    // buttons
    btnSell=this.add.text(80,500,'Sell',{font:'18px sans-serif',fill:'#fff',backgroundColor:'#006400',padding:{x:12,y:6}})
      .setInteractive().setVisible(false).setDepth(12).setShadow(0,0,'#000',2,true,true)
      .on('pointerdown',()=>handleAction.call(this,'sell'));
    btnGive=this.add.text(200,500,'Give Free',{font:'18px sans-serif',fill:'#fff',backgroundColor:'#008000',padding:{x:12,y:6}})
      .setInteractive().setVisible(false).setDepth(12).setShadow(0,0,'#000',2,true,true)
      .on('pointerdown',()=>handleAction.call(this,'give'));
    btnRef=this.add.text(360,500,'Refuse',{font:'18px sans-serif',fill:'#fff',backgroundColor:'#800000',padding:{x:12,y:6}})
      .setInteractive().setVisible(false).setDepth(12).setShadow(0,0,'#000',2,true,true)
      .on('pointerdown',()=>handleAction.call(this,'refuse'));

    // emoji icons behind buttons
    iconSell=this.add.text(0,0,'💵',{font:'60px sans-serif',fill:'#000'})
      .setOrigin(0.5).setAlpha(0.3).setDepth(13).setVisible(false);
    iconGive=this.add.text(0,0,'💝',{font:'60px sans-serif',fill:'#000'})
      .setOrigin(0.5).setAlpha(0.3).setDepth(13).setVisible(false);
    iconRef=this.add.text(0,0,'✋',{font:'60px sans-serif',fill:'#000'})
      .setOrigin(0.5).setAlpha(0.3).setDepth(13).setVisible(false);

    // position icons behind their buttons
    const centerPos=(btn)=>[btn.x+btn.width/2, btn.y+btn.height/2];
    const [sx,sy]=centerPos(btnSell);
    iconSell.setPosition(sx,sy);
    const [gx,gy]=centerPos(btnGive);
    iconGive.setPosition(gx,gy);
    const [rx,ry]=centerPos(btnRef);
    iconRef.setPosition(rx,ry);

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
  }

  function spawnCustomer(){
    const level=calcLoveLevel(love);
    if(gameOver) return;
    const createOrder=()=>{
      const coins=Phaser.Math.Between(0,20);
      const item=Phaser.Utils.Array.GetRandom(MENU);
      const qty=(level>=3?2:1);
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
    c.walkTween=this.tweens.add({targets:c.sprite,x:targetX,duration:dur(12000),onUpdate:(tw,t)=>{
        const p=tw.progress;
        t.y=startY+Math.sin(p*Math.PI*freq)*amp;
      },onComplete:()=>{
        const idx=wanderers.indexOf(c);
        if(idx>=0) wanderers.splice(idx,1);
        c.sprite.destroy();
      }});
    if(level>=3 && Phaser.Math.Between(1,100)<=love){
      const k2=Phaser.Utils.Array.GetRandom(keys);
      order.qty+=1;
      c.friend=this.add.sprite(startX+FRIEND_OFFSET,startY,k2).setScale(distScale).setDepth(4);
      this.tweens.add({targets:c.friend,x:targetX,duration:dur(12000),onUpdate:(tw,t)=>{
          const p=tw.progress;
          t.y=startY+Math.sin(p*Math.PI*freq)*amp;
        }});
    }
    wanderers.push(c);
    lureNextWanderer(this);
    scheduleNextSpawn(this);

    spawnCount++;
    if(spawnCount===2){
      this.time.delayedCall(500,showSideC,[],this);
    }
  }

  function showDialog(){
    activeCustomer=queue[0]||null;
    if(!activeCustomer) return;
    const c=activeCustomer;
    if(!c.atOrder && (c.sprite.y!==ORDER_Y || c.sprite.x!==ORDER_X)){
      c.atOrder=true;
      const targets=[c.sprite];
      if(c.friend) targets.push(c.friend);
      this.tweens.add({targets:targets,x:ORDER_X,y:ORDER_Y,scale:scaleForY(ORDER_Y),duration:dur(300),onComplete:()=>{showDialog.call(this);}});
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
    dialogText
      .setOrigin(0,0.5)
      .setPosition(dialogBg.x-dialogBg.width/2+40,440)
      .setText(wantLine)
      .setVisible(true);
    const totalCost=c.orders.reduce((s,o)=>s+o.price*o.qty,0);
    const canAfford = c.orders[0].coins >= totalCost;
    dialogCoins
      .setOrigin(0,0.5)
      .setPosition(dialogBg.x-dialogBg.width/2+40,470)
      .setStyle({fontSize:'20px'})
      .setText(canAfford?`I have $${c.orders[0].coins}`:`...but I only have $${c.orders[0].coins}`)
      .setVisible(true);
    dialogPriceLabel
      .setOrigin(1,0.5)
      .setPosition(dialogBg.x+dialogBg.width/2-60,440)
      .setStyle({fontSize:'14px'})
      .setText('Total\nCost')
      .setVisible(true);
    dialogPriceValue
      .setOrigin(1,0.5)
      .setPosition(dialogBg.x+dialogBg.width/2-60,470)
      .setStyle({fontSize:'32px'})
      .setText(`$${totalCost.toFixed(2)}`)
      .setColor('#000')
      .setScale(1)
      .setAlpha(1)
      .setVisible(true);
    tipText.setVisible(false);
    btnSell.setVisible(canAfford);
    if (canAfford) btnSell.setInteractive(); else btnSell.disableInteractive();
    btnGive.setVisible(true).setInteractive();
    btnRef.setVisible(true).setInteractive();
    iconSell.setVisible(canAfford); iconGive.setVisible(true); iconRef.setVisible(true);
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
    btnSell.setVisible(false).disableInteractive();
    btnGive.setVisible(false).disableInteractive();
    btnRef.setVisible(false).disableInteractive();
    iconSell.setVisible(false); iconGive.setVisible(false); iconRef.setVisible(false);
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
    const friend=current.friend;
    activeCustomer=null;

    const finish=()=>{
      const targets=[current.sprite];
      if(friend) targets.push(friend);
      targets.forEach(t=>t.setDepth(5));
      this.tweens.add({ targets: targets, x: (type==='refuse'? -50:520), alpha:0, duration:dur(WALK_OFF_BASE), callbackScope:this,
        onComplete:()=>{
          current.sprite.destroy();
          if(friend) friend.destroy();
          queue.shift();
          moveQueueForward.call(this);
          if(money<=0){
            showFalconAttack.call(this,()=>{
              showEnd.call(this,'Game Over\nYou lost all the money.\nLady Falcon reclaims the coffee truck.');
            });
            return;
          }
          if(love<=0){showEnd.call(this,'Game Over 😠');return;}
          if(money>=MAX_M){showEnd.call(this,'Congrats! 💰');return;}
          if(love>=MAX_L){showEnd.call(this,'Victory! ❤️');return;}
          scheduleNextSpawn(this);
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
    const scene=this;
    const falcon=scene.add.sprite(-40,-40,'lady_falcon',0)
      .setScale(1.4)
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
      const e=s.add.text(girl.x,girl.y-50,'😠',{font:'32px sans-serif',fill:'#f00'})
        .setOrigin(0.5).setDepth(21);
      s.tweens.add({targets:e,alpha:0,duration:dur(150),yoyo:true,repeat:2,onComplete:()=>e.destroy()});
    }

    function createDebrisEmoji(s, x, y){
      const chars=['✨','💥','🪶'];
      const ch=chars[Phaser.Math.Between(0,chars.length-1)];
      return s.add.text(x,y,ch,{font:'24px sans-serif',fill:'#555'})
        .setOrigin(0.5).setDepth(21);
    }
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
      if(activeCustomer.friend) activeCustomer.friend.destroy();
    }
    activeCustomer=null;
    Phaser.Actions.Call(queue,c=>{ c.sprite.destroy(); if(c.friend) c.friend.destroy(); });
    queue=[];
    Phaser.Actions.Call(wanderers,c=>{ c.sprite.destroy(); if(c.friend) c.friend.destroy(); });
    wanderers=[];
    spawnCount=0;
    gameOver=false;
    playIntro(this);
  }

};
