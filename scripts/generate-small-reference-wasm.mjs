/** Re-run the two mass-spring scripts and the first 50 gravity-beam steps in Octave WASM.
 * Usage: node scripts/generate-small-reference-wasm.mjs /path/to/DDG_Tutorial [output.json]
 * The upstream source is read locally, not redistributed. Plotting/logging is removed;
 * the beam is limited to 50 steps and outputs 12 significant digits. */
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {readFile,readdir,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import path from 'node:path'

const repo=process.argv[2],output=process.argv[3]||'small-reference.json'
if(!repo)throw Error('Specify the DDG_Tutorial checkout')
const commit=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const octaveDir=path.dirname(require.resolve('@liudonghua123/octave-wasm'))
const html=`<!doctype html><script src="/octave.js"></script><script>window.logs=[];OCTAVE({print:x=>window.logs.push(String(x)),printErr:x=>window.logs.push(String(x))}).then(m=>{window.m=m;m.execute_interp();m.eval_string("fprintf('OCTAVE_VERSION=%s\\\\n',version);");window.ready=true}).catch(e=>{window.error=String(e);window.ready=true})</script>`
const server=createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname
  if(name==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);return}
  if(!['/octave.js','/octave.data','/octave.wasm'].includes(name)){res.writeHead(404);res.end();return}
  try{const data=await readFile(path.join(octaveDir,name.slice(1)));res.writeHead(200,{'content-type':name.endsWith('.wasm')?'application/wasm':'application/octet-stream'});res.end(data)}catch{res.writeHead(500);res.end()}
})
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve))
let browser
try{
  async function collect(dir,relative=''){
    const out=[]
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const name=relative+entry.name,full=path.join(dir,entry.name)
      if(entry.isDirectory())out.push(...await collect(full,name+'/'))
      else if(/\.(m|txt)$/.test(entry.name))out.push({name,content:await readFile(full,'utf8')})
    }
    return out
  }
  const replace=(s,from,to)=>{if(!s.includes(from))throw Error('Upstream script changed: '+from);return s.replace(from,to)}
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox']})
  const run=async(kind)=>{
    const dir=kind==='beam'?'2d_curve/case_1':`mass_spring_system/${kind==='single'?'single_DOF':'multiple_DOF'}`
    const files=await collect(path.join(repo,dir))
    for(const file of files){
      if(file.name==='main.m'){
        file.content=file.content.replace('close all;','').replace('clc;','')
        if(kind==='beam'){
          file.content=replace(file.content,'simParams = defSimParams();','simParams = defSimParams(); simParams.Nsteps = 50; simParams.plotStep = 100000;')
          file.content=file.content.replace("fprintf('t=%f\\n', ctime);",'').replaceAll('%.4f','%.12g')
        }else{
          const plot=file.content.indexOf('% plot result');if(plot<0)throw Error('Original plot marker changed')
          const vector=kind==='single'?"[t; x'; u']":'[t; x(2,:); x(3,:); x(4,:); u(2,:); u(3,:); u(4,:)]'
          const format=Array(kind==='single'?3:7).fill('%.12g').join(' ')+'\\n'
          file.content=file.content.slice(0,plot)+`\nfid=fopen('result.txt','w'); fprintf(fid,'${format}', ${vector}); fclose(fid);\n`
        }
      }else if(kind==='beam'&&file.name==='objfun.m')file.content=replace(file.content,"fprintf('Iter=%d, error=%e\\n', iter-1, normfNew);",'')
      else if(kind==='beam'&&file.name==='plotBeam.m')file.content='function plotBeam(varargin)\nend\n'
    }
    const page=await browser.newPage()
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'load'})
      await page.waitForFunction(()=>window.ready,{timeout:120000})
      const result=await page.evaluate(({files,kind})=>{
        if(window.error)throw Error(window.error)
        const m=window.m;m.FS.mkdir('/reference')
        for(const f of files){const parts=f.name.split('/');let d='/reference';for(const part of parts.slice(0,-1)){d+='/'+part;try{m.FS.mkdir(d)}catch{}}m.FS.writeFile('/reference/'+f.name,f.content)}
        m.eval_string("cd('/reference'); main;")
        try{return {text:m.FS.readFile('/reference/'+(kind==='beam'?'data.txt':'result.txt'),{encoding:'utf8'}),version:window.logs.find(x=>x.startsWith('OCTAVE_VERSION='))}}
        catch(e){throw Error('Missing output: '+e+'; '+window.logs.slice(-10).join(' | '))}
      },{files,kind})
      const rows=result.text.trim().split(/\r?\n/).filter(Boolean).map(line=>line.trim().split(/\s+/).map(Number))
      const expected=kind==='beam'?2000:1000,columns=kind==='single'?3:kind==='multiple'?7:3
      if(rows.length!==expected||rows.some(r=>r.length!==columns||r.some(v=>!Number.isFinite(v))))throw Error(`${kind}: invalid output`)
      const samples=kind==='beam'
        ?rows.flatMap((r,i)=>i%40===39?[{step:Math.floor(i/40)+1,time_label:r[0],tip_y:r[2]}]:[])
        :rows.flatMap((r,i)=>i%10===0||i===rows.length-1?[{step:i,time_label:r[0],positions:r.slice(1,kind==='single'?2:4)}]:[])
      console.log(`${kind}: ${rows.length} rows, ${samples.length} saved samples`)
      return {samples,runner:`GNU Octave ${result.version?.split('=')[1]?.trim()||'unknown'} WebAssembly`}
    }finally{await page.close()}
  }
  const single=await run('single'),multiple=await run('multiple'),beam=await run('beam')
  await writeFile(output,JSON.stringify({metadata:{reference_commit:commit,runner:single.runner,modifications:'Original time labels and 999 mass integration steps; beam limited to 50 steps. Plotting/logging removed and output printed to 12 significant digits.'},single:single.samples,multiple:multiple.samples,beam:beam.samples},null,2)+'\n')
  console.log(`Wrote ${output}`)
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
