window.onload = function(){
  const COFFEE_COST=5.00, WATER_COST=5.58;
  const VERSION='56';
  const SPAWN_DELAY=300;
  const SPAWN_VARIANCE=500;
  const QUEUE_SPACING=50;
  const QUEUE_X=240;
  const FRIEND_OFFSET=40;
  const WANDER_Y=600;
  const MAX_M=100, MAX_L=100;
  let speed=1;
  let money=10.00, love=10, gameOver=false, customerQueue=[], wanderers=[];
  let loveLevel=1;
  const keys=[];

  const dur=v=>v/speed;

  const config={ type:Phaser.AUTO, parent:'game-container', backgroundColor:'#f2e5d7',
    scale:{ mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width:480, height:640 },
    pixelArt:true, scene:{ preload, create } };
  new Phaser.Game(config);

  let moneyText, loveText, loveLevelText, queueLevelText, versionText, speedBtn;
  let dialogBg, dialogText, dialogCoins, btnSell, btnGive, btnRef;
  let iconSell, iconGive, iconRef;
  let reportLine1, reportLine2, reportLine3, reportLine4;
  let paidStamp;

  function calcLoveLevel(v){
    if(v>=100) return 4;
    if(v>=50) return 3;
    if(v>=20) return 2;
    return 1;
  }

  function queueCapacityForLevel(lv){
    if(lv===1) return 1;
    if(lv===2) return 2;
    return 3;
  }

  function repositionQueue(scene){
    Phaser.Actions.Call(customerQueue,(c,idx)=>{
      const targetY=332+QUEUE_SPACING*idx;
      scene.tweens.add({targets:c.sprite,x:QUEUE_X,y:targetY,duration:dur(500)});
      if(c.friend){
        scene.tweens.add({targets:c.friend,x:QUEUE_X+FRIEND_OFFSET,y:targetY,duration:dur(500)});
      }
    });
    tryJoinWanderer(scene);
  }

  function tryJoinWanderer(scene){
    const level=calcLoveLevel(love);
    const maxQ=queueCapacityForLevel(level);
    if(customerQueue.length>=maxQ||wanderers.length===0) return;
    const w=wanderers.shift();
    if(w.walkTween) w.walkTween.stop();
    const targetY=332+QUEUE_SPACING*customerQueue.length;
    customerQueue.push(w);
    const dist=Phaser.Math.Distance.Between(w.sprite.x,w.sprite.y,QUEUE_X,targetY);
    w.walkTween = scene.tweens.add({targets:w.sprite,x:QUEUE_X,y:targetY,scale:0.7,duration:dur(800+dist*2),ease:'Sine.easeIn',callbackScope:scene,
      onComplete:()=>{ w.walkTween=null; startGiveUpTimer(w,scene); if(customerQueue[0]===w){ showDialog.call(scene); } }});
  }

  function startGiveUpTimer(c, scene){
    c.giveUpTimer = scene.time.delayedCall(dur(20000), () => {
      const idx = customerQueue.indexOf(c);
      if(idx>0){
        customerQueue.splice(idx,1);
        const targets=[c.sprite];
        if(c.friend) targets.push(c.friend);
        scene.tweens.add({targets:targets,x:-50,duration:dur(600),onComplete:()=>{
          c.sprite.destroy();
          if(c.friend) c.friend.destroy();
          repositionQueue(scene);
        }});
      }
    }, [], scene);
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
  }

  function scheduleNextSpawn(scene){
    const delay = SPAWN_DELAY + Phaser.Math.Between(0, SPAWN_VARIANCE);
    scene.time.delayedCall(dur(delay), spawnCustomer, [], scene);
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
    moneyText=this.add.text(20,20,'🪙 '+money.toFixed(2),{font:'26px sans-serif',fill:'#fff'}).setDepth(1);
    loveText=this.add.text(20,50,'❤️ '+love,{font:'26px sans-serif',fill:'#fff'}).setDepth(1);
    // position level number centered over the heart icon
    loveLevelText=this.add.text(loveText.x+12,loveText.y+8,loveLevel,
        {font:'12px sans-serif',fill:'#800'})
      .setOrigin(0.5)
      .setDepth(1);
    queueLevelText=this.add.text(320,360,'Lv. '+loveLevel,{font:'16px sans-serif',fill:'#000'})
      .setOrigin(0.5).setDepth(1);
    updateLevelDisplay();
    versionText=this.add.text(10,630,'v'+VERSION,{font:'12px sans-serif',fill:'#000'})
      .setOrigin(0,1).setDepth(1);
    speedBtn=this.add.text(460,20,'1x',{font:'20px sans-serif',fill:'#000',backgroundColor:'#ddd',padding:{x:6,y:4}})
      .setOrigin(1,0).setDepth(1).setInteractive()
      .on('pointerdown',()=>{ speed++; speedBtn.setText(speed+'x'); });

    // truck & girl
    const truck=this.add.image(520,245,'truck').setScale(0.924).setDepth(2);

    const girl=this.add.image(520,260,'girl').setScale(0.5).setDepth(3).setVisible(false);

    const intro=this.tweens.createTimeline({callbackScope:this,
      onComplete:()=>scheduleNextSpawn(this)});
    intro.add({targets:[truck,girl],x:240,duration:dur(600)});
    intro.add({targets:girl,y:292,duration:dur(300),onStart:()=>girl.setVisible(true)});
    intro.play();

    // dialog
    dialogBg=this.add.rectangle(240,460,460,120,0xffffff).setStrokeStyle(2,0x000).setVisible(false).setDepth(10);
    dialogText=this.add.text(240,440,'',{font:'24px sans-serif',fill:'#000',align:'center',wordWrap:{width:420}})
                     .setOrigin(0.5).setVisible(false).setDepth(11);
    dialogCoins=this.add.text(240,470,'',{font:'28px sans-serif',fill:'#000'}).setOrigin(0.5).setVisible(false).setDepth(11);

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
    paidStamp=this.add.text(0,0,'PAID',{font:'24px sans-serif',fill:'#0a0'})
      .setOrigin(0.5).setDepth(12).setVisible(false);
  }

  function spawnCustomer(){
    const level=calcLoveLevel(love);
    const maxQ=queueCapacityForLevel(level);
    if(gameOver) return;
    if(customerQueue.length<maxQ){
      tryJoinWanderer(this);
      if(customerQueue.length>=maxQ) return;
    }
    const createOrder=(extra)=>{
      const coins=Phaser.Math.Between(1,10)+extra;
      const req=coins<COFFEE_COST?'water':'coffee';
      const qty=(level>=3?2:1);
      return {coins, req, qty};
    };

    const c={ orders:[] };
    const startScale=1.1;
    const k=Phaser.Utils.Array.GetRandom(keys);
    const order=createOrder(0);
    if(customerQueue.length>=maxQ){
      const dir=Phaser.Math.Between(0,1)?1:-1;
      const startX=dir===1?-40:520;
      const targetX=dir===1?520:-40;
      c.orders.push(order);
      c.sprite=this.add.sprite(startX,WANDER_Y,k).setScale(startScale).setDepth(4);
      c.walkTween=this.tweens.add({targets:c.sprite,x:targetX,duration:dur(6000),onComplete:()=>{
          const idx=wanderers.indexOf(c);
          if(idx>=0) wanderers.splice(idx,1);
          c.sprite.destroy();
      }});
      wanderers.push(c);
      scheduleNextSpawn(this);
      return;
    }
    const startX=Phaser.Math.Between(-40,520);
    const startY=700;
    c.sprite=this.add.sprite(startX,startY,k).setScale(startScale).setDepth(4);

    if(level>=3 && Phaser.Math.Between(1,100)<=love){
      const k2=Phaser.Utils.Array.GetRandom(keys);
      order.qty+=1;
      c.friend=this.add.sprite(startX+FRIEND_OFFSET,startY,k2).setScale(startScale).setDepth(4);
    }
    c.orders.push(order);

    const targetY=332+QUEUE_SPACING*customerQueue.length;
    customerQueue.push(c);
    const dist=Phaser.Math.Distance.Between(startX,startY,QUEUE_X,targetY);
    let moveDur=1200+dist*4;
    if(customerQueue.length===1) moveDur=800+dist*3;
    c.walkTween = this.tweens.add({targets:c.sprite,x:QUEUE_X,y:targetY,scale:0.7,duration:dur(moveDur),ease:'Sine.easeIn',callbackScope:this,
      onComplete:()=>{ c.walkTween=null; startGiveUpTimer(c,this); if(customerQueue[0]===c) { showDialog.call(this); } }});
    if(c.friend){
      this.tweens.add({targets:c.friend,x:QUEUE_X+FRIEND_OFFSET,y:targetY,scale:0.7,duration:dur(moveDur),ease:'Sine.easeIn'});
    }
    if(customerQueue.length<maxQ){
      scheduleNextSpawn(this);
    }
  }

  function showDialog(){
    if(customerQueue.length===0) return;
    const c=customerQueue[0];
    dialogBg.setVisible(true);
    const itemStr=c.orders.map(o=>`${o.qty>1?o.qty+' ':''}${o.req}`).join(' and ');
    dialogText
      .setOrigin(0,0.5)
      .setPosition(dialogBg.x-dialogBg.width/2+20,440)
      .setText(`I want ${itemStr}`)
      .setVisible(true);
    const totalCost=c.orders.reduce((s,o)=>s+(o.req==='coffee'?COFFEE_COST:WATER_COST)*o.qty,0);
    dialogCoins
      .setOrigin(1,0.5)
      .setPosition(dialogBg.x+dialogBg.width/2-20,440)
      .setText(`Total $${totalCost.toFixed(2)}`)
      .setVisible(true);
    const hasCoffee=c.orders.some(o=>o.req==='coffee');
    btnSell.setVisible(hasCoffee); btnGive.setVisible(true); btnRef.setVisible(true);
    iconSell.setVisible(hasCoffee); iconGive.setVisible(true); iconRef.setVisible(true);
  }

  function clearDialog(keepPrice=false){
    if(!keepPrice){
      dialogBg.setVisible(false);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
    }else{
      dialogBg.setVisible(true);
      dialogText.setVisible(true);
    }
    btnSell.setVisible(false); btnGive.setVisible(false); btnRef.setVisible(false);
    iconSell.setVisible(false); iconGive.setVisible(false); iconRef.setVisible(false);
  }

  function handleAction(type){
    clearDialog(type==='sell');
    const current=customerQueue[0];
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
    if(current.giveUpTimer){ current.giveUpTimer.remove(false); }
    customerQueue.shift();
    repositionQueue(this);
    const finish=()=>{
      const targets=[current.sprite];
      if(friend) targets.push(friend);
      this.tweens.add({ targets: targets, x: (type==='refuse'? -50:520), duration:dur(600), callbackScope:this,
        onComplete:()=>{
          current.sprite.destroy();
          if(friend) friend.destroy();
          if(money<=0){showEnd.call(this,'Game Over\nYou are fired');return;}
          if(love<=0){showEnd.call(this,'Game Over 😠');return;}
          if(money>=MAX_M){showEnd.call(this,'Congrats! 💰');return;}
          if(love>=MAX_L){showEnd.call(this,'Victory! ❤️');return;}
            repositionQueue(this);
            if(customerQueue.length>0){
              const next=customerQueue[0];
              if(next.walkTween){
                next.walkTween.once('complete',()=>{ showDialog.call(this); });
              }else{
                this.time.delayedCall(dur(600),showDialog,[],this);
              }
            }else{
              scheduleNextSpawn(this);
            }
        }
      });
    };

    // animated report using timelines
    const midX=240, midY=120;

    let pending=(type!=='refuse'?1:0)+(lD!==0?1:0);
    const done=()=>{ if(--pending<=0) finish(); };

    if(type==='sell'){
      const t=dialogCoins;
      t.setScale(1.2).setVisible(true);
      paidStamp
        .setText('PAID')
        .setPosition(t.x,t.y)
        .setAngle(Phaser.Math.Between(-15,15))
        .setVisible(true);
      this.time.delayedCall(dur(1000),()=>{
        paidStamp.setVisible(false);
        const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
            t.setVisible(false).setScale(1);
            dialogBg.setVisible(false);
            dialogText.setVisible(false);
            money=+(money+mD).toFixed(2);
            moneyText.setText('🪙 '+money.toFixed(2));
            done();
        }});
        tl.add({targets:t,x:moneyText.x,y:moneyText.y,duration:dur(400)});
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
        reportLine2.setText(`$${tip.toFixed(2)} ${tipPct}% TIP`)
          .setStyle({fontSize:'16px',fill:'#fff'})
          .setScale(1)
          .setPosition(customer.x,customer.y+24).setVisible(true);
        reportLine3.setVisible(false).alpha=1;
      }else{
        reportLine2.setVisible(false).alpha=1;
        reportLine3.setVisible(false).alpha=1;
      }

      const moving=[reportLine1];
      const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
          reportLine1.setVisible(false).alpha=1;
          reportLine2.setVisible(false).alpha=1;
          reportLine3.setVisible(false).alpha=1;
          money=+(money+mD).toFixed(2);
          moneyText.setText('🪙 '+money.toFixed(2));
          done();
      }});
      tl.add({targets:reportLine1,x:midX,y:midY,duration:dur(300),onComplete:()=>{
            if(type==='give'){
              reportLine1.setText(`$${totalCost.toFixed(2)} LOSS`).setColor('#f88');
            }
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
    money=10.00; love=10;
    moneyText.setText('🪙 '+money.toFixed(2));
    loveText.setText('❤️ '+love);
    updateLevelDisplay();
    Phaser.Actions.Call(customerQueue,c=>{ c.sprite.destroy(); if(c.friend) c.friend.destroy(); });
    customerQueue=[];
    gameOver=false;
    scheduleNextSpawn(this);
  }

};
