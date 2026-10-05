const categories = { strategy: 'Research & strategy', execution: 'Content & campaigns', growth: 'Conversion & insights', ai: 'AI & automation', web: 'Web development', shopify: 'Shopify' };
function escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function cleanText(value, max, name, required=true) {
 if(typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Invalid ${name}.`);
 return value.trim();
}
function link(value) {
 if(!value) return '';
 const url = new URL(cleanText(value,2000,'project link'));
 if(url.protocol !== 'https:' || url.username || url.password) throw new Error('Project links must start with https://.');
 return url.href;
}
function validateProjects(projects) {
 if(!Array.isArray(projects) || projects.length>100) throw new Error('Maximum 100 projects.');
 const ids=new Set();
 return projects.map(p=>{
  if(!p || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id) || ids.has(p.id)) throw new Error('Invalid or duplicate project ID.');
  ids.add(p.id);
  if(!Object.hasOwn(categories,p.category)) throw new Error('Choose a valid category.');
  if(typeof p.image!=='string' || !/^assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(p.image)) throw new Error('Choose a project image.');
  if(!Array.isArray(p.tags) || p.tags.length>8) throw new Error('Use at most 8 tags.');
  return {id:p.id,title:cleanText(p.title,100,'title'),description:cleanText(p.description,1200,'description'),category:p.category,image:p.image,tags:p.tags.map(t=>cleanText(t,32,'tag')),url:link(p.url),codeUrl:link(p.codeUrl)};
 });
}
function renderCards(projects) {
 return validateProjects(projects).map((p,i)=>`<article class="project" data-category="${p.category}"><a class="project-art screenshot" href="${p.image}" data-preview="${escape(p.title)}" aria-label="Enlarge ${escape(p.title)} screenshot"><img src="${p.image}" alt="${escape(p.title)} project screenshot" loading="lazy"><span class="image-hint">VIEW PROJECT IMAGE ↗</span></a><div class="project-meta"><h3>${escape(p.title)}</h3><span>${String(i+1).padStart(2,'0')}</span></div><p>${escape(p.description)}</p><div class="tags">${p.tags.map(t=>`<span>${escape(t)}</span>`).join('')}</div><div class="project-links">${p.url?`<a href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">Live project ↗</a>`:''}${p.codeUrl?`<a href="${escape(p.codeUrl)}" target="_blank" rel="noopener noreferrer">Source code ↗</a>`:''}</div></article>`).join('\n');
}
function validateProfile(profile) {
 if(!profile||typeof profile!=='object'||Array.isArray(profile)||typeof profile.image!=='string'||!/^assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(profile.image))throw new Error('Choose a valid personal photo.');
 return {image:profile.image};
}
function updateProfile(html,profile) {
 const {image}=validateProfile(profile);
 const pattern=/(<figure\b[^>]*class="portrait"[^>]*>\s*<img\b[^>]*\bsrc=")[^"]*(")/;
 if(!pattern.test(html))throw new Error('Personal photo section missing. Reload before publishing.');
 return html.replace(pattern,(_,before,after)=>before+image+after);
}
function validateReviews(reviews) {
 if(!Array.isArray(reviews)||reviews.length>50)throw new Error('Use at most 50 client reviews.');
 const ids=new Set();
 return reviews.map(review=>{
  if(!review||typeof review.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(review.id)||ids.has(review.id))throw new Error('Invalid or duplicate review ID.');
  ids.add(review.id);
  if(review.rating!==null&&(!Number.isInteger(review.rating)||review.rating<1||review.rating>5))throw new Error('Choose a rating from 1 to 5, or no rating.');
  const image=review.image===undefined?'':review.image;
  if(typeof image!=='string'||(image&&!/^assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(image)))throw new Error('Choose a valid review screenshot.');
  const quote=cleanText(review.quote,1200,'review',false);
  if(!quote&&!image)throw new Error('Add review text or a screenshot.');
  return {id:review.id,name:cleanText(review.name,100,'client name',!image),role:cleanText(review.role,120,'client role or company',false),quote,rating:review.rating,image,platform:cleanText(review.platform===undefined?'':review.platform,80,'platform',false),sourceUrl:link(review.sourceUrl)};
 });
}
function renderReviews(reviews) {
 const items=validateReviews(reviews);if(!items.length)return '';
 return `<section id="reviews" class="section wrap client-reviews" aria-labelledby="reviews-title"><div class="section-heading"><div><p class="eyebrow">CLIENT REVIEWS</p><h2 id="reviews-title">In my clients’ words.</h2></div></div><div class="reviews-grid">${items.map(r=>`<figure class="client-review">${r.platform?`<span class="review-platform">${escape(r.platform)}</span>`:''}${r.rating?`<div class="review-stars" role="img" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}<span aria-hidden="true">${'☆'.repeat(5-r.rating)}</span></div>`:''}${r.image?`<a class="review-screenshot" href="${r.image}" data-review-preview="${escape(r.name||r.platform||'Client review')}" aria-label="Enlarge review screenshot"><img src="${r.image}" alt="${escape(r.platform?r.platform+' review screenshot':'Client review screenshot')}${r.name?' from '+escape(r.name):''}" loading="lazy"><span>View full screenshot ↗</span></a>`:''}${r.quote?`<blockquote><p>${escape(r.quote)}</p></blockquote>`:''}${r.name||r.role?`<figcaption>${r.name?`<span class="client-initials" aria-hidden="true">${escape(r.name.split(/\s+/).slice(0,2).map(part=>part[0]).join(''))}</span>`:''}<span>${r.name?`<strong>${escape(r.name)}</strong>`:''}${r.role?`<small>${escape(r.role)}</small>`:''}</span></figcaption>`:''}${r.sourceUrl?`<a class="review-source" href="${escape(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">View original review ↗</a>`:''}</figure>`).join('')}</div></section>`;
}
function updateReviews(html,reviews) {
 const start='<!-- REVIEWS:START -->',end='<!-- REVIEWS:END -->';
 if(!html.includes(start)) {
  if(!html.includes('<section id="contact"'))throw new Error('Portfolio contact section missing.');
  html=html.replace('<section id="contact"',`${start}\n${end}\n    <section id="contact"`);
 }
 const a=html.indexOf(start),b=html.indexOf(end);
 if(b<a)throw new Error('Review section markers are invalid.');
 return html.slice(0,a+start.length)+'\n'+renderReviews(reviews)+'\n'+html.slice(b);
}
function updateIndex(html,projects,reviews) {
 const start='<!-- PROJECTS:START -->',end='<!-- PROJECTS:END -->';
 const a=html.indexOf(start), b=html.indexOf(end);
 if(a<0 || b<a) throw new Error('Portfolio project markers are missing. Reload before publishing.');
 const result=html.slice(0,a+start.length)+'\n'+renderCards(projects)+'\n'+html.slice(b);
 return reviews===undefined?result:updateReviews(result,reviews);
}
function validateImage(upload) {
 if(!upload || typeof upload.base64!=='string' || upload.base64.length>7*1024*1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(upload.base64)) throw new Error('Invalid image data.');
 const buffer=Buffer.from(upload.base64,'base64');
 if(!buffer.length || buffer.length>5*1024*1024) throw new Error('Each image must be smaller than 5 MB.');
 let extension;
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) extension='png';
 else if(buffer[0]===255 && buffer[1]===216 && buffer[2]===255) extension='jpg';
 else if(buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP') extension='webp';
 else throw new Error('Use a PNG, JPEG, or WebP image.');
 if(typeof upload.path!=='string' || !new RegExp('^assets/upload-[a-f0-9-]{36}\\.'+extension+'$').test(upload.path)) throw new Error('Invalid upload filename.');
 return buffer;
}
module.exports={categories,validateProjects,validateImage,renderCards,updateIndex,validateReviews,renderReviews,updateReviews,validateProfile,updateProfile};
