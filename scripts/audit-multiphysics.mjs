/** Interaction, non-blank canvas and loaded-state visual audit for the three new models. */
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {waitForVisibleGeometry} from './audit-canvas.mjs'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173',errors=[]
page.on('pageerror',e=>errors.push(String(e)))
const assert=(v,m)=>{if(!v)throw Error(m)}
const readTime=async()=>parseFloat(await page.getByTestId('time-value').innerText())
const displacement=async()=>parseFloat((await page.locator('.chart-meta strong').innerText()).replace(/\s/g,''))
const scenarios=[
 {id:'hyper-membrane',target:1.8,expected:60,file:'31-membrane-inflation.jpg',test:x=>x>.3,desc:'mother-line pressure inflation'},
 {id:'robot-magnetic',target:2,expected:40,file:'32-magnetic-field.jpg',test:x=>Math.abs(x)>.05,desc:'magnetically actuated beam'},
 {id:'robot-swim',target:2,expected:40,file:'33-swimmer-propulsion.jpg',test:x=>x>.1,desc:'swimming displacement with camera tracking'},
]
try{
 await mkdir('docs/screenshots',{recursive:true})
 const results=[]
 for(const scenario of scenarios){
  await page.goto(`${base}/?page=workspace&case=${scenario.id}`,{waitUntil:'networkidle'})
  await page.waitForFunction(t=>parseFloat(document.querySelector('[data-testid="time-value"]')?.textContent||'0')>=t,scenario.target,{timeout:120000})
  await page.getByTestId('play-pause').evaluate(el=>{if(!el.disabled&&el.getAttribute('aria-label')==='暂停')el.click()})
  const t=await readTime(),d=await displacement(),heading=await page.locator('.viewport-top-left').innerText()
  assert(scenario.test(d),`${scenario.id} did not reach the expected displacement: ${d}`)
  assert(heading.includes(String(scenario.expected)),`${scenario.id} node count missing: ${heading}`)
  assert(await page.locator('.solver-warning').count()===0,`${scenario.id}: solver warning`)
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),`${scenario.id}: overflow`)
  try{await waitForVisibleGeometry(page)}catch(error){await page.screenshot({path:`/tmp/ddg-canvas-failure-${scenario.id}.png`,fullPage:true});throw error}
  await page.screenshot({path:`docs/screenshots/${scenario.file}`,type:'jpeg',quality:82,fullPage:true})
  await page.getByRole('tab',{name:'验证说明'}).click()
  const note=await page.locator('.insight-content').innerText()
  assert(note.includes(scenario.id==='hyper-membrane'?'质量装配':scenario.id==='robot-magnetic'?'磁场参数':'第一端速度'),`${scenario.id}: limitations missing`)
  const slider=page.getByLabel('回看已记录的仿真时间')
  await slider.evaluate(el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'50');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))})
  await page.waitForTimeout(200)
  const rewind=await readTime();assert(rewind<.55,`${scenario.id}: rewind failed (${rewind})`)
  await waitForVisibleGeometry(page)
  results.push({id:scenario.id,description:scenario.desc,time:t,displacement:d,rewind,screenshot:scenario.file,canvas:true,solverWarning:false})
  console.log('PASS',scenario.id,JSON.stringify(results.at(-1)))
 }
 assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`)
 const report={date:new Date().toISOString().slice(0,10),results,browserErrors:errors,scope:'Browser interaction and visual audit only; numerical agreement is reported separately.'}
 await writeFile('docs/screenshots/multiphysics-audit.json',JSON.stringify(report,null,2)+'\n')
}finally{await browser.close()}
