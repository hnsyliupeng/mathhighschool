import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const errors=[],workers=[],assert=(ok,message)=>{if(!ok)throw Error(message)}
try{
  const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(/object-hand3d\.worker-.*\.js/.test(r.url()))workers.push({status:r.status(),contentType:r.headers()['content-type']||''})})
  await page.goto(`${process.env.AUDIT_BASE_URL||'http://127.0.0.1:4174'}/?page=objects3d`,{waitUntil:'domcontentloaded'});await page.locator('.gripper-three canvas').waitFor({timeout:90000})
  const pause=page.getByLabel('暂停');if(await pause.isVisible())await pause.click()
  for(const name of ['拇指','食指','中指','无名指','小指'])await page.getByLabel(`${name}目标牵引`).fill('0')
  await page.getByTestId('object-preset').selectOption('capsule');await page.getByTestId('object-apply').click()
  await page.waitForFunction(()=>document.querySelector('[data-testid="object-name"]')?.textContent==='胶囊棒'&&/已到达目标|增量失败/.test(document.querySelector('.grip-stage-status')?.textContent||''),null,{timeout:90000})
  assert((await page.locator('.grip-stage-status').innerText()).trim()==='已到达目标','Production initialization failed')
  assert((await page.getByTestId('object-dimensions').innerText()).includes('90.0 × 60.0 × 60.0'),'Wrong production shape size')
  assert((await page.locator('.object-review-scroll tbody tr').count())===6,'Comparison table missing')
  const backend=await page.locator('.grip-backend').innerText();assert(backend.includes('后台工作线程'),'Worker did not run')
  assert(workers.some(w=>w.status===200&&/javascript/.test(w.contentType)),`Worker MIME/status failure: ${JSON.stringify(workers)}`)
  assert(!errors.length,`Browser errors: ${errors.join(' | ')}`)
  const browserReport=JSON.parse(await readFile('docs/screenshots/multi-object-browser-audit.json','utf8')),hash=createHash('sha256');for(const f of browserReport.sourceFiles)hash.update(f).update(await readFile(f))
  assert(hash.digest('hex')===browserReport.codeHash,'Stale UI sources')
  const report={sourceHash:browserReport.codeHash,status:'passed',productionWorker:workers,backend,object:'capsule',normalizedPullMm:0,comparisonRows:6,errors,scope:'Production build initial state and worker/shape switch only; not a loaded-path or free-grasp validation.'}
  await writeFile('docs/screenshots/multi-object-production-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{await browser.close()}
