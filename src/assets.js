import { DEBUG } from './debug.js';

export const keys = [];
export const requiredAssets = ['bg','truck','girl','lady_falcon','falcon_end','revolt_end','sparrow','sparrow2','sparrow3','dog1','price_ticket','pupcup'];
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
  const n=name.toLowerCase();
  const iced = n.includes('iced') || n.includes('cold brew');
  let base='☕';
  if(n.includes('tea')) base='🍵';
  else if(n.includes('chocolate')) base='🍫';
  else if(n.includes('rose')) base='🌹';
  else if(n.includes('pink')) base='🌸';
  if(iced) return `🧊\n${base}`;
  return base;
}

export function preload(){
  const loader=this.load;
  loader.on('loaderror', file=>{
    if (DEBUG) console.error('Asset failed to load:', file.key || file.src);
  });
  loader.image('bg','assets/bg.png');
  loader.image('truck','assets/truck.png');
  loader.image('girl','assets/coffeegirl.png');
  loader.spritesheet('lady_falcon','assets/lady_falcon.png',{frameWidth:64,frameHeight:64});
  loader.image('falcon_end','assets/ladyfalconend.png');
  loader.image('revolt_end','assets/revolt.png');
  loader.image('price_ticket','assets/priceticket.png');
  loader.image('pupcup','assets/pupcup.png');
  loader.spritesheet('sparrow','assets/sparrow.png',{frameWidth:16,frameHeight:16});
  loader.spritesheet('sparrow2','assets/sparrow2.png',{frameWidth:20,frameHeight:20});
  loader.spritesheet('sparrow3','assets/sparrow3.png',{frameWidth:20,frameHeight:20});
  loader.spritesheet('dog1','assets/dog1.png',{frameWidth:100,frameHeight:100});
  for(const k of genzSprites){
    keys.push(k);
    requiredAssets.push(k);
    loader.image(k,`assets/genz/${k}.png`);
  }
}
