import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),pkg=process.env.CHROME_BIN?null:require('@sparticuz/chromium'),bundle=pkg?.default||pkg
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]).filter(x=>x!=='--single-process'),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const errors=[],workers=[],workerUrls=[],assert=(ok,message)=>{if(!ok)throw Error(message)}
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('worker',w=>{if(/material-grasp3d\.worker-.*\.js/.test(w.url()))workerUrls.push(w.url())})
  await page.goto(`${process.env.AUDIT_BASE_URL||'http://127.0.0.1:4174'}/?page=materials3d`,{waitUntil:'domcontentloaded'});await page.locator('[data-testid="material-viewport"] canvas').waitFor({timeout:90000})
  assert((await page.getByTestId('material-object-name').innerText())==='鸡蛋','production preset incorrect')
  assert((await page.locator('[data-testid="material-audit"] tbody tr').count())===3,'three scale records missing')
  assert((await page.locator('.material-convergence span').count())===3,'convergence comparisons missing')
  await page.getByTestId('material-run').click();await page.waitForFunction(()=>/短时数值保持|子步失败|未满足保持条件/.test(document.querySelector('[data-testid="material-status"]')?.textContent||''),null,{timeout:240000})
  const status=(await page.getByTestId('material-status').innerText()).trim(),rise=Number((await page.getByTestId('material-rise').innerText()).replace(/[^\d.-]/g,''))
  assert(status==='短时数值保持'&&rise>50,`production trajectory failed: ${status}, ${rise}`)
  for(const url of workerUrls){const response=await page.request.get(url);workers.push({url,status:response.status(),contentType:response.headers()['content-type']||''})}
  assert(workers.some(w=>w.status===200&&/javascript/.test(w.contentType)),`Worker MIME/status failure: ${JSON.stringify(workers)}`)
  assert(!errors.length,`Browser errors: ${errors.join(' | ')}`)
  const browserReport=JSON.parse(await readFile('docs/screenshots/material-grasp-browser-audit.json','utf8')),hash=createHash('sha256');for(const f of browserReport.sourceFiles)hash.update(f).update(await readFile(f))
  assert(hash.digest('hex')===browserReport.sourceHash,'stale browser report')
  const report={status:'passed',sourceHash:browserReport.sourceHash,productionWorker:workers,trajectory:'egg, 100%, 1/240 s, 40 iterations',riseMm:rise,errors,scope:'Production build worker and one reduced-model trajectory only; no physical or tendon-hand certification.'}
  await writeFile('docs/screenshots/material-grasp-production-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{await browser.close()}
