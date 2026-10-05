const $=id=>document.getElementById(id);
const categories={strategy:'Research & strategy',execution:'Content & campaigns',growth:'Conversion & insights',ai:'AI & automation',web:'Web development',shopify:'Shopify'};
let token='',projects=[],uploads={},baseSha='',dirty=false,busy=false,editingId=null,selectedImage='',selectedUpload=null,formDirty=false,pollTimer,expectedCommit='',imageReading=false,editVersion=0;
const imageCache={};
let reviews=[],editingReviewId=null;
let reviewImage='',reviewUpload=null,reviewImageReading=false,reviewImageVersion=0;
let profile={image:'assets/abanoub-george.jpg'},profileCandidate=null,profileUpload=null,profileReading=false,profileVersion=0;
let setupMode=false;
let setupKey=new URLSearchParams(location.hash.slice(1)).get('setup')||'';
if(location.hash)history.replaceState(null,'',location.pathname);
function lock(){token='';reviewImageVersion++;profileVersion++;profileReading=false;clearTimeout(pollTimer);document.body.classList.add('locked');if($('editor').open)$('editor').close();if($('review-editor').open)$('review-editor').close();$('auth-password').value='';$('auth-confirm').value='';}
function configureLogin(session){
 setupMode=!session.configured;
 $('auth-title').textContent=setupMode?'Protect your workspace.':'Welcome back.';
 $('auth-description').textContent=setupMode?'Choose a password with at least 12 characters. You will use it each time you sign in.':'Sign in to manage your projects.';
 $('confirm-label').hidden=!setupMode;$('auth-confirm').required=setupMode;
 $('auth-password').minLength=setupMode?12:1;$('auth-password').autocomplete=setupMode?'new-password':'current-password';
 $('sign-in').textContent=setupMode?'Create password & sign in':'Sign in';
 if(setupMode&&!setupKey){$('auth-error').textContent='Open Open-Portfolio-Admin.cmd on your computer to create your password.';$('sign-in').disabled=true;}
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
async function request(url,body){
 const response=await fetch(url,{method:body?'POST':'GET',headers:{'X-Admin-Token':token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const result=await response.json();if(response.status===401)lock();if(!response.ok)throw Error(result.error||'Something went wrong.');return result;
}
function controls(){
 $('logout').disabled=busy;
 for(const id of ['new-project','new-review','export','import']) $(id).disabled=busy||!baseSha;
 $('reload').disabled=busy;
 $('publish').disabled=busy||!dirty||!baseSha||!!profileCandidate||profileReading;
 $('export').disabled=busy||!baseSha||!!profileCandidate||profileReading;
 $('profile-image-file').disabled=busy||!baseSha;
 $('save-profile-photo').disabled=busy||!profileCandidate||profileReading||!baseSha;
 $('cancel-profile-photo').disabled=busy||(!profileCandidate&&!profileReading);
 document.querySelectorAll('.card button,.review-item button').forEach(button=>{button.disabled=busy||button.dataset.edge==='true';});
 $('change-state').textContent=busy?'Working…':dirty?'Unpublished':'Up to date';
 $('change-detail').textContent=dirty?'Your draft is not live yet':'Changes saved to GitHub';
 $('publish-label').textContent=dirty?'Ready when you are. Publish your changes.':'Your collection is saved.';
}
function imageSource(project){const image=uploads[project.image]||imageCache[project.image];return image?`data:${image.mime};base64,${image.base64}`:`https://abanoubgeorge20.github.io/${project.image}`;}
function render(){
 $('project-list').replaceChildren();
 projects.forEach((project,index)=>{
  const card=document.createElement('article');card.className='card';
  card.innerHTML=`<div class="card-image"><img alt="${escape(project.title)}"></div><div class="card-body"><span class="card-category">${escape(categories[project.category])}</span><h3>${escape(project.title)}</h3><p>${escape(project.description)}</p><div class="card-actions"><button data-action="edit">Edit</button><button data-action="delete" class="delete">Delete</button><button data-action="up" aria-label="Move ${escape(project.title)} up" data-edge="${index===0}">↑</button><button data-action="down" aria-label="Move ${escape(project.title)} down" data-edge="${index===projects.length-1}">↓</button></div></div>`;
  card.querySelector('img').src=imageSource(project);
  card.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
   if(busy)return;
   if(button.dataset.action==='edit')return openEditor(project);
   if(button.dataset.action==='delete'){
    if(!confirm(`Remove “${project.title}” from your portfolio? It stays live until you publish.`))return;
    projects.splice(index,1);
   } else {const target=index+(button.dataset.action==='up'?-1:1);if(target<0||target>=projects.length)return;[projects[index],projects[target]]=[projects[target],projects[index]];}
   dirty=true;render();
  }));
  $('project-list').append(card);
 });
 $('total').textContent=projects.length;$('category-total').textContent=new Set(projects.map(p=>p.category)).size;$('empty').hidden=projects.length!==0;renderReviews();renderProfile();controls();
}
async function load(){
 if((dirty||profileCandidate||profileReading)&&!confirm('Discard your unpublished changes and reload? Save and export your draft first if you want to keep it.'))return;
 busy=true;controls();notice('Loading the latest projects from GitHub…');
 try{const state=await request('/api/projects');projects=state.projects;reviews=state.reviews??[];profile=state.profile??{image:'assets/abanoub-george.jpg'};profileVersion++;profileCandidate=null;profileUpload=null;profileReading=false;$('profile-image-file').value='';baseSha=state.sha;uploads={};dirty=false;expectedCommit='';clearTimeout(pollTimer);$('account-state').textContent=`Connected · ${state.account}`;notice('Connected. Update your photo, projects or client reviews, then publish when you’re ready.');}
 catch(error){notice(error.message,true);$('account-state').textContent='Connection needs attention';}
 finally{busy=false;render();}
}
function openEditor(project){
 editVersion++;editingId=project?.id||null;selectedImage=project?.image||'';selectedUpload=null;imageReading=false;$('project-form').reset();$('form-error').textContent='';
 $('editor-title').textContent=project?'Edit project':'New project';
 for(const [id,key]of [['title','title'],['description','description'],['url','url'],['code-url','codeUrl']])$(id).value=project?.[key]||'';
 $('category').value=project?.category||'ai';$('tags').value=project?.tags.join(', ')||'';
 $('image-preview').hidden=!project;if(project)$('image-preview').src=imageSource(project);else $('image-preview').removeAttribute('src');
 formDirty=false;$('editor').showModal();$('title').focus();
}
function closeEditor(){if(formDirty&&!confirm('Discard changes in this project form?'))return;editVersion++;$('editor').close();}
$('new-project').addEventListener('click',()=>openEditor());
$('close-editor').addEventListener('click',closeEditor);$('cancel-editor').addEventListener('click',closeEditor);
$('editor').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
$('project-form').addEventListener('input',()=>{formDirty=true;});
function readData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read this image.'));reader.readAsDataURL(file);});}
$('image-file').addEventListener('change',async()=>{
 const file=$('image-file').files[0];if(!file)return;
 const version=editVersion;imageReading=true;$('form-error').textContent='';
 try{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a PNG, JPG, or WebP image smaller than 5 MB.');
  const bitmap=await createImageBitmap(file);bitmap.close();
  const data=await readData(file);if(version!==editVersion)return;
  const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
  selectedImage=`assets/upload-${crypto.randomUUID()}.${extension}`;selectedUpload={path:selectedImage,base64:data.split(',')[1],mime:file.type};
  $('image-preview').src=data;$('image-preview').hidden=false;formDirty=true;
 }catch(error){if(version===editVersion){$('form-error').textContent=error.message;$('image-file').value='';}}
 finally{if(version===editVersion)imageReading=false;}
});
function validLink(value){if(!value.trim())return '';const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password)throw Error('Project links must start with https://.');return url.href;}
function validateDraft(list){
 if(!Array.isArray(list)||list.length>100)throw Error('Use a draft with at most 100 projects.');
 const ids=new Set();
 for(const p of list){
  if(!p||typeof p.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id)||ids.has(p.id))throw Error('Invalid project IDs in draft.');ids.add(p.id);
  if(typeof p.title!=='string'||!p.title.trim()||p.title.length>100||typeof p.description!=='string'||!p.description.trim()||p.description.length>1200||!Object.hasOwn(categories,p.category))throw Error('Invalid project details in draft.');
  if(typeof p.image!=='string'||!/^assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(p.image))throw Error('Invalid project image path.');
  if(!Array.isArray(p.tags)||p.tags.length>8||p.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>32))throw Error('Use up to 8 tags, each 32 characters or fewer.');
  validLink(p.url||'');validLink(p.codeUrl||'');
 }
 return list;
}
$('project-form').addEventListener('submit',event=>{
 event.preventDefault();$('form-error').textContent='';
 try{
  if(imageReading)throw Error('Please wait for the image to finish loading.');
  if(!selectedImage)throw Error('Choose a project image.');
  const project={id:editingId||`project-${crypto.randomUUID()}`,title:$('title').value.trim(),description:$('description').value.trim(),category:$('category').value,image:selectedImage,tags:$('tags').value.split(',').map(t=>t.trim()).filter(Boolean),url:validLink($('url').value),codeUrl:validLink($('code-url').value)};
  validateDraft([project]);if(!editingId&&projects.length>=100)throw Error('Maximum 100 projects.');
  const index=projects.findIndex(p=>p.id===editingId);if(index>=0)projects[index]=project;else projects.unshift(project);
  if(selectedUpload)uploads[selectedUpload.path]=selectedUpload;
  dirty=true;formDirty=false;$('editor').close();render();notice('Project saved to your draft. Publish changes to update your live portfolio.');
 }catch(error){$('form-error').textContent=error.message;}
});
$('reload').addEventListener('click',load);
function usedUploads(){const used=new Set([...projects,...reviews,profile].map(p=>p.image).filter(Boolean));return Object.values(uploads).filter(upload=>used.has(upload.path));}
$('export').addEventListener('click',()=>{
 const data={version:3,projects,reviews,profile,uploads:usedUploads()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='abanoub-portfolio-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Draft exported, including new images. Keep it as a backup.');
});
$('import').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async()=>{
 try{
  const file=$('import-file').files[0];if(!file)return;if(file.size>30*1024*1024)throw Error('Draft file is too large.');
  const draft=JSON.parse(await file.text());validateDraft(draft.projects);
  if(![1,2,3].includes(draft.version)||!Array.isArray(draft.uploads)||draft.uploads.length>20)throw Error('Unsupported draft format.');
  if(draft.version>=2)validateReviewDraft(draft.reviews);
  if(draft.version===3)validateProfileDraft(draft.profile);
  const incoming={};let size=0;
  for(const upload of draft.uploads){
   if(!upload||typeof upload.path!=='string'||!/^assets\/upload-[a-f0-9-]{36}\.(png|jpg|webp)$/.test(upload.path)||!['image/png','image/jpeg','image/webp'].includes(upload.mime)||typeof upload.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(upload.base64)||upload.base64.length>7*1024*1024)throw Error('Invalid draft image.');
   size+=upload.base64.length;incoming[upload.path]=upload;
  }
  if(size>28*1024*1024)throw Error('Draft images exceed 20 MB.');
  if(!confirm('Replace your current draft with this imported draft? Nothing is published yet.'))return;
  const retainedPaths=new Set([...(draft.version<3?[profile.image]:[]),...(draft.version<2?reviews.map(r=>r.image):[])]);
  const retained=Object.fromEntries(Object.entries(uploads).filter(([path])=>retainedPaths.has(path)));
  projects=draft.projects;if(draft.version>=2)reviews=draft.reviews;if(draft.version===3)profile=draft.profile;profileVersion++;profileCandidate=null;profileUpload=null;profileReading=false;$('profile-image-file').value='';uploads={...retained,...incoming};dirty=true;render();notice('Draft imported. Review it, then publish when ready.');
 }catch(error){notice(error.message,true);}finally{$('import-file').value='';}
});
async function pollDeployment(attempt=0){
 try{
  const status=await request('/api/status');
  if(status.commit===expectedCommit&&status.status==='built'){notice('Your changes are live. Open your portfolio to see them.');return;}
  if(status.commit===expectedCommit&&status.status==='errored'){notice('Saved to GitHub, but deployment failed. Check the repository’s Actions page.',true);return;}
 }catch{ /* Publishing already succeeded. A status failure does not undo it. */ }
 if(attempt<24)pollTimer=setTimeout(()=>pollDeployment(attempt+1),10000);
 else notice('Saved to GitHub. Deployment is taking longer than usual; check your live portfolio or GitHub Actions.');
}
$('publish').addEventListener('click',async()=>{
 if(busy||!dirty||profileCandidate||profileReading)return;
 if(!confirm(`Publish your personal photo, ${projects.length} projects and ${reviews.length} client reviews to your live website?`))return;
 busy=true;controls();notice('Publishing projects and images to GitHub. Keep this window open…');
 try{
  const result=await request('/api/publish',{baseSha,projects,reviews,profile,uploads:usedUploads()});
  Object.assign(imageCache,uploads);projects=result.projects;reviews=result.reviews??reviews;profile=result.profile??profile;baseSha=result.sha;uploads={};dirty=false;expectedCommit=result.sha;
  notice('Saved to GitHub. Waiting for the live website to finish deploying…');clearTimeout(pollTimer);pollTimer=setTimeout(()=>pollDeployment(),5000);
 }catch(error){notice(error.message+' Your draft is still here; export it before reloading.',true);}
 finally{busy=false;render();}
});
addEventListener('beforeunload',event=>{if(dirty||formDirty||busy||profileCandidate||profileReading){event.preventDefault();event.returnValue='';}});
$('auth-form').addEventListener('submit',async event=>{
 event.preventDefault();$('auth-error').textContent='';
 if(setupMode&&$('auth-password').value!==$('auth-confirm').value){$('auth-error').textContent='Passwords do not match.';return;}
 $('sign-in').disabled=true;
 try{
  const result=await request(setupMode?'/api/setup':'/api/login',{password:$('auth-password').value,...(setupMode?{setupKey}:{})});
  token=result.token;setupKey='';configureLogin({configured:true});$('auth-password').value='';$('auth-confirm').value='';document.body.classList.remove('locked');await load();
 }catch(error){$('auth-error').textContent=error.message;$('auth-password').value='';$('auth-confirm').value='';}
 finally{$('sign-in').disabled=false;}
});
$('logout').addEventListener('click',async()=>{
 if(busy)return;if((dirty||formDirty||profileCandidate||profileReading)&&!confirm('Sign out and discard your unpublished draft? Export it first to keep it.'))return;
 try{await request('/api/logout',{});projects=[];reviews=[];profile={image:'assets/abanoub-george.jpg'};profileCandidate=null;profileUpload=null;uploads={};for(const key of Object.keys(imageCache))delete imageCache[key];baseSha='';dirty=false;formDirty=false;render();lock();$('auth-password').focus();}catch(error){notice(error.message,true);}
});
function validateReviewDraft(list){
 if(!Array.isArray(list)||list.length>50)throw Error('Use at most 50 client reviews.');
 const ids=new Set();
 for(const r of list){
  if(!r||typeof r.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(r.id)||ids.has(r.id))throw Error('Invalid or duplicate review ID.');ids.add(r.id);
  const image=r.image===undefined?'':r.image;
  if(typeof image!=='string'||(image&&!/^assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(image)))throw Error('Choose a valid screenshot.');
  if(typeof r.name!=='string'||(!image&&!r.name.trim())||r.name.length>100||typeof r.role!=='string'||r.role.length>120||typeof r.quote!=='string'||(!image&&!r.quote.trim())||r.quote.length>1200)throw Error('Add review text and a client name, or upload a screenshot.');
  if(r.platform!==undefined&&(typeof r.platform!=='string'||r.platform.length>80))throw Error('Platform name must be 80 characters or fewer.');
  validLink(r.sourceUrl||'');
  if(r.rating!==null&&(!Number.isInteger(r.rating)||r.rating<1||r.rating>5))throw Error('Choose a rating from 1 to 5, or no rating.');
 }
}
function renderReviews(){
 $('review-list').replaceChildren();$('reviews-count').textContent=reviews.length;$('reviews-empty').hidden=reviews.length>0;
 reviews.forEach((review,index)=>{
  const card=document.createElement('article');card.className='review-item';
  card.innerHTML=`${review.rating?`<div class="stars" aria-label="${review.rating} out of 5 stars">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</div>`:''}<h3>${escape(review.name)}</h3><small>${escape(review.role)}</small><blockquote>${escape(review.quote)}</blockquote><div class="card-actions"><button data-action="edit">Edit</button><button data-action="delete" class="delete">Delete</button><button data-action="up" data-edge="${index===0}" aria-label="Move review up">↑</button><button data-action="down" data-edge="${index===reviews.length-1}" aria-label="Move review down">↓</button></div>`;
  card.querySelector('h3').textContent=review.name||review.platform||'Review screenshot';
  if(review.platform){const platform=document.createElement('p');platform.className='review-platform-label';platform.textContent=review.platform;card.prepend(platform);}
  if(review.image){const img=document.createElement('img');img.className='review-thumb';img.alt='Review screenshot';img.src=imageSource(review);card.prepend(img);}
  if(review.sourceUrl){const link=document.createElement('a');link.href=validLink(review.sourceUrl);link.textContent='Original review ↗';link.target='_blank';link.rel='noopener noreferrer';link.className='review-original';card.querySelector('.card-actions').before(link);}
  card.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
   if(busy)return;if(button.dataset.action==='edit')return openReview(review);
   if(button.dataset.action==='delete'){if(!confirm(`Remove the review from ${review.name}? It stays live until you publish.`))return;reviews.splice(index,1);}
   else{const next=index+(button.dataset.action==='up'?-1:1);if(next<0||next>=reviews.length)return;[reviews[index],reviews[next]]=[reviews[next],reviews[index]];}
   dirty=true;render();
  }));$('review-list').append(card);
 });
}
function openReview(review){
 reviewImageVersion++;reviewImage=review?.image||'';reviewUpload=null;reviewImageReading=false;
 editingReviewId=review?.id||null;$('review-form').reset();$('review-error').textContent='';$('review-editor-title').textContent=review?'Edit client review':'Add client review';
 $('review-name').value=review?.name||'';$('review-role').value=review?.role||'';$('review-quote').value=review?.quote||'';$('review-rating').value=review?.rating??'';
 $('review-platform').value=review?.platform||'';$('review-source').value=review?.sourceUrl||'';
 $('review-image-preview').hidden=!reviewImage;$('remove-review-image').hidden=!reviewImage;
 if(reviewImage)$('review-image-preview').src=imageSource(review);else $('review-image-preview').removeAttribute('src');
 formDirty=false;$('review-editor').showModal();$('review-name').focus();
}
function closeReview(){if(formDirty&&!confirm('Discard changes in this review form?'))return;reviewImageVersion++;formDirty=false;$('review-editor').close();}
$('new-review').addEventListener('click',()=>openReview());$('close-review').addEventListener('click',closeReview);$('cancel-review').addEventListener('click',closeReview);
$('review-editor').addEventListener('cancel',event=>{event.preventDefault();closeReview();});$('review-form').addEventListener('input',()=>{formDirty=true;});
$('review-form').addEventListener('submit',event=>{
 event.preventDefault();$('review-error').textContent='';
 try{
  if(reviewImageReading)throw Error('Wait for your screenshot to finish loading.');
  const review={id:editingReviewId||`review-${crypto.randomUUID()}`,name:$('review-name').value.trim(),role:$('review-role').value.trim(),quote:$('review-quote').value.trim(),rating:$('review-rating').value?Number($('review-rating').value):null,image:reviewImage,platform:$('review-platform').value.trim(),sourceUrl:validLink($('review-source').value)};
  validateReviewDraft([review]);if(!editingReviewId&&reviews.length>=50)throw Error('Maximum 50 reviews.');
  const index=reviews.findIndex(r=>r.id===editingReviewId);if(index>=0)reviews[index]=review;else reviews.push(review);
  if(reviewUpload)uploads[reviewUpload.path]=reviewUpload;
  dirty=true;formDirty=false;$('review-editor').close();render();notice('Review saved to your draft. Publish changes to show it on your website.');
 }catch(error){$('review-error').textContent=error.message;}
});
$('review-image-file').addEventListener('change',async()=>{
 const file=$('review-image-file').files[0];if(!file)return;
 const version=++reviewImageVersion;reviewImageReading=true;$('review-error').textContent='';
 try{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a PNG, JPG, or WebP screenshot smaller than 5 MB.');
  const bitmap=await createImageBitmap(file);bitmap.close();
  const data=await readData(file);if(version!==reviewImageVersion)return;
  const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
  reviewImage=`assets/upload-${crypto.randomUUID()}.${extension}`;reviewUpload={path:reviewImage,base64:data.split(',')[1],mime:file.type};
  $('review-image-preview').src=data;$('review-image-preview').hidden=false;$('remove-review-image').hidden=false;formDirty=true;
 }catch(error){if(version===reviewImageVersion){$('review-error').textContent=error.message;$('review-image-file').value='';}}
 finally{if(version===reviewImageVersion)reviewImageReading=false;}
});
$('remove-review-image').addEventListener('click',()=>{
 reviewImageVersion++;reviewImage='';reviewUpload=null;reviewImageReading=false;$('review-image-file').value='';$('review-image-preview').removeAttribute('src');$('review-image-preview').hidden=true;$('remove-review-image').hidden=true;formDirty=true;
});
function validateProfileDraft(value){if(!value||typeof value.image!=='string'||!/^assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(value.image))throw Error('Choose a valid personal photo.');}
function renderProfile(){
 const preview=$('profile-preview');preview.hidden=!baseSha;
 if(baseSha)preview.src=profileCandidate&&profileUpload?`data:${profileUpload.mime};base64,${profileUpload.base64}`:imageSource(profile);
 $('profile-photo-state').textContent=profileReading?'Loading your photo…':profileCandidate?'Preview only — save this photo to draft.':uploads[profile.image]?'Photo saved to draft. Publish changes to update your website.':'Your portfolio photo.';
}
function clearPhotoSelection(){profileVersion++;profileCandidate=null;profileUpload=null;profileReading=false;$('profile-image-file').value='';$('profile-error').textContent='';renderProfile();controls();}
$('profile-image-file').addEventListener('change',async()=>{
 const file=$('profile-image-file').files[0];if(!file)return;const version=++profileVersion;profileReading=true;$('profile-error').textContent='';renderProfile();controls();
 try{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a PNG, JPG, or WebP photo smaller than 5 MB.');
  const bitmap=await createImageBitmap(file);bitmap.close();const data=await readData(file);if(version!==profileVersion)return;
  const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];const image=`assets/upload-${crypto.randomUUID()}.${extension}`;
  profileCandidate={image};profileUpload={path:image,mime:file.type,base64:data.split(',')[1]};
 }catch(error){if(version===profileVersion){$('profile-error').textContent=error.message;$('profile-image-file').value='';}}
 finally{if(version===profileVersion){profileReading=false;renderProfile();controls();}}
});
$('save-profile-photo').addEventListener('click',()=>{
 if(busy||profileReading||!profileCandidate||!profileUpload)return;
 validateProfileDraft(profileCandidate);profile=profileCandidate;uploads[profileUpload.path]=profileUpload;dirty=true;clearPhotoSelection();render();notice('Personal photo saved to your draft. Publish changes to update your website.');
});
$('cancel-profile-photo').addEventListener('click',clearPhotoSelection);
(async()=>{try{const session=await request('/api/session');configureLogin(session);if(session.authenticated){token=session.token;document.body.classList.remove('locked');await load();}}catch(error){$('auth-error').textContent=error.message;}})();
