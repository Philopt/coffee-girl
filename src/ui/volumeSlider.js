let slider=null;
export function showVolumeSlider(value=1,onChange){
  if(typeof document==='undefined') return;
  const container=document.getElementById('game-container');
  if(!container) return;
  if(!slider){
    slider=document.createElement('input');
    slider.id='volume-slider';
    slider.type='range';
    slider.min='0';
    slider.max='1';
    slider.step='0.05';
    Object.assign(slider.style,{
      position:'absolute',
      bottom:'120px',
      left:'50%',
      transform:'translateX(-50%)',
      width:'120px',
      zIndex:'30',
      display:'none'
    });
    container.appendChild(slider);
  }
  slider.value=String(value);
  slider.style.display='block';
  slider.oninput=()=>{
    const val=parseFloat(slider.value);
    if(typeof onChange==='function') onChange(val);
  };
}
export function hideVolumeSlider(){
  if(slider) slider.style.display='none';
}
