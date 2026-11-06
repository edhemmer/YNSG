// "Meet Ed" intro video: renders only when the owner adds site/assets/meet-ed.mp4.
// Optional companions: meet-ed.jpg (poster) and meet-ed.vtt (captions, strongly recommended).
export function meetEdVideo({hasVideo,hasPoster,hasCaptions}){
 if(!hasVideo)return '';
 return `<section class="meet-ed section" aria-labelledby="meet-ed-title"><div class="shell meet-ed-inner"><div><p class="overline">Meet the owner</p><h2 id="meet-ed-title">Hi, I’m Ed.</h2><p>Here’s who you’ll see at your door, and why I started Your Neighborhood Service Guy.</p></div><figure class="meet-ed-video"><video controls playsinline preload="metadata"${hasPoster?' poster="/assets/meet-ed.jpg"':''}><source src="/assets/meet-ed.mp4" type="video/mp4">${hasCaptions?'<track kind="captions" src="/assets/meet-ed.vtt" srclang="en" label="English" default>':''}Your browser can’t play this video.</video></figure></div></section>`;
}
