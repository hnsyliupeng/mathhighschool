/** Production GUI + GIF audit; requires playwright-core and Chromium.
 * AUDIT_BASE_URL, AUDIT_MODULE_ROOT, CHROME_BIN, CHROMIUM_LIB_DIR can be set. */
import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const executablePath=process.env.CHROME_BIN||await bundle.executablePath(),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:4173'
const browser=await chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const errors=[],assert=(x,message)=>{if(!x)throw Error(message)},attach=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})}
const done=page=>page.getByTestId('gripper3d-status').getByText('已完成',{exact:true}).waitFor({timeout:180000})
const pull=async(page,target)=>page.waitForFunction(t=>Math.abs(parseFloat(document.querySelector('[data-testid="gripper3d-pull"]')?.textContent||'-100')-t)<.005,target,{timeout:90000})
const values=async page=>({tip:parseFloat(await page.getByTestId('gripper3d-tip').innerText()),tension:parseFloat(await page.getByTestId('gripper3d-tension').innerText()),contacts:parseInt(await page.getByTestId('gripper3d-contacts').innerText()),penetration:parseFloat(await page.getByTestId('gripper3d-penetration').innerText()),denseCheck:parseFloat(await page.getByTestId('gripper3d-check-penetration').innerText())})
function inspectGif(buf){
  assert(buf.subarray(0,6).toString()==='GIF89a'||buf.subarray(0,6).toString()==='GIF87a','Bad GIF header')
  const width=buf.readUInt16LE(6),height=buf.readUInt16LE(8);let i=13,packed=buf[10],frames=0,hashes=[],delays=[]
  if(packed&128)i+=3*(1<<((packed&7)+1))
  while(i<buf.length){const block=buf[i++];if(block===0x3b)break
    if(block===0x21){const kind=buf[i++];if(kind===0xf9&&buf[i]===4)delays.push(buf.readUInt16LE(i+2)*10);while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}}
    else if(block===0x2c){const p=buf[i+8];i+=9;if(p&128)i+=3*(1<<((p&7)+1));i++;const start=i;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}hashes.push(createHash('sha256').update(buf.subarray(start,i)).digest('hex'));frames++}
    else throw Error(`Unknown GIF block ${block} at ${i-1}`)
  }
  return {width,height,frames,uniqueCompressedFrames:new Set(hashes).size,delays}
}
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});attach(page)
  await page.goto(`${base}/?page=gripper3d`,{waitUntil:'domcontentloaded'});await done(page);await pull(page,3)
  const result=await values(page)
  assert(Math.abs(result.tip-10.40)<.06&&Math.abs(result.tension-.139)<.002&&result.contacts>0&&result.penetration>0&&result.denseCheck>result.penetration,`Bad default ${JSON.stringify(result)}`)
  assert((await page.getByTestId('gripper3d-mesh').innerText()).includes('288 节点 / 816 四面体'),'Wrong 3D mesh')
  assert(await page.getByText('后台工作线程 · TypeScript',{exact:false}).isVisible(),'Missing worker status')
  assert(await page.locator('.grip3-mesh-warning').innerText().then(s=>s.includes('网格尚未收敛')),'Missing mesh warning')
  assert(await page.locator('.grip-equations .katex-error').count()===0&&await page.locator('.grip-equations .katex-display').count()===4,'Equations failed')
  const tex=await page.locator('.grip-equations .katex-mathml annotation').first().textContent();assert(tex?.includes('\\sum')&&!tex.includes('\\\\sum'),'Formula escaping')
  const colored=await page.locator('.gripper-three canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=240;c.height=200;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,c.width,c.height);const a=ctx.getImageData(0,0,c.width,c.height).data;let red=0,teal=0,orange=0;for(let i=0;i<a.length;i+=4){if(a[i]>140&&a[i]>a[i+1]*1.35&&a[i+1]<140)red++;if(a[i]<140&&a[i+1]>75&&a[i+2]>65&&a[i+1]>a[i]*1.1)teal++;if(a[i]>180&&a[i+1]>90&&a[i+1]<180&&a[i+2]<100)orange++}return {red,teal,orange}})
  assert(colored.red>4&&colored.teal>40&&colored.orange>3,`Missing visible solid/tendon/contact: ${JSON.stringify(colored)}`)
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Desktop overflow')
  await page.screenshot({path:'docs/screenshots/59-gripper3d-desktop.jpg',type:'jpeg',quality:84,fullPage:true});await page.screenshot({path:'docs/screenshots/60-gripper3d-viewport.jpg',type:'jpeg',quality:85})
  let pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 CSV'}).click();let download=await pending,csv=await readFile(await download.path(),'utf8');let rows=csv.trim().split('\n')
  assert(rows.length===14&&rows[0].includes('check_64_per_segment_penetration_um')&&rows[0].includes('support_force_balance_N'),'CSV not complete')
  pending=page.waitForEvent('download',{timeout:90000});await page.getByRole('button',{name:'导出 GIF'}).click();download=await pending;const gif=await readFile(await download.path()),gifInfo=inspectGif(gif)
  assert(gifInfo.frames===13&&gifInfo.uniqueCompressedFrames>10&&gifInfo.width>100&&gifInfo.height>100,`Bad GIF ${JSON.stringify(gifInfo)}`)
  await mkdir('docs/media',{recursive:true});await writeFile('docs/media/tendon-gripper-3d.gif',gif)
  pending=page.waitForEvent('download');await page.getByLabel('下载三维 PNG').click();download=await pending;const png=await readFile(await download.path());assert(png.subarray(1,4).toString()==='PNG','Invalid PNG')
  const canvas=page.locator('.gripper-three canvas'),before=await canvas.evaluate(c=>c.toDataURL()),box=await canvas.boundingBox();assert(box,'No canvas')
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.72,box.y+box.height*.54,{steps:10});await page.mouse.up();await page.waitForTimeout(400)
  const after=await canvas.evaluate(c=>c.toDataURL());assert(before!==after,'Orbit drag did not change the 3D view')
  await page.getByLabel('重置三维视角').click();await page.getByLabel('沿孔轴查看真实孔口').click();await page.waitForTimeout(300)
  assert(await page.getByLabel('切换透视模式').getAttribute('aria-pressed')==='false'&&await page.getByLabel('切换三维接触力').getAttribute('aria-pressed')==='false','Bore view does not reveal solid geometry')
  await page.screenshot({path:'docs/screenshots/61-gripper3d-bore.jpg',type:'jpeg',quality:86})
  await page.getByLabel('三维抓手加载历史').fill('0');await pull(page,0);const atZero=await values(page);assert(Math.abs(atZero.tip)<.01&&atZero.contacts===0,'Rewind failed')
  await page.getByLabel('三维抓手单步').click();await pull(page,.25);await page.getByLabel('播放三维抓手').click();await pull(page,3);await done(page)
  await page.getByLabel('重置三维视角').click();await page.getByLabel('切换透视模式').click();await page.getByLabel('切换三维接触力').click();await page.waitForTimeout(350)
  assert(await page.getByLabel('切换三维接触力').getAttribute('aria-pressed')==='true','Contact toggle after replay failed')
  await page.getByRole('button',{name:'验证与限制'}).click();assert((await page.locator('.grip-validation').innerText()).includes('不是连续碰撞检测'),'Missing contact caveat')
  await page.getByLabel('每段接触采样').selectOption('4');await page.getByTestId('gripper3d-apply').click()
  await page.waitForFunction(()=>document.querySelector('[data-testid="gripper3d-status"]')?.textContent!=='已完成');await done(page)
  const coarse=await values(page);assert(coarse.denseCheck>40&&coarse.penetration<5&&await page.locator('.grip-error').innerText().then(t=>t.includes('密采样复查')),'Dense-check warning missing')
  await page.locator('.grip-stage').screenshot({path:'docs/screenshots/63-gripper3d-sampling-warning.jpg',type:'jpeg',quality:85})
  await page.getByLabel('每段接触采样').selectOption('12');await page.getByLabel('三维杨氏模量').fill('500');await page.getByLabel('三维最大牵引').fill('0.5');await page.getByLabel('加载至峰值后实际求解卸载').check();await page.getByTestId('gripper3d-apply').click()
  await page.waitForFunction(()=>document.querySelector('.grip-progress-end')?.textContent?.trim()==='0.50 mm'&&document.querySelector('[data-testid="gripper3d-status"]')?.textContent!=='已完成');await done(page);await pull(page,0)
  const unloaded=await values(page);assert(Math.abs(unloaded.tip)<.02&&unloaded.tension<.001,'Unloading failed')
  pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 CSV'}).click();download=await pending;csv=await readFile(await download.path(),'utf8');rows=csv.trim().split('\n');assert(rows.length===6&&rows.some(s=>s.startsWith('unloading,'))&&rows.some(s=>s.startsWith('loading,0.5,')),'No actual unloading samples')
  await page.getByLabel('加载至峰值后实际求解卸载').uncheck();await page.getByLabel('三维杨氏模量').fill('250');await page.getByLabel('实体网格').selectOption('2');await page.getByTestId('gripper3d-apply').click();await page.getByTestId('gripper3d-mesh').getByText(/1654 节点/).waitFor({timeout:30000});await done(page);const fine=await values(page)
  assert(Math.abs(fine.tip-2.05)<.1&&fine.tension>.01&&fine.tension<.02,'Refined mesh result incorrect')
  const navigation=await browser.newPage({viewport:{width:1200,height:900}});attach(navigation);await navigation.goto(`${base}/?page=gripper`,{waitUntil:'domcontentloaded'});await navigation.getByRole('button',{name:'进入三维实体孔抓手 →'}).click();await navigation.getByRole('heading',{name:'三维实体孔 · 腱驱抓手。'}).waitFor();assert(new URL(navigation.url()).searchParams.get('page')==='gripper3d','2D-to-3D deep link missing');await navigation.getByRole('button',{name:'查看原二维等效模型 →'}).click();assert(new URL(navigation.url()).searchParams.get('page')==='gripper','3D-to-2D navigation missing');await navigation.getByTestId('nav-gripper3d').click();assert(new URL(navigation.url()).searchParams.get('page')==='gripper3d','3D sidebar entry missing');await navigation.close()
  const fallback=await browser.newPage({viewport:{width:1200,height:900}});attach(fallback);await fallback.addInitScript(()=>{window.Worker=undefined});await fallback.goto(`${base}/?page=gripper3d`,{waitUntil:'domcontentloaded'});await done(fallback);const fallbackResult=await values(fallback)
  assert(await fallback.getByText('主线程回退 · TypeScript',{exact:false}).isVisible(),'No main-thread fallback');assert(Math.abs(fallbackResult.tip-result.tip)<.02,'Worker/fallback mismatch');await fallback.close()
  const mobile=await browser.newPage({viewport:{width:390,height:844}});attach(mobile);await mobile.goto(`${base}/?page=gripper3d`,{waitUntil:'domcontentloaded'});await done(mobile)
  assert(!(await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Mobile overflow');assert(await mobile.locator('.gripper-three canvas').isVisible(),'No mobile canvas')
  await mobile.screenshot({path:'docs/screenshots/62-gripper3d-mobile.jpg',type:'jpeg',quality:82,fullPage:true});await mobile.getByLabel('打开导航').click();assert(await mobile.getByTestId('nav-gripper3d').isVisible(),'Mobile 3D navigation missing');await mobile.close()
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
  const report={date:new Date().toISOString().slice(0,10),base,default:result,coarseSampling:coarse,refinedAtHalfMm:fine,unloaded,fallback:fallbackResult,visiblePixels:colored,gif:{...gifInfo,bytes:gif.length},checks:['direct 3D entry and worker','sidebar and 2D/3D cross-navigation','explicit non-converged grid warning','4 KaTeX formulae','actual red tendon and contact markers','CSV/PNG','13-frame generated GIF','3D orbit and solid bore view','rewind/step/playback','undersampled penetration warning','calculated unloading','refined 3D grid','main-thread fallback','mobile navigation/overflow'],browserErrors:errors,scope:'Browser behavior and rendered frames; not an experiment or continuous collision validation.'}
  await writeFile('docs/screenshots/gripper3d-browser-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{await browser.close()}
