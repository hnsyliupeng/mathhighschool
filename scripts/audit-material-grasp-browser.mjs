/** Browser validation of the reduced-order dynamic pad bench; not physical grasp certification. */
import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),chromiumPackage=process.env.CHROME_BIN?null:require('@sparticuz/chromium'),bundle=chromiumPackage?.default||chromiumPackage
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173',executablePath=process.env.CHROME_BIN||await bundle.executablePath()
const launch=()=>chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]).filter(x=>x!=='--single-process'),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const errors=[],assert=(ok,message)=>{if(!ok)throw Error(message)}
const attach=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})}
function inspectGif(buf){assert(['GIF89a','GIF87a'].includes(buf.subarray(0,6).toString()),'Invalid GIF');let i=13,frames=0,hashes=[],packed=buf[10];if(packed&128)i+=3*(1<<((packed&7)+1));while(i<buf.length){const b=buf[i++];if(b===0x3b)break;if(b===0x21){i++;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}}else if(b===0x2c){const p=buf[i+8];i+=9;if(p&128)i+=3*(1<<((p&7)+1));i++;const start=i;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}hashes.push(createHash('sha256').update(buf.subarray(start,i)).digest('hex'));frames++}else throw Error(`GIF block ${b}`)}return {width:buf.readUInt16LE(6),height:buf.readUInt16LE(8),frames,uniqueFrames:new Set(hashes).size,bytes:buf.length}}
let browser=await launch(),mobileBrowser
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});attach(page)
  await page.goto(`${base}/?page=materials3d`,{waitUntil:'domcontentloaded'});await page.locator('[data-testid="material-viewport"] canvas').waitFor({timeout:90000})
  assert(await page.getByText('独立的降阶指垫实验，不是五腱驱实体手。').isVisible(),'Missing scope warning')
  const initialHashes={},names={screwdriver:'螺丝刀',egg:'鸡蛋','bottle-cap':'瓶盖',cloth:'衣物布片'}
  for(const id of Object.keys(names)){
    await page.getByTestId(`material-preset-${id}`).click();await page.locator('[data-testid="material-viewport"] canvas').waitFor();await page.waitForTimeout(250)
    assert((await page.getByTestId('material-object-name').innerText())===names[id],`wrong preset ${id}`)
    const png=await page.locator('[data-testid="material-viewport"] canvas').evaluate(c=>c.toDataURL());initialHashes[id]=createHash('sha256').update(png).digest('hex')
  }
  assert(new Set(Object.values(initialHashes)).size===4,'Initial shape canvases not distinct')
  async function configure(id,scale){
    await page.getByTestId(`material-preset-${id}`).click();if(scale!==100){await page.getByTestId('material-scale').fill(String(scale));await page.getByTestId('material-apply').click()}
    await page.locator('[data-testid="material-viewport"] canvas').waitFor();assert((await page.getByTestId('material-status').innerText()).includes('待计算'),'not reset')
  }
  async function run(){
    const canvas=page.locator('[data-testid="material-viewport"] canvas'),before=await canvas.evaluate(c=>c.toDataURL());await page.getByTestId('material-run').click()
    await page.waitForFunction(()=>/短时数值保持|子步失败|未满足保持条件/.test(document.querySelector('[data-testid="material-status"]')?.textContent||''),null,{timeout:240000})
    await page.waitForTimeout(300);const status=(await page.getByTestId('material-status').innerText()).trim(),after=await canvas.evaluate(c=>c.toDataURL());assert(before!==after,'trajectory did not change rendered geometry')
    return status
  }
  async function csvAndGif(id,gifWanted){
    let pending=page.waitForEvent('download',{timeout:30000});await page.getByTestId('material-csv').click();let download=await pending,csv=await readFile(await download.path(),'utf8'),lines=csv.trim().split('\n'),head=lines[0].split(','),last=lines.at(-1).split(',')
    assert(lines.length===386,`CSV should contain initial plus 384 accepted steps: ${lines.length}`)
    assert(head.includes('clips_active')&&head.includes('max_discrete_pad_face_penetration_mm'),'CSV fields missing')
    const held=lines.slice(1).map(line=>line.split(',')).find(row=>Number(row[head.indexOf('time_s')])>=.6);assert(held&&held[head.indexOf('phase')]==='holding','CSV phase inconsistent with closure schedule')
    assert(Number(last[head.indexOf('centre_rise_mm')])>30,'CSV has no lifted object')
    if(id==='cloth'){assert(lines[1].split(',')[head.indexOf('clips_active')]==='1','cloth initial clamps missing');assert(last[head.indexOf('clips_active')]==='0','cloth clamps not released')}
    let info=null
    if(gifWanted){pending=page.waitForEvent('download',{timeout:120000});await page.getByTestId('material-gif').click();download=await pending;const data=await readFile(await download.path());info=inspectGif(data);assert(info.frames===25&&info.uniqueFrames>=20,`GIF not animated: ${JSON.stringify(info)}`);await mkdir('docs/media',{recursive:true});await writeFile(`docs/media/material-grasp-${id}.gif`,data)}
    return {csvRows:lines.length,finalRiseMm:Number(last[head.indexOf('centre_rise_mm')]),gif:info}
  }
  const results={}
  for(const [id,scale,dimensions,gifWanted] of [['egg',100,'44.0 × 60.0 × 44.0',true],['screwdriver',100,'28.0 × 147.0 × 26.6',false],['bottle-cap',70,'22.4 × 22.4 × 8.4',false],['cloth',130,'117.0 × 0.0 × 130.0',true]]){
    await configure(id,scale);assert((await page.getByTestId('material-dimensions').innerText()).includes(dimensions),`dimension failure ${id}`)
    const status=await run();assert(status==='短时数值保持',`${id} unexpected ${status}: ${await page.locator('[role="alert"]').allTextContents()}`)
    assert((await page.getByTestId('material-result').innerText()).includes('不是腱驱仿生手'),`missing outcome caveat ${id}`)
    const extra=await csvAndGif(id,gifWanted);results[id]={scale,status,...extra}
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(300);await page.screenshot({path:`docs/screenshots/${{'egg':'74-material-egg','screwdriver':'75-material-screwdriver','bottle-cap':'76-material-cap','cloth':'77-material-cloth'}[id]}.jpg`,type:'jpeg',quality:85})
    console.log('BROWSER',id,scale,status,JSON.stringify(extra))
  }
  // A zero-friction control must not be reported as a successful hold.
  await configure('egg',100);await page.getByTestId('material-friction').fill('0');await page.getByTestId('material-apply').click()
  const noFriction=await run();assert(noFriction==='未满足保持条件',`zero friction unexpectedly passed: ${noFriction}`);assert((await page.getByTestId('material-result').innerText()).includes('未满足数值保持条件'),'failure result missing')
  // Known low-iteration cloth path exceeds the fixed penetration guard.
  await configure('cloth',100);await page.getByLabel('每步迭代次数').selectOption('12');await page.getByTestId('material-apply').click();const rollback=await run();assert(rollback==='子步失败 · 已回滚',`rollback not shown: ${rollback}`);assert((await page.locator('[role="alert"]').innerText()).includes('回滚'),'rollback message missing')
  // Seek, replay and camera controls must operate on accepted frames.
  await page.getByTestId('material-seek').fill('0');assert((await page.getByTestId('material-time').innerText()).startsWith('0.000'),'rewind failed')
  await page.getByTestId('material-replay').click();await page.waitForTimeout(250);assert(!(await page.getByTestId('material-time').innerText()).startsWith('0.000'),'replay failed')
  const canvas=page.locator('[data-testid="material-viewport"] canvas'),before=await canvas.evaluate(c=>c.toDataURL()),box=await canvas.boundingBox();assert(box,'canvas missing');await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:8});await page.mouse.up();await page.waitForTimeout(300);assert(before!==await canvas.evaluate(c=>c.toDataURL()),'orbit failed')
  assert((await page.locator('.grip-equations .katex-error').count())===0,'formula rendering error')
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'desktop overflow')
  // Switching presets while a worker is computing must terminate the old run.
  await configure('screwdriver',100);await page.getByTestId('material-run').click();await page.getByTestId('material-preset-egg').click();await page.waitForTimeout(1000);assert((await page.getByTestId('material-status').innerText()).includes('待计算'),'stale worker altered switched preset')
  let pending=page.waitForEvent('download');await page.getByLabel('保存 PNG').click();const download=await pending;assert((await readFile(await download.path())).subarray(1,4).toString()==='PNG','invalid PNG')
  await browser.close();browser=null
  mobileBrowser=await launch();const mobile=await mobileBrowser.newPage({viewport:{width:390,height:844}});attach(mobile);await mobile.goto(`${base}/?page=materials3d`,{waitUntil:'domcontentloaded'});await mobile.locator('[data-testid="material-viewport"] canvas').waitFor({timeout:90000});await mobile.waitForTimeout(300)
  assert(!(await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'mobile overflow');await mobile.screenshot({path:'docs/screenshots/78-material-mobile.jpg',type:'jpeg',quality:84,fullPage:true});await mobile.getByLabel('打开导航').click();assert(await mobile.getByTestId('nav-materials3d').isVisible(),'mobile nav missing')
  assert(!errors.length,`Browser errors: ${errors.join(' | ')}`)
  const files=['src/App.tsx','src/engine/material-grasp3d.ts','src/engine/material-grasp-analysis.ts','src/engine/material-grasp3d.worker.ts','src/components/MaterialGraspViewport.tsx','src/components/MaterialGraspLab.tsx','src/components/material-grasp.css','src/data/material-grasp-validation.json','src/data/material-grasp-convergence.json','scripts/audit-material-grasp-browser.mjs'],hash=createHash('sha256');for(const f of files)hash.update(f).update(await readFile(f))
  const report={date:new Date().toISOString(),sourceHash:hash.digest('hex'),sourceFiles:files,presetSceneHashes:initialHashes,results,zeroFrictionStatus:noFriction,rollbackStatus:rollback,errors,scope:'Browser worker, export and four sampled reduced-model trajectories only; not physical material or tendon-hand certification.'}
  await writeFile('docs/screenshots/material-grasp-browser-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{if(browser)await browser.close();if(mobileBrowser)await mobileBrowser.close()}
