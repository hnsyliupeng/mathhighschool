/** Run the original 2d_surface axisymmetric shell scripts in GNU Octave WASM.
 * Usage: node scripts/generate-axis-shell-reference.mjs /path/to/DDG_Tutorial --case 1|2 [--steps N] [--output path]
 * Optional case-2 --checkpoint FILE requires a separate --output; it runs a
 * conditional local window from an external seed, not an independent full run.
 * Only output, plotting and iteration instrumentation are changed; equations and source mesh are not changed.
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
const steps=Number(get('--steps',caseNo===1?'200':'1200'))
if(!Number.isInteger(steps)||steps<1)throw Error('Steps must be a positive integer')
const output=path.resolve(get('--output',`src/data/references/axis-shell-${caseNo}-reference.json`))
const checkpointPath=get('--checkpoint',null)
const checkpoint=checkpointPath?JSON.parse(await readFile(checkpointPath,'utf8')):null
const offset=checkpoint?.step??0
if(checkpoint&&(caseNo!==2||!Number.isInteger(offset)||offset<0||offset+steps>1200||checkpoint.q?.length!==80||checkpoint.v?.length!==80||[...checkpoint.q,...checkpoint.v].some(x=>!Number.isFinite(x))))throw Error('Invalid case-2 checkpoint or requested window')
if(checkpoint&&(!args.includes('--output')||output===path.resolve('src/data/references/axis-shell-2-reference.json')))throw Error('Conditional window requires a separate --output; it cannot replace the independent reference')
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
 const files=await collect(path.join(repo,'2d_surface',`case_${caseNo}`))
 for(const file of files){
   file.content=file.content.replaceAll('\r\n','\n')
   if(file.name==='main.m'){
     file.content=file.content.replace('close all;','').replace('clc;','')
     file.content=replace(file.content,'simParams = defSimParams();',`simParams = defSimParams(); simParams.Nsteps = ${steps}; simParams.plotStep = 100000;`)
     file.content=file.content.replace("fprintf('t=%f\\n', ctime);",'').replaceAll('%.4f','%.12g')
     file.content=file.content.replace(/% Plot result[\s\S]*$/, '')
     if(caseNo===2){
       file.content=replace(file.content,"fileID = fopen('data.txt', 'w');", "fileID = fopen('data.txt', 'w'); reactionID = fopen('reaction.txt', 'w');")
       file.content=replace(file.content,'[xUncons, reForce] = objfun(rodParams, simParams, consParams, sElement, bElement);',"[xUncons, reForce] = objfun(rodParams, simParams, consParams, sElement, bElement); fprintf(reactionID, '%.12g\\n', reForce);")
       file.content=replace(file.content,'fclose(fileID);','fclose(fileID); fclose(reactionID);')
     }
   }else if(file.name==='objfun.m'){
     file.content=replace(file.content,"fprintf('Iter=%d, error=%e\\n', iter-1, normfNew);",'')
     file.content=replace(file.content,'if (iter>maximum_iter)',"if (iter>maximum_iter)\n        fprintf('REFERENCE_MAX_ITER norm=%e\\n', normfNew);")
   }else if(file.name==='plotShell.m')file.content='function plotShell(varargin)\nend\n'
 }
 const port=server.address().port
 await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'load'});await page.waitForFunction(()=>window.ready,{timeout:120000})
 console.log(`Running 2d_surface/case_${caseNo}: ${steps} steps (Octave WASM, may take considerable time)...`)
 // Execute the unmodified time-loop body in consecutive batches in the same
 // Octave workspace. Saving each batch makes long jobs inspectable
 // (the file is a valid *partial* reference until targetSteps, not a restart checkpoint).
 const main=files.find(f=>f.name==='main.m').content,begin='for timeStep=1:simParams.Nsteps\n',end='\nend\n\nfclose(fileID);'
 const startAt=main.indexOf(begin),endAt=main.lastIndexOf(end)
 if(startAt<0||endAt<0)throw Error('Cannot identify upstream time loop')
 const prefix=main.slice(0,startAt),body=main.slice(startAt+begin.length,endAt)
 await page.evaluate(({files,prefix,checkpoint})=>{
   if(window.error)throw Error(window.error)
   const m=window.m;m.FS.mkdir('/reference')
   for(const file of files){const parts=file.name.split('/');let dir='/reference';for(const part of parts.slice(0,-1)){dir+='/'+part;try{m.FS.mkdir(dir)}catch{}}m.FS.writeFile('/reference/'+file.name,file.content)}
   m.eval_string("cd('/reference');")
   m.eval_string(prefix)
   if(checkpoint){
     const text=checkpoint.q.map((v,i)=>`${v.toPrecision(17)} ${checkpoint.v[i].toPrecision(17)}`).join('\n')+'\n'
     m.FS.writeFile('/reference/checkpoint.txt',text)
     m.eval_string(`cp=load('/reference/checkpoint.txt'); rodParams.x=cp(:,1); rodParams.x0=cp(:,1); rodParams.u=cp(:,2); ctime=${checkpoint.step*.005};`)
   }
 },{files,prefix,checkpoint})
 const batch=Number(get('--batch','10'))
 if(!Number.isInteger(batch)||batch<1)throw Error('Batch must be a positive integer')
 await mkdir(path.dirname(output),{recursive:true})
 for(let first=1;first<=steps;first+=batch){
   const completed=Math.min(steps,first+batch-1)
   const code=`for timeStep=${offset+first}:${offset+completed}\n${body}\nend\nfflush(fileID);${caseNo===2?'fflush(reactionID);':''}`
   const result=await page.evaluate(({code,caseNo})=>{
     const m=window.m;m.eval_string(code)
     let text,reactions
     try{text=m.FS.readFile('/reference/data.txt',{encoding:'utf8'});if(caseNo===2)reactions=m.FS.readFile('/reference/reaction.txt',{encoding:'utf8'})}catch(e){throw Error('Missing output: '+e+'; '+window.octaveLogs.slice(-10).join(' | '))}
     return {text,reactions,version:window.octaveLogs.find(x=>x.startsWith('OCTAVE_VERSION=')),warnings:window.octaveLogs.filter(x=>x.includes('REFERENCE_MAX_ITER')),logs:window.octaveLogs.slice(-8)}
   },{code,caseNo})
   const n=40,rows=result.text.trim().split(/\r?\n/).filter(Boolean).map(line=>line.trim().split(/\s+/).map(Number))
   if(rows.length!==completed*n||rows.some(row=>row.length!==3||row.some(x=>!Number.isFinite(x))))throw Error(`Expected ${completed*n} finite rows; found ${rows.length}; logs: ${result.logs.join(' | ')}`)
   const probeNode=caseNo===1?0:19,probe=[],frames=[],every=Number(get('--sample-every',checkpoint?'1':caseNo===1?'10':'30'))
   if(!Number.isInteger(every)||every<1)throw Error('sample-every must be a positive integer')
   for(let i=0;i<completed;i++){
     const step=i+1,at=i*n
     probe.push([rows[at+probeNode][1],rows[at+probeNode][2]])
     if(step===1||step===completed||step%every===0)frames.push({step,positions:rows.slice(at,at+n).flatMap(row=>[row[1],row[2]])})
   }
   const reactions=caseNo===2?result.reactions.trim().split(/\s+/).map(Number):undefined
   if(reactions&&(reactions.length!==completed||reactions.some(x=>!Number.isFinite(x))))throw Error('Invalid reaction samples')
   const data={metadata:{reference_repository:'https://github.com/weicheng-huang-mechanics/DDG_Tutorial',reference_commit:commit,runner:`GNU Octave ${result.version?.split('=')[1]?.trim()||'unknown'} WebAssembly`,case:`2d_surface/case_${caseNo}`,targetSteps:steps,modifications:'Removed plotting and per-iteration logging, instrumented maximum-iteration exits and recorded 12 significant digits. The original time-loop body executes in consecutive batches in one Octave workspace; equations, source nodal data, parameters, timestep and iteration stopping order unchanged. Case 2 reaction is the original pre-final-update value returned by objfun.'+(checkpoint?' This conditional window starts from an external TypeScript-generated state and is not an independent full trajectory.':''),sampling:`Node ${probeNode+1} r and z every step; all 40 nodes at local step 1, every ${every}th local step and the final recorded step.`,warnings:result.warnings},steps:completed,offsetSteps:offset,dt:caseNo===1?.01:.005,probeNode,probe,frames,...(reactions?{reactions}:{}),...(checkpoint?{checkpoint}: {})}
   await writeFile(output,JSON.stringify(data,null,2)+'\n')
   console.log(`Wrote ${output}: ${completed}/${steps} steps; ${result.warnings.length} maximum-iteration exits`)
 }
 await page.evaluate(({caseNo})=>window.m.eval_string(`fclose(fileID);${caseNo===2?'fclose(reactionID);':''}`),{caseNo})
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
