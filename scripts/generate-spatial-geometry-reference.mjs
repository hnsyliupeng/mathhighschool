/** Record three local spatial-rod frames using the original MATLAB initializer in Octave WASM.
 * Usage: node scripts/generate-spatial-geometry-reference.mjs /path/to/DDG_Tutorial [output.json]
 * This is a local geometry and angle-gradient fixture, not a rod trajectory or full force/Jacobian validation. */
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {readFile,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
const repo=process.argv[2],output=process.argv[3]||'src/data/references/spatial-rod-geometry-reference.json'
if(!repo)throw Error('Specify the DDG_Tutorial checkout')
const commit=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const octaveDir=path.dirname(require.resolve('@liudonghua123/octave-wasm'))
const html=`<!doctype html><script src="/octave.js"></script><script>window.logs=[];OCTAVE({print:x=>window.logs.push(String(x)),printErr:x=>window.logs.push(String(x))}).then(m=>{window.m=m;m.execute_interp();m.eval_string("fprintf('OCTAVE_VERSION=%s\\\\n',version);");window.ready=true}).catch(e=>{window.error=String(e);window.ready=true})</script>`
const server=createServer(async(req,res)=>{const n=new URL(req.url,'http://localhost').pathname;if(n==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);return}if(!['/octave.js','/octave.data','/octave.wasm'].includes(n)){res.writeHead(404);res.end();return}try{res.writeHead(200,{'content-type':n.endsWith('.wasm')?'application/wasm':'application/octet-stream'});res.end(await readFile(path.join(octaveDir,n.slice(1))))}catch{res.writeHead(500);res.end()}})
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve))
let browser
try{
 const names=['InitialBendingElement.m','InitialStretchingElement.m','getVertex.m','parallel_transport.m','bendingForce.m','twistingForce.m','crossMat.m']
 const files=await Promise.all(names.map(async name=>({name,content:await readFile(path.join(repo,'3d_curve/case_1',name),'utf8')})))
 const cases=[
  {name:'oblique',points:[[-1.2,-.2,.3],[0,.1,0],[.8,.7,.4]],theta:[.3,-.4],referenceTwist:.15,restTwist:.2,restKappa:[.1,-.2],restVoronoi:1.2,bendingStiffness:2.4,torsionalStiffness:1.3},
  {name:'vertical-fallback',points:[[0,0,-1],[0,0,0],[.5,.4,.8]],theta:[-.2,.6],referenceTwist:-.1,restTwist:0,restKappa:[0,0],restVoronoi:.9,bendingStiffness:.8,torsionalStiffness:.5},
  {name:'straight',points:[[-1,0,0],[0,0,0],[1,0,0]],theta:[.2,.4],referenceTwist:0,restTwist:.1,restKappa:[.05,.03],restVoronoi:1,bendingStiffness:1,torsionalStiffness:2}
 ]
 const vec=a=>'['+a.map(x=>Number(x).toPrecision(17)).join(';')+']'
 const codes=cases.map((c,i)=>{
   const p=c.points.map(vec)
   return `clear rod s b; p0=${p[0]}; p1=${p[1]}; p2=${p[2]}; rod.x=[p0;p1;p2;0;0]; rod.nv=3; rod.ne=2; rod.nb=1; rod.EA=1; rod.EI=${c.bendingStiffness}; rod.GJ=${c.torsionalStiffness}; s=InitialStretchingElement(rod,[1 2;2 3]); b=InitialBendingElement(rod,[1 2],s); a=${c.theta[0]}; z=${c.theta[1]}; m1e=cos(a)*b.d_11+sin(a)*b.d_12; m2e=-sin(a)*b.d_11+cos(a)*b.d_12; m1f=cos(z)*b.d_21+sin(z)*b.d_22; m2f=-sin(z)*b.d_21+cos(z)*b.d_22; kb=2*cross(b.t_1,b.t_2)/(1+dot(b.t_1,b.t_2)); k1=.5*dot(kb,m2e+m2f); k2=-.5*dot(kb,m1e+m1f); tw=z-a+(${c.referenceTwist}); eb=${c.bendingStiffness}/(2*${c.restVoronoi})*((k1-(${c.restKappa[0]}))^2+(k2-(${c.restKappa[1]}))^2); et=${c.torsionalStiffness}/(2*${c.restVoronoi})*(tw-(${c.restTwist}))^2; [fb,jb]=bendingForce(p0',p1',p2',m1e',m2e',m1f',m2f',[${c.restKappa[0]} ${c.restKappa[1]}],${c.restVoronoi},${c.bendingStiffness},1,1); [ft,jt]=twistingForce(p0',p1',p2',a,z,(${c.referenceTwist})-(${c.restTwist}),${c.restVoronoi},${c.torsionalStiffness},1,1); fid=fopen('out${i}.txt','w'); fprintf(fid,'%.16g\\n',[b.t_1;b.t_2;b.d_11;b.d_12;b.d_21;b.d_22;m1e;m2e;m1f;m2f;kb;k1;k2;tw;eb;et;fb(4);fb(8);ft(4);ft(8)]); fclose(fid);`
 })
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox']})
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'load'});await page.waitForFunction(()=>window.ready,{timeout:120000})
 const data=await page.evaluate(({files,codes})=>{
   if(window.error)throw Error(window.error)
   const m=window.m;m.FS.mkdir('/fixture');for(const f of files)m.FS.writeFile('/fixture/'+f.name,f.content);m.eval_string("cd('/fixture');")
   const outputs=codes.map((code,i)=>{m.eval_string(code);try{return m.FS.readFile(`/fixture/out${i}.txt`,{encoding:'utf8'})}catch(e){throw Error(String(e)+' '+window.logs.slice(-8).join(' | '))}})
   return {outputs,version:window.logs.find(x=>x.startsWith('OCTAVE_VERSION='))}
 },{files,codes})
 const keys=['te','tf','d1e','d2e','d1f','d2f','m1e','m2e','m1f','m2f','kb']
 const fixtures=cases.map((input,i)=>{const v=data.outputs[i].trim().split(/\s+/).map(Number);if(v.length!==42||v.some(x=>!Number.isFinite(x)))throw Error(`Invalid fixture ${input.name}: ${v.length} values`);let k=0,expected={};for(const key of keys){expected[key]=v.slice(k,k+3);k+=3}expected.kappa=v.slice(k,k+2);k+=2;expected.twist=v[k++];expected.bendingEnergy=v[k++];expected.twistingEnergy=v[k++];expected.bendingGradient=v.slice(k,k+2);k+=2;expected.twistingGradient=v.slice(k,k+2);return {input,expected}})
 const report={metadata:{reference_repository:'https://github.com/weicheng-huang-mechanics/DDG_Tutorial',reference_commit:commit,runner:`GNU Octave ${data.version?.split('=')[1]?.trim()||'unknown'} WebAssembly`,scope:'Original InitialStretchingElement/InitialBendingElement and parallel_transport evaluated on three prescribed local geometries. Material rotations and scalar energies follow the source equations; the two material-angle energy gradients are extracted from bendingForce/twistingForce. No rod trajectory, translational-force or Hessian validation, or evolving reference twist.'},fixtures}
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(`Wrote ${output}: ${fixtures.length} local frames`)
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
