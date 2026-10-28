// Audit automatic framing at the end of a long deformed proxy trajectory.
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {waitForVisibleGeometry} from './audit-canvas.mjs'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173',browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const assert=(v,m)=>{if(!v)throw Error(m)},errors=[]
const sample=page=>page.evaluate(()=>{const src=document.querySelector('.three-mount canvas'),dst=document.createElement('canvas');dst.width=128;dst.height=64;const ctx=dst.getContext('2d');ctx.drawImage(src,0,0,128,64);return [...ctx.getImageData(0,0,128,64).data]})
const diff=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length
async function terminal(page,id='rod-helix'){
  await page.goto(`${base}/?page=workspace&case=${id}`,{waitUntil:'networkidle'})
  await page.getByTitle('切换播放速度').click()
  await page.waitForFunction(()=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=10,null,{timeout:180000})
  assert(await page.locator('.solver-warning').count()===0,`${id} solver warning`)
  await page.waitForTimeout(400)
}
try{
 await mkdir('docs/screenshots/end-cases',{recursive:true});await mkdir('/tmp/ddg-end-crops',{recursive:true})
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(String(e)))
 await terminal(page);await waitForVisibleGeometry(page)
 await page.screenshot({path:'docs/screenshots/end-cases/06-rod-helix.jpg',type:'jpeg',quality:78,fullPage:true})
 await page.locator('.viewport-shell').screenshot({path:'/tmp/ddg-end-crops/06-rod-helix.jpg',type:'jpeg',quality:88})
 const initial=await sample(page),canvas=page.locator('.three-mount canvas'),box=await canvas.boundingBox()
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-420);await page.waitForTimeout(700)
 const zoomed=await sample(page),zoomDifference=diff(initial,zoomed)
 assert(zoomDifference>.1,`User zoom had no lasting effect: ${zoomDifference}`)
 await page.getByLabel('重置视角').click();await page.waitForTimeout(700)
 const reset=await sample(page),resetDifference=diff(initial,reset)
 assert(resetDifference<.25,`Reset did not restore automatic fit: ${resetDifference}`)
 for(const [number,id] of [['11','plate-gravity'],['12','plate-wrinkle']]){
   await terminal(page,id);await waitForVisibleGeometry(page)
   await page.screenshot({path:`docs/screenshots/end-cases/${number}-${id}.jpg`,type:'jpeg',quality:78,fullPage:true})
   await page.locator('.viewport-shell').screenshot({path:`/tmp/ddg-end-crops/${number}-${id}.jpg`,type:'jpeg',quality:88})
 }
 await page.close()
 const mobile=await browser.newPage({viewport:{width:390,height:844}});mobile.on('pageerror',e=>errors.push(String(e)))
 await terminal(mobile)
 assert(!(await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),'Mobile overflow')
 await mobile.screenshot({path:'docs/screenshots/50-mobile-helix-end.jpg',type:'jpeg',quality:82,fullPage:true});await mobile.close()
 assert(!errors.length,'Browser errors: '+errors.join(' | '))
 const report={date:new Date().toISOString().slice(0,10),browserVersion:browser.version(),cases:['rod-helix','plate-gravity','plate-wrinkle'],time:10,zoomDifference,resetDifference,mobileWidth:390,errors,scope:'Camera interaction and captured viewport only; this is still a proxy model, not a rod-physics validation.'}
 await writeFile('docs/screenshots/camera-fit-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
