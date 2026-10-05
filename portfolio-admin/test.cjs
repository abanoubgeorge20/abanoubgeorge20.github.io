const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateProjects,validateImage,renderCards,updateIndex,validateReviews,renderReviews,updateReviews,validateProfile,updateProfile}=require('./model.cjs');
const {service}=require('./github.cjs');
const {createServer}=require('./server.cjs');
const {createAuth}=require('./auth.cjs');
const os=require('node:os');
function temporaryAuth(t,options={}){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-auth-test-'));t.after(()=>{if(!directory.startsWith(path.join(os.tmpdir(),'portfolio-auth-test-')))throw Error('Unexpected temporary directory');fs.rmSync(directory,{recursive:true,force:true});});return {directory,auth:createAuth({directory,...options})};}
const portfolioRoot=fs.existsSync(path.join(__dirname,'../portfolio/index.html'))?path.join(__dirname,'../portfolio'):path.join(__dirname,'..');
const original=JSON.parse(fs.readFileSync(path.join(portfolioRoot,'projects.json'))).projects;
const sha='a'.repeat(40);
const image={path:'assets/upload-12345678-1234-1234-1234-123456789abc.png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII='};
test('migration preserves the nine projects and static gallery',()=>{
 assert.equal(validateProjects(original).length,9);
 const html=fs.readFileSync(path.join(portfolioRoot,'index.html'),'utf8');
 assert.equal((html.match(/<article class="project"/g)||[]).length,9);
 assert.ok(html.includes('<!-- PROJECTS:START -->'));
 const updated=updateIndex(html,[original[0]]);
 assert.equal((updated.match(/<article class="project"/g)||[]).length,1);
 assert.ok(updated.includes('assets/abanoub-george.jpg'));
});
test('content validation blocks injection, unsafe links, duplicate IDs and paths',()=>{
 const escaped=renderCards([{...original[0],title:'<img src=x onerror=alert(1)>',description:'<script>oops</script>'}]);
 assert.ok(escaped.includes('&lt;img'));assert.ok(!escaped.includes('<script>'));
 for(const patch of [{url:'javascript:alert(1)'},{codeUrl:'http://example.com'},{image:'../secret.png'},{category:'__proto__'},{title:''},{tags:Array(9).fill('tag')}])assert.throws(()=>validateProjects([{...original[0],...patch}]));
 assert.throws(()=>validateProjects([original[0],original[0]]));
 assert.throws(()=>updateIndex('<html>no markers</html>',original));
});
test('uploads validate image signatures, size and fixed safe path',()=>{
 assert.ok(validateImage(image).length>0);
 assert.throws(()=>validateImage({...image,base64:Buffer.from('<svg onload="alert(1)">').toString('base64')}));
 assert.throws(()=>validateImage({...image,path:'../outside.png'}));
 assert.throws(()=>validateImage({...image,path:image.path.replace('.png','.jpg')}));
 assert.throws(()=>validateImage({...image,base64:'a'.repeat(8*1024*1024)}));
});
function fakeApi({head=sha,account='abanoubgeorge20',rejectRef=false,reviews=[],profile={image:'assets/abanoub-george.jpg'}}={}) {
 const calls=[];
 const html='KEEP HEADER<figure class="portrait"><img src="assets/abanoub-george.jpg" alt="Owner"><figcaption>OWNER</figcaption></figure><!-- PROJECTS:START -->old<!-- PROJECTS:END --><!-- REVIEWS:START --><!-- REVIEWS:END -->KEEP FOOTER';
 const call=async(endpoint,method='GET',body)=>{
  calls.push({endpoint,method,body});
  if(endpoint==='user')return {login:account};
  if(endpoint.endsWith('.github.io'))return {default_branch:'main'};
  if(endpoint.endsWith('/git/ref/heads/main'))return {object:{sha:head}};
  if(endpoint.includes('/contents/projects.json'))return {encoding:'base64',content:Buffer.from(JSON.stringify({projects:original,reviews,profile})).toString('base64')};
  if(endpoint.includes('/contents/index.html'))return {encoding:'base64',content:Buffer.from(html).toString('base64')};
  if(endpoint.includes('/git/commits/')&&method==='GET')return {tree:{sha:'tree'}};
  if(endpoint.includes('/git/trees/')&&method==='GET')return {tree:[...original,...reviews,profile].filter(p=>p?.image).map(p=>({type:'blob',path:p.image})),truncated:false};
  if(method==='POST')return {sha:'b'.repeat(40)};
  if(method==='PATCH'){if(rejectRef)throw Error('Update rejected: repository changed');return {};}
  throw Error('Unexpected test request '+endpoint);
 };return {call,calls};
}
test('publication atomically commits images, JSON and generated HTML without forced updates',async()=>{
 const mock=fakeApi();const backend=service(mock.call);
 const project={...original[0],image:image.path,title:'A new project',category:'web',url:'https://example.com/'};
 const result=await backend.publish({baseSha:sha,projects:[project],uploads:[image]});
 assert.equal(result.projects[0].title,'A new project');
 const tree=mock.calls.find(c=>c.endpoint.endsWith('/git/trees')&&c.method==='POST').body;
 assert.deepEqual(tree.tree.map(f=>f.path),[image.path,'projects.json','index.html']);
 assert.ok(tree.tree[2].content.includes('KEEP HEADER'));
 assert.ok(tree.tree[2].content.includes('Live project'));
 assert.equal(tree.base_tree,'tree');
 const patch=mock.calls.at(-1);assert.equal(patch.method,'PATCH');assert.equal(patch.body.force,false);
});
test('stale drafts and wrong accounts cannot mutate GitHub',async()=>{
 for(const options of [{head:'c'.repeat(40)},{account:'another-user'}]){
  const mock=fakeApi(options);
  await assert.rejects(()=>service(mock.call).publish({baseSha:sha,projects:original,uploads:[]}));
  assert.ok(mock.calls.every(c=>c.method==='GET'));
 }
});
test('missing images reject before writes and failed ref update never reports success',async()=>{
 const missing=fakeApi();await assert.rejects(()=>service(missing.call).publish({baseSha:sha,projects:[{...original[0],image:'assets/missing.png'}],uploads:[]}));
 assert.ok(missing.calls.every(c=>c.method==='GET'));
 const race=fakeApi({rejectRef:true});await assert.rejects(()=>service(race.call).publish({baseSha:sha,projects:original,uploads:[]}));
});
test('local dashboard rejects cross-origin, DNS rebinding and unauthenticated writes',async t=>{
 const {auth,directory}=temporaryAuth(t);
 let writes=0;const server=createServer({auth,backend:{load:async()=>({projects:original}),publish:async()=>{writes++;return {ok:true};},status:async()=>({status:'built'})}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const anonymous=await (await fetch(base+'/api/session')).json();assert.equal(anonymous.authenticated,false);assert.equal(anonymous.token,undefined);
 assert.equal((await fetch(base+'/api/projects')).status,401);
 assert.equal((await fetch(base+'/api/setup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({password:'temporary-test-password',setupKey:'incorrect'})})).status,400);
 const setup=await fetch(base+'/api/setup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({password:'temporary-test-password',setupKey:fs.readFileSync(path.join(directory,'setup-key'),'utf8')})});
 assert.equal(setup.status,200);const cookie=setup.headers.get('set-cookie').split(';')[0];assert.match(setup.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 const session=await setup.json();assert.ok(session.token);
 assert.equal((await fetch(base+'/api/session',{headers:{Origin:'https://evil.example'}})).status,403);
 const rebound=await new Promise((resolve,reject)=>{const request=require('node:http').get(base+'/api/session',{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);});
 assert.equal(rebound,403);
 assert.equal((await fetch(base+'/api/publish',{method:'POST',body:'{}'})).status,401);
 assert.equal((await fetch(base+'/api/publish',{method:'POST',headers:{'X-Admin-Token':session.token,'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'})).status,403);
 assert.equal(writes,0);
 assert.equal((await fetch(base+'/api/publish',{method:'POST',headers:{Cookie:cookie,'X-Admin-Token':session.token,'Content-Type':'application/json',Origin:base},body:'{}'})).status,200);
 assert.equal(writes,1);
 assert.equal((await fetch(base+'/../github.cjs',{headers:{Cookie:cookie,'X-Admin-Token':session.token}})).status,404);
 assert.equal((await fetch(base+'/.private/password.json',{headers:{Cookie:cookie,'X-Admin-Token':session.token}})).status,404);
 await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:cookie,'X-Admin-Token':session.token,Origin:base}});
 assert.equal((await fetch(base+'/api/projects',{headers:{Cookie:cookie,'X-Admin-Token':session.token}})).status,401);
});
test('password is hashed, setup is one-time, lockout and session expiry work',t=>{
 let clock=1000;const {auth,directory}=temporaryAuth(t,{now:()=>clock});
 const setupKey=fs.readFileSync(path.join(directory,'setup-key'),'utf8');
 assert.throws(()=>auth.setup('short',setupKey));
 auth.setup('temporary-test-password',setupKey);
 assert.ok(!fs.readFileSync(path.join(directory,'password.json'),'utf8').includes('temporary-test-password'));
 assert.ok(!fs.existsSync(path.join(directory,'setup-key')));
 assert.throws(()=>auth.setup('another-password-123',setupKey));
 for(let i=0;i<5;i++)assert.throws(()=>auth.login('wrong-password'));
 assert.throws(()=>auth.login('temporary-test-password'),/five minutes/);
 clock+=300001;const session=auth.login('temporary-test-password');assert.ok(auth.session('portfolio_session='+session.id));
 clock+=8*60*60*1000+1;assert.equal(auth.session('portfolio_session='+session.id),null);
 const restarted=createAuth({directory});assert.equal(restarted.configured(),true);assert.ok(restarted.login('temporary-test-password'));
});
const review={id:'review-one',name:'Test Client',role:'Example Company',quote:'Useful work with clear communication.',rating:4,image:'',platform:'',sourceUrl:''};
test('review rendering escapes text, supports optional rating and hides empty sections',()=>{
 assert.equal(renderReviews([]),'');
 const markup=renderReviews([{...review,name:'<script>x</script>',quote:'<img onerror=alert(1)>',rating:null}]);
 assert.ok(markup.includes('&lt;script&gt;'));assert.ok(!markup.includes('<script>'));assert.ok(!markup.includes('review-stars'));
 assert.ok(renderReviews([review]).includes('4 out of 5 stars'));
 for(const patch of [{name:''},{quote:''},{rating:0},{rating:6},{rating:2.5},{role:null}])assert.throws(()=>validateReviews([{...review,...patch}]));
 assert.throws(()=>validateReviews([review,review]));
 const html=updateReviews('<main><section id="contact">contact</section></main>',[review]);
 assert.ok(html.includes('id="reviews"'));assert.ok(html.includes('id="contact"'));
 const empty=updateReviews(html,[]);assert.ok(!empty.includes('id="reviews"'));assert.ok(empty.includes('REVIEWS:START'));
});
test('reviews publish with projects, persist on load, and older clients preserve them',async()=>{
 const initial=fakeApi({reviews:[review]});const loaded=await service(initial.call).load();assert.deepEqual(loaded.reviews,[review]);
 const compatible=fakeApi({reviews:[review]});const result=await service(compatible.call).publish({baseSha:sha,projects:original,uploads:[]});assert.deepEqual(result.reviews,[review]);
 const mock=fakeApi();await service(mock.call).publish({baseSha:sha,projects:original,reviews:[review],uploads:[]});
 const tree=mock.calls.find(c=>c.endpoint.endsWith('/git/trees')&&c.method==='POST').body.tree;
 const content=JSON.parse(tree.find(f=>f.path==='projects.json').content);assert.deepEqual(content.projects,original);assert.deepEqual(content.reviews,[review]);
 assert.ok(tree.find(f=>f.path==='index.html').content.includes('Test Client'));
 const cleared=fakeApi({reviews:[review]});const empty=await service(cleared.call).publish({baseSha:sha,projects:original,reviews:[],uploads:[]});assert.deepEqual(empty.reviews,[]);
});
test('screenshot-only reviews and legacy text reviews validate safely',()=>{
 const screenshot={...review,name:'',role:'',quote:'',rating:null,image:image.path,platform:'Upwork',sourceUrl:'https://example.com/review'};
 const html=renderReviews([screenshot]);assert.ok(html.includes('data-review-preview="Upwork"'));assert.ok(html.includes('View original review'));assert.ok(!html.includes('<blockquote>'));assert.ok(!html.includes('review-stars'));
 assert.throws(()=>validateReviews([{...screenshot,image:''}]));
 assert.throws(()=>validateReviews([{...screenshot,image:'https://example.com/image.png'}]));
 assert.throws(()=>validateReviews([{...screenshot,sourceUrl:'javascript:alert(1)'}]));
 assert.throws(()=>validateReviews([{...screenshot,platform:'x'.repeat(81)}]));
 const {image:unusedImage,platform:unusedPlatform,sourceUrl:unusedUrl,...legacy}=review;
 assert.deepEqual(validateReviews([legacy]),[review]);
});
test('review screenshots upload atomically, survive project-only edits, and missing files reject',async()=>{
 const screenshot={...review,image:image.path,platform:'Fiverr',sourceUrl:'https://example.com/review'};
 const mock=fakeApi();const result=await service(mock.call).publish({baseSha:sha,projects:original,reviews:[screenshot],uploads:[image]});
 assert.deepEqual(result.reviews,[screenshot]);
 const tree=mock.calls.find(c=>c.endpoint.endsWith('/git/trees')&&c.method==='POST').body.tree;
 assert.equal(tree[0].path,image.path);assert.equal(JSON.parse(tree.find(item=>item.path==='projects.json').content).reviews[0].image,image.path);
 assert.ok(tree.find(item=>item.path==='index.html').content.includes(image.path));
 const existing=fakeApi({reviews:[screenshot]});const unchanged=await service(existing.call).publish({baseSha:sha,projects:original,uploads:[]});assert.equal(unchanged.reviews[0].image,image.path);
 const missing=fakeApi();await assert.rejects(()=>service(missing.call).publish({baseSha:sha,projects:original,reviews:[screenshot],uploads:[]}));assert.ok(missing.calls.every(call=>call.method==='GET'));
});
test('personal photo updates only the portrait and rejects unsafe paths',()=>{
 const html='<figure class="portrait"><img src="assets/old.jpg" alt="Owner"><figcaption>Owner name</figcaption></figure><img src="assets/project.png">';
 const updated=updateProfile(html,{image:image.path});assert.ok(updated.includes(`src="${image.path}"`));assert.ok(updated.includes('alt="Owner"'));assert.ok(updated.includes('Owner name'));assert.ok(updated.includes('src="assets/project.png"'));
 for(const profile of [null,{},[],{image:''},{image:'../secret.jpg'},{image:'https://example.com/photo.jpg'},{image:'assets/photo.svg'}])assert.throws(()=>validateProfile(profile));
 assert.throws(()=>updateProfile('<main></main>',{image:image.path}));
});
test('personal photo uploads with content and survives project-only publications',async()=>{
 const mock=fakeApi({reviews:[review]});const profile={image:image.path};
 const result=await service(mock.call).publish({baseSha:sha,projects:original,reviews:[review],profile,uploads:[image]});assert.deepEqual(result.profile,profile);assert.deepEqual(result.reviews,[review]);
 const tree=mock.calls.find(c=>c.endpoint.endsWith('/git/trees')&&c.method==='POST').body.tree;
 assert.equal(tree[0].path,image.path);const data=JSON.parse(tree.find(f=>f.path==='projects.json').content);assert.deepEqual(data.profile,profile);assert.deepEqual(data.projects,original);
 assert.match(tree.find(f=>f.path==='index.html').content,new RegExp('<figure class="portrait"><img src="'+image.path+'"'));
 const preserved=fakeApi({profile});const retained=await service(preserved.call).publish({baseSha:sha,projects:original,uploads:[]});assert.deepEqual(retained.profile,profile);
 assert.deepEqual((await service(preserved.call).load()).profile,profile);
 const missing=fakeApi();await assert.rejects(()=>service(missing.call).publish({baseSha:sha,projects:original,profile,uploads:[]}));assert.ok(missing.calls.every(call=>call.method==='GET'));
});
