/** Record a deformed element's original MATLAB force/Jacobian in Octave WASM.
 * Usage: node scripts/generate-axis-shell-element-reference.mjs /path/to/DDG_Tutorial [output.json]
 */
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
const repo=process.argv[2],output=process.argv[3]||'src/data/references/axis-shell-element-reference.json'
if(!repo)throw Error('Specify the DDG_Tutorial checkout')
const commit=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const octaveDir=path.dirname(require.resolve('@liudonghua123/octave-wasm'))
const html=`<!doctype html><html><script src="/octave.js"></script><script>window.logs=[];OCTAVE({print:x=>window.logs.push(String(x)),printErr:x=>window.logs.push(String(x))}).then(m=>{window.m=m;m.execute_interp();m.eval_string("fprintf('OCTAVE_VERSION=%s\\\\n',version);");window.ready=true}).catch(e=>{window.error=String(e);window.ready=true})</script></html>`
const server=createServer(async(req,res)=>{const name=new URL(req.url,'http://localhost').pathname;if(name==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);return}if(!['/octave.js','/octave.data','/octave.wasm'].includes(name)){res.writeHead(404);res.end();return}try{const content=await readFile(path.join(octaveDir,name.slice(1)));res.writeHead(200,{'content-type':name.endsWith('.wasm')?'application/wasm':'application/octet-stream'});res.end(content)}catch{res.writeHead(500);res.end()}})
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve))
let browser
try{
 const files=await Promise.all(['bendingForce.m','stretchingForce.m'].map(async name=>({name,content:await readFile(path.join(repo,'2d_surface/case_1',name),'utf8')})))
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox']})
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'load'});await page.waitForFunction(()=>window.ready,{timeout:120000})
 const result=await page.evaluate(({files})=>{
   if(window.error)throw Error(window.error)
   const m=window.m;m.FS.mkdir('/fixture');for(const f of files)m.FS.writeFile('/fixture/'+f.name,f.content)
   m.eval_string("cd('/fixture'); a=[0.20;0.03]; b=[0.23;0.045]; c=[0.258;0.051]; [F,J]=bendingForce(a,b,c,0.3,0.7,0.031,0.23,0.8,0.5); fid=fopen('bend.txt','w'); fprintf(fid,'%.16g\\n',F); fprintf(fid,'%.16g\\n',J'); fclose(fid); [Fs,Js]=stretchingForce(a,b,0.031,0.215,300,0.5); fid=fopen('stretch.txt','w'); fprintf(fid,'%.16g\\n',Fs); fprintf(fid,'%.16g\\n',Js'); fclose(fid);")
   return {bend:m.FS.readFile('/fixture/bend.txt',{encoding:'utf8'}),stretch:m.FS.readFile('/fixture/stretch.txt',{encoding:'utf8'}),version:window.logs.find(x=>x.startsWith('OCTAVE_VERSION='))}
 },{files})
 const parse=(text,n)=>{const values=text.trim().split(/\s+/).map(Number);if(values.length!==n+n*n||values.some(v=>!Number.isFinite(v)))throw Error('Invalid fixture output');return {gradient:values.slice(0,n),hessian:Array.from({length:n},(_,i)=>values.slice(n+i*n,n+(i+1)*n))}}
 const data={metadata:{reference_repository:'https://github.com/weicheng-huang-mechanics/DDG_Tutorial',reference_commit:commit,runner:`GNU Octave ${result.version?.split('=')[1]?.trim()||'unknown'} WebAssembly`,case:'2d_surface/case_1',description:'Original stretchingForce and bendingForce at an arbitrary deformed element. Source returns energy gradient and Hessian, not signed global internal force.'},points:[[.2,.03],[.23,.045],[.258,.051]],stretch:{l0:.031,r0:.215,ea:300,nu:.5,...parse(result.stretch,4)},bend:{l0:.031,r0:.23,ei:.8,nu:.5,k10:.3,k20:.7,...parse(result.bend,6)}}
 await writeFile(output,JSON.stringify(data,null,2)+'\n');console.log(`Wrote ${output}`)
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
