/** Run unaltered soft-robot MATLAB mechanics in GNU Octave WASM, recording precise node positions.
 * Usage: node scripts/generate-soft-reference.mjs /path/to/DDG_Tutorial --case 1|2 [--steps N] [--output path]
 * Optional tools live outside the application; see docs/VALIDATION.md.
 */
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
const [repoArg,...args]=process.argv.slice(2)
const get=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]}
if(!repoArg||repoArg.startsWith('--'))throw Error('Specify the DDG_Tutorial checkout')
const repo=path.resolve(repoArg),caseNo=Number(get('--case','1'))
if(![1,2].includes(caseNo))throw Error('Case must be 1 or 2')
const steps=Number(get('--steps',caseNo===1?'2000':'500'))
if(!Number.isInteger(steps)||steps<1)throw Error('Steps must be a positive integer')
const output=path.resolve(get('--output',`src/data/references/soft-${caseNo}-reference.json`))
const commit=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const executablePath=process.env.CHROME_BIN||await bundle.executablePath()
const octaveDir=path.dirname(require.resolve('@liudonghua123/octave-wasm'))
const html=`<!doctype html><html><body><script src="/octave.js"></script><script>
window.octaveLogs=[];OCTAVE({print:x=>window.octaveLogs.push(String(x)),printErr:x=>window.octaveLogs.push('ERR: '+x)})
.then(m=>{window.m=m;m.execute_interp();m.eval_string("fprintf('OCTAVE_VERSION=%s\\\\n', version);");window.ready=true})
.catch(e=>{window.error=String(e);window.ready=true});</script></body></html>`
const server=createServer(async(req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname
 if(name==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);return}
 if(!['/octave.js','/octave.data','/octave.wasm'].includes(name)){res.writeHead(404);res.end();return}
 try{const content=await readFile(path.join(octaveDir,name.slice(1)));res.writeHead(200,{'content-type':name.endsWith('.wasm')?'application/wasm':'application/octet-stream'});res.end(content)}catch{res.writeHead(500);res.end()}
})
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve))
let browser
try{
 browser=await chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox']})
 const page=await browser.newPage()
 async function collect(dir,relative=''){
   const result=[]
   for(const entry of await readdir(dir,{withFileTypes:true})){
     const rel=relative+entry.name,abs=path.join(dir,entry.name)
     if(entry.isDirectory())result.push(...await collect(abs,rel+'/'))
     else if(/\.(m|txt)$/.test(entry.name))result.push({name:rel,content:await readFile(abs,'utf8')})
   }
   return result
 }
 const replace=(s,a,b)=>{if(!s.includes(a))throw Error(`Upstream changed: ${a}`);return s.replace(a,b)}
 const files=await collect(path.join(repo,'soft_robot',`case_${caseNo}`))
 for(const file of files){
   // Normalize CRLF to make exact modifications deterministic.
   file.content=file.content.replaceAll('\r\n','\n')
   if(file.name==='main.m'){
     file.content=file.content.replace('close all;','').replace('clc;','')
     file.content=replace(file.content,'simParams = defSimParams();',`simParams = defSimParams(); simParams.Nsteps = ${steps}; simParams.plotStep = 100000;`)
     file.content=file.content.replace("fprintf('t=%f\\n', ctime);",'').replaceAll('%.4f','%.12g')
   }else if(file.name==='InitialStretchingElement.m'){
     file.content=file.content.replace('figure(3);','').replace('hold on','')
   }else if(file.name==='objfun.m'){
     file.content=replace(file.content,"fprintf('Iter=%d, error=%e\\n', iter-1, normfNew);",'')
     file.content=replace(file.content,'if (iter>maximum_iter)',"if (iter>maximum_iter)\n        fprintf('REFERENCE_MAX_ITER norm=%e\\n', normfNew);")
   }else if(file.name==='plotBeam.m')file.content='function plotBeam(varargin)\nend\n'
 }
 const port=server.address().port
 await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'load'});await page.waitForFunction(()=>window.ready,{timeout:120000})
 console.log(`Running soft_robot/case_${caseNo}: ${steps} steps (Octave WASM, can take minutes)...`)
 const result=await page.evaluate(({files})=>{
   if(window.error)throw Error(window.error)
   const m=window.m;m.FS.mkdir('/reference')
   for(const file of files){const parts=file.name.split('/');let dir='/reference';for(const part of parts.slice(0,-1)){dir+='/'+part;try{m.FS.mkdir(dir)}catch{}}m.FS.writeFile('/reference/'+file.name,file.content)}
   m.eval_string("cd('/reference'); main;")
   let text;try{text=m.FS.readFile('/reference/data.txt',{encoding:'utf8'})}catch(e){throw Error('Missing output: '+e+'; '+window.octaveLogs.slice(-10).join(' | '))}
   return {text,version:window.octaveLogs.find(x=>x.startsWith('OCTAVE_VERSION=')),warnings:window.octaveLogs.filter(x=>x.includes('REFERENCE_MAX_ITER')),logs:window.octaveLogs.slice(-8)}
 },{files})
 const n=40,rows=result.text.trim().split(/\r?\n/).filter(Boolean).map(line=>line.trim().split(/\s+/).map(Number))
 if(rows.length!==steps*n||rows.some(row=>row.length!==3||row.some(x=>!Number.isFinite(x))))throw Error(`Expected ${steps*n} finite rows; found ${rows.length}; logs: ${result.logs.join(' | ')}`)
 const probe=[],frames=[]
 for(let i=0;i<steps;i++){
   const step=i+1,at=i*n
   probe.push([rows[at+n-1][1],rows[at+n-1][2]])
   if(step===1||step===steps||step%50===0)frames.push({step,positions:rows.slice(at,at+n).flatMap(row=>[row[1],row[2]])})
 }
 const data={metadata:{reference_repository:'https://github.com/weicheng-huang-mechanics/DDG_Tutorial',reference_commit:commit,runner:`GNU Octave ${result.version?.split('=')[1]?.trim()||'unknown'} WebAssembly`,case:`soft_robot/case_${caseNo}`,modifications:'Removed plotting and logging, instrumented maximum iteration exits, and printed 12 significant digits. Equations, original nodal data, parameters, timestep and iteration stopping order are unchanged.',sampling:'40th node x and y every step; all 40 nodes at step 1, every 50th step and final step.',warnings:result.warnings},steps,dt:.01,probeNode:39,probe,frames}
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(data,null,2)+'\n')
 console.log(`Wrote ${output}: ${rows.length} nodal rows; ${result.warnings.length} maximum-iteration exits`)
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
