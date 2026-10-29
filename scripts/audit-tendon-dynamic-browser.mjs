import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),pkg=process.env.CHROME_BIN?null:require('@sparticuz/chromium'),bundle=pkg?.default||pkg
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173',executablePath=process.env.CHROME_BIN||await bundle.executablePath()
const launch=()=>chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]).filter(x=>x!=='--single-process'),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const errors=[],assert=(x,m)=>{if(!x)throw Error(m)},attach=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})}
function inspectGif(buf){assert(['GIF89a','GIF87a'].includes(buf.subarray(0,6).toString()),'Invalid GIF');let i=13,frames=0,hashes=[],packed=buf[10];if(packed&128)i+=3*(1<<((packed&7)+1));while(i<buf.length){const b=buf[i++];if(b===0x3b)break;if(b===0x21){i++;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}}else if(b===0x2c){const p=buf[i+8];i+=9;if(p&128)i+=3*(1<<((p&7)+1));i++;const start=i;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}hashes.push(createHash('sha256').update(buf.subarray(start,i)).digest('hex'));frames++}else throw Error(`Invalid GIF block ${b}`)}return {width:buf.readUInt16LE(6),height:buf.readUInt16LE(8),frames,uniqueFrames:new Set(hashes).size,bytes:buf.length}}
let browser=await launch(),mobile
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});attach(page)
  await page.goto(`${base}/?page=tendon3d`,{waitUntil:'domcontentloaded'});await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000});await page.waitForTimeout(500)
  assert(await page.getByText('这是单坐标/指的双向降阶模型，不是完整自由度 Q1 动态耦合。').isVisible(),'Scope warning missing')
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Desktop overflow')
  const shapes={}
  for(const id of ['egg','screwdriver','bottle-cap','cloth']){
    await page.getByTestId(`tendon-preset-${id}`).click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000});await page.waitForTimeout(250);shapes[id]=createHash('sha256').update(await page.locator('[data-testid="tendon-viewport"] canvas').evaluate(c=>c.toDataURL())).digest('hex')
  }
  assert(new Set(Object.values(shapes)).size===4,'Object shapes should differ')
  await page.getByTestId('tendon-preset-egg').click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000});await page.waitForTimeout(300)
  await page.getByTestId('tendon-load-recording').click();await page.getByTestId('tendon-recording-note').waitFor({timeout:90000});await page.waitForTimeout(500)
  assert((await page.getByTestId('tendon-fixture').innerText()).includes('已释放'),'Recorded fixture did not release')
  assert((await page.getByTestId('tendon-contacts').innerText()).includes('4'),'Recorded finger contacts missing');assert(parseFloat(await page.getByTestId('tendon-rise').innerText())>50,'Recorded object did not lift')
  assert((await page.getByTestId('tendon-result').innerText()).includes('不等价于全自由度'),'Missing result scope warning')
  await mkdir('docs/screenshots',{recursive:true});await page.screenshot({path:'docs/screenshots/79-tendon-dynamic-egg.jpg',type:'jpeg',quality:85})
  const pending=page.waitForEvent('download',{timeout:90000});await page.getByTestId('tendon-gif').click();const download=await pending,buf=await readFile(await download.path()),gif=inspectGif(buf);assert(gif.frames===12&&gif.uniqueFrames>=10,'Sampled recording GIF is not animated');await mkdir('docs/media',{recursive:true});await writeFile('docs/media/tendon-dynamic-egg.gif',buf)
  const csvPending=page.waitForEvent('download');await page.getByTestId('tendon-csv').click();const csvDownload=await csvPending,csv=await readFile(await csvDownload.path(),'utf8');assert(csv.includes('pull_thumb_m')&&csv.trim().split('\n').length===13,'CSV missing sampled dynamic states')
  await page.getByTestId('tendon-seek').fill('0');assert((await page.getByTestId('tendon-time').innerText()).startsWith('0.000'),'Seek failed');assert((await page.getByTestId('tendon-fixture').innerText()).includes('启用'),'Initial fixture missing')
  await page.getByTestId('tendon-preset-screwdriver').click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000});await page.getByTestId('tendon-load-recording').click();await page.getByTestId('tendon-recording-note').waitFor({timeout:90000});await page.waitForTimeout(400)
  assert((await page.getByTestId('tendon-contacts').innerText()).includes('3'),'Recorded screwdriver finger contacts missing');assert(parseFloat(await page.getByTestId('tendon-rise').innerText())>46,'Recorded screwdriver did not lift');assert((await page.getByTestId('tendon-fixture').innerText()).includes('已释放'),'Screwdriver fixture still on')
  await page.screenshot({path:'docs/screenshots/81-tendon-dynamic-screwdriver.jpg',type:'jpeg',quality:85})
  const screwPending=page.waitForEvent('download',{timeout:90000});await page.getByTestId('tendon-gif').click();const screwDownload=await screwPending,screwBuf=await readFile(await screwDownload.path()),screwGif=inspectGif(screwBuf);assert(screwGif.frames===12&&screwGif.uniqueFrames>=10,'Screwdriver sampled GIF not animated');await writeFile('docs/media/tendon-dynamic-screwdriver.gif',screwBuf)
  await page.getByTestId('tendon-preset-bottle-cap').click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000});await page.getByTestId('tendon-load-recording').click();await page.getByTestId('tendon-recording-note').waitFor({timeout:90000});await page.waitForTimeout(400)
  assert((await page.getByTestId('tendon-contacts').innerText()).includes('4'),'Recorded cap finger contacts missing');assert(parseFloat(await page.getByTestId('tendon-rise').innerText())>51,'Recorded cap did not lift');assert((await page.getByTestId('tendon-fixture').innerText()).includes('已释放'),'Cap fixture still on')
  await page.screenshot({path:'docs/screenshots/82-tendon-dynamic-cap.jpg',type:'jpeg',quality:85})
  const capPending=page.waitForEvent('download',{timeout:90000});await page.getByTestId('tendon-gif').click();const capDownload=await capPending,capBuf=await readFile(await capDownload.path()),capGif=inspectGif(capBuf);assert(capGif.frames===12&&capGif.uniqueFrames>=10,'Cap sampled GIF not animated');await writeFile('docs/media/tendon-dynamic-cap.gif',capBuf)
  await page.getByTestId('tendon-preset-egg').click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000});await page.getByTestId('tendon-run').click();await page.waitForFunction(()=>Number((document.querySelector('[data-testid="tendon-time"]')?.textContent||'0').split('/')[0])>=.05,null,{timeout:90000});await page.getByLabel('暂停仿真').click();await page.waitForTimeout(500)
  assert((await page.getByTestId('tendon-status').innerText()).includes('暂停'),'Live worker pause missing')
  assert((await page.locator('.grip-equations .katex-error').count())===0,'Formula error')
  await browser.close();browser=null
  mobile=await launch();const mp=await mobile.newPage({viewport:{width:390,height:844}});attach(mp);await mp.goto(`${base}/?page=tendon3d`,{waitUntil:'domcontentloaded'});await mp.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000});await mp.waitForTimeout(300);assert(!(await mp.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Mobile overflow');await mp.screenshot({path:'docs/screenshots/80-tendon-dynamic-mobile.jpg',type:'jpeg',quality:84,fullPage:true});await mp.getByLabel('打开导航').click();assert(await mp.getByTestId('nav-tendon3d').isVisible(),'Mobile nav missing')
  assert(!errors.length,errors.join(' | '))
  const files=['src/App.tsx','src/navigation.ts','src/styles.css','src/engine/tendon-dynamic-grasp.ts','src/engine/tendon-dynamic-certification.ts','src/engine/tendon-dynamic.worker.ts','src/components/TendonDynamicViewport.tsx','src/components/TendonDynamicLab.tsx','src/components/gripper.css','src/components/gripper3d.css','src/components/bionic-hand.css','src/components/multi-object.css','src/components/material-grasp.css','src/components/tendon-dynamic.css','src/data/tendon-grasp-manifold.json','src/data/tendon-egg-recording.json','src/data/tendon-screwdriver-recording.json','src/data/tendon-cap-recording.json','scripts/audit-tendon-dynamic-browser.mjs'],hash=createHash('sha256');for(const f of files)hash.update(f).update(await readFile(f))
  const report={sourceHash:hash.digest('hex'),sourceFiles:files,shapes,gif,screwGif,capGif,csvRows:csv.trim().split('\n').length,errors,scope:'Browser rendering, sampled recording playback/export and a short live worker test only; not full-DOF or physical grasp certification.'};await writeFile('docs/screenshots/tendon-dynamic-browser-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{if(browser)await browser.close();if(mobile)await mobile.close()}
