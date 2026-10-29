/* Production 3-D gripper redraw/export regression on a short 0.5 mm path.
 * This is a UI test, not the full 14.75 mm physical/convergence audit. */
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),pkg=process.env.CHROME_BIN?null:require('@sparticuz/chromium'),bundle=pkg?.default||pkg
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]).filter(x=>x!=='--single-process'),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5175',errors=[],assert=(value,message)=>{if(!value)throw Error(message)}
function gifFrames(buf){
  assert(['GIF87a','GIF89a'].includes(buf.subarray(0,6).toString()),'invalid GIF');let i=13,frames=0,packed=buf[10];if(packed&128)i+=3*(1<<((packed&7)+1))
  while(i<buf.length){const b=buf[i++];if(b===0x3b)break;if(b===0x21){i++;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}}else if(b===0x2c){const p=buf[i+8];i+=9;if(p&128)i+=3*(1<<((p&7)+1));i++;while(i<buf.length){const n=buf[i++];if(!n)break;i+=n}frames++}else throw Error(`GIF block ${b}`)}return frames
}
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.addInitScript(()=>{window.__auditClears=0;for(const T of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(T&&Object.hasOwn(T.prototype,'clear')){const clear=T.prototype.clear;T.prototype.clear=function(...args){window.__auditClears++;return clear.apply(this,args)}}})
  await page.goto(`${base}/?page=gripper3d`,{waitUntil:'domcontentloaded'});await page.getByLabel('三维最大牵引').fill('0.5');await page.getByTestId('gripper3d-apply').click()
  await page.waitForFunction(()=>document.querySelector('.grip-progress-end')?.textContent?.trim()==='0.50 mm'&&document.querySelector('[data-testid="gripper3d-status"]')?.textContent!=='已完成',null,{timeout:30000})
  await page.getByTestId('gripper3d-status').getByText('已完成',{exact:true}).waitFor({timeout:240000})
  assert(Math.abs(parseFloat(await page.getByTestId('gripper3d-pull').innerText())-.5)<.005,'short solve did not reach 0.5 mm')
  const canvas=page.locator('.gripper-three canvas');await canvas.waitFor();await page.waitForTimeout(1200);const beforeClears=await page.evaluate(()=>window.__auditClears);await page.waitForTimeout(1000)
  const idleClears=await page.evaluate(()=>window.__auditClears)-beforeClears;assert(idleClears<=2,`paused 3-D gripper redraws ${idleClears} times/s`)
  const original=await canvas.evaluate(c=>c.toDataURL());await page.getByLabel('切换透视模式').click();await page.waitForTimeout(400)
  assert(original!==await canvas.evaluate(c=>c.toDataURL()),'x-ray toggle did not redraw paused scene');await page.getByLabel('切换透视模式').click();await page.waitForTimeout(400)
  const beforeGif=await canvas.evaluate(c=>c.toDataURL());let pending=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'导出 GIF'}).click();let download=await pending;const gif=await readFile(await download.path()),frames=gifFrames(gif)
  assert(frames===3,`expected 3 sampled GIF frames, got ${frames}`);await page.waitForTimeout(500);assert(beforeGif===await canvas.evaluate(c=>c.toDataURL()),'GIF export did not restore the paused scene')
  pending=page.waitForEvent('download');await page.getByLabel('下载三维 PNG').click();download=await pending;const png=await readFile(await download.path());assert(png.subarray(1,4).toString()==='PNG','invalid PNG')
  pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 CSV'}).click();download=await pending;const csv=await readFile(await download.path(),'utf8');assert(csv.trim().split('\n').length===4&&csv.includes('minimum_path_J_lower_bound'),'invalid short-path CSV')
  await page.getByLabel('三维抓手加载历史').fill('0');await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="gripper3d-pull"]')?.textContent||'-1')===0)
  await page.getByLabel('三维抓手单步').click();await page.waitForFunction(()=>Math.abs(parseFloat(document.querySelector('[data-testid="gripper3d-pull"]')?.textContent||'-1')-.25)<.005)
  assert(!errors.length,errors.join(' | '))
  const files=['src/components/Gripper3DLab.tsx','src/components/Gripper3DViewport.tsx','src/engine/useGripper3D.ts','src/engine/gripper3d.worker.ts','scripts/audit-gripper3d-redraw.mjs'],hash=createHash('sha256');for(const f of files)hash.update(f).update(await readFile(f))
  const report={sourceHash:hash.digest('hex'),sourceFiles:files,targetMm:.5,idleClearsPerSecond:idleClears,gifFrames:frames,gifBytes:gif.length,pngBytes:png.length,csvRows:4,errors,scope:'Short-path production UI, idle redraw, display toggle, exports, GIF scene restoration and seek/step only; not large-curl or physical certification.'}
  await writeFile('docs/screenshots/gripper3d-redraw-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{await browser.close()}
