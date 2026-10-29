/** Browser checks for shape/size switching, loaded path, playback and exports.
 * It does not certify free grasp, mesh convergence or the whole loading path. */
import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const executablePath=process.env.CHROME_BIN||await bundle.executablePath(),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173'
const launch=()=>chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const errors=[],assert=(ok,message)=>{if(!ok)throw Error(message)},attach=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})}
function inspectGif(buf){
  assert(['GIF89a','GIF87a'].includes(buf.subarray(0,6).toString()),'Invalid GIF');let i=13,frames=0,hashes=[],packed=buf[10];if(packed&128)i+=3*(1<<((packed&7)+1))
  while(i<buf.length){const b=buf[i++];if(b===0x3b)break;if(b===0x21){i++;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}}
    else if(b===0x2c){const p=buf[i+8];i+=9;if(p&128)i+=3*(1<<((p&7)+1));i++;const start=i;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}hashes.push(createHash('sha256').update(buf.subarray(start,i)).digest('hex'));frames++}else throw Error(`GIF block ${b}`)}
  return {width:buf.readUInt16LE(6),height:buf.readUInt16LE(8),frames,uniqueFrames:new Set(hashes).size,bytes:buf.length}
}
const presets=[['ball60','小球','60.0 × 60.0 × 60.0'],['ball90','球体','90.0 × 90.0 × 90.0'],['ball110','大球','110.0 × 110.0 × 110.0'],['capsule','胶囊棒','90.0 × 60.0 × 60.0'],['rounded-box','圆角盒','90.0 × 80.0 × 50.0'],['dumbbell','双球哑铃','98.0 × 52.0 × 52.0']]
const actuators=[['拇指',.78],['食指',.9],['中指',1],['无名指',.92],['小指',.78]]
let browser=await launch(),mobileBrowser
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});attach(page)
  await page.goto(`${base}/?page=objects3d`,{waitUntil:'domcontentloaded'});await page.locator('.gripper-three canvas').waitFor({timeout:90000})
  assert(await page.getByText('固定支撑接触原型，未通过完整抓取验收。').isVisible(),'Missing scope warning')
  const pause=page.getByLabel('暂停');if(await pause.isVisible())await pause.click()
  for(const [name] of actuators)await page.getByLabel(`${name}目标牵引`).fill('0')
  async function apply(id,name,dimensions){
    await page.getByTestId('object-preset').selectOption(id);await page.getByTestId('object-apply').click()
    await page.waitForFunction(expected=>document.querySelector('[data-testid="object-name"]')?.textContent===expected&&/已到达目标|增量失败/.test(document.querySelector('.grip-stage-status')?.textContent||''),name,{timeout:900000})
    assert((await page.locator('.grip-stage-status').innerText()).trim()==='已到达目标',`Path failed: ${await page.locator('.grip-error').allTextContents()}`)
    assert((await page.getByTestId('object-dimensions').innerText()).includes(dimensions),`Dimensions mismatch for ${id}`)
    await page.locator('.gripper-three canvas').waitFor({timeout:90000});await page.waitForTimeout(300)
  }
  const images={}
  for(const [id,name,dimensions] of presets){
    await apply(id,name,dimensions);const data=await page.locator('.gripper-three canvas').evaluate(c=>c.toDataURL())
    images[id]=createHash('sha256').update(data).digest('hex')
  }
  assert(new Set(Object.values(images)).size===6,'Different presets produced identical rendered scenes')
  await page.getByTestId('object-scale').fill('75');await apply('ball90','球体','67.5 × 67.5 × 67.5')
  await page.getByTestId('object-scale').fill('100')
  const results={}
  for(const [id,name,dimensions] of [presets[3],presets[4]]){
    const target=id==='capsule'?3.25:2,expectedFrames=target/.25+1
    for(const [finger,scale] of actuators)await page.getByLabel(`${finger}目标牵引`).fill(String(Number((target*scale).toFixed(3))))
    await apply(id,name,dimensions)
    const contacts=Number(await page.getByTestId('object-finger-count').innerText()),frame=(await page.getByTestId('object-frame').innerText()).trim()
    assert(contacts>=1,`Expected object contact for ${id}`)
    assert((await page.locator('.grip-equations .katex-error').count())===0&&(await page.locator('.grip-equations .katex-display').count())===3,'Bad equations')
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Desktop horizontal overflow')
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(400)
    await page.screenshot({path:`docs/screenshots/${id==='capsule'?'71-objects-capsule-desktop':'72-objects-rounded-box'}.jpg`,type:'jpeg',quality:84,fullPage:true})
    let pending=page.waitForEvent('download');await page.getByTestId('object-csv').click();let download=await pending,csv=await readFile(await download.path(),'utf8')
    const rows=csv.trim().split('\n');assert(rows.length===expectedFrames*5+1&&rows[0].includes('object_force_on_finger_x_N')&&rows[0].includes('object_id'),'CSV missing data')
    pending=page.waitForEvent('download',{timeout:120000});await page.getByTestId('object-gif').click();download=await pending;const gif=await readFile(await download.path()),info=inspectGif(gif)
    assert(info.frames===expectedFrames&&info.uniqueFrames>=expectedFrames-1,`Bad GIF: ${JSON.stringify(info)}`);await mkdir('docs/media',{recursive:true});await writeFile(`docs/media/multi-object-${id}.gif`,gif)
    results[id]={normalizedTargetMm:target,contacts,frame,csvRows:rows.length,gif:info}
  }
  let pending=page.waitForEvent('download');await page.getByLabel('下载物体 PNG').click();let download=await pending;assert((await readFile(await download.path())).subarray(1,4).toString()==='PNG','Bad PNG')
  const canvas=page.locator('.gripper-three canvas'),before=await canvas.evaluate(c=>c.toDataURL()),box=await canvas.boundingBox();assert(box,'Canvas missing')
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:8});await page.mouse.up();await page.waitForTimeout(350);assert(before!==await canvas.evaluate(c=>c.toDataURL()),'Orbit not changing scene')
  await page.getByLabel('物体平衡历史').fill('0');assert((await page.getByTestId('object-frame').innerText()).trim().startsWith('0'),'Rewind failed')
  await page.getByLabel('单步',{exact:true}).click();assert((await page.getByTestId('object-frame').innerText()).trim().startsWith('1'),'Step/replay failed')
  const viewBefore=await canvas.evaluate(c=>c.toDataURL());await page.getByLabel('切换透视').click();await page.waitForTimeout(400);assert(viewBefore!==await canvas.evaluate(c=>c.toDataURL()),'X-ray toggle did not redraw');await page.getByLabel('切换接触标记').click();await page.getByLabel('重置视角').click()
  await browser.close();browser=null
  mobileBrowser=await launch();const mobile=await mobileBrowser.newPage({viewport:{width:390,height:844}});attach(mobile)
  await mobile.goto(`${base}/?page=objects3d`,{waitUntil:'domcontentloaded'});await mobile.locator('.gripper-three canvas').waitFor({timeout:90000})
  const mobilePause=mobile.getByLabel('暂停');if(await mobilePause.isVisible())await mobilePause.click()
  assert(!(await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Mobile horizontal overflow')
  await mobile.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await mobile.waitForTimeout(400)
  await mobile.screenshot({path:'docs/screenshots/73-objects-mobile.jpg',type:'jpeg',quality:82,fullPage:true});await mobile.getByLabel('打开导航').click();assert(await mobile.getByTestId('nav-objects3d').isVisible(),'Mobile nav missing')
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
  const files=['src/App.tsx','src/engine/object-hand3d.ts','src/engine/object-finger3d.ts','src/engine/rounded-object-contact.ts','src/engine/object-presets3d.ts','src/engine/object-hand3d.worker.ts','src/engine/useObjectHand3D.ts','src/components/MultiObjectViewport.tsx','src/components/MultiObjectLab.tsx','src/components/MultiObjectComparison.tsx','src/components/multi-object.css','src/data/multi-object-comparison.json'],hash=createHash('sha256');for(const f of files)hash.update(f).update(await readFile(f))
  const report={date:new Date().toISOString(),codeHash:hash.digest('hex'),sourceFiles:files,presetSceneHashes:images,scale75DimensionsMm:[67.5,67.5,67.5],results,errors,scope:'UI/export, six initial shapes and two supported-object paths only; NOT free grasp, continuum CCD, mesh convergence or experimental validation.'}
  await writeFile('docs/screenshots/multi-object-browser-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{if(browser)await browser.close();if(mobileBrowser)await mobileBrowser.close()}
