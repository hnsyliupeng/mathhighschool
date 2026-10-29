/** Browser and screenshot audit of the custom gripper; requires playwright-core.
 * Set AUDIT_BASE_URL, AUDIT_MODULE_ROOT, CHROME_BIN and CHROMIUM_LIB_DIR as needed. */
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const executablePath=process.env.CHROME_BIN||await bundle.executablePath(),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173'
const browser=await chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const errors=[],assert=(condition,message)=>{if(!condition)throw Error(message)},attach=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})}
const waitPull=async(page,target)=>{try{await page.waitForFunction(t=>Math.abs(parseFloat(document.querySelector('[data-testid="gripper-pull"]')?.textContent||'-100')-t)<.01,target,{timeout:30000})}catch(error){console.log('WAIT DEBUG',target,await page.getByTestId('gripper-pull').innerText(),await page.getByTestId('gripper-status').innerText(),await page.locator('.grip-error').allTextContents());throw error}}
const waitDone=async page=>page.getByText('已完成',{exact:true}).waitFor({timeout:90000})
const readValues=async page=>({tip:parseFloat(await page.getByTestId('gripper-tip').innerText()),tension:parseFloat(await page.getByTestId('gripper-tension').innerText()),penetration:parseFloat(await page.getByTestId('gripper-penetration').innerText()),contacts:await page.getByTestId('gripper-active-count').innerText()})
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});attach(page)
  await page.addInitScript(()=>{window.__auditClears=0;for(const T of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(T&&Object.hasOwn(T.prototype,'clear')){const clear=T.prototype.clear;T.prototype.clear=function(...args){window.__auditClears++;return clear.apply(this,args)}}})
  await page.goto(`${base}/?page=gripper`,{waitUntil:'domcontentloaded'});await waitPull(page,4);await waitDone(page)
  const values=await readValues(page)
  assert(Math.abs(values.tip-17.71)<.05&&Math.abs(values.tension-.183)<.002&&values.contacts==='4 / 4'&&values.penetration>0&&values.penetration<5,`Unexpected default result: ${JSON.stringify(values)}`)
  assert(await page.locator('.grip-table-row').count()===4,'Contact inspector missing rows')
  assert(await page.locator('.grip-equations .katex-error').count()===0&&await page.locator('.grip-equations .katex-display').count()===4,'Gripper equations failed')
  const tex=await page.locator('.grip-equations .katex-mathml annotation').first().textContent();assert(tex?.includes('\\frac')&&!tex.includes('\\\\frac'),'Formula escaping is wrong')
  assert(await page.getByText('后台工作线程',{exact:true}).isVisible(),'Expected worker execution')
  const colored=await page.locator('.gripper-three canvas').evaluate(canvas=>{
    const s=document.createElement('canvas');s.width=200;s.height=200;const ctx=s.getContext('2d');ctx.drawImage(canvas,0,0,200,200);const data=ctx.getImageData(0,0,200,200).data;let red=0,teal=0
    for(let i=0;i<data.length;i+=4){if(data[i]>170&&data[i+1]<145&&data[i+2]<145)red++;if(data[i]<130&&data[i+1]>75&&data[i+2]>70&&data[i+1]>data[i])teal++}return {red,teal}
  })
  assert(colored.red>3&&colored.teal>10,`WebGL tendon/solid not visible: ${JSON.stringify(colored)}`)
  const canvas=page.locator('.gripper-three canvas');await page.waitForTimeout(500);const clears=await page.evaluate(()=>window.__auditClears);await page.waitForTimeout(1000);const idleClears=await page.evaluate(()=>window.__auditClears)-clears
  assert(idleClears<=2,`paused 2-D gripper redraws ${idleClears} times/s`)
  const forcesBefore=await canvas.evaluate(c=>c.toDataURL());await page.getByLabel('切换接触力箭头').click();await page.waitForTimeout(300)
  assert(forcesBefore!==await canvas.evaluate(c=>c.toDataURL()),'force toggle did not redraw the paused scene');await page.getByLabel('切换接触力箭头').click();await page.waitForTimeout(300)
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Desktop overflow')
  await page.screenshot({path:'docs/screenshots/54-gripper-desktop.jpg',type:'jpeg',quality:84,fullPage:true})
  await page.screenshot({path:'docs/screenshots/55-gripper-viewport.jpg',type:'jpeg',quality:85})
  await page.locator('.grip-contact-card').screenshot({path:'docs/screenshots/57-gripper-contact.jpg',type:'jpeg',quality:88})
  let pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 CSV'}).click();let download=await pending,content=await readFile(await download.path(),'utf8')
  let rows=content.trim().split('\n');assert(rows.length===22&&rows[0].includes('guide_4_normal_N')&&rows[0].includes('guide_4_clearance_mm'),'CSV samples or contact fields missing')
  pending=page.waitForEvent('download');await page.getByLabel('下载抓手 PNG').click();download=await pending;const png=await readFile(await download.path());assert(png.subarray(1,4).toString()==='PNG','Invalid PNG download')
  await page.getByRole('button',{name:'接触力',exact:true}).click();assert(await page.getByRole('img',{name:/最大孔壁法向力曲线/}).isVisible(),'Contact response chart not selectable')
  await page.getByRole('button',{name:'能量',exact:true}).click();assert(await page.getByRole('img',{name:/总势能曲线/}).isVisible(),'Energy chart not selectable')
  await page.getByLabel('切换初始轮廓').click();assert(await page.getByLabel('切换初始轮廓').getAttribute('aria-pressed')==='true','Reference toggle failed')
  await page.getByLabel('抓手加载历史').fill('0');await waitPull(page,0)
  let initial=await readValues(page);assert(Math.abs(initial.tip)<.01&&initial.contacts==='0 / 4','Rewind did not restore the initial state')
  await page.getByLabel('抓手单步').click();await waitPull(page,.2)
  await page.getByLabel('播放抓手').click();await waitPull(page,4);await waitDone(page)
  // New settings plus a full unload are actually solved, not a reverse animation.
  await page.getByLabel('杨氏模量').fill('500');await page.getByLabel('最大牵引位移').fill('1');await page.getByLabel('到达最大牵引后卸载').check()
  await page.getByTestId('gripper-apply').click()
  await page.waitForFunction(()=>document.querySelector('.grip-progress-end')?.textContent?.trim()==='1.0 mm'&&document.querySelector('[data-testid="gripper-status"]')?.textContent!=='已完成',null,{timeout:30000})
  await waitDone(page);await waitPull(page,0)
  const unloaded=await readValues(page);assert(Math.abs(unloaded.tip)<.01&&unloaded.tension<.001&&unloaded.contacts==='0 / 4',`Unloading did not recover: ${JSON.stringify(unloaded)}`)
  pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 CSV'}).click();download=await pending;content=await readFile(await download.path(),'utf8');rows=content.trim().split('\n')
  assert(rows.length===12&&rows.some(row=>row.startsWith('unloading,'))&&rows.some(row=>row.startsWith('loading,1,')),'Loading peak or unloading history is missing')
  await page.getByRole('button',{name:'验证与限制',exact:true}).click();assert((await page.locator('.grip-validation').innerText()).includes('网格未挖孔'),'Missing honest bore limitation')
  await page.getByLabel('杨氏模量').fill('250');await page.getByLabel('到达最大牵引后卸载').uncheck();await page.getByLabel('网格分辨率').selectOption('8')
  await page.getByTestId('gripper-apply').click();await page.getByText('345 节点 / 560 单元',{exact:true}).waitFor({timeout:30000});await waitDone(page)
  const fine=await readValues(page);assert(Math.abs(fine.tip-4.94)<.05&&Math.abs(fine.tension-.033)<.002,`Refined browser result mismatch: ${JSON.stringify(fine)}`)
  await page.getByLabel('网格分辨率').selectOption('4');await page.getByLabel('杨氏模量').fill('500');await page.getByLabel('最大牵引位移').fill('8');await page.getByLabel('初始孔壁半间隙').fill('0.2');await page.getByLabel('接触罚刚度').fill('2');await page.getByLabel('腱轴向刚度').fill('60')
  await page.getByTestId('gripper-apply').click();await waitPull(page,8);await waitDone(page)
  assert((await page.locator('.grip-error').innerText()).includes('穿透超过间隙的 10%'),'Excess penetration warning missing')
  await page.locator('.grip-stage').screenshot({path:'docs/screenshots/58-gripper-penalty-warning.jpg',type:'jpeg',quality:85})
  const fallback=await browser.newPage({viewport:{width:1200,height:900}});attach(fallback);await fallback.addInitScript(()=>{window.Worker=undefined});await fallback.goto(`${base}/?page=gripper`,{waitUntil:'domcontentloaded'});await waitPull(fallback,4);await waitDone(fallback)
  assert(await fallback.getByText('主线程回退',{exact:true}).isVisible(),'No-Worker fallback not reported');const fallbackResult=await readValues(fallback)
  assert(Math.abs(fallbackResult.tip-values.tip)<.01&&Math.abs(fallbackResult.tension-values.tension)<.001,'Worker/fallback mismatch');await fallback.close()
  const mobile=await browser.newPage({viewport:{width:390,height:844}});attach(mobile);await mobile.goto(`${base}/?page=gripper`,{waitUntil:'domcontentloaded'});await waitPull(mobile,4);await waitDone(mobile)
  assert(!(await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Mobile overflow')
  assert(await mobile.locator('.gripper-three canvas').isVisible(),'Mobile simulation missing')
  await mobile.screenshot({path:'docs/screenshots/56-gripper-mobile.jpg',fullPage:true,type:'jpeg',quality:82})
  await mobile.getByLabel('打开导航').click();assert(await mobile.getByTestId('nav-gripper').isVisible(),'Mobile gripper navigation missing');await mobile.close()
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
  const report={date:new Date().toISOString().slice(0,10),base,default:values,renderedPixels:colored,idleClearsPerSecond:idleClears,unloaded,fine,fallback:fallbackResult,checks:['default 4 mm equilibrium and four contacts','colored nonblank WebGL','4 KaTeX equations','CSV and PNG export','contact and energy charts','reference toggle','paused force-toggle redraw and idle render rate','rewind, step and playback','parameter changes and computed unload','refined mesh','high penetration warning','worker and no-worker agreement','mobile canvas/navigation/overflow','honest bore limitation'],browserErrors:errors,scope:'Browser interactions and visualization; not an experimental or 3-D contact validation.'}
  await writeFile('docs/screenshots/gripper-browser-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report))
}finally{await browser.close()}
