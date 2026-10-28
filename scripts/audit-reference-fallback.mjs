// Ensure the lazily loaded, worker-disabled reference fallback is functional.
import {createRequire} from 'node:module'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(()=>{Object.defineProperty(window,'Worker',{value:undefined,configurable:true})})
 await page.goto(`${process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173'}/?page=validation`,{waitUntil:'networkidle'})
 await page.getByRole('button',{name:'运行验证',exact:true}).click()
 await page.getByRole('button',{name:'重新运行验证'}).waitFor({timeout:360000})
 const summary=await page.locator('.verification-summary').innerText()
 if(!summary.includes('15 / 15')||!summary.includes('21 / 21')||!summary.includes('10 / 21')||errors.length)throw Error(`Worker-disabled reference fallback failed: ${summary} ${errors.join(' | ')}`)
 console.log('PASS: worker disabled; lazy reference fallback produced 15/15 checks, 21/21 smoke, 10/21 strict reference passes')
}finally{await browser.close()}
