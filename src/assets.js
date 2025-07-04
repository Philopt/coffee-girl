import { DEBUG } from './debug.js';

export const keys = [];
export const requiredAssets = ['bg','truck','girl','lady_falcon','falcon_end','falcon_victory','revolt_end','fired_end','muse_victory','sparrow','dog1','price_ticket','pupcup','pupcup2','give','refuse','sell','cloudHeart','cloudDollar'];
export const genzSprites = [
  'new_kid_0_0','new_kid_0_1','new_kid_0_2','new_kid_0_4','new_kid_0_5',
  'new_kid_1_0','new_kid_1_1','new_kid_1_2','new_kid_1_3','new_kid_1_4','new_kid_1_5',
  'new_kid_2_0','new_kid_2_1','new_kid_2_2','new_kid_2_3','new_kid_2_4','new_kid_2_5',
  'new_kid_3_0','new_kid_3_1','new_kid_3_2','new_kid_3_3','new_kid_3_4','new_kid_3_5',
  'new_kid_4_0','new_kid_4_1','new_kid_4_2','new_kid_4_3','new_kid_4_4','new_kid_4_5'
];

const supers={
  '0':'\u2070','1':'\u00b9','2':'\u00b2','3':'\u00b3','4':'\u2074',
  '5':'\u2075','6':'\u2076','7':'\u2077','8':'\u2078','9':'\u2079'
};
const smallDollar='\uFE69';
export function receipt(value){
  const [d,c]=value.toFixed(2).split('.');
  const cents=c.split('').map(ch=>supers[ch]||ch).join('');
  return `${smallDollar}${d}${cents}`;
}

export function emojiFor(name){
  const n = name.toLowerCase();
  const iced = n.includes('iced') || n.includes('cold brew');
  const chocolate = n.includes('chocolate') || n.includes('mocha');
  const latte = n.includes('latte') || n.includes('cappuccino');
  const espresso = n.includes('espresso');
  const rose = n.includes('rose');
  const pink = n.includes('pink');
  const starry = n.includes('starry night');
  const falcon = n.includes('falcon');
  const roast = n.includes('roaster');
  const crush = n.includes('crush');
  const tea = n.includes('tea');

  // Base drink emoji: coffee by default, tea cup when mentioned explicitly.
  let base = '☕';
  if (tea) base = '🍵';
  else if (n.includes('hot chocolate')) base = '🍫';

  const extras = [];
  // Build extra modifiers. Order roughly controls layering.
  if (falcon) extras.push('🦅');
  if (roast) extras.push('🔥');
  if (espresso) extras.push('⚡');
  if (latte && base === '☕') extras.push('🥛');
  if (chocolate && base === '☕') extras.push('🍫');
  if (starry) extras.push('✨');
  if (rose) extras.push('🌹');
  else if (pink) extras.push('🌸');
  if (crush) extras.push('💥');
  if (iced) extras.push('🧊 🧊');

  if (extras.length) {
    return `${extras.join(' ')}\n${base}`;
  }
  return base;
}

let loadErrorShown = false;

export function preload(){
  const loader=this.load;
  loader.on('loaderror', file=>{
    if (DEBUG) console.error('Asset failed to load:', file.key || file.src);
    if (!loadErrorShown && typeof document !== 'undefined') {
      loadErrorShown = true;
      const div = document.createElement('div');
      div.textContent = 'Asset failed to load. Make sure you started the game with `npm start`.';
      div.style.position = 'fixed';
      div.style.top = '50%';
      div.style.left = '50%';
      div.style.transform = 'translate(-50%, -50%)';
      div.style.background = 'rgba(0,0,0,0.85)';
      div.style.color = '#fff';
      div.style.padding = '1em';
      div.style.fontFamily = 'sans-serif';
      div.style.zIndex = 1000;
      document.body.appendChild(div);
    }
  });
  loader.image('bg','assets/bg.png');
  loader.image('truck','assets/truck.png');
  loader.image('girl','assets/coffeegirl.png');
  loader.image('girldog','assets/girldog.png');
  loader.image('coffeecup2','assets/coffeecup2.png');
  loader.image('titlecard','assets/titlecard.png');
  loader.image('title2','assets/title2.png');
  loader.spritesheet('lady_falcon','assets/lady_falcon.png',{frameWidth:64,frameHeight:64});
  loader.image('falcon_end','assets/ladyfalconend.png');
  loader.image('fired_end','assets/firedend.png');
  // Correct file extension and name for falcon victory asset
  loader.image('falcon_victory','assets/falcon_victory.gif');
  loader.image('muse_victory','assets/musevictory.png');
  loader.image('revolt_end','assets/revolt.png');
  loader.image('price_ticket','assets/priceticket.png');
  loader.image('pupcup','assets/pupcup.png');
  loader.image('pupcup2','assets/pupcup2.png');
  loader.image('give','assets/give.png');
  loader.image('refuse','assets/refuse.png');
  loader.image('sell','assets/sell.png');
  loader.spritesheet('cloudHeart','assets/cloudheart.png',{
    frameWidth:35,frameHeight:29
  });
  loader.spritesheet('cloudDollar','assets/clouddollar.png',{
    frameWidth:30,frameHeight:25
  });
  loader.spritesheet('sparrow','assets/sparrow3x1.png',{frameWidth:22,frameHeight:28});
  loader.spritesheet('dog1','assets/dog1.png',{frameWidth:100,frameHeight:100});
  for(const k of genzSprites){
    keys.push(k);
    requiredAssets.push(k);
    loader.image(k,`assets/genz/${k}.png`);
  }
}
