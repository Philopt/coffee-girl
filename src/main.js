window.onload = function(){
  const COFFEE_COST=5.00, WATER_COST=5.58;
  const VERSION='54';
  const SPAWN_DELAY=300;
  const QUEUE_SPACING=70;
  const MAX_M=100, MAX_L=100;
  let speed=1;
  let money=10.00, love=10, gameOver=false, customerQueue=[], coins=0, req='coffee';
  const keys=[];

  const dur=v=>v/speed;

  const config={ type:Phaser.AUTO, parent:'game-container', backgroundColor:'#f2e5d7',
    scale:{ mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width:480, height:640 },
    pixelArt:true, scene:{ preload, create } };
  new Phaser.Game(config);

  let moneyText, loveText, versionText, speedBtn;
  let dialogBg, dialogText, dialogCoins, btnSell, btnGive, btnRef;
  let iconSell, iconGive, iconRef;
  let reportLine1, reportLine2, reportLine3, reportLine4;

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
    versionText=this.add.text(10,630,'v'+VERSION,{font:'12px sans-serif',fill:'#000'})
      .setOrigin(0,1).setDepth(1);
    speedBtn=this.add.text(460,20,'1x',{font:'20px sans-serif',fill:'#000',backgroundColor:'#ddd',padding:{x:6,y:4}})
      .setOrigin(1,0).setDepth(1).setInteractive()
      .on('pointerdown',()=>{ speed++; speedBtn.setText(speed+'x'); });

    // truck & girl
    const truck=this.add.image(520,245,'truck').setScale(0.924).setDepth(2);
    const girl=this.add.image(520,260,'girl').setScale(0.5).setDepth(3)
      .setVisible(false);

    const intro=this.tweens.createTimeline({callbackScope:this,
      onComplete:()=>this.time.delayedCall(dur(SPAWN_DELAY),spawnCustomer,[],this)});
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
  }

  function spawnCustomer(){
    if(gameOver||customerQueue.length>=3) return;
    const c={};
    c.coins=Phaser.Math.Between(1,10);
    c.req=c.coins<COFFEE_COST?'water':'coffee';
    const k=Phaser.Utils.Array.GetRandom(keys);
    const startY=700;
    c.sprite=this.add.sprite(240,startY,k).setScale(0.7).setDepth(4);
    const targetY=332+QUEUE_SPACING*customerQueue.length;
    customerQueue.push(c);
    this.tweens.add({targets:c.sprite,y:targetY,duration:dur(800),callbackScope:this,
      onComplete:()=>{ if(customerQueue[0]===c) { coins=c.coins; req=c.req; showDialog.call(this); } }});
  }

  function showDialog(){
    if(customerQueue.length===0) return;
    const c=customerQueue[0];
    coins=c.coins; req=c.req;
    dialogBg.setVisible(true);
    dialogText.setText(`${req.charAt(0).toUpperCase()+req.slice(1)} $${(req==='coffee'?COFFEE_COST:WATER_COST).toFixed(2)}`)
      .setVisible(true);
    dialogCoins.setText(`🪙${coins}`).setVisible(true);
    btnSell.setVisible(req==='coffee'); btnGive.setVisible(true); btnRef.setVisible(true);
    iconSell.setVisible(req==='coffee'); iconGive.setVisible(true); iconRef.setVisible(true);
  }

  function clearDialog(){
    dialogBg.setVisible(false); dialogText.setVisible(false); dialogCoins.setVisible(false);
    btnSell.setVisible(false); btnGive.setVisible(false); btnRef.setVisible(false);
    iconSell.setVisible(false); iconGive.setVisible(false); iconRef.setVisible(false);
  }

  function handleAction(type){
    clearDialog();
    let mD=0, lD=0, tip=0;
    if(type==='sell'){
      lD=Phaser.Math.Between(0,2);
      tip=+(COFFEE_COST*0.15*lD).toFixed(2);
      mD=COFFEE_COST+tip;
    } else if(type==='give'){
      const cost=(req==='coffee'?COFFEE_COST:WATER_COST);
      mD=-cost; lD=Phaser.Math.Between(2,4);
    } else {
      lD=-Phaser.Math.Between(1,3);
    }

    const cost=(req==='coffee'?COFFEE_COST:WATER_COST);
    const tipPct=type==='sell'?lD*15:0;

    const current=customerQueue[0];
    const customer=current.sprite;
    customerQueue.shift();
    const finish=()=>{
      this.tweens.add({ targets: current.sprite, x: (type==='refuse'? -50:520), duration:dur(600), callbackScope:this,
        onComplete:()=>{
          current.sprite.destroy();
          if(money<=0){showEnd.call(this,'Game Over\nYou are fired');return;}
          if(love<=0){showEnd.call(this,'Game Over 😠');return;}
          if(money>=MAX_M){showEnd.call(this,'Congrats! 💰');return;}
          if(love>=MAX_L){showEnd.call(this,'Victory! ❤️');return;}
          Phaser.Actions.Call(customerQueue,(c,idx)=>{
            this.tweens.add({targets:c.sprite,y:332+QUEUE_SPACING*idx,duration:dur(500)});
          });
          if(customerQueue.length>0){
            this.time.delayedCall(dur(600),showDialog,[],this);
          }else{
            this.time.delayedCall(dur(SPAWN_DELAY), spawnCustomer, [], this);
          }
        }
      });
    };

    // animated report using timelines
    const midX=240, midY=120;

    let pending=(type!=='refuse'?1:0)+(lD!==0?1:0);
    const done=()=>{ if(--pending<=0) finish(); };

    if(type!=='refuse'){
      const showTip=tip>0;
      reportLine1.setStyle({fill:'#fff'})
        .setText(`$${cost.toFixed(2)}`)
        .setPosition(customer.x,customer.y).setVisible(true);
      if(showTip){
        reportLine2.setText(`Tip ${tipPct}%`)
          .setStyle({fontSize:'14px',fill:'#ddf'})
          .setPosition(customer.x,customer.y+18).setVisible(true);
        reportLine3.setText(`$${tip.toFixed(2)}`)
          .setStyle({fontSize:'16px',fill:'#fff'})
          .setPosition(customer.x,customer.y+36).setVisible(true);
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
      tl.add({targets:reportLine1,x:midX,y:midY,duration:dur(300),completeDelay:dur(300),onComplete:()=>{
            if(type==='give'){
              reportLine1.setText(`$${cost.toFixed(2)} LOSS`).setColor('#f88');
            }else{
              reportLine1.setText(`$${cost.toFixed(2)} PAID`).setColor('#8f8');
            }
        }});
      if(showTip){
        tl.add({targets:reportLine2,x:midX,y:midY+18,duration:dur(300),completeDelay:dur(300)},0);
        tl.add({targets:reportLine3,x:midX,y:midY+36,duration:dur(300),completeDelay:dur(300)},0);
        moving.push(reportLine2,reportLine3);
      }
      tl.add({targets:moving,x:moneyText.x,y:moneyText.y,alpha:0,duration:dur(400)});
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
    const baseX=customer.x-80;
    const baseY=customer.y+40;
    const hearts=[];
    for(let i=0;i<count;i++){
      const h=this.add.text(customer.x,customer.y,emoji,{font:'24px sans-serif',fill:'#fff'})
        .setOrigin(0.5).setDepth(11);
      hearts.push(h);
      this.tweens.add({targets:h,x:baseX+i*20,y:baseY,duration:dur(400),ease:'Cubic.easeOut'});
    }
    const popOne=(idx)=>{
      if(idx>=hearts.length){ if(cb) cb(); return; }
      const h=hearts[idx];
      this.tweens.add({targets:h,x:loveText.x,y:loveText.y,scale:1.2,angle:360,alpha:0,
        duration:dur(250),onComplete:()=>{
          love+=delta>0?1:-1;
          loveText.setText('❤️ '+love);
          h.destroy();
          popOne(idx+1);
        }});
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
    money=10.00; love=10; coins=0; req='coffee';
    moneyText.setText('🪙 '+money.toFixed(2));
    loveText.setText('❤️ '+love);
    Phaser.Actions.Call(customerQueue,c=>c.sprite.destroy());
    customerQueue=[];
    gameOver=false;
    this.time.delayedCall(dur(SPAWN_DELAY), spawnCustomer, [], this);
  }

};
