// The optional welcome never controls navigation or request submission.
// Audio plays only when the visitor presses Play on the native controls: no autoplay,
// no playback triggered by unrelated clicks or keys (WCAG 1.4.2; avoids startling visitors).
export function welcomeVoice(doc=document){
  const panel=doc.querySelector('[data-welcome-voice]');
  if(!panel)return;
  const audio=panel.querySelector('audio');
  const status=panel.querySelector('[data-welcome-voice-status]');
  if(!audio||!status)return;
  const update=()=>{status.textContent=audio.paused?'Press Play to hear our welcome.':'Playing our welcome. Use the player to pause or replay.';};
  audio.addEventListener('play',update);
  audio.addEventListener('pause',()=>{if(!audio.ended)update();});
  audio.addEventListener('ended',()=>{status.textContent='Thanks for listening. Replay our welcome whenever you like.';});
  audio.addEventListener('error',()=>{status.textContent='Audio is unavailable. You can read the welcome message below.';});
  update();
}
