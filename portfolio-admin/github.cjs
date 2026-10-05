const {spawn} = require('node:child_process');
const fs=require('node:fs');
const {validateProjects,validateImage,updateIndex,validateReviews,validateProfile,updateProfile}=require('./model.cjs');
const REPO='abanoubgeorge20/abanoubgeorge20.github.io';
const GH=fs.existsSync('C:/Program Files/GitHub CLI/gh.exe')?'C:/Program Files/GitHub CLI/gh.exe':'gh';
function api(endpoint,method='GET',body) {
 return new Promise((resolve,reject)=>{
  const args=['api',endpoint,'--method',method];
  if(body!==undefined) args.push('--input','-');
  const child=spawn(GH,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let output='',error='';
  const timer=setTimeout(()=>{child.kill();reject(new Error('GitHub took too long to respond. Check your connection, then reload to verify publication before retrying.'));},45000);
  child.stdout.on('data',data=>{output+=data;}); child.stderr.on('data',data=>{error+=data;});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('GitHub CLI is unavailable. Install it and sign in with gh auth login.'));});
  child.on('close',code=>{
   clearTimeout(timer);
   if(code!==0) return reject(new Error(/401|403|auth login|not logged/i.test(error)?'GitHub access denied. Sign in again with GitHub CLI and check repository permissions.':/422|409/.test(error)?'The repository changed or GitHub rejected the update. Reload projects before publishing.':'GitHub request failed. Check your connection and try again.'));
   try {resolve(output?JSON.parse(output):{});} catch {reject(new Error('Unexpected response from GitHub.'));}
  });
  child.stdin.on('error',()=>{});
  child.stdin.end(body===undefined?undefined:JSON.stringify(body));
 });
}
function service(call=api) {
 const base=`repos/${REPO}`;
 async function head() {
  const repository=await call(base);
  const branch=repository.default_branch;
  const ref=await call(`${base}/git/ref/heads/${encodeURIComponent(branch)}`);
  return {branch,sha:ref.object.sha};
 }
 async function readFile(filename,sha) {
  const blob=await call(`${base}/contents/${filename}?ref=${sha}`);
  if(blob.encoding!=='base64') throw new Error('Unexpected repository file format.');
  return Buffer.from(blob.content,'base64').toString('utf8');
 }
 async function load() {
  const user=await call('user');
  if(user.login!=='abanoubgeorge20') throw new Error('Sign into GitHub as abanoubgeorge20 before using this dashboard.');
  const state=await head();
  const content=JSON.parse(await readFile('projects.json',state.sha));
  return {...state,projects:validateProjects(content.projects),reviews:validateReviews(content.reviews??[]),profile:validateProfile(content.profile??{image:'assets/abanoub-george.jpg'}),account:user.login,site:'https://abanoubgeorge20.github.io/'};
 }
 async function publish(payload) {
  const projects=validateProjects(payload.projects);
  if(payload.reviews!==undefined)validateReviews(payload.reviews);
  if(payload.profile!==undefined)validateProfile(payload.profile);
  if(!/^[a-f0-9]{40}$/.test(payload.baseSha)) throw new Error('Reload projects before publishing.');
  if(!Array.isArray(payload.uploads) || payload.uploads.length>20) throw new Error('Upload up to 20 images per publication.');
  const user=await call('user');
  if(user.login!=='abanoubgeorge20') throw new Error('Sign in as abanoubgeorge20 before publishing.');
  const state=await head();
  if(state.sha!==payload.baseSha) throw new Error('The website changed since you opened it. Export your draft, then reload the latest projects.');
  const commit=await call(`${base}/git/commits/${state.sha}`);
  const tree=await call(`${base}/git/trees/${commit.tree.sha}?recursive=1`);
  if(tree.truncated) throw new Error('Repository too large to validate safely.');
  const existing=new Set(tree.tree.filter(entry=>entry.type==='blob').map(entry=>entry.path));
  const current=JSON.parse(await readFile('projects.json',state.sha));
  const reviews=validateReviews(payload.reviews===undefined?(current.reviews??[]):payload.reviews);
  const profile=validateProfile(payload.profile===undefined?(current.profile??{image:'assets/abanoub-george.jpg'}):payload.profile);
  const referenced=new Set([...projects,...reviews,profile].map(item=>item.image).filter(Boolean));
  const uploads=payload.uploads.filter(upload=>upload&&referenced.has(upload.path));
  if(uploads.reduce((total,upload)=>total+(typeof upload.base64==='string'?upload.base64.length:0),0)>28*1024*1024) throw new Error('Upload fewer images per publication (20 MB total).');
  const used=new Set();
  for(const upload of uploads){validateImage(upload);if(used.has(upload.path))throw new Error('Duplicate image filename.');used.add(upload.path);}
  for(const image of referenced)if(!existing.has(image)&&!used.has(image))throw new Error('A profile, project, or review image is missing. Select the image again.');
  for(const upload of uploads)if(existing.has(upload.path))throw new Error('An uploaded image filename already exists. Select the image again.');
  const html=updateProfile(updateIndex(await readFile('index.html',state.sha),projects,reviews),profile);
  const changes=[];
  for(const upload of uploads){
   const blob=await call(`${base}/git/blobs`,'POST',{content:upload.base64,encoding:'base64'});
   changes.push({path:upload.path,mode:'100644',type:'blob',sha:blob.sha});
  }
  changes.push({path:'projects.json',mode:'100644',type:'blob',content:JSON.stringify({version:3,projects,reviews,profile},null,2)+'\n'}, {path:'index.html',mode:'100644',type:'blob',content:html});
  const newTree=await call(`${base}/git/trees`,'POST',{base_tree:commit.tree.sha,tree:changes});
  const newCommit=await call(`${base}/git/commits`,'POST',{message:'Update portfolio profile, projects and client reviews',tree:newTree.sha,parents:[state.sha]});
  await call(`${base}/git/refs/heads/${encodeURIComponent(state.branch)}`,'PATCH',{sha:newCommit.sha,force:false});
  return {sha:newCommit.sha,projects,reviews,profile,site:'https://abanoubgeorge20.github.io/',commitUrl:`https://github.com/${REPO}/commit/${newCommit.sha}`};
 }
 async function status() {
  const result=await call(`${base}/pages/builds/latest`);
  return {status:result.status,commit:result.commit,error:result.error?.message||null};
 }
 return {load,publish,status};
}
module.exports={api,service,REPO};
