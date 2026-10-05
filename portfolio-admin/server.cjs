const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {createAuth}=require('./auth.cjs');
const {service}=require('./github.cjs');
function createServer({backend=service(),auth=createAuth()}={}) {
 let publishing=false;
 const assets={'/':['index.html','text/html; charset=utf-8'],'/admin.js':['admin.js','application/javascript; charset=utf-8'],'/admin.css':['admin.css','text/css; charset=utf-8']};
 const server=http.createServer(async(req,res)=>{
  const origin=`http://127.0.0.1:${server.address().port}`;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https://abanoubgeorge20.github.io; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  if(req.headers.host!==`127.0.0.1:${server.address().port}` || (req.headers.origin && req.headers.origin!==origin) || req.headers['sec-fetch-site']==='cross-site') return json(403,{error:'Open the dashboard from its local launcher.'});
  try {
   if(req.method==='GET' && assets[req.url]) {
    const [file,type]=assets[req.url];res.writeHead(200,{'Content-Type':type});return res.end(fs.readFileSync(path.join(__dirname,file)));
   }
   const session=auth.session(req.headers.cookie);
   if(req.method==='GET' && req.url==='/api/session') return json(200,{app:'abanoub-portfolio-admin',authVersion:1,configured:auth.configured(),authenticated:!!session,...(session?{token:session.token}:{})});
   if(req.method==='POST' && ['/api/login','/api/setup'].includes(req.url)) {
    if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return json(403,{error:'Sign in from the dashboard page.'});
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2048)return json(413,{error:'Login request too large.'});chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(req.url==='/api/setup')auth.setup(body.password,body.setupKey);
    const result=auth.login(body.password);
    res.setHeader('Set-Cookie',`portfolio_session=${result.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
    return json(200,{token:result.token});
   }
   if(!session)return json(401,{error:'Sign in to manage your portfolio.'});
   if(req.headers['x-admin-token']!==session.token) return json(403,{error:'Reload the dashboard to start a new session.'});
   if(req.method==='POST' && req.url==='/api/logout') {
    auth.logout(session.id);res.setHeader('Set-Cookie','portfolio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(200,{ok:true});
   }
   if(req.method==='GET' && req.url==='/api/projects') return json(200,await backend.load());
   if(req.method==='GET' && req.url==='/api/status') return json(200,await backend.status());
   if(req.method==='POST' && req.url==='/api/publish') {
    if(publishing) return json(409,{error:'A publication is already running. Please wait.'});
    if(req.headers['content-type']!=='application/json') return json(415,{error:'Use JSON requests.'});
    if(Number(req.headers['content-length'])>30*1024*1024) return json(413,{error:'Upload fewer images per publication (20 MB total).'});
    publishing=true;
    try {
     let size=0;const chunks=[];
     for await(const chunk of req){size+=chunk.length;if(size>30*1024*1024) throw new Error('Upload fewer images per publication.');chunks.push(chunk);}
     const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
     return json(200,await backend.publish(payload));
    } finally {publishing=false;}
   }
   return json(404,{error:'Not found.'});
  } catch(error) {if(!res.headersSent)json(400,{error:error instanceof SyntaxError?'Invalid request data.':error.message});}
 });
 return server;
}
if(require.main===module) {
 const server=createServer();
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Dashboard already running on port 4318.':error.message);process.exitCode=1;});
 server.listen(4318,'127.0.0.1',()=>console.log('Portfolio dashboard: http://127.0.0.1:4318'));
}
module.exports={createServer};
