// Speech is optional and never a prerequisite for navigation or requesting service.
// Browsers may block unmuted autoplay; native audio controls always remain available.
export function welcomeVoice(doc=document){
 const container=doc.querySelector('[data-welcome-voice]');
 if(!container)return;
 const audio=container.querySelector('audio');const status=container.querySelector('[data-welcome-voice-status]');
 if(!audio||!status)return;
 const update=()=>{status.textContent=audio.paused?'Press Play to hear our welcome.':'Playing the welcome recording. Use the audio controls to pause or replay.';};
 audio.addEventListener('play',update);audio.addEventListener('pause',update);
 audio.addEventListener('ended',()=>{status.textContent='Thanks for listening. You can replay our welcome anytime.';});
 audio.addEventListener('error',()=>{status.textContent='Audio is temporarily unavailable. You can read the welcome message below.';});
 const view=doc.defaultView;
 if(!view||doc.visibilityState!=='visible'||view.matchMedia?.('(prefers-reduced-motion: reduce)').matches||view.navigator?.connection?.saveData)return;
 let alreadyAttempted=false;
 try{alreadyAttempted=view.sessionStorage.getItem('ynsg-welcome-autoplay-attempted')==='1';if(!alreadyAttempted)view.sessionStorage.setItem('ynsg-welcome-autoplay-attempted','1');}
 catch{alreadyAttempted=true;}
 if(alreadyAttempted)return;
 try{const attempt=audio.play();if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>{status.textContent='Press Play to hear our welcome.';});}
 catch{status.textContent='Press Play to hear our welcome.';}
}
