/**
 * Re-run the original hyperelastic planar cable MATLAB script in Octave 7.2 WASM, with
 * plotting/logging removed and recorded output made precise. Optional dev tools
 * (playwright-core, @sparticuz/chromium or CHROME_BIN, octave-wasm) live outside
 * the app and are not shipped. See README for reproducibility instructions.
 */
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { makeHyperReference } from './hyper-reference-io.mjs'

const [repoArg,...args]=process.argv.slice(2)
if(!repoArg||repoArg.startsWith('--'))throw Error('Usage: node scripts/generate-hyper-reference.mjs /path/to/DDG_Tutorial [--output file] [--steps 1000]')
const get=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]}
const repo=path.resolve(repoArg),output=path.resolve(get('--output','src/data/references/hyper-reference.json'))
const steps=Number(get('--steps','1000'))
if(!Number.isInteger(steps)||steps<1)throw Error('Step count must be a positive integer')
const commit=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core')
const bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
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
const address=server.address(),base=`http://127.0.0.1:${address.port}`
let browser
try{
  browser=await chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox']})
  // Reuse the page: some single-process Chromium builds terminate with their last page.
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
  const replace=(text,from,to)=>{if(!text.includes(from))throw Error('Reference script changed: '+from);return text.replace(from,to)}
  async function run(steps){
    const files=await collect(path.join(repo,'hyper_elastic','case_1'))
    for(const file of files){
      if(file.name==='main.m'){
        file.content=file.content.replace('close all;','').replace('clc;','')
        file.content=replace(file.content,'simParams = defSimParams();',`simParams = defSimParams(); simParams.Nsteps = ${steps}; simParams.plotStep = 100000;`)
        file.content=file.content.replace("fprintf('t=%f\\n', ctime);",'').replaceAll('%.4f','%.12g')
        // The original ends with a figure after closing its output file.
        const figure=file.content.indexOf('figure(2)');if(figure<0)throw Error('Reference end plot changed')
        file.content=file.content.slice(0,figure)
      }else if(file.name==='objfun.m'){
        file.content=replace(file.content,"fprintf('Iter=%d, error=%e\\n', iter-1, normfNew);",'')
        file.content=replace(file.content,'if (iter>maximum_iter)',"if (iter>maximum_iter)\n        fprintf('REFERENCE_MAX_ITER norm=%e\\n', normfNew);")
      }else if(file.name==='plotBeam.m')file.content='function plotBeam(varargin)\nend\n'
    }
    {
      await page.goto(base,{waitUntil:'load'});await page.waitForFunction(()=>window.ready,{timeout:120000})
      console.log(`Running hyperelastic cable: ${steps} steps (this can take several minutes)...`)
      const result=await page.evaluate(({files})=>{
        if(window.error)throw Error(window.error)
        const m=window.m;m.FS.mkdir('/reference')
        for(const file of files){const parts=file.name.split('/');let dir='/reference';for(const part of parts.slice(0,-1)){dir+='/'+part;try{m.FS.mkdir(dir)}catch{}}m.FS.writeFile('/reference/'+file.name,file.content)}
        m.eval_string("cd('/reference'); main;")
        let text;try{text=m.FS.readFile('/reference/data.txt',{encoding:'utf8'})}catch(e){throw Error('Missing output: '+e+'; '+window.octaveLogs.slice(-10).join(' | '))}
        return {text,version:window.octaveLogs.find(x=>x.startsWith('OCTAVE_VERSION=')),warnings:window.octaveLogs.filter(x=>x.includes('REFERENCE_MAX_ITER'))}
      },{files})
      console.log(`Cable: ${result.text.length} bytes, ${result.warnings.length} maximum-iteration exits`)
      return result
    }
  }
  const cable=await run(steps)
  const version=cable.version?.split('=')[1]?.trim()||'unknown'
  const data=makeHyperReference({raw:cable.text,steps,commit,runner:`GNU Octave ${version} WebAssembly`,warnings:cable.warnings})
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(data,null,2)+'\n')
  console.log('Wrote',output,'from reference commit',commit)
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
