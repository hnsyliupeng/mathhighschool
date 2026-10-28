/** Browser review of the two prescribed-boundary planar beam cases. */
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {waitForVisibleGeometry} from './audit-canvas.mjs'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173',errors=[]
page.on('pageerror',e=>errors.push(String(e)))
const assert=(value,message)=>{if(!value)throw Error(message)}
const time=async()=>parseFloat(await page.getByTestId('time-value').innerText())
const waitTime=t=>page.waitForFunction(t=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=t,t,{timeout:120000})
const displacement=async()=>parseFloat((await page.locator('.chart-meta strong').innerText()).replace(/\s/g,''))
try{
 await mkdir('docs/screenshots',{recursive:true})
 await page.goto(`${base}/?page=workspace&case=beam-buckling`,{waitUntil:'networkidle'})
 await page.getByLabel('离散节点').waitFor();assert((await page.locator('.viewport-top-left').innerText()).includes('40 NODES'),'Buckling node count')
 assert((await page.locator('.panel-bottom-note').innerText()).includes('准静态'),'Quasi-static label missing')
 await waitTime(2);await page.getByTestId('play-pause').click()
 assert((await page.getByTestId('loading-phase').innerText()).includes('右端压缩'),'Buckling phase missing')
 assert(await displacement()>.1,'Buckling center did not deflect')
 assert(await page.locator('.solver-warning').count()===0,'Buckling solver did not converge')
 await waitForVisibleGeometry(page)
 await page.screenshot({path:'docs/screenshots/27-buckling-loaded.jpg',type:'jpeg',quality:80,fullPage:true})
 const bucketTime=await time()
 await page.goto(`${base}/?page=workspace&case=beam-snap`,{waitUntil:'networkidle'})
 assert((await page.locator('.time-end').innerText()).includes('20.0'),'Snap duration is not 20 s')
 await page.getByTitle('切换播放速度').click() // 2×
 await waitTime(14.3);await page.getByTestId('play-pause').click()
 const beforeTime=await time(),beforeY=await displacement()
 assert(beforeY>.1&&beforeTime<15.2,'Pre-snap state is not above the baseline')
 await waitForVisibleGeometry(page)
 await page.screenshot({path:'docs/screenshots/28-snap-before.jpg',type:'jpeg',quality:80,fullPage:true})
 await page.getByTestId('play-pause').click();await waitTime(16.3);await page.getByTestId('play-pause').click()
 const afterTime=await time(),afterY=await displacement()
 assert(afterY<-.1,'Snap-through did not switch sign')
 assert((await page.getByTestId('loading-phase').innerText()).includes('已翻转'),'Post-snap phase missing')
 assert(await page.locator('.solver-warning').count()===0,'Snap solver did not converge')
 await waitForVisibleGeometry(page)
 await page.screenshot({path:'docs/screenshots/29-snap-after.jpg',type:'jpeg',quality:80,fullPage:true})
 // Restore a pre-transition recorded state and replay across the snap.
 const slider=page.getByLabel('回看已记录的仿真时间')
 await slider.evaluate(el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'1400');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))})
 await page.waitForTimeout(150);assert((await time())<14.1,'Rewind did not restore 14 s')
 await page.getByTestId('play-pause').click();await waitTime(16.3);await page.getByTestId('play-pause').click()
 const replayY=await displacement();assert(replayY<-.1&&Math.abs(replayY-afterY)<.02,'Replayed snap differs from original')
 assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
 const report={date:new Date().toISOString().slice(0,10),buckling:{time:bucketTime,screenshot:'27-buckling-loaded.jpg'},snap:{beforeTime,beforeY,afterTime,afterY,replayY,screenshots:['28-snap-before.jpg','29-snap-after.jpg']},browserErrors:errors,scope:'Visual/interaction checks; numerical reference agreement is recorded separately.'}
 await writeFile('docs/screenshots/planar-audit.json',JSON.stringify(report,null,2)+'\n')
 console.log('PASS planar browser audit:',JSON.stringify(report))
}finally{await browser.close()}
