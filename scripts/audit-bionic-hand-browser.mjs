/** UI/screenshot/export audit. This verifies one specified normalized supported
 * sphere path only; it is not a numerical mesh or physical grasp validation. */
import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const executablePath=process.env.CHROME_BIN||await bundle.executablePath(),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173'
const launch=()=>chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const target=Number(process.env.AUDIT_NORMALIZED_TARGET_MM||'3.5');if(!Number.isFinite(target)||target<=0||target>6.75)throw Error('Browser audit target must be in (0,6.75] mm')
const expectedFrames=Math.ceil(target/.25)+1
const errors=[],assert=(ok,message)=>{if(!ok)throw Error(message)},attach=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})}
function inspectGif(buf){
  assert(['GIF89a','GIF87a'].includes(buf.subarray(0,6).toString()),'Invalid GIF')
  let i=13,frames=0,hashes=[],packed=buf[10];if(packed&128)i+=3*(1<<((packed&7)+1))
  while(i<buf.length){const b=buf[i++];if(b===0x3b)break;if(b===0x21){i++;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}}
    else if(b===0x2c){const p=buf[i+8];i+=9;if(p&128)i+=3*(1<<((p&7)+1));i++;const start=i;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}hashes.push(createHash('sha256').update(buf.subarray(start,i)).digest('hex'));frames++}else throw Error(`GIF block ${b}`)}
  return {width:buf.readUInt16LE(6),height:buf.readUInt16LE(8),frames,uniqueFrames:new Set(hashes).size,bytes:buf.length}
}
let browser=await launch(),mobileBrowser
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});attach(page)
  await page.goto(`${base}/?page=hand3d`,{waitUntil:'domcontentloaded'});await page.locator('.gripper-three canvas').waitFor({timeout:90000})
  assert(await page.getByText('研究原型，尚未通过完整验收。').isVisible(),'Missing scope warning')
  const pause=page.getByLabel('暂停五指');if(await pause.isVisible())await pause.click()
  for(const [name,scale] of [['拇指',.78],['食指',.9],['中指',1],['无名指',.92],['小指',.78]])await page.getByLabel(`${name}目标牵引`).fill(String(Number((target*scale).toFixed(3))))
  await page.getByTestId('hand-apply').click()
  await page.waitForFunction(()=>/已到达目标|增量失败/.test(document.querySelector('.grip-stage-status')?.textContent||''),null,{timeout:900000})
  const status=(await page.locator('.grip-stage-status').innerText()).trim()
  assert(status==='已到达目标',`Five-finger path failed: ${await page.locator('.grip-error').allTextContents()}`)
  const count=parseInt(await page.getByTestId('hand-object-fingers').innerText()),frame=(await page.getByTestId('hand-frame').innerText()).trim(),table=await page.locator('.hand-table').innerText()
  assert(count>=(target>=6.75?5:1),`Unexpected sphere contact count: ${table}`)
  if(target>=6.75){const thumb=await page.locator('.hand-row').filter({hasText:'拇指'}).locator('span').last().innerText();assert(Number(thumb)>0&&Number(thumb)<.0001,`Thumb force rounded to zero: ${thumb}`)}
  assert((await page.locator('.grip-equations .katex-error').count())===0&&(await page.locator('.grip-equations .katex-display').count())===3,'Bad equations')
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Desktop horizontal overflow')
  await page.screenshot({path:'docs/screenshots/68-bionic-hand-desktop.jpg',type:'jpeg',quality:84,fullPage:true})
  await page.screenshot({path:'docs/screenshots/69-bionic-hand-viewport.jpg',type:'jpeg',quality:85})
  let pending=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();let download=await pending,csv=await readFile(await download.path(),'utf8')
  const rows=csv.trim().split('\n');assert(rows.length===expectedFrames*5+1&&rows[0].includes('sphere_force_on_finger_x_N')&&rows[0].includes('tendon_complementarity_um'),'CSV missing data')
  pending=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'GIF',exact:true}).click();download=await pending;const gif=await readFile(await download.path()),gifInfo=inspectGif(gif)
  assert(gifInfo.frames===expectedFrames&&gifInfo.uniqueFrames>=expectedFrames-1,`Bad GIF: ${JSON.stringify(gifInfo)}`);await mkdir('docs/media',{recursive:true});await writeFile('docs/media/bionic-hand-3d.gif',gif)
  pending=page.waitForEvent('download');await page.getByLabel('下载五指 PNG').click();download=await pending;assert((await readFile(await download.path())).subarray(1,4).toString()==='PNG','Bad PNG')
  const canvas=page.locator('.gripper-three canvas'),before=await canvas.evaluate(c=>c.toDataURL()),box=await canvas.boundingBox();assert(box,'Canvas missing')
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:8});await page.mouse.up();await page.waitForTimeout(350);assert(before!==await canvas.evaluate(c=>c.toDataURL()),'Orbit not changing scene')
  await page.getByLabel('五指平衡历史').fill('0');assert((await page.getByTestId('hand-frame').innerText()).trim().startsWith('0'),'Rewind failed')
  await page.getByLabel('五指单步').click();assert((await page.getByTestId('hand-frame').innerText()).trim().startsWith('1'),'Step/replay failed')
  const viewBefore=await canvas.evaluate(c=>c.toDataURL());await page.getByLabel('切换五指透视').click();await page.waitForTimeout(400);assert(viewBefore!==await canvas.evaluate(c=>c.toDataURL()),'X-ray toggle did not redraw the scene');await page.getByLabel('切换五指接触标记').click();await page.getByLabel('重置五指视角').click()
  await browser.close();browser=null
  mobileBrowser=await launch();const mobile=await mobileBrowser.newPage({viewport:{width:390,height:844}});attach(mobile)
  await mobile.goto(`${base}/?page=hand3d`,{waitUntil:'domcontentloaded'});await mobile.locator('.gripper-three canvas').waitFor({timeout:90000})
  assert(!(await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Mobile horizontal overflow')
  await mobile.screenshot({path:'docs/screenshots/70-bionic-hand-mobile.jpg',type:'jpeg',quality:82,fullPage:true});await mobile.getByLabel('打开导航').click();assert(await mobile.getByTestId('nav-hand3d').isVisible(),'Mobile nav missing')
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
  const files=['src/engine/bionic-hand3d.ts','src/engine/sphere-finger3d.ts','src/engine/hand-object-contact.ts','src/engine/bionic-hand3d.worker.ts','src/engine/useBionicHand3D.ts','src/components/BionicHandViewport.tsx','src/components/BionicHandLab.tsx'],hash=createHash('sha256');for(const f of files)hash.update(f).update(await readFile(f))
  const report={date:new Date().toISOString(),codeHash:hash.digest('hex'),status,normalizedTargetMm:target,activeSphereFingerCount:count,frame,table,csvRows:rows.length,gif:gifInfo,errors,scope:'UI/export and one supported-sphere path only; NOT complete grasp, continuum CCD, mesh-convergence or experimental validation.'}
  await writeFile('docs/screenshots/bionic-hand-browser-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{if(browser)await browser.close();if(mobileBrowser)await mobileBrowser.close()}
