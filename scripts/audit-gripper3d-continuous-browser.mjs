/** Browser check for the segment/triangle solver. Set AUDIT_BASE_URL,
 * AUDIT_MODULE_ROOT, CHROME_BIN and optionally CHROMIUM_LIB_DIR. */
import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const executablePath=process.env.CHROME_BIN||await bundle.executablePath(),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:4174'
const launch=()=>chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const browser=await launch();let fallbackBrowser,mobileBrowser
const errors=[],assert=(x,m)=>{if(!x)throw Error(m)},attach=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})}
const done=page=>page.getByTestId('gripper3d-status').getByText('已完成',{exact:true}).waitFor({timeout:900000})
const pull=(page,t)=>page.waitForFunction(x=>Math.abs(parseFloat(document.querySelector('[data-testid="gripper3d-pull"]')?.textContent||'-100')-x)<.005,t,{timeout:900000})
const values=async page=>({angle:parseFloat(await page.getByTestId('gripper3d-angle').innerText()),tip:parseFloat(await page.getByTestId('gripper3d-tip').innerText()),tension:parseFloat(await page.getByTestId('gripper3d-tension').innerText()),contacts:parseInt(await page.getByTestId('gripper3d-contacts').innerText()),penetration:parseFloat(await page.getByTestId('gripper3d-check-penetration').innerText()),complementarity:parseFloat(await page.getByTestId('gripper3d-complementarity').innerText()),interference:await page.getByTestId('gripper3d-interference').innerText()})
function inspectGif(buf){
  assert(['GIF89a','GIF87a'].includes(buf.subarray(0,6).toString()),'Bad GIF header')
  const width=buf.readUInt16LE(6),height=buf.readUInt16LE(8);let i=13,packed=buf[10],frames=0,hashes=[]
  if(packed&128)i+=3*(1<<((packed&7)+1))
  while(i<buf.length){const block=buf[i++];if(block===0x3b)break
    if(block===0x21){i++;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}}
    else if(block===0x2c){const p=buf[i+8];i+=9;if(p&128)i+=3*(1<<((p&7)+1));i++;const start=i;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}hashes.push(createHash('sha256').update(buf.subarray(start,i)).digest('hex'));frames++}
    else throw Error(`Unknown GIF block ${block}`)
  }
  return {width,height,frames,uniqueCompressedFrames:new Set(hashes).size}
}
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});attach(page)
  await page.goto(`${base}/?page=gripper3d`,{waitUntil:'domcontentloaded'});await done(page);await pull(page,14.75)
  const result=await values(page)
  assert(result.angle>91&&result.angle<94&&Math.abs(result.tip-46.20)<.2&&Math.abs(result.tension-.498)<.004&&result.contacts>0&&result.penetration<=.02&&result.complementarity<=.02&&result.interference==='0 / 0 / 0',`Bad default ${JSON.stringify(result)}`)
  assert((await page.getByTestId('gripper3d-mesh').innerText()).includes('288 节点 / 136 六面体'),'Wrong grid')
  assert(await page.getByText('后台工作线程 · TypeScript',{exact:false}).isVisible(),'No worker status')
  assert((await page.locator('.grip3-mesh-warning').innerText()).includes('严格验收尚未通过'),'Missing failed acceptance warning')
  assert(await page.locator('.grip-equations .katex-error').count()===0&&await page.locator('.grip-equations .katex-display').count()===4,'Equations failed')
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Desktop overflow')
  const pixels=await page.locator('.gripper-three canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=240;c.height=200;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,c.width,c.height);const a=ctx.getImageData(0,0,c.width,c.height).data;let red=0,teal=0,orange=0,redMinY=200,redMaxY=0;for(let i=0;i<a.length;i+=4){if(a[i]>140&&a[i]>a[i+1]*1.35&&a[i+1]<140){red++;let y=Math.floor((i/4)/c.width);redMinY=Math.min(redMinY,y);redMaxY=Math.max(redMaxY,y)}if(a[i]<140&&a[i+1]>75&&a[i+2]>65&&a[i+1]>a[i]*1.1)teal++;if(a[i]>180&&a[i+1]>90&&a[i+1]<180&&a[i+2]<100)orange++}return {red,teal,orange,redMinY,redMaxY}})
  assert(pixels.red>4&&pixels.teal>40&&pixels.orange>3&&pixels.redMinY>1&&pixels.redMaxY<198,`Missing visible components: ${JSON.stringify(pixels)}`)
  await page.screenshot({path:'docs/screenshots/64-gripper3d-continuous-desktop.jpg',type:'jpeg',quality:84,fullPage:true});await page.screenshot({path:'docs/screenshots/65-gripper3d-continuous-viewport.jpg',type:'jpeg',quality:85})
  let pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 CSV'}).click();let download=await pending,csv=await readFile(await download.path(),'utf8');const rows=csv.trim().split('\n')
  assert(rows.length===61&&rows[0].includes('tip_rotation_xy_deg')&&rows[0].includes('positive_volume_tet_overlaps')&&rows[0].includes('complementarity_um')&&rows[0].includes('ccd_checks'),'CSV missing diagnostics')
  pending=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'导出 GIF'}).click();download=await pending;const gif=await readFile(await download.path()),gifInfo=inspectGif(gif)
  assert(gifInfo.frames===60&&gifInfo.uniqueCompressedFrames>50,`Invalid GIF ${JSON.stringify(gifInfo)}`)
  await mkdir('docs/media',{recursive:true});await writeFile('docs/media/tendon-gripper-3d-continuous.gif',gif)
  pending=page.waitForEvent('download');await page.getByLabel('下载三维 PNG').click();download=await pending;assert((await readFile(await download.path())).subarray(1,4).toString()==='PNG','Bad PNG')
  const canvas=page.locator('.gripper-three canvas'),before=await canvas.evaluate(c=>c.toDataURL()),box=await canvas.boundingBox();assert(box,'No canvas')
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.72,box.y+box.height*.54,{steps:10});await page.mouse.up();await page.waitForTimeout(400);assert(before!==await canvas.evaluate(c=>c.toDataURL()),'Orbit failed')
  await page.getByLabel('沿孔轴查看真实孔口').click();await page.waitForTimeout(500)
  const borePixels=await canvas.evaluate(canvas=>{const c=document.createElement('canvas');c.width=240;c.height=200;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,c.width,c.height);const a=ctx.getImageData(0,0,c.width,c.height).data;let red=0;for(let y=70;y<130;y++)for(let x=90;x<150;x++){const i=4*(y*c.width+x);if(a[i]>140&&a[i]>a[i+1]*1.35&&a[i+1]<140)red++}return {red}})
  assert(borePixels.red>4,`Deformed axial bore does not reveal the tendon: ${JSON.stringify(borePixels)}`)
  await page.screenshot({path:'docs/screenshots/66-gripper3d-continuous-bore.jpg',type:'jpeg',quality:85})
  await page.getByLabel('三维抓手加载历史').fill('0');await pull(page,0);assert((await values(page)).contacts===0,'Rewind failed')
  await page.getByLabel('三维抓手单步').click();await pull(page,.25);await page.getByLabel('播放三维抓手').click();await pull(page,14.75);await done(page)
  await page.getByRole('button',{name:'验证与限制'}).click();const caveat=await page.locator('.grip-validation').innerText();assert(caveat.includes('内部体积重叠没有独立逐对 CCD')&&caveat.includes('网格收敛'),'Missing validation caveat')
  await page.getByLabel('三维最大牵引').fill('0.5');await page.getByLabel('加载至峰值后实际求解卸载').check();await page.getByTestId('gripper3d-apply').click()
  await page.waitForFunction(()=>document.querySelector('.grip-progress-end')?.textContent?.trim()==='0.50 mm'&&document.querySelector('[data-testid="gripper3d-status"]')?.textContent!=='已完成');await done(page);await pull(page,0);const unloaded=await values(page);assert(Math.abs(unloaded.tip)<.02&&unloaded.tension<.001,`Unloading ${JSON.stringify(unloaded)}`)
  await page.getByLabel('加载至峰值后实际求解卸载').uncheck();await page.getByLabel('腱段细化').selectOption('2');await page.getByLabel('实体网格').selectOption('2');await page.getByTestId('gripper3d-apply').click();await page.getByTestId('gripper3d-mesh').getByText(/1654 节点/).waitFor({timeout:90000});await done(page);const fine=await values(page);assert(fine.tip>1.8&&fine.tip<2.4&&fine.tension>0,'Fine grid/tendon control failed')
  // Separate browser processes avoid single-process headless Chromium losing
  // its last WebGL context when a page is closed.
  await browser.close();fallbackBrowser=await launch()
  const fallback=await fallbackBrowser.newPage({viewport:{width:1200,height:900}});attach(fallback);await fallback.addInitScript(()=>{window.Worker=undefined});await fallback.goto(`${base}/?page=gripper3d`,{waitUntil:'domcontentloaded'});await fallback.getByLabel('三维最大牵引').fill('0.5');await fallback.getByTestId('gripper3d-apply').click();await done(fallback);await pull(fallback,.5);const fallbackResult=await values(fallback);assert(await fallback.getByText('主线程回退 · TypeScript',{exact:false}).isVisible(),'Main-thread fallback missing');assert(fallbackResult.tip>1.9&&fallbackResult.tip<2.3,'Main-thread fallback result');await fallbackBrowser.close();fallbackBrowser=null
  mobileBrowser=await launch()
  const mobile=await mobileBrowser.newPage({viewport:{width:390,height:844}});attach(mobile);await mobile.goto(`${base}/?page=gripper3d`,{waitUntil:'domcontentloaded'});await mobile.locator('.gripper-three canvas').waitFor({timeout:90000})
  assert(!(await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Mobile overflow');await mobile.screenshot({path:'docs/screenshots/67-gripper3d-continuous-mobile.jpg',type:'jpeg',quality:82,fullPage:true});await mobile.getByLabel('打开导航').click();assert(await mobile.getByTestId('nav-gripper3d').isVisible(),'Mobile navigation');await mobile.close()
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
  const report={date:new Date().toISOString(),base,default:result,unloaded,fine,fallback:fallbackResult,visiblePixels:pixels,borePixels,gif:{...gifInfo,bytes:gif.length},checks:['worker and full 14.75mm large-curl solve','honest incomplete-acceptance banner','4 equations','3-D rendering','CSV PNG GIF','orbit and bore view','replay','validation caveats','actual unloading','mobile navigation'],errors,scope:'Browser behavior, not physical convergence validation'}
  await writeFile('docs/screenshots/gripper3d-continuous-browser-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{await mobileBrowser?.close();await fallbackBrowser?.close();await browser.close()}
