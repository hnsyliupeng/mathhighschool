/* Reproduce the examples and screenshots in docs/STEP_BY_STEP.md.
 * Install Playwright separately, build and start a Vite preview first:
 * AUDIT_MODULE_ROOT=/path/to/playwright CHROME_BIN=/path/to/chromium \
 * AUDIT_BASE_URL=http://127.0.0.1:5175 node scripts/audit-step-by-step.mjs --mode=quick
 * Modes: quick, gripper3d, box, stiffness, validation. The last three may be slow.
 * These are UI demonstrations, not complete physical or accessibility validation.
 */
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises'
import path from 'node:path'

const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core')
const bundle=process.env.CHROME_BIN?null:(require('@sparticuz/chromium').default||require('@sparticuz/chromium'))
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5175'
const mode=process.argv.find(v=>v.startsWith('--mode='))?.split('=')[1]||'quick'
if(!['quick','gripper3d','box','stiffness','validation'].includes(mode))throw Error(`Unknown mode ${mode}`)
const dir='docs/screenshots/step-by-step'
await mkdir(dir,{recursive:true})
const files=[]
async function walk(folder){
  for(const e of await readdir(folder,{withFileTypes:true})){
    const f=path.join(folder,e.name)
    if(e.isDirectory())await walk(f)
    else if(/\.(tsx?|css|json|woff2)$/.test(f))files.push(f)
  }
}
await walk('src')
files.push('index.html','vite.config.ts','package.json','package-lock.json','public/ddg_core.wasm','scripts/audit-step-by-step.mjs')
files.sort()
async function digest(){const h=createHash('sha256');for(const f of files)h.update(f).update(await readFile(f));return h.digest('hex')}
const sourceHash=await digest(),errors=[],results={},shots=[]
const assert=(condition,message)=>{if(!condition)throw Error(message)}
const browser=await chromium.launch({
  executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,
  args:[...(bundle?.args||[]).filter(x=>x!=='--single-process'),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
})
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true})
page.on('pageerror',e=>errors.push(String(e)))
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
async function go(route){await page.goto(`${base}/?page=${route}`,{waitUntil:'domcontentloaded'});await page.locator('main h1').waitFor({timeout:90000});await page.evaluate(()=>document.fonts.ready)}
async function photo(name,scroll=0){await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),scroll);await page.waitForTimeout(350);await page.screenshot({path:`${dir}/${name}.jpg`,type:'jpeg',quality:84});shots.push(`${name}.jpg`)}
async function download(click){const pending=page.waitForEvent('download',{timeout:120000});await click();const file=await pending;return {name:file.suggestedFilename(),bytes:await readFile(await file.path())}}
async function pauseAndSeekSecond(){
  await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=1.05,null,{timeout:90000})
  const play=page.getByTestId('play-pause');if(await play.getAttribute('aria-label')==='暂停')await play.click()
  await page.getByLabel('回看已记录的仿真时间').fill('100')
  await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'-1')===1,null,{timeout:15000})
  return (await page.locator('.chart-meta strong').innerText()).trim()
}
try{
  if(mode==='quick'){
    await go('library')
    await page.getByLabel('搜索算例',{exact:true}).fill('悬臂梁')
    const card=page.locator('[data-case-id="beam-gravity"]');await card.waitFor();assert(await page.locator('.case-card').count()===1,'Beam search should return one result')
    await photo('01-library-search')
    await card.click();await page.getByTestId('case-title').waitFor();assert((await page.getByTestId('case-title').innerText()).includes('重力下的悬臂梁'),'Wrong case')
    await page.getByLabel('恢复默认参数').click();const baseline=await pauseAndSeekSecond()
    await page.getByLabel('重力加速度').fill('15');await page.getByTestId('apply-params').click();const adjusted=await pauseAndSeekSecond()
    assert(baseline!==adjusted,'Load change had no visible effect at the sample time')
    await photo('02-beam-load')
    const csv=await download(()=>page.getByRole('button',{name:'导出数据'}).click())
    const text=csv.bytes.toString('utf8');assert(csv.name==='ddg-beam-gravity-data.csv'&&text.includes('time_s,displacement')&&text.trim().split('\n').length>2,'Invalid beam CSV')
    const png=await download(()=>page.getByLabel('下载视图 PNG').click());assert(png.bytes.subarray(1,4).toString()==='PNG','Invalid beam PNG')
    results.beam={sampleTimeS:1,baseline,gravity15:adjusted,csv:csv.name,csvRows:text.trim().split('\n').length,png:png.name}

    await page.getByTestId('nav-theory').click();await page.locator('.derivation').waitFor()
    await page.getByRole('button',{name:/平面梁：伸长与弯曲/}).click();await page.getByLabel('离散转角').fill('60')
    assert((await page.getByTestId('curvature-value').innerText()).trim()==='1.155','60 degree curvature mismatch')
    await photo('03-theory-curvature',170);results.curvature={angleDeg:60,beta:1.155}

    await go('tendon3d');await page.getByTestId('tendon-preset-egg').click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000})
    await page.getByTestId('tendon-load-recording').click();await page.getByTestId('tendon-recording-note').waitFor({timeout:90000})
    await page.getByTestId('tendon-seek').fill('0')
    assert((await page.getByTestId('tendon-time').innerText()).startsWith('0.000')&&(await page.getByTestId('tendon-fixture').innerText()).includes('启用'),'Initial egg frame mismatch')
    await photo('04-egg-start',210)
    await page.getByTestId('tendon-seek').fill('11');await page.waitForTimeout(400)
    assert((await page.getByTestId('tendon-time').innerText()).startsWith('2.150')&&(await page.getByTestId('tendon-fixture').innerText()).includes('已释放'),'Egg final frame mismatch')
    assert(parseFloat(await page.getByTestId('tendon-rise').innerText())>50&&(await page.getByTestId('tendon-contacts').innerText()).includes('4'),'Egg sample response mismatch')
    await photo('05-egg-end',300)
    const eggCsv=await download(()=>page.getByTestId('tendon-csv').click()),eggGif=await download(()=>page.getByTestId('tendon-gif').click())
    assert(eggCsv.name==='tendon-dynamic-egg.csv'&&eggCsv.bytes.toString().trim().split('\n').length===13,'Recorded CSV is not twelve sampled states')
    assert(eggGif.name==='tendon-dynamic-egg.gif'&&eggGif.bytes.subarray(0,3).toString()==='GIF','Invalid recorded GIF')
    results.egg={finalTimeS:2.15,rise:await page.getByTestId('tendon-rise').innerText(),contacts:await page.getByTestId('tendon-contacts').innerText(),csv:eggCsv.name,csvRows:13,gif:eggGif.name}

    for(const [id,expected] of [['screwdriver',3],['bottle-cap',4]]){
      await page.getByTestId(`tendon-preset-${id}`).click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000})
      await page.getByTestId('tendon-load-recording').click();await page.getByTestId('tendon-recording-note').waitFor({timeout:90000})
      assert(parseInt(await page.getByTestId('tendon-contacts').innerText())===expected,`${id} contacts changed`)
      results[id]={rise:await page.getByTestId('tendon-rise').innerText(),contacts:await page.getByTestId('tendon-contacts').innerText()}
      await photo(id==='screwdriver'?'06-screwdriver-end':'07-cap-end',250)
    }
    await page.getByTestId('tendon-preset-cloth').click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000})
    assert(await page.getByTestId('tendon-load-recording').count()===0,'Cloth unexpectedly has a recording')

    await go('gripper');await page.getByTestId('gripper-status').getByText('已完成',{exact:true}).waitFor({timeout:180000})
    assert(parseFloat(await page.getByTestId('gripper-pull').innerText())===4,'2D default target changed')
    results.gripper2d={pull:await page.getByTestId('gripper-pull').innerText(),contacts:await page.getByTestId('gripper-active-count').innerText(),tip:await page.getByTestId('gripper-tip').innerText()}
    await photo('08-gripper2d',150)

    await go('materials3d');await page.getByTestId('material-preset-egg').click()
    await page.getByLabel('材料连杆刚度倍率').fill('2');await page.getByTestId('material-apply').click();await page.getByTestId('material-run').click()
    await page.waitForFunction(()=>Number((document.querySelector('[data-testid="material-time"]')?.textContent||'0').split('/')[0])>=.2,null,{timeout:120000})
    const pause=page.getByLabel('暂停仿真');if(await pause.count()&&await pause.isVisible())await pause.click()
    await photo('09-independent-pads',180)
    results.pads={status:await page.getByTestId('material-status').innerText(),time:await page.getByTestId('material-time').innerText(),stiffness:await page.getByLabel('材料连杆刚度倍率').inputValue()}

    const mobile=await browser.newPage({viewport:{width:390,height:844}})
    await mobile.goto(`${base}/?page=workspace`,{waitUntil:'domcontentloaded'});await mobile.getByLabel('打开导航').click();assert(await mobile.getByTestId('nav-tendon3d').isVisible(),'Mobile navigation unavailable')
    await mobile.screenshot({path:`${dir}/10-mobile-menu.jpg`,type:'jpeg',quality:84});shots.push('10-mobile-menu.jpg');await mobile.close()
  }
  if(mode==='gripper3d'){
    await go('gripper3d');await page.getByLabel('三维最大牵引').fill('0.5');await page.getByTestId('gripper3d-apply').click()
    await page.waitForFunction(()=>document.querySelector('.grip-progress-end')?.textContent?.trim()==='0.50 mm'&&document.querySelector('[data-testid="gripper3d-status"]')?.textContent==='已完成',null,{timeout:300000})
    assert(Math.abs(parseFloat(await page.getByTestId('gripper3d-pull').innerText())-.5)<.005,'3D path did not reach 0.5 mm')
    await photo('11-gripper3d',140)
    await page.getByLabel('沿孔轴查看真实孔口').click();await photo('12-gripper3d-bore',140)
    const csv=await download(()=>page.getByRole('button',{name:'导出 CSV'}).click()),gif=await download(()=>page.getByRole('button',{name:'导出 GIF'}).click())
    assert(csv.bytes.toString().trim().split('\n').length===4&&gif.bytes.subarray(0,3).toString()==='GIF','3D export invalid')
    results.gripper3d={pull:await page.getByTestId('gripper3d-pull').innerText(),angle:await page.getByTestId('gripper3d-angle').innerText(),csv:csv.name,csvRows:4,gif:gif.name}
  }
  if(mode==='box'){
    await go('objects3d');await page.getByTestId('object-preset').selectOption('rounded-box');await page.getByTestId('object-scale').fill('100')
    await page.getByRole('button',{name:'短路径 2.00 mm'}).click();await page.getByTestId('object-apply').click()
    await page.waitForFunction(()=>document.querySelector('[data-testid="object-name"]')?.textContent==='圆角盒'&&/已到达目标|增量失败/.test(document.querySelector('.grip-stage-status')?.textContent||''),null,{timeout:900000})
    assert((await page.locator('.grip-stage-status').innerText()).trim()==='已到达目标',`Box path failed: ${await page.locator('.grip-error').allTextContents()}`)
    assert((await page.getByTestId('object-frame').innerText()).trim().startsWith('8'),'Box expected eight accepted increments')
    await photo('13-rounded-box',140)
    const csv=await download(()=>page.getByTestId('object-csv').click());assert(csv.bytes.toString().trim().split('\n').length===46,'Box CSV should have five fingers across nine frames')
    results.box={frame:await page.getByTestId('object-frame').innerText(),contacts:await page.getByTestId('object-finger-count').innerText(),csv:csv.name,csvRows:46}
  }
  if(mode==='stiffness'){
    await go('tendon3d');await page.getByTestId('tendon-preset-egg').click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000})
    await page.getByLabel('物体弹簧刚度').fill('4');await page.getByTestId('tendon-apply').click();await page.locator('[data-testid="tendon-viewport"] canvas').waitFor({timeout:90000})
    assert(await page.getByLabel('物体弹簧刚度').inputValue()==='4','Stiffness was not applied')
    assert(await page.getByRole('checkbox',{name:'检查指间与指—物体连续碰撞'}).isChecked(),'CCD unexpectedly disabled')
    await photo('14-stiffness-setup',180);await page.getByTestId('tendon-run').click()
    const progress=setInterval(async()=>{try{console.log('stiffness progress',await page.getByTestId('tendon-time').innerText())}catch{}},30000)
    try{await page.waitForFunction(()=>['计算完成','失败并回滚'].includes(document.querySelector('[data-testid="tendon-status"]')?.textContent?.trim()),null,{timeout:1200000})}finally{clearInterval(progress)}
    const status=(await page.getByTestId('tendon-status').innerText()).trim();assert(status==='计算完成',`Stiffness run failed: ${await page.locator('.grip-error').allTextContents()}`)
    assert((await page.getByTestId('tendon-result').innerText()).includes('达到降阶短时保持条件'),'Stiffness hold condition not met')
    await photo('15-stiffness-end',300)
    const csv=await download(()=>page.getByTestId('tendon-csv').click()),rows=csv.bytes.toString().trim().split('\n').length
    assert(rows===131,`Expected initial state and every fourth requested step: got ${rows} CSV rows`)
    results.stiffness={status,time:await page.getByTestId('tendon-time').innerText(),rise:await page.getByTestId('tendon-rise').innerText(),contacts:await page.getByTestId('tendon-contacts').innerText(),result:await page.getByTestId('tendon-result').innerText(),csv:csv.name,csvRows:rows}
  }
  if(mode==='validation'){
    await go('validation');await page.getByRole('button',{name:'运行验证'}).click()
    await page.getByRole('button',{name:'重新运行验证'}).waitFor({timeout:600000})
    const summary=await page.locator('.verification-summary').innerText();assert(summary.includes('15 / 15')&&summary.includes('21 / 21')&&summary.includes('10 / 21'),`Unexpected validation summary: ${summary}`)
    await photo('16-validation-result');results.validation={summary}
  }
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
  assert(sourceHash===await digest(),'Source changed during the browser audit')
  const report={mode,sourceHash,sourceFiles:files,base,results,screenshots:shots,errors,scope:'A step-by-step UI scenario on a production build; not a physical, convergence, full-history export or experimental certification.'}
  await writeFile(`${dir}/audit-${mode}.json`,JSON.stringify(report,null,2)+'\n')
  console.log('PASS',JSON.stringify({mode,results,screenshots:shots,sourceHash}))
}finally{await browser.close()}
