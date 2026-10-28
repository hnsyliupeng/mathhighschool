/** Browser interaction and loaded-state capture for the Mooney–Rivlin cable. */
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {waitForVisibleGeometry} from './audit-canvas.mjs'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173',errors=[]
page.on('pageerror',e=>errors.push(String(e)))
const assert=(v,m)=>{if(!v)throw Error(m)}
const time=async()=>parseFloat(await page.getByTestId('time-value').innerText())
const displacement=async()=>parseFloat((await page.locator('.chart-meta strong').innerText()).replace(/\s/g,''))
try {
 await mkdir('docs/screenshots',{recursive:true})
 await page.goto(`${base}/?page=workspace&case=hyper-cable`,{waitUntil:'networkidle'})
 await page.getByLabel('离散节点').waitFor()
 assert((await page.locator('.viewport-top-left').innerText()).includes('40 NODES'),'Cable should default to 40 nodes')
 assert((await page.locator('.parameter-panel').innerText()).includes('逐节点力'),'Force-ramp note missing')
 await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=.99,null,{timeout:90000})
 // At the end the player can already be paused; avoid restarting it.
 const play=page.getByTestId('play-pause')
 await page.waitForFunction(()=>document.querySelector('[data-testid="play-pause"]')?.disabled,null,{timeout:10000})
 const loadedTime=await time(),loadedY=await displacement()
 assert(loadedTime>=.9&&loadedY<-.4,'Cable did not deform under the force ramp')
 assert((await page.getByTestId('loading-phase').innerText()).includes('节点力'),'Loading phase is absent')
 assert(await page.locator('.solver-warning').count()===0,'Cable solver did not converge')
 await waitForVisibleGeometry(page)
 await page.screenshot({path:'docs/screenshots/30-hyper-cable-loaded.jpg',type:'jpeg',quality:80,fullPage:true})
 // Rewind a recorded state and confirm replay returns to the expected endpoint.
 const slider=page.getByLabel('回看已记录的仿真时间')
 await slider.evaluate(el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'50');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))})
 await page.waitForTimeout(100);assert((await time())<.52,'Rewind failed')
 await play.click();await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=.99,null,{timeout:90000})
 const replayY=await displacement();assert(Math.abs(replayY+.631623)<.02,'Replay deviates from full baseline')
 // Applying a changed grid must rebuild the scene and keep the solver finite.
 await page.getByLabel('离散节点').fill('24');await page.getByTestId('apply-params').click()
 await page.waitForFunction(()=>document.querySelector('.viewport-top-left')?.textContent?.includes('24 NODES'))
 assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
 const report={date:new Date().toISOString().slice(0,10),loadedTime,loadedY,replayY,nodeChange:24,screenshot:'30-hyper-cable-loaded.jpg',browserErrors:errors,scope:'Visual and interaction checks; numerical reference agreement is documented separately.'}
 await writeFile('docs/screenshots/hyper-audit.json',JSON.stringify(report,null,2)+'\n')
 console.log('PASS hyperelastic cable browser audit:',JSON.stringify(report))
}finally{await browser.close()}
