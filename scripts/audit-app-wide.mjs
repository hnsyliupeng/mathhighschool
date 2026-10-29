/* Production app-wide UI/accessibility audit. Optional dependencies:
 * npm install --prefix /tmp/browser-audit playwright-core @sparticuz/chromium axe-core
 * npm run build && npm run preview -- --port 5175
 * AUDIT_MODULE_ROOT=/tmp/browser-audit CHROMIUM_LIB_DIR=/path/to/libs node scripts/audit-app-wide.mjs
 * The audit exercises default page states; it is not a physical-model validation.
 */
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises'
import path from 'node:path'
import {gzipSync} from 'node:zlib'
const require=createRequire(path.join(process.env.AUDIT_MODULE_ROOT||process.cwd(),'package.json'))
const {chromium}=require('playwright-core'),pkg=process.env.CHROME_BIN?null:require('@sparticuz/chromium'),bundle=pkg?.default||pkg
const axePath=require.resolve('axe-core/axe.min.js')
if(process.env.CHROMIUM_LIB_DIR)process.env.LD_LIBRARY_PATH=[process.env.CHROMIUM_LIB_DIR,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const executablePath=process.env.CHROME_BIN||await bundle.executablePath(),base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5175'
const assert=(condition,message)=>{if(!condition)throw Error(message)}
const routes=[
  ['workspace','.three-mount canvas'],['library','.case-grid .case-card'],['theory','.derivation'],['validation','.verification-summary'],
  ['gripper','.gripper-three canvas'],['gripper3d','.gripper-three canvas'],['hand3d','.gripper-three canvas'],['objects3d','.gripper-three canvas'],
  ['materials3d','[data-testid="material-viewport"] canvas'],['tendon3d','[data-testid="tendon-viewport"] canvas'],
]
const sourceFiles=[]
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(ts|tsx|css|json|woff2|txt)$/.test(file))sourceFiles.push(file)}}
await walk('src');await walk('public/licenses');sourceFiles.push('index.html','vite.config.ts','package.json','package-lock.json','public/ddg_core.wasm','scripts/audit-app-wide.mjs','scripts/subset-ui-font.py');sourceFiles.sort()
async function digest(){const h=createHash('sha256');for(const f of sourceFiles)h.update(f).update(await readFile(f));return h.digest('hex')}
const startHash=await digest(),errors=[],rows=[],workers=new Set()
await mkdir('docs/screenshots/app-review',{recursive:true})
const browser=await chromium.launch({executablePath,headless:true,args:[...(bundle?.args||[]).filter(x=>x!=='--single-process'),'--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
function attach(page){
  page.on('pageerror',e=>errors.push(`pageerror: ${e}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)})
  page.on('worker',w=>workers.add(w.url()))
}
async function ready(page,route,selector){
  await page.goto(`${base}/?page=${route}`,{waitUntil:'domcontentloaded'});await page.locator('main h1').waitFor({timeout:90000});await page.locator(selector).first().waitFor({timeout:90000});await page.waitForTimeout(400)
  assert(await page.getByTestId(`nav-${route}`).getAttribute('aria-current')==='page',`${route}: incorrect active navigation`)
  assert(await page.locator('.page-load-error,.viewport-error,.gripper-render-error').count()===0,`${route}: page or WebGL failure`)
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)
  assert(!overflow,`${route}: horizontal overflow`)
}
let idleClears,redrawOnToggle,historyAudit,guideAudit,cancelAudit,fontFallback,workspaceLoad,entryBytes=0,entryGzip=0
try{
  for(const [route,selector] of routes){
    const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});attach(page)
    await page.addInitScript(()=>{window.__auditClears=0;for(const T of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(T&&Object.hasOwn(T.prototype,'clear')){const original=T.prototype.clear;T.prototype.clear=function(...args){window.__auditClears++;return original.apply(this,args)}}})
    await ready(page,route,selector)
    if(route==='workspace'){
      // Cold-context resource timing includes the default fonts and CSS, not
      // merely the entry JS; worker fetches and the HTML navigation are separate.
      workspaceLoad=await page.evaluate(async()=>{
        await document.fonts.ready
        const resources=performance.getEntriesByType('resource').filter(r=>new URL(r.name).origin===location.origin).map(r=>({path:new URL(r.name).pathname,encodedBytes:r.encodedBodySize,decodedBytes:r.decodedBodySize,transferBytes:r.transferSize}))
        return {resources,encodedBytes:resources.reduce((n,r)=>n+r.encodedBytes,0),decodedBytes:resources.reduce((n,r)=>n+r.decodedBytes,0),transferBytes:resources.reduce((n,r)=>n+r.transferBytes,0)}
      })
      assert(workspaceLoad.encodedBytes>0&&workspaceLoad.decodedBytes>0,'resource byte timing unavailable; run without privacy-suppressing Chromium flags')
      assert(workspaceLoad.resources.some(r=>/\/ddg-cjk-subset-[^/]+\.woff2$/.test(r.path)),'UI font subset did not load')
      assert(!workspaceLoad.resources.some(r=>/\/(MathBlock|reference)-[^/]+\.js$/.test(r.path)),'formula/reference chunks loaded on the default workspace')
      await page.getByRole('tab',{name:'核心公式'}).click();await page.locator('.insight-content .katex').first().waitFor({timeout:30000})
      assert(await page.locator('.insight-content .katex-error').count()===0,'lazy formula did not render')
      await page.getByRole('tab',{name:'算例概览'}).click()
      const play=page.getByTestId('play-pause');if(await play.getAttribute('aria-label')==='暂停')await play.click()
      await page.waitForTimeout(1300);const before=await page.evaluate(()=>window.__auditClears);await page.waitForTimeout(1000);idleClears=await page.evaluate(()=>window.__auditClears)-before
      assert(idleClears<=2,`paused workspace still redraws ${idleClears} times/s`)
      const old=await page.evaluate(()=>window.__auditClears);await page.getByLabel('隐藏节点').click();await page.waitForTimeout(350);redrawOnToggle=await page.evaluate(()=>window.__auditClears)-old;assert(redrawOnToggle>0,'display toggle did not redraw')
      const download=page.waitForEvent('download',{timeout:30000});await page.getByRole('button',{name:'导出数据'}).click();const csv=await readFile(await (await download).path(),'utf8');assert(csv.includes('time_s,displacement'),'workspace CSV missing headers')
    }
    await page.addScriptTag({path:axePath})
    const violations=await page.evaluate(async()=>{const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return result.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length}))})
    const screenshot=`app-review/${route}-desktop.jpg`;await page.screenshot({path:`docs/screenshots/${screenshot}`,type:'jpeg',quality:78})
    rows.push({route,viewport:'desktop',screenshot,violations});console.log('DESKTOP',route,JSON.stringify(violations));await page.close()
  }
  for(const [route,selector] of routes){
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});attach(page);await ready(page,route,selector)
    const screenshot=`app-review/${route}-mobile.jpg`;await page.screenshot({path:`docs/screenshots/${screenshot}`,type:'jpeg',quality:76});rows.push({route,viewport:'mobile',screenshot,overflow:false});console.log('MOBILE',route);await page.close()
  }
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});attach(page)
  await ready(page,'workspace','.three-mount canvas');await page.getByTestId('nav-library').click();await page.locator('.case-grid').waitFor()
  // A Chinese glyph outside the compact UI subset must still load the
  // original fontsource fallback when typed by the user.
  await page.evaluate(()=>document.fonts.ready);const beforeFonts=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name))
  const search=page.getByLabel('搜索算例',{exact:true});await search.fill(String.fromCodePoint(0x4e10));await page.waitForTimeout(300);await page.evaluate(()=>document.fonts.ready)
  const afterFonts=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));fontFallback=afterFonts.some(url=>!beforeFonts.includes(url)&&/noto-sans-sc-100-.*\.woff2/.test(url))
  assert(fontFallback,'unlisted user-input glyph did not load the fallback font');await search.fill('')
  await page.getByTestId('nav-theory').click();await page.locator('.derivation').waitFor()
  await page.goBack();await page.waitForURL(/page=library/);assert(await page.getByTestId('nav-library').getAttribute('aria-current')==='page','history back did not restore library')
  await page.goBack();await page.waitForURL(/page=workspace/);await page.goForward();await page.waitForURL(/page=library/)
  await page.getByTestId('nav-theory').click();await page.locator('.derivation').waitFor();await page.getByRole('button',{name:/平面梁：伸长与弯曲/}).click();await page.waitForURL(/chapter=planar/);await page.goBack();await page.waitForURL(url=>url.searchParams.get('page')==='theory'&&url.searchParams.get('chapter')!=='planar');historyAudit=true
  const help=page.getByRole('button',{name:'使用帮助'});await help.click();await page.getByRole('dialog').waitFor();assert(await page.getByLabel('关闭使用说明').evaluate(el=>document.activeElement===el),'guide did not receive focus');await page.keyboard.press('Shift+Tab');assert(await page.getByRole('button',{name:'开始探索'}).evaluate(el=>document.activeElement===el),'guide focus did not wrap');await page.keyboard.press('Escape');assert(await page.getByRole('dialog').count()===0,'Escape did not close guide');assert(await help.evaluate(el=>document.activeElement===el),'guide focus was not restored');guideAudit=true
  await page.getByTestId('nav-validation').click();await page.locator('.verification-summary').waitFor();await page.getByRole('button',{name:'运行验证'}).click();await page.getByRole('button',{name:'取消验证'}).click();await page.getByRole('button',{name:'运行验证'}).waitFor();cancelAudit=true
  await page.close()
  const mobile=await browser.newPage({viewport:{width:390,height:844}});attach(mobile);await ready(mobile,'library','.case-grid .case-card');const menu=mobile.getByLabel('打开导航');await menu.click();assert(await menu.getAttribute('aria-expanded')==='true','mobile menu did not open');await mobile.keyboard.press('Escape');assert(await menu.getAttribute('aria-expanded')==='false','Escape did not close mobile menu');await mobile.close()
  const html=await readFile('dist/index.html','utf8'),entry=html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];assert(entry,'cannot find production entry chunk');const data=await readFile(path.join('dist',entry));entryBytes=data.length;entryGzip=gzipSync(data).length
  const requestPage=await browser.newPage();for(const worker of workers){if(!worker.startsWith(base))continue;const response=await requestPage.request.get(worker);assert(response.status()===200,`worker HTTP ${response.status()}: ${worker}`);assert(/javascript/.test(response.headers()['content-type']||''),`worker MIME: ${worker}`)}await requestPage.close()
  assert(!errors.length,errors.join('\n'))
  const endHash=await digest();assert(startHash===endHash,'source changed during audit')
  const violations=rows.filter(r=>r.violations?.length).map(({route,violations})=>({route,violations}))
  const report={sourceHash:endHash,sourceFiles,base,rows,workers:[...workers],workspaceLoad,idleWorkspaceClearsPerSecond:idleClears,redrawOnToggle,historyAudit,guideAudit,cancelAudit,fontFallback,entryBytes,entryGzip,violations,errors,scope:'Default page states in one desktop Chromium and one mobile viewport; automated WCAG scan only on desktop default states. Cold workspace resource timing excludes HTML navigation and worker fetches; byte counts depend on compression, fonts and environment. Does not establish accessibility in every state, browser, assistive technology, or physical-model validity.'}
  await writeFile('docs/screenshots/app-wide-audit.json',JSON.stringify(report,null,2)+'\n');console.log(violations.length?'FAIL':'PASS',JSON.stringify({routes:routes.length,viewportChecks:rows.length,violations,idleClears,redrawOnToggle,entryBytes,entryGzip,workers:workers.size}))
  if(violations.length)process.exitCode=1
}finally{await browser.close()}
