/**
 * Reproducible visual and interaction audit. Requires playwright-core and either
 * CHROME_BIN or @sparticuz/chromium installed locally. Start `npm run dev` first.
 * Set AUDIT_MODULE_ROOT if the optional browser packages are installed elsewhere.
 */
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import {waitForVisibleGeometry} from './audit-canvas.mjs'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT || process.cwd(),'package.json'))
const {chromium}=require('playwright-core')
const bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
const executablePath=process.env.CHROME_BIN || await bundle.executablePath()
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const base=process.env.AUDIT_BASE_URL || 'http://127.0.0.1:5173'
const ids=['mass-single','mass-multi','beam-gravity','beam-buckling','beam-snap','rod-helix','rod-bifurcation','rod-growth','axis-inflate','axis-snap','plate-gravity','plate-wrinkle','shell-indent','net-gravity','net-form','lattice-gravity','hyper-cable','hyper-membrane','robot-magnetic','robot-swim','robot-crawl']
const out='docs/screenshots', crops=process.env.AUDIT_CROP_DIR || '/tmp/ddg-crops'
await mkdir(out,{recursive:true});await mkdir(crops,{recursive:true})
const browser=await chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true})
const errors=[]
let testingFallback=false
page.on('pageerror',e=>errors.push(String(e)))
page.on('console',m=>{if(m.type()==='error'&&!testingFallback)errors.push(m.text())})
const assert=(condition,message)=>{if(!condition)throw Error(message)}
const report=[]
try{
  if(process.env.AUDIT_SKIP_CASES==='1') {
    const previous=JSON.parse(await readFile(`${out}/audit.json`,'utf8'))
    assert(previous.caseScreenshots?.length===ids.length,'Full case captures are required before reusing screenshots')
    for(let i=0;i<ids.length;i++){assert(previous.caseScreenshots[i].id===ids[i],`Previous capture mismatch: ${ids[i]}`);report.push(previous.caseScreenshots[i])}
  } else for(let i=0;i<ids.length;i++){
    const id=ids[i];await page.goto(`${base}/?page=workspace&case=${id}`,{waitUntil:'networkidle'})
    await page.waitForSelector('.three-mount canvas',{timeout:30000})
    await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=.5,null,{timeout:30000})
    await page.getByTestId('play-pause').evaluate(button=>{if(!button.disabled&&button.getAttribute('aria-label')==='暂停')button.click()})
    const name=await page.getByTestId('case-title').innerText(),time=await page.getByTestId('time-value').innerText()
    const warning=await page.locator('.solver-warning').count(),overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)
    assert(!warning,`${id}: solver warning`);assert(!overflow,`${id}: horizontal overflow`)
    await waitForVisibleGeometry(page)
    const file=`${String(i+1).padStart(2,'0')}-${id}.jpg`
    await page.screenshot({path:`${out}/${file}`,type:'jpeg',quality:78,fullPage:true})
    await page.locator('.viewport-shell').screenshot({path:`${crops}/${file}`,type:'jpeg',quality:88})
    report.push({id,name,time,screenshot:file,canvas:true,solverWarning:false,overflow:false})
    console.log(`${String(i+1).padStart(2,'0')}/21 ${id} ${time}`)
  }
  // Playback, rewind, parameter application, scene reconstruction and exports.
  await page.goto(`${base}/?page=workspace&case=beam-gravity`,{waitUntil:'networkidle'})
  await page.getByRole('button',{name:'下一个算例'}).click();await page.waitForTimeout(350)
  assert((await page.getByTestId('case-title').innerText()).includes('屈曲'),'Next case did not open')
  assert((await page.locator('.viewport-top-left').innerText()).includes('40 NODES'),'Case switch did not rebuild topology')
  await page.getByRole('button',{name:'上一个算例'}).click();await page.waitForTimeout(350)
  assert((await page.getByTestId('case-title').innerText()).includes('悬臂梁'),'Previous case did not open')
  await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>.3)
  await page.getByTestId('play-pause').click();const paused=await page.getByTestId('time-value').innerText();await page.waitForTimeout(250)
  assert((await page.getByTestId('time-value').innerText())===paused,'Pause did not hold time')
  await page.getByLabel('单步前进').click();assert(parseFloat(await page.getByTestId('time-value').innerText())>parseFloat(paused),'Step did not advance')
  const range=page.getByLabel('离散节点');await range.focus();await range.press('Home');await page.getByTestId('apply-params').click()
  await page.waitForFunction(()=>document.querySelector('.viewport-top-left')?.textContent.includes('12 NODES'))
  assert(await page.locator('canvas').count()===1,'Canvas was not rebuilt after changing node count')
  await page.getByRole('tab',{name:'核心公式'}).click();await page.locator('.insight-content .katex').first().waitFor({timeout:30000});assert(await page.locator('.insight-content .katex').count()>0,'Case equation did not render')
  await page.getByRole('tab',{name:'验证说明'}).click();assert((await page.locator('.insight-content').innerText()).includes('对照'),'Verification note missing')
  let downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出数据'}).click();let download=await downloadPromise;const csv=await readFile(await download.path(),'utf8');assert(csv.includes('time_s,displacement'),'CSV export is invalid')
  downloadPromise=page.waitForEvent('download');await page.getByLabel('下载视图 PNG').click();download=await downloadPromise;const png=await readFile(await download.path());assert(png.subarray(1,4).toString()==='PNG','PNG export is invalid')
  // Library filters/search and navigation.
  await page.getByTestId('nav-library').click();await page.locator('.case-card').first().waitFor({timeout:30000});assert(await page.locator('.case-card').count()===21,'Library case count mismatch')
  await page.getByRole('button',{name:'空间曲面',exact:true}).click();assert(await page.locator('.case-card').count()===3,'Surface filter mismatch')
  await page.getByLabel('搜索算例',{exact:true}).fill('圆柱');assert(await page.locator('.case-card').count()===1,'Search mismatch');await page.locator('.case-card').first().click();assert((await page.getByTestId('case-title').innerText()).includes('圆柱'),'Case selection failed')
  await page.getByTestId('nav-library').click();await page.screenshot({path:`${out}/22-library.jpg`,type:'jpeg',quality:78,fullPage:true})
  // All theory chapters should render without KaTeX parse errors.
  await page.getByTestId('nav-theory').click();const chapters=page.locator('.theory-nav-item');await chapters.first().waitFor({timeout:30000});assert(await chapters.count()===8,'Theory chapter count mismatch')
  for(let i=0;i<8;i++){await chapters.nth(i).click();assert(await page.locator('.derivation .katex-error').count()===0,`KaTeX error in chapter ${i+1}`);assert(await page.locator('.derivation .katex-display').count()>=3,`Missing formulae in chapter ${i+1}`)}
  await chapters.nth(2).click()
  const rod=page.getByTestId('spatial-rod-lab'),twist=page.getByTestId('rod-twist'),kappa=page.getByTestId('rod-kappa')
  assert(await rod.isVisible(),'Spatial material-frame diagram missing')
  const previousKappa=await kappa.innerText()
  const materialAngle=page.getByLabel('后边材料转角');await materialAngle.focus();await materialAngle.press('End')
  assert(Math.abs(parseFloat(await twist.innerText())-Math.PI/2)<.002,'Rod twist slider did not update')
  assert((await kappa.innerText())!==previousKappa,'Rod curvature components did not respond to material rotation')
  const bend=page.getByLabel('弯曲转角');await bend.focus();await bend.press('Home')
  assert((await kappa.innerText()).replace(/[-\s]/g,'')==='(0.000,0.000)','Straight rod has nonzero curvature')
  await page.getByRole('button',{name:'播放扭转'}).click()
  const beforeAnimation=await twist.innerText()
  await page.waitForFunction(previous=>document.querySelector('[data-testid="rod-twist"]')?.textContent!==previous,beforeAnimation,{timeout:5000})
  await page.getByRole('button',{name:'暂停演示'}).click()
  await chapters.nth(0).click();await chapters.nth(2).click();await page.screenshot({path:`${out}/51-spatial-rod-theory.jpg`,type:'jpeg',quality:78,fullPage:true})
  await rod.screenshot({path:`${out}/52-spatial-rod-lab.jpg`,type:'jpeg',quality:88})
  await chapters.nth(6).click();await page.screenshot({path:`${out}/35-theory-hyperelasticity.jpg`,type:'jpeg',quality:78,fullPage:true})
  await chapters.nth(7).click();await page.screenshot({path:`${out}/36-theory-multiphysics.jpg`,type:'jpeg',quality:78,fullPage:true})
  await chapters.nth(1).click()
  const curvature=page.getByLabel('离散转角');await curvature.focus();await curvature.press('End')
  assert((await page.getByTestId('curvature-angle').innerText())==='80°','Curvature slider did not update')
  assert(Math.abs(parseFloat(await page.getByTestId('curvature-value').innerText())-2*Math.tan(40*Math.PI/180))<.002,'Curvature value is incorrect')
  await page.getByRole('button',{name:'播放演示'}).click();await page.getByRole('button',{name:'暂停演示'}).click()
  await chapters.nth(0).click();await chapters.nth(1).click();await page.screenshot({path:`${out}/23-theory.jpg`,type:'jpeg',quality:78,fullPage:true})
  // On-device numerical checks and all 21 smoke checks.
  await page.getByTestId('nav-validation').click();await page.getByRole('button',{name:'运行验证',exact:true}).click();await page.getByRole('button',{name:'重新运行验证'}).waitFor({timeout:360000})
  const summary=await page.locator('.verification-summary').innerText();assert(summary.includes('15 / 15')&&summary.includes('21 / 21')&&summary.includes('10 / 21'),`Validation failed: ${summary}`)
  const capRow=page.locator('.reference-results .check-row').filter({hasText:'轴对称球冠翻转'})
  const capComparison=await capRow.innerText()
  assert(capComparison.includes('尚未覆盖约 4 s 的翻转')&&capComparison.includes('翻转条件诊断：未通过')&&capComparison.includes('不是独立全程')&&capComparison.includes('7 次触及迭代上限')&&capComparison.includes('本设备回放')&&capComparison.includes('步未收敛'),`Cap coverage or conditional disagreement not explicit: ${capComparison}`)
  await capRow.screenshot({path:`${out}/42-cap-diagnostic.jpg`,type:'jpeg',quality:86})
  const netRow=page.locator('.reference-results .check-row').filter({hasText:'重力下的柔性网'}),netComparison=await netRow.innerText()
  assert(netComparison.includes('2.00 s')&&netComparison.includes('631 节点')&&netComparison.includes('稀疏向量化装配')&&netComparison.includes('前 5 步全节点'),`Net validation scope missing: ${netComparison}`)
  await netRow.screenshot({path:`${out}/46-net-validation.jpg`,type:'jpeg',quality:86})
  const snapComparison=await page.locator('.reference-results .check-row').filter({hasText:'预屈曲梁的跃迁'}).innerText()
  assert(snapComparison.includes('严格阈值未通过')&&snapComparison.includes('兼容回放通过'),`Snap reference statuses not explicit: ${snapComparison}`)
  const swimComparison=await page.locator('.reference-results .check-row').filter({hasText:'流固耦合软体游动'}).innerText()
  assert(swimComparison.includes('未通过')&&swimComparison.includes('兼容回放')&&swimComparison.includes('第一端速度'),`Swimmer reference statuses not explicit: ${swimComparison}`)
  await page.screenshot({path:`${out}/24-validation.jpg`,type:'jpeg',quality:78,fullPage:true})
  // A deliberately blocked WASM must fall back without claiming a Rust comparison passed.
  testingFallback=true;await page.route('**/ddg_core.wasm',route=>route.abort())
  await page.goto(`${base}/?page=validation`,{waitUntil:'networkidle'})
  await page.getByText('JS 核心',{exact:false}).waitFor()
  await page.getByRole('button',{name:'运行验证',exact:true}).click()
  await page.getByRole('button',{name:'重新运行验证'}).waitFor({timeout:360000})
  assert((await page.locator('.verification-summary').innerText()).includes('14 / 15'),'WASM fallback was incorrectly marked as verified')
  assert((await page.locator('.validation-card').first().innerText()).includes('未验证'),'WASM fallback skip is not visible')
  await page.unroute('**/ddg_core.wasm');testingFallback=false
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});mobile.on('pageerror',e=>errors.push(String(e)))
  await mobile.goto(`${base}/?page=workspace&case=beam-gravity`,{waitUntil:'networkidle'});await mobile.waitForSelector('canvas');await mobile.screenshot({path:`${out}/26-mobile-workspace.jpg`,type:'jpeg',quality:78,fullPage:false});await mobile.getByLabel('打开导航').click();assert(await mobile.getByTestId('nav-library').isVisible(),'Mobile navigation failed')
  await mobile.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left)<1)
  await mobile.screenshot({path:`${out}/34-mobile-navigation.jpg`,type:'jpeg',quality:78,fullPage:false})
  await mobile.getByTestId('nav-library').click();await mobile.locator('.case-card').first().waitFor({timeout:30000});assert(await mobile.locator('.case-card').count()===21,'Mobile library failed')
  await mobile.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0.5)
  const mobileOverflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);assert(!mobileOverflow,'Mobile horizontal overflow')
  await mobile.screenshot({path:`${out}/25-mobile-library.jpg`,type:'jpeg',quality:78,fullPage:false})
  await mobile.goto(`${base}/?page=theory`,{waitUntil:'networkidle'});await mobile.locator('.theory-nav-item').nth(2).click()
  assert(await mobile.getByTestId('spatial-rod-lab').isVisible(),'Mobile rod diagram missing')
  assert(!(await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Mobile rod theory overflow')
  await mobile.getByTestId('spatial-rod-lab').screenshot({path:`${out}/53-mobile-spatial-rod-lab.jpg`,type:'jpeg',quality:85});await mobile.close()
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
  await writeFile(`${out}/audit.json`,JSON.stringify({date:new Date().toISOString().slice(0,10),viewport:'1440×1000',caseScreenshots:report,interactionChecks:['nonblank WebGL scene in each captured case','case switching','pause','step','node-count apply and canvas rebuild','formula tab','verification tab','CSV export','PNG export','library filter and search','8 KaTeX chapters and interactive planar curvature and spatial material-frame diagrams','15 numerical checks','21 case smoke checks','12 Octave reference comparisons (10 satisfy the stated strict window thresholds)','mobile navigation and overflow','WASM failure and honest JS fallback'],browserErrors:errors,limitations:'Case smoke checks and screenshots do not validate agreement with the MATLAB reference.'},null,2)+'\n')
  console.log('PASS: interactions, 8 formula chapters, 15 numerical checks, 21 smoke checks, 12 reference comparisons (10 strict window passes), exports and mobile')
}finally{await browser.close()}
