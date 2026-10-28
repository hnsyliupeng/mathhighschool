// End-to-end terminal-state screenshots for every UI case; not a reference test.
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {waitForVisibleGeometry} from './audit-canvas.mjs'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const ids=['mass-single','mass-multi','beam-gravity','beam-buckling','beam-snap','rod-helix','rod-bifurcation','rod-growth','axis-inflate','axis-snap','plate-gravity','plate-wrinkle','shell-indent','net-gravity','net-form','lattice-gravity','hyper-cable','hyper-membrane','robot-magnetic','robot-swim','robot-crawl']
const out='docs/screenshots/end-cases',crops=process.env.AUDIT_END_CROP_DIR||'/tmp/ddg-end-crops',base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173'
await mkdir(out,{recursive:true});await mkdir(crops,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),errors=[],reports=[]
page.on('pageerror',e=>errors.push(String(e)))
try{
 for(let i=0;i<ids.length;i++){
   const id=ids[i];await page.goto(`${base}/?page=workspace&case=${id}`,{waitUntil:'networkidle'})
   const duration=parseFloat(await page.locator('.time-end').innerText())
   await page.getByTitle('切换播放速度').click() // 2x; integration time step remains unchanged.
   await page.waitForFunction(target=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=target-1e-9||!!document.querySelector('.solver-warning'),duration,{timeout:360000})
   const time=parseFloat(await page.getByTestId('time-value').innerText()),warning=await page.locator('.solver-warning').count()
   if(warning||Math.abs(time-duration)>1e-8)throw Error(`${id}: did not reach terminal time ${duration}; reached ${time}, warning=${warning}`)
   if(!(await page.getByTestId('play-pause').isDisabled())||!(await page.getByLabel('单步前进').isDisabled()))throw Error(`${id}: terminal controls remain enabled`)
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),metric=await page.locator('.chart-meta strong').innerText()
   if(overflow||!Number.isFinite(parseFloat(metric)))throw Error(`${id}: overflow or invalid displacement: ${metric}`)
   await waitForVisibleGeometry(page)
   const file=`${String(i+1).padStart(2,'0')}-${id}.jpg`
   await page.screenshot({path:`${out}/${file}`,type:'jpeg',quality:78,fullPage:true})
   await page.locator('.viewport-shell').screenshot({path:`${crops}/${file}`,type:'jpeg',quality:88})
   reports.push({id,time,duration,metric,screenshot:file,warning:false,overflow:false})
   console.log(`${i+1}/21 PASS ${id} ${time.toFixed(2)} s`)
 }
 if(errors.length)throw Error('Browser page errors: '+errors.join(' | '))
 await writeFile(`${out}/audit.json`,JSON.stringify({date:new Date().toISOString().slice(0,10),browserVersion:browser.version(),viewport:'1440×1000',reports,errors,scope:'Terminal-time browser playback, finite displayed displacement, nonblank WebGL, controls, overflow and screenshots; not reference accuracy or physical validity.'},null,2)+'\n')
 console.log('PASS: 21 terminal browser states and screenshots')
}finally{await browser.close()}
