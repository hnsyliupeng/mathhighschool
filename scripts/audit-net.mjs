// Physical-net interaction and visual audit; accuracy is measured separately.
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {waitForVisibleGeometry} from './audit-canvas.mjs'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173',errors=[],assert=(v,m)=>{if(!v)throw Error(m)}
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage()
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(`${base}/?page=workspace&case=net-gravity`,{waitUntil:'networkidle'})
 await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=2,null,{timeout:120000})
 await page.waitForTimeout(250)
 const time=async()=>parseFloat(await page.getByTestId('time-value').innerText()),displacement=async()=>parseFloat(await page.locator('.chart-meta strong').innerText())
 const end=await time(),endDisp=await displacement(),endStrain=parseFloat(await page.getByTestId('net-strain').innerText()),header=await page.locator('.viewport-top-left').innerText(),metrics=await page.locator('.metric-strip').innerText()
 assert(end===2&&Math.abs(endDisp-(-.43913521))<1e-3,`Incorrect terminal time or displacement: ${end}, ${endDisp}`)
 assert(Math.abs(endStrain-17.4)<.1&&(await page.locator('.strain-caveat').innerText()).includes('不是强度判据'),'Edge strain or its material-validity caveat missing')
 assert(header.includes('631 NODES')&&metrics.includes('720')&&header.includes('实时数值求解'),'Source topology or solver status missing')
 assert(await page.locator('.solver-warning').count()===0&&await page.getByTestId('play-pause').isDisabled()&&await page.getByLabel('单步前进').isDisabled(),'Terminal solver state incorrect')
 assert((await page.locator('.parameter-note').innerText()).includes('6 个固定点')&&await page.getByLabel('离散节点').count()===0,'Fixed original mesh is not explained')
 await waitForVisibleGeometry(page);await page.screenshot({path:'docs/screenshots/47-net-loaded.jpg',type:'jpeg',quality:82,fullPage:true})
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出数据'}).click()])
 const csv=await readFile(await download.path(),'utf8'),rows=csv.trim().split('\n')
 assert(rows[0].includes('displacement_unit')&&rows.at(-1).startsWith('2.0000,')&&rows.at(-1).includes(',m,'),'Recorded full path or CSV units missing')
 const slider=page.getByLabel('回看已记录的仿真时间');await slider.fill('50')
 assert((await time())===.5&&Math.abs((await displacement())-(-.56217612))<1e-3,'Rewind must restore the physical center displacement')
 assert((await page.getByTestId('solver-residual').innerText()).includes('e-'),'Rewind must restore residual')
 await page.getByTestId('play-pause').click()
 await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=.8,null,{timeout:60000})
 await page.getByTestId('play-pause').evaluate(el=>{if(!el.disabled&&el.getAttribute('aria-label')==='暂停')el.click()})
 assert(await page.locator('.solver-warning').count()===0,'Replayed path failed')
 await page.getByLabel('隐藏节点').click();assert(await page.getByLabel('显示节点').count()===1,'Nodes cannot be hidden')
 await page.getByLabel('隐藏参考构型').click();assert(await page.getByLabel('显示参考构型').count()===1,'Reference cannot be hidden')
 const [png]=await Promise.all([page.waitForEvent('download'),page.getByLabel('下载视图 PNG').click()]);assert((await readFile(await png.path())).subarray(1,4).toString()==='PNG','PNG download invalid')
 await page.getByRole('tab',{name:'验证说明'}).click();const limitation=await page.locator('.insight-content').innerText()
 assert(limitation.includes('没有弯曲')&&limitation.includes('受压')&&limitation.includes('回滚'),'Original model limitations not disclosed')
 await page.getByRole('tab',{name:'核心公式'}).click();assert(await page.locator('.insight-content .katex-error').count()===0,'Net formula did not render')
 await page.getByRole('button',{name:'展开详细推导'}).click();assert(await page.locator('.derivation .katex-error').count()===0,'Network derivation has a KaTeX error')
 assert((await page.locator('.derivation').innerText()).includes('柔性网原算例是特例')&&(await page.locator('.derivation').innerText()).includes('共轭梯度'),'Network derivation incomplete')
 await page.screenshot({path:'docs/screenshots/49-net-theory.jpg',type:'jpeg',quality:82,fullPage:true})
 // Reapply zero gravity: this is a control check, not a source-reference comparison.
 await page.goto(`${base}/?page=workspace&case=net-gravity`,{waitUntil:'networkidle'})
 await page.getByLabel('重力加速度').fill('0');await page.getByTestId('apply-params').click()
 await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=.15,null,{timeout:60000})
 await page.getByTestId('play-pause').evaluate(el=>{if(!el.disabled&&el.getAttribute('aria-label')==='暂停')el.click()})
 assert(Math.abs(await displacement())<1e-8,'Zero gravity should leave the initial stress-free net stationary')
 await context.close()
 for(const width of [320,390]){
   const mobile=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});mobile.on('pageerror',e=>errors.push(String(e)))
   await mobile.goto(`${base}/?page=workspace&case=net-gravity`,{waitUntil:'networkidle'})
   await mobile.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=.3,null,{timeout:90000})
   await mobile.getByTestId('play-pause').evaluate(el=>{if(!el.disabled&&el.getAttribute('aria-label')==='暂停')el.click()})
   const bounds=await mobile.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {badge:box('.viewport-top-left'),tools:box('.viewport-tools'),legend:box('.viewport-legend'),viewport:box('.viewport-shell'),scroll:document.documentElement.scrollWidth,width:innerWidth}})
   assert(bounds.scroll<=bounds.width+1&&bounds.badge.right<=bounds.tools.left&&bounds.legend.left>=bounds.viewport.left&&bounds.legend.right<=bounds.viewport.right,`Net mobile layout issue ${width}px: ${JSON.stringify(bounds)}`)
   await waitForVisibleGeometry(mobile)
   if(width===390)await mobile.screenshot({path:'docs/screenshots/48-mobile-net.jpg',type:'jpeg',quality:82,fullPage:true})
   await mobile.close()
 }
 assert(!errors.length,'Browser errors: '+errors.join(' | '))
 const report={date:new Date().toISOString().slice(0,10),browserVersion:browser.version(),case:'rod_network/case_1',nodes:631,edges:720,fullyFixedNodes:6,terminalTime:end,terminalDisplacement:endDisp,terminalEdgeStrainPercent:endStrain,rewindAt:.5,csvRows:rows.length-1,zeroGravityStationary:true,png:true,formula:true,mobileWidths:[320,390],browserErrors:errors,scope:'Interaction and screenshot review only; reference accuracy and convergence limits are documented separately.',images:['47-net-loaded.jpg','48-mobile-net.jpg','49-net-theory.jpg']}
 await writeFile('docs/screenshots/net-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
