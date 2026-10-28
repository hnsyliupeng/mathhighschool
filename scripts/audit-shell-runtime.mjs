/** Compare one conditional shell diagnostic in Node and in the browser.
 * Requires the dev server, playwright-core and Chromium; this is not an
 * independent source trajectory or a grid/time-step convergence study.
 */
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {writeFile} from 'node:fs/promises'
import path from 'node:path'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),bundle=process.env.CHROME_BIN?null:require('@sparticuz/chromium').default
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const node=JSON.parse(execFileSync('node_modules/.bin/vite-node',['scripts/compare-axis-shell-window.ts'],{encoding:'utf8'}))
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundle.executablePath(),headless:true,args:[...(bundle?.args||[]),'--no-sandbox']})
try{
 const page=await browser.newPage()
 await page.goto(process.env.AUDIT_BASE_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'})
 const web=await page.evaluate(async()=>{
   const {compareShellConditionalWindow}=await import('/src/engine/axis-shell-window.ts')
   const data=await (await fetch('/src/data/references/axis-shell-cap-conditional.json')).json()
   const r=compareShellConditionalWindow(data)
   return {pass:r.pass,start:r.start,end:r.end,strictError:r.strictError,reactionError:r.reactionError,switchStep:r.switchStep,replayError:r.replayError,replayLimits:r.replayLimits,replayUnconverged:r.replayUnconverged,maxReplayResidual:r.maxReplayResidual,sourceLimits:r.sourceLimits,sourceUnconverged:r.sourceUnconverged}
 })
 const fields=['pass','start','end','strictError','reactionError','switchStep','replayError','replayLimits','replayUnconverged','maxReplayResidual','sourceLimits','sourceUnconverged']
 const select=x=>Object.fromEntries(fields.map(key=>[key,x[key]]))
 if(node.pass||web.pass||node.sourceLimits!==7||web.sourceLimits!==7||node.sourceUnconverged!==6||web.sourceUnconverged!==6||node.switchStep!==web.switchStep||Math.abs(node.strictError-web.strictError)>1e-6)throw Error('Conditional diagnostic status or strict path changed unexpectedly')
 const report={date:new Date().toISOString().slice(0,10),scope:'The 3.90 s seed comes from TypeScript; this is a conditional local diagnostic, not an independent full source trajectory.',nodeVersion:process.version,nodeV8:process.versions.v8,browserVersion:browser.version(),node:select(node),browser:web,replayErrorDifference:Math.abs(node.replayError-web.replayError)}
 await writeFile('docs/screenshots/shell-runtime-audit.json',JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
