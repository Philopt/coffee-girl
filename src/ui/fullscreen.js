export function addFullscreenButton(){
  if(typeof document==='undefined') return;
  const container=document.getElementById('game-container');
  if(!container) return;
  if(document.getElementById('fullscreen-btn')) return;
  container.style.position='relative';
  const btn=document.createElement('button');
  btn.id='fullscreen-btn';
  btn.textContent='\u26F6';
  Object.assign(btn.style,{
    position:'absolute',
    right:'8px',
    bottom:'8px',
    width:'32px',
    height:'32px',
    padding:'0',
    background:'rgba(0,0,0,0.5)',
    color:'#fff',
    border:'none',
    borderRadius:'4px',
    cursor:'pointer',
    zIndex:'20',
    fontSize:'20px',
    lineHeight:'32px',
    textAlign:'center'
  });
  container.appendChild(btn);
  function toggle(){
    if(document.fullscreenElement){
      if(document.exitFullscreen) document.exitFullscreen();
    }else if(container.requestFullscreen){
      container.requestFullscreen();
    }
  }
  btn.addEventListener('click',toggle);
  document.addEventListener('fullscreenchange',()=>{
    btn.textContent=document.fullscreenElement?'\u2715':'\u26F6';
    const game=window.Phaser&&window.Phaser.GAMES&&window.Phaser.GAMES[0];
    if(game&&game.scale&&game.scale.refresh){
      game.scale.refresh();
    }
  });
}
