window.onload = function(){
  const COFFEE_COST=5.00, WATER_COST=5.58;
  const VERSION='60';
  // spawn new customers slowly to keep things manageable
  // at least a few seconds between arrivals
  const SPAWN_DELAY=3000;
  const SPAWN_VARIANCE=2000;
  const QUEUE_SPACING=36;
  // front of the queue near the truck
  const QUEUE_X=240;
  const QUEUE_Y=360;
  const FRIEND_OFFSET=40;
  const WANDER_Y=600;
  const MAX_WANDERERS=1;
  const WALK_OFF_BASE=1000;
  const WALK_OFF_SLOW=200;
  const MAX_M=100, MAX_L=100;
  const MAX_SPEED=3;
  let speed=1;
  let money=10.00, love=10, gameOver=false;
  let queue=[], activeCustomer=null, wanderers=[];
  let spawnTimer = null;
  let loveLevel=1;
  const keys=[];

  const dur=v=>v/speed;

  const supers={
    '0':'\u2070','1':'\u00b9','2':'\u00b2','3':'\u00b3','4':'\u2074',
    '5':'\u2075','6':'\u2076','7':'\u2077','8':'\u2078','9':'\u2079'
  };

  function receipt(value){
    const [d,c]=value.toFixed(2).split('.');
    const cents=c.split('').map(ch=>supers[ch]||ch).join('');
    return `$${d}${cents}`;
  }

  const config={ type:Phaser.AUTO, parent:'game-container', backgroundColor:'#f2e5d7',
    scale:{ mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width:480, height:640 },
    pixelArt:true, scene:{ preload, create } };
  new Phaser.Game(config);

  let moneyText, loveText, loveLevelText, queueLevelText, versionText, speedBtn;
  let dialogBg, dialogText, dialogCoins, dialogPriceLabel, dialogPriceValue,
      btnSell, btnGive, btnRef;
  let iconSell, iconGive, iconRef;
  let reportLine1, reportLine2, reportLine3, reportLine4, tipText;
  let paidStamp, lossStamp;
  let truck, girl;
  let activeBubble=null;
  let sideCText;
  let spawnCount=0;

  function calcLoveLevel(v){
    if(v>=100) return 4;
    if(v>=50) return 3;
    if(v>=20) return 2;
    return 1;
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
    const level=calcLoveLevel(love);
    if(wanderers.length && queue.length < level){
      const c=wanderers.shift();
      if(c.walkTween) c.walkTween.stop();
      const idx=queue.length;
      queue.push(c);
      activeCustomer=queue[0];
      const targetY=QUEUE_Y+idx*QUEUE_SPACING;
      const dist=Phaser.Math.Distance.Between(c.sprite.x,c.sprite.y,QUEUE_X,targetY);
      c.sprite.setDepth(5);
      c.walkTween=scene.tweens.add({targets:c.sprite,x:QUEUE_X,y:targetY,scale:0.7,duration:dur(1200+dist*4),ease:'Sine.easeIn',callbackScope:scene,
        onComplete:()=>{c.walkTween=null; if(idx===0) showDialog.call(scene);} });
    }
  }

  function moveQueueForward(){
    const scene=this;
    queue.forEach((cust, idx)=>{
      const ty=QUEUE_Y+idx*QUEUE_SPACING;
      if(cust.sprite.y!==ty){
        scene.tweens.add({targets:cust.sprite,y:ty,duration:dur(300)});
        if(cust.friend) scene.tweens.add({targets:cust.friend,y:ty,duration:dur(300)});
      }
    });
    activeCustomer=queue[0]||null;
    if(activeCustomer){
      showDialog.call(scene);
    } else {
      lureNextWanderer(scene);
    }
  }

  function updateLevelDisplay(){
    const newLevel=calcLoveLevel(love);
    if(loveLevelText){
      loveLevelText.setText(newLevel);
      if(newLevel>loveLevel){
        const scene=loveLevelText.scene;
        loveLevelText.setColor('#fff');
        scene.time.delayedCall(dur(1000),()=>loveLevelText.setColor('#800'),[],scene);
        const sp=scene.add.text(loveLevelText.x,loveLevelText.y,'✨',
            {font:'18px sans-serif',fill:'#fff'})
          .setOrigin(0.5).setDepth(loveLevelText.depth+1);
        scene.tweens.add({targets:sp,y:loveLevelText.y-20,alpha:0,
            duration:dur(600),onComplete:()=>sp.destroy()});
      }
    }
    if(queueLevelText){
      queueLevelText.setText('Lv. '+newLevel);
      if(newLevel!==loveLevel){
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
    const delay = SPAWN_DELAY + Phaser.Math.Between(0, SPAWN_VARIANCE);
    // use real-time delay to ensure customers never spawn too quickly,
    // regardless of game speed adjustments
    spawnTimer = scene.time.delayedCall(delay, spawnCustomer, [], scene);
  }

  function showSideC(){
    if(sideCText) return;
    const y=this.scale.height*0.15;
    sideCText=this.add.text(this.scale.width/2,y,'Side C',
        {font:'bold 64px sans-serif',fill:'#fff'})
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
    // position level number centered over the heart icon
    loveLevelText=this.add.text(loveText.x+12,loveText.y+13,loveLevel,
        {font:'12px sans-serif',fill:'#800'})
      .setOrigin(0.5)
      .setDepth(1);
    queueLevelText=this.add.text(320,292,'Lv. '+loveLevel,{font:'16px sans-serif',fill:'#000'})
      .setOrigin(0.5).setDepth(1);
    updateLevelDisplay();
    versionText=this.add.text(10,630,'v'+VERSION,{font:'12px sans-serif',fill:'#000'})
      .setOrigin(0,1).setDepth(1);
    speedBtn=this.add.text(460,20,'1x',{font:'20px sans-serif',fill:'#000',backgroundColor:'#ddd',padding:{x:6,y:4}})
      .setOrigin(1,0).setDepth(1).setInteractive()
      .on('pointerdown',()=>{
        speed = speed < MAX_SPEED ? speed + 1 : 1;
        speedBtn.setText(speed+'x');
      });

    // truck & girl
    truck=this.add.image(520,245,'truck').setScale(0.924).setDepth(2);

    girl=this.add.image(520,260,'girl').setScale(0.5).setDepth(3).setVisible(false);

    playIntro(this);

    // dialog
    dialogBg=this.add.rectangle(240,460,460,120,0xffffff).setStrokeStyle(2,0x000).setVisible(false).setDepth(10);
    dialogText=this.add.text(240,440,'',{font:'24px sans-serif',fill:'#000',align:'center',wordWrap:{width:420}})
                     .setOrigin(0.5).setVisible(false).setDepth(11);
    dialogCoins=this.add.text(240,470,'',{font:'24px sans-serif',fill:'#000'})
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
      const req=coins<COFFEE_COST?'water':'coffee';
      const qty=(level>=3?2:1);
      return {coins, req, qty};
    };

    const c={ orders:[] };
    const startScale=1.1;
    const k=Phaser.Utils.Array.GetRandom(keys);
    const order=createOrder();

    const queueFull = queue.length >= level;
    if(queueFull){
      if(wanderers.length>=MAX_WANDERERS){
        scheduleNextSpawn(this);
        return;
      }
      const dir=Phaser.Math.Between(0,1)?1:-1;
      const startX=dir===1?-40:520;
      const targetX=dir===1?520:-40;
      const startY=Phaser.Math.Between(WANDER_Y-15,WANDER_Y+15);
      const distScale=0.6+((startY-(WANDER_Y-15))/30)*0.3;
      c.orders.push(order);
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
      scheduleNextSpawn(this);
      return;
    }

    const startX=Phaser.Math.Between(-40,520);
    const startY=700+Phaser.Math.Between(-20,10);
    c.sprite=this.add.sprite(startX,startY,k).setScale(startScale).setDepth(4);

    if(level>=3 && Phaser.Math.Between(1,100)<=love){
      const k2=Phaser.Utils.Array.GetRandom(keys);
      order.qty+=1;
      c.friend=this.add.sprite(startX+FRIEND_OFFSET,startY,k2).setScale(startScale).setDepth(4);
    }
    c.orders.push(order);

    const idx=queue.length;
    queue.push(c);
    activeCustomer = queue[0];
    const targetY=QUEUE_Y + idx*QUEUE_SPACING;
    const dist=Phaser.Math.Distance.Between(startX,startY,QUEUE_X,targetY);
    const moveDur=1200+dist*4;
    c.sprite.setDepth(5);
    if(c.friend) c.friend.setDepth(5);
    c.walkTween = this.tweens.add({targets:c.sprite,x:QUEUE_X,y:targetY,scale:0.7,duration:dur(moveDur),ease:'Sine.easeIn',callbackScope:this,
      onComplete:()=>{ c.walkTween=null; if(idx===0) showDialog.call(this); }});
    if(c.friend){
      this.tweens.add({targets:c.friend,x:QUEUE_X+FRIEND_OFFSET,y:targetY,scale:0.7,duration:dur(moveDur),ease:'Sine.easeIn'});
    }
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
    dialogBg.setVisible(true);
    const itemStr=c.orders.map(o=>`${o.qty>1?o.qty+' ':''}${o.req}`).join(' and ');
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
      .setPosition(dialogBg.x-dialogBg.width/2+60,440)
      .setText(`I want ${itemStr}`)
      .setVisible(true);
    dialogCoins
      .setOrigin(0,0.5)
      .setPosition(dialogBg.x-dialogBg.width/2+60,470)
      .setStyle({fontSize:'24px'})
      .setText(`I have $${c.orders[0].coins.toFixed(2)}`)
      .setVisible(true);
    const totalCost=c.orders.reduce((s,o)=>s+(o.req==='coffee'?COFFEE_COST:WATER_COST)*o.qty,0);
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
      .setAlpha(1)
      .setVisible(true);
    tipText.setVisible(false);
    const hasCoffee=c.orders.some(o=>o.req==='coffee');
    btnSell.setVisible(hasCoffee); btnGive.setVisible(true); btnRef.setVisible(true);
    iconSell.setVisible(hasCoffee); iconGive.setVisible(true); iconRef.setVisible(true);
  }

  function clearDialog(keepPrice=false){
    if(!keepPrice){
      dialogBg.setVisible(false);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
      dialogPriceLabel.setVisible(false);
      dialogPriceValue.setVisible(false);
    }else{
      dialogBg.setVisible(true);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
      dialogPriceLabel.setVisible(true);
      dialogPriceValue.setVisible(true);
    }
    btnSell.setVisible(false); btnGive.setVisible(false); btnRef.setVisible(false);
    iconSell.setVisible(false); iconGive.setVisible(false); iconRef.setVisible(false);
    tipText.setVisible(false);
  }

  function handleAction(type){
    clearDialog(type!=='refuse');
    const current=activeCustomer;
    if(!current) return;
    const orderCount=current.orders.length;
    const totalCost=current.orders.reduce((s,o)=>s+(o.req==='coffee'?COFFEE_COST:WATER_COST)*o.qty,0);

    let mD=0, lD=0, tip=0;
    if(type==='sell'){
      lD=Phaser.Math.Between(0,2)*orderCount;
      tip=+(totalCost*0.15*lD).toFixed(2);
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
          if(money<=0){showEnd.call(this,'Game Over\nYou are fired');return;}
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
            done();
        }});
        tl.add({targets:t,x:moneyText.x,y:moneyText.y,alpha:0,duration:dur(400)});
        tl.play();
      },[],this);
    } else if(type==='give'){
      const t=dialogPriceValue;
      t.setVisible(true);
      lossStamp
        .setText('LOSS')
        .setScale(1.8)
        .setPosition(t.x, t.y)
        .setAngle(Phaser.Math.Between(-15,15))
        .setVisible(true);
      this.time.delayedCall(dur(1000),()=>{
        lossStamp.setVisible(false);
        t.setText(`-$${totalCost.toFixed(2)}`);
        dialogBg.setVisible(false);
        dialogText.setVisible(false);
        const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
            clearDialog();
            t.setVisible(false);
            money=+(money+mD).toFixed(2);
            moneyText.setText('🪙 '+receipt(money));
            done();
        }});
        tl.add({targets:t,x:moneyText.x,y:moneyText.y,alpha:0,duration:dur(400)});
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

      const moving=[reportLine1];
      const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
          reportLine1.setVisible(false).alpha=1;
          reportLine2.setVisible(false).alpha=1;
          reportLine3.setVisible(false).alpha=1;
          money=+(money+mD).toFixed(2);
          moneyText.setText('🪙 '+receipt(money));
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

      tl.add({targets:moving,duration:dur(2000)});
      const endDelay = showTip ? 0 : dur(300);
      tl.add({targets:moving,x:moneyText.x,y:moneyText.y,alpha:0,duration:dur(400),delay:endDelay});

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
      if(idx>=hearts.length){ if(cb) cb(); return; }
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

  function showEnd(msg){
    clearDialog();
    const bg=this.add.rectangle(240,320,480,240,0xffffff).setStrokeStyle(2,0x000).setDepth(20);
    const txt=this.add.text(240,300,msg,{font:'24px sans-serif',fill:'#000',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5).setDepth(21);
    const btn=this.add.text(240,350,'Restart',{font:'20px sans-serif',fill:'#fff',backgroundColor:'#006400',padding:{x:14,y:8}})
      .setOrigin(0.5).setDepth(22).setInteractive()
      .on('pointerdown',()=>{
        bg.destroy(); txt.destroy(); btn.destroy();
        restartGame.call(this);
      });
    gameOver=true;
  }

  function restartGame(){
    if (spawnTimer) {
      spawnTimer.remove(false);
      spawnTimer = null;
    }
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
    speed = 1;
    if (speedBtn) speedBtn.setText('1x');
    gameOver=false;
    playIntro(this);
  }

};
