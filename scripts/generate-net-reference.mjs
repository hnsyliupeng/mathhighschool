/** Run DDG_Tutorial/rod_network/case_1 in Octave WASM with sparse storage.
 * Example: AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/tmp/chromium \
 *   node scripts/generate-net-reference.mjs /path/to/DDG_Tutorial --steps 5 --output /tmp/net-reference.json
 * The original local law, constraint DOFs, integrator and Newton stop order
 * are retained. Dense storage/solve is replaced with sparse storage/solve;
 * --fast-assembly additionally vectorizes stretching assembly algebraically.
 * Validate fast and unvectorized assembly against one another before use.
 */
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
const [repoArg,...args]=process.argv.slice(2),get=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]}
if(!repoArg||repoArg.startsWith('--'))throw Error('Specify DDG_Tutorial checkout or pinned source archive')
const repo=path.resolve(repoArg),dir=path.join(repo,'rod_network/case_1'),steps=Number(get('--steps','200')),frameEvery=Number(get('--frame-every','20')),fast=args.includes('--fast-assembly'),output=path.resolve(get('--output','src/data/references/net-gravity-reference.json'))
if(!Number.isInteger(steps)||steps<1||steps>200||!Number.isInteger(frameEvery)||frameEvery<1)throw Error('Steps must be 1–200 and frame-every must be positive')
const nodeHash='19b52253245990c0444ed7e5f006b5e7db4c5e8b342fcc9d071780038742dcc9',edgeHash='f58e0aecf98dfaea14c4b1d1a5b1f5f02fe28343052828abc3f2850475c2d92a'
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex')
if(await hash(path.join(dir,'inputfile/node.txt'))!==nodeHash||await hash(path.join(dir,'inputfile/edge.txt'))!==edgeHash)throw Error('Original net input mesh does not match pinned source')
let commit
try{commit=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{commit=get('--commit','')}
if(commit!=='20d732f3fffdd5137eee720e46175de3a98016c6')throw Error('Use pinned commit 20d732f... or provide --commit when using a source archive')
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const executablePath=process.env.CHROME_BIN||await bundle.executablePath(),octaveDir=path.dirname(require.resolve('@liudonghua123/octave-wasm'))
const html=`<!doctype html><html><body><script src="/octave.js"></script><script>
window.logs=[];OCTAVE({print:x=>window.logs.push(String(x)),printErr:x=>window.logs.push('ERR: '+x)}).then(m=>{window.m=m;m.execute_interp();m.eval_string("fprintf('OCTAVE_VERSION=%s\\\\n', version);");window.ready=true}).catch(e=>{window.error=String(e);window.ready=true});</script></body></html>`
const server=createServer(async(req,res)=>{const name=new URL(req.url,'http://localhost').pathname;if(name==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);return}if(!['/octave.js','/octave.data','/octave.wasm'].includes(name)){res.writeHead(404);res.end();return}try{const content=await readFile(path.join(octaveDir,name.slice(1)));res.writeHead(200,{'content-type':name.endsWith('.wasm')?'application/wasm':'application/octet-stream'});res.end(content)}catch{res.writeHead(500);res.end()}})
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve))
let browser
try{
 browser=await chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox']})
 const page=await browser.newPage()
 async function collect(d,relative=''){const result=[];for(const entry of await readdir(d,{withFileTypes:true})){const rel=relative+entry.name,abs=path.join(d,entry.name);if(entry.isDirectory())result.push(...await collect(abs,rel+'/'));else if(/\.(m|txt)$/.test(entry.name))result.push({name:rel,content:await readFile(abs,'utf8')})}return result}
 const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Upstream changed: '+a);return s.replace(a,b)}
 const files=await collect(dir)
 for(const file of files){
   file.content=file.content.replaceAll('\r\n','\n')
   if(file.name==='main.m'){
     file.content=file.content.replace('close all;','').replace('clc;','').replace("fprintf('t=%f\\n', ctime);",'')
     file.content=replace(file.content,'simParams = defSimParams();',`simParams = defSimParams(); simParams.Nsteps = ${steps}; simParams.plotStep = ${steps+1};`)
     file.content=file.content.replaceAll('%.4f','%.12g')
   }else if(file.name==='getFs.m')file.content=fast?await readFile('scripts/net-octave-getFs.m','utf8'):replace(file.content,'Js = zeros(rodParams.ndof, rodParams.ndof);','Js = sparse(rodParams.ndof, rodParams.ndof);')
   else if(file.name==='getFg.m')file.content=replace(file.content,'Jg = zeros(rodParams.ndof, rodParams.ndof);','Jg = sparse(rodParams.ndof, rodParams.ndof);')
   else if(file.name==='objfun.m'){
     file.content=replace(file.content,'mMat = diag(mUncons);','mMat = spdiags(mUncons,0,length(mUncons),length(mUncons));')
     file.content=replace(file.content,"fprintf('Iter=%d, error=%e\\n', iter-1, normfNew);",'')
     file.content=replace(file.content,'if (iter>maximum_iter)',"if (iter>maximum_iter)\n        fprintf('REFERENCE_MAX_ITER norm=%e\\n', normfNew);")
   }
   if(fast&&(file.name==='objfun.m'||file.name==='main.m')){
     const update='for i = 1:rodParams.ne\n        sElement(i).nodePos_1 = getVertex(rodParams.x, sElement(i).nodeIndex(1));\n        sElement(i).nodePos_2 = getVertex(rodParams.x, sElement(i).nodeIndex(2));\n    end'
     file.content=replace(file.content,update,'% Fast assembly reads the current x directly.')
   }
 }
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'load'});await page.waitForFunction(()=>window.ready,{timeout:120000})
 console.log(`Running net source (${steps} steps, sparse Octave WASM)...`)
 const result=await page.evaluate(({files})=>{
   if(window.error)throw Error(window.error)
   const m=window.m;m.FS.mkdir('/reference')
   for(const file of files){const parts=file.name.split('/');let d='/reference';for(const p of parts.slice(0,-1)){d+='/'+p;try{m.FS.mkdir(d)}catch{}}m.FS.writeFile('/reference/'+file.name,file.content)}
   m.eval_string("cd('/reference'); main;")
   let text;try{text=m.FS.readFile('/reference/data.txt',{encoding:'utf8'})}catch(e){throw Error('Missing output: '+e+'; '+window.logs.slice(-10).join(' | '))}
   return {text,version:window.logs.find(x=>x.startsWith('OCTAVE_VERSION=')),warnings:window.logs.filter(x=>x.includes('REFERENCE_MAX_ITER')),logs:window.logs.slice(-8)}
 },{files})
 const n=631,rows=result.text.trim().split(/\r?\n/).filter(Boolean).map(s=>s.trim().split(/\s+/).map(Number))
 if(rows.length!==steps*n||rows.some(r=>r.length!==4||r.some(x=>!Number.isFinite(x))))throw Error(`Expected ${steps*n} finite rows; found ${rows.length}. ${result.logs.join(' | ')}`)
 const probe=[],frames=[]
 for(let i=0;i<steps;i++){const step=i+1,at=i*n;probe.push(rows[at].slice(1));if(step===1||step===steps||step%frameEvery===0)frames.push({step,positions:rows.slice(at,at+n).flatMap(r=>r.slice(1))})}
 const data={metadata:{reference_repository:'https://github.com/weicheng-huang-mechanics/DDG_Tutorial',reference_commit:commit,runner:`GNU Octave ${result.version?.split('=')[1]?.trim()||'unknown'} WebAssembly`,case:'rod_network/case_1',node_sha256:nodeHash,edge_sha256:edgeHash,modifications:`Removed plotting and per-iteration logging, instrumented iteration limit, printed 12 significant digits; dense global matrices replaced by sparse storage and sparse linear solve. ${fast?'Stretching assembly was vectorized algebraically and reads current x directly; validate against unvectorized source assembly.':'Original element and force assembly loops retained.'} Mesh, local element law, parameters, integrator and original stopping order unchanged.`,sampling:`Center node x/y/z each step; all 631 nodes at step 1, every ${frameEvery}th step and final step.`,fastAssembly:fast,warnings:result.warnings},steps,dt:.01,probeNode:0,probe,frames}
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(data,null,2)+'\n')
 console.log(`Wrote ${output}: ${rows.length} nodal rows, ${result.warnings.length} iteration-limit exits`)
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
