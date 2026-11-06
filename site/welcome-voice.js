// The optional welcome never controls navigation or request submission.
// Sound autoplay can be blocked even after a gesture; native audio controls remain usable.
export function welcomeVoice(doc=document){
  const panel=doc.querySelector('[data-welcome-voice]');
  if(!panel)return;
  const audio=panel.querySelector('audio');
  const status=panel.querySelector('[data-welcome-voice-status]');
  if(!audio||!status)return;
  const view=doc.defaultView;
  const session=view?.sessionStorage;
  const flag='ynsg-welcome-played-this-visit';
  let pending=false, stopped=false;
  const markPlayed=()=>{try{session?.setItem(flag,'1');}catch{};detach();};
  const update=()=>{status.textContent=audio.paused?'Press Play to hear our welcome.':'Playing our welcome. Use the player to pause or replay.';};
  function detach(){doc.removeEventListener('click',onClick,true);doc.removeEventListener('keydown',onKeydown,true);}
  function pauseRequested(){stopped=true;detach();}
  audio.addEventListener('play',()=>{markPlayed();update();});
  audio.addEventListener('pause',()=>{if(!audio.ended)pauseRequested();update();});
  audio.addEventListener('ended',()=>{stopped=true;detach();status.textContent='Thanks for listening. Replay our welcome whenever you like.';});
  audio.addEventListener('error',()=>{stopped=true;detach();status.textContent='Audio is unavailable. You can read the welcome message below.';});
  const alreadyPlayed=()=>{try{return session?.getItem(flag)==='1';}catch{return false;}};
  function attempt(){
    if(pending||stopped||alreadyPlayed()||!audio.paused||doc.visibilityState==='hidden')return;
    pending=true;
    try{
      const result=audio.play();
      if(result&&typeof result.then==='function')result.then(()=>{pending=false;markPlayed();},()=>{pending=false;status.textContent='Press Play to hear our welcome.';});
      else{pending=false;markPlayed();}
    }catch{pending=false;status.textContent='Press Play to hear our welcome.';}
  }
  // Ignore navigation and native media controls: both should retain their own behavior.
  function eligible(target){
    const el=target?.nodeType===1?target:target?.parentElement;
    return Boolean(el&&!el.closest('audio, a[href], [role="link"], input, textarea, select, [contenteditable="true"]'));
  }
  function onClick(e){if(eligible(e.target))attempt();}
  function onKeydown(e){if((e.key==='Enter'||e.key===' ')&&!e.repeat&&eligible(e.target))attempt();}
  if(!view||alreadyPlayed())return;
  doc.addEventListener('click',onClick,true);
  doc.addEventListener('keydown',onKeydown,true);
  // A first attempt is optional and browser-controlled. A rejection does NOT disable
  // the later gesture-based attempt (unlike the previous implementation).
  if(doc.visibilityState!=='hidden'&&!view.navigator?.connection?.saveData&&!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches)attempt();
}
