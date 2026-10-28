// Exercise production chunks, WASM, Worker and no-Worker fallback in Chromium.
// Run npm run build && npm run preview -- --port 4173 first.
import {createRequire} from 'node:module'
import {writeFile} from 'node:fs/promises'
import path from 'node:path'
import {waitForVisibleGeometry} from './audit-canvas.mjs'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:4173'
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const results=[]
try{
  for(const mode of ['worker','no-worker']){
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failures=[],assets=[]
    page.on('pageerror',e=>errors.push(String(e)))
    page.on('requestfailed',req=>failures.push(`${req.url()}: ${req.failure()?.errorText}`))
    page.on('response',res=>{
      if(res.url().startsWith(base)&&res.status()>=400)failures.push(`${res.status()} ${res.url()}`)
      if(res.url().startsWith(base)&&/\.(?:js|css|wasm)(?:\?|$)/.test(res.url()))assets.push({url:res.url().slice(base.length),status:res.status(),type:res.headers()['content-type']||''})
    })
    try{
      if(mode==='no-worker')await page.addInitScript(()=>{Object.defineProperty(window,'Worker',{value:undefined,configurable:true})})
      await page.goto(`${base}/?page=workspace&case=beam-gravity`,{waitUntil:'networkidle'})
      await page.getByText('WASM 就绪',{exact:false}).waitFor({timeout:30000})
      await waitForVisibleGeometry(page)
      await page.goto(`${base}/?page=theory`,{waitUntil:'networkidle'})
      await page.locator('.theory-nav-item').nth(2).click()
      if(!(await page.getByTestId('spatial-rod-lab').isVisible())||await page.locator('.derivation .katex-error').count())throw Error(`${mode}: production spatial-rod theory failed`)
      const angle=page.getByLabel('后边材料转角');await angle.focus();await angle.press('End')
      if(Math.abs(parseFloat(await page.getByTestId('rod-twist').innerText())-Math.PI/2)>.002)throw Error(`${mode}: production rod slider failed`)
      await page.goto(`${base}/?page=validation`,{waitUntil:'networkidle'})
      await page.getByRole('button',{name:'运行验证',exact:true}).click()
      await page.getByRole('button',{name:'重新运行验证'}).waitFor({timeout:360000})
      const summary=await page.locator('.verification-summary').innerText()
      if(!summary.includes('15 / 15')||!summary.includes('21 / 21')||!summary.includes('10 / 21'))throw Error(`${mode}: wrong validation status ${summary}`)
      if(errors.length||failures.length)throw Error(`${mode}: ${[...errors,...failures].join(' | ')}`)
      const wasm=assets.find(a=>a.url.endsWith('/ddg_core.wasm'))
      if(!wasm||wasm.status!==200||!wasm.type.includes('application/wasm'))throw Error(`${mode}: invalid WASM response ${JSON.stringify(wasm)}`)
      const result={mode,summary:summary.replace(/\s+/g,' ').trim(),wasmStatus:wasm.status,wasmMime:wasm.type,loadedAssetCount:assets.length,browserErrors:errors,requestFailures:failures}
      results.push(result);console.log('PASS',JSON.stringify(result))
    }finally{await page.close()}
  }
  await writeFile('docs/screenshots/production-audit.json',JSON.stringify({date:new Date().toISOString().slice(0,10),browserVersion:browser.version(),results,scope:'Built Vite assets on preview server, WASM MIME/availability, nonblank initial WebGL, spatial-rod theory slider and validation with Worker and no-Worker dynamic-import fallback. Reference failures remain visible; this is not physical validation.'},null,2)+'\n')
}finally{await browser.close()}
