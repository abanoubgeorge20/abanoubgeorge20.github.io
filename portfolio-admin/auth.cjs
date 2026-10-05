const fs=require('node:fs');
const path=require('node:path');
const {randomBytes,scryptSync,timingSafeEqual}=require('node:crypto');
function createAuth({directory=path.join(__dirname,'.private'),now=Date.now}={}) {
 fs.mkdirSync(directory,{recursive:true});
 const credentialPath=path.join(directory,'password.json'),setupPath=path.join(directory,'setup-key');
 if(!fs.existsSync(credentialPath)&&!fs.existsSync(setupPath))fs.writeFileSync(setupPath,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});
 const sessions=new Map();let failures=0,lockedUntil=0;
 const configured=()=>fs.existsSync(credentialPath);
 function equal(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);}
 function setup(password,key){
  if(configured())throw Error('A password is already configured. Sign in instead.');
  if(!equal(key,fs.readFileSync(setupPath,'utf8')))throw Error('Open the dashboard using Open-Portfolio-Admin.cmd to set your password.');
  if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Use a password between 12 and 128 characters.');
  const salt=randomBytes(32).toString('hex');const hash=scryptSync(password,salt,64).toString('hex');
  fs.writeFileSync(credentialPath,JSON.stringify({version:1,salt,hash}),{flag:'wx',mode:0o600});
  fs.unlinkSync(setupPath);
 }
 function login(password){
  if(now()<lockedUntil)throw Error('Too many attempts. Please wait five minutes and try again.');
  if(!configured())throw Error('Set your password using the local launcher first.');
  if(now()>=lockedUntil&&lockedUntil){failures=0;lockedUntil=0;}
  const credential=JSON.parse(fs.readFileSync(credentialPath,'utf8'));
  const valid=typeof password==='string'&&password.length<=128&&equal(scryptSync(password,credential.salt,64).toString('hex'),credential.hash);
  if(!valid){failures++;if(failures>=5)lockedUntil=now()+300000;throw Error('Incorrect password.');}
  failures=0;lockedUntil=0;
  for(const [id,session]of sessions)if(session.expires<=now())sessions.delete(id);
  const id=randomBytes(32).toString('hex'),token=randomBytes(32).toString('hex');
  sessions.set(id,{token,expires:now()+8*60*60*1000});return {id,token};
 }
 function session(cookie=''){
  const id=cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('portfolio_session='))?.slice(18);
  const value=sessions.get(id);if(!value)return null;if(value.expires<=now()){sessions.delete(id);return null;}return {...value,id};
 }
 function logout(id){sessions.delete(id);}
 return {configured,setup,login,session,logout};
}
module.exports={createAuth};
