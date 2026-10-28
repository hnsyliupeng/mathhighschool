// Reproduce a known nonconvergent slider combination and audit safe UI recovery.
// The exact 0.55 s stopping point below is a Chromium 153 regression baseline;
// extreme ill-conditioned paths may differ across engines and require review.
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox']})
const errors=[],assert=(x,message)=>{if(!x)throw Error(message)}
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage()
 page.on('pageerror',error=>errors.push(error.message))
 const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173'
 await page.goto(`${base}/?page=workspace&case=axis-inflate`,{waitUntil:'networkidle'})
 await page.getByLabel('压力路径倍率').fill('2');await page.getByLabel('杨氏模量').fill('0.2');await page.getByLabel('母线节点').fill('24')
 await page.getByTestId('apply-params').click()
 if(await page.getByTestId('play-pause').getAttribute('aria-label')==='暂停')await page.getByTestId('play-pause').click()
 const time=async()=>Number((await page.getByTestId('time-value').innerText()).replace(' s',''))
 // From the paused valid state, take 10 ms single steps up to 0.55 s.
 for(let i=0;i<60&&(await time())<.55;i++){
   assert(await page.locator('.solver-warning').count()===0,'Failed before expected step')
   await page.getByLabel('单步前进').click()
 }
 assert((await time())===.55&&await page.locator('.solver-warning').count()===0,'Expected a valid state at 0.55 s')
 const downloadCsv=async()=>{const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出数据'}).click()]);return await readFile(await d.path(),'utf8')}
 const before=await downloadCsv(),displacement=await page.locator('.chart-meta strong').innerText(),strain=await page.getByTestId('meridional-strain').innerText()
 assert(parseFloat(strain)>10000,'Extreme deformation should be disclosed by the current-strain metric')
 await page.getByLabel('单步前进').click()
 await page.locator('.solver-warning').waitFor({state:'visible'})
 assert((await time())===.55,'A failed single step advanced time')
 assert(await page.getByTestId('play-pause').isDisabled()&&await page.getByLabel('单步前进').isDisabled(),'Playback and single-step must stop on failure')
 assert((await page.locator('.metric-strip').innerText()).includes('失败尝试残差'),'Failure residual must be distinguished from the retained converged state')
 assert(await page.locator('.chart-meta strong').innerText()===displacement&&await page.getByTestId('meridional-strain').innerText()===strain,'A failed step changed the displayed converged configuration or strain')
 const after=await downloadCsv()
 assert(before===after,'A failed step was incorrectly added to response history / CSV')
 await page.locator('.simulation-panel').screenshot({path:'docs/screenshots/43-shell-nonconvergence.jpg',type:'jpeg',quality:84})
 await page.locator('.analysis-panel').screenshot({path:'docs/screenshots/45-shell-extreme-strain.jpg',type:'jpeg',quality:84})
 for(const width of [320,390]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(300)
   const bounds=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {warning:box('.solver-warning'),legend:box('.viewport-legend'),phase:box('.loading-phase'),viewport:box('.viewport-shell'),doc:document.documentElement.scrollWidth,screen:innerWidth}})
   if(width===390)await page.locator('.simulation-panel').screenshot({path:'docs/screenshots/44-mobile-shell-nonconvergence.jpg',type:'jpeg',quality:84})
   assert(bounds.doc<=bounds.screen+1&&bounds.warning.left>=bounds.viewport.left&&bounds.warning.right<=bounds.viewport.right&&bounds.warning.bottom<bounds.legend.top&&bounds.warning.top>bounds.phase.bottom,`Failure warning overlaps, clips or overflows on mobile ${width}px: ${JSON.stringify(bounds)}`)
 }
 await page.getByLabel('回看已记录的仿真时间').fill('50')
 assert(await page.locator('.solver-warning').count()===0&&await page.getByTestId('play-pause').isEnabled(),'Rewinding to a converged state should permit playback')
 await page.getByLabel('恢复默认参数').click();await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]').textContent)>0)
 assert(await page.locator('.solver-warning').count()===0,'Reset should recover from nonconvergence')
 assert(!errors.length,'Browser error: '+errors.join('; '))
 const report={date:new Date().toISOString().slice(0,10),browserVersion:browser.version(),scope:'This intentionally difficult parameter set is an interaction/rollback test, not a physical instability claim or original-reference comparison.',nodes:24,youngMPa:.2,pressureMultiplier:2,lastConvergedTime:.55,failedStep:.56,meridionalStrainDisplayed:strain,csvUnchanged:true,playbackDisabled:true,rewindRecovery:true,parameterResetRecovery:true,mobileWidths:[320,390],browserErrors:errors,images:['43-shell-nonconvergence.jpg','44-mobile-shell-nonconvergence.jpg','45-shell-extreme-strain.jpg']}
 await writeFile('docs/screenshots/shell-failure-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await context.close()
}finally{await browser.close()}
