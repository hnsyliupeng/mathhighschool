/** Reject a blank/lost WebGL frame instead of treating a canvas element as evidence. */
export async function waitForVisibleGeometry(page) {
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('.three-mount canvas')
    if(!(canvas instanceof HTMLCanvasElement)||!canvas.width||!canvas.height)return false
    const sample=document.createElement('canvas');sample.width=160;sample.height=80
    const ctx=sample.getContext('2d');if(!ctx)return false
    ctx.drawImage(canvas,0,0,sample.width,sample.height)
    const p=ctx.getImageData(0,0,sample.width,sample.height).data
    let dark=0
    for(let i=0;i<p.length;i+=4)if(p[i+3]>200&&(p[i]<185||p[i+1]<185||p[i+2]<170))dark++
    return dark>=4
  },null,{timeout:30000,polling:250})
  // Let the screenshot compositor consume the completed WebGL frame.
  await page.waitForTimeout(150)
}
