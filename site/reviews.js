// Real customer reviews, shown on the homepage only once at least three are added.
// Add entries to site/data/reviews.json, copied word for word from Google with the customer's
// permission, e.g. {"name":"Pat M.","town":"Sycamore","rating":5,"text":"…","date":"2026-11-20"}.
// Never invent, edit or paraphrase a review. No review schema is emitted (Google ignores
// self-published business reviews), so this is for people, not search tricks.
export const minimumReviewsToShow=3;
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validReviews(list){
 if(!Array.isArray(list))throw Error('reviews.json must be an array');
 return list.map((r,i)=>{
  const ok=r&&typeof r.name==='string'&&r.name.trim().length>=2&&r.name.length<=60&&typeof r.town==='string'&&r.town.trim().length>=2&&r.town.length<=60&&Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=5&&typeof r.text==='string'&&r.text.trim().length>=10&&r.text.length<=600&&/^\d{4}-\d{2}-\d{2}$/.test(r.date);
  if(!ok)throw Error('Invalid review at index '+i);
  return {name:r.name.trim(),town:r.town.trim(),rating:r.rating,text:r.text.trim(),date:r.date};
 }).sort((a,b)=>b.date.localeCompare(a.date));
}
export function reviewsSection(list,reviewUrl){
 const reviews=validReviews(list);
 if(reviews.length<minimumReviewsToShow)return '';
 const cards=reviews.slice(0,6).map(r=>`<figure class="review-card"><p class="review-stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</p><blockquote><p>${escape(r.text)}</p></blockquote><figcaption><strong>${escape(r.name)}</strong> · ${escape(r.town)}</figcaption></figure>`).join('');
 return `<section class="home-reviews section" aria-labelledby="reviews-title"><div class="shell"><p class="overline">From our neighbors</p><h2 id="reviews-title">What our neighbors are saying</h2><div class="review-grid">${cards}</div><p class="review-source">Reviews from Google. <a href="${escape(reviewUrl)}" rel="noopener">Leave your own review</a>.</p></div></section>`;
}

// Until three written reviews exist, show only the verified Google rating (from site/data/google-rating.json,
// updated by hand from the Business Profile). Stars only (the review count is kept in the data but not shown): no quote is ever invented.
export function validRating(data){
 const ok=data&&Number.isInteger(data.count)&&data.count>=1&&data.count<=100000&&typeof data.rating==='number'&&data.rating>=1&&data.rating<=5&&/^\d{4}-\d{2}-\d{2}$/.test(data.asOf);
 if(!ok)throw Error('Invalid google-rating.json');
 return {rating:Math.round(data.rating*10)/10,count:data.count};
}
export function ratingBadge(data,profileUrl){
 if(!data)return '';
 const {rating}=validRating(data),full=Math.round(rating);
 return `<section class="home-rating" aria-label="Google rating"><div class="shell"><p class="rating-badge"><span class="review-stars" aria-hidden="true">${'★'.repeat(full)}${'☆'.repeat(5-full)}</span> <strong>${rating.toFixed(1)}</strong> on Google <a href="${escape(profileUrl)}" rel="noopener">See it on Google</a></p></div></section>`;
}
