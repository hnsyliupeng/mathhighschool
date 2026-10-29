import data from '../data/multi-object-comparison.json'

type Comparison={status:string;sourceHash:string;targetNormalizedMm:number;cases:{id:string;name:string;dimensionsMm:number[];acceptedNormalizedMm:number;contactFingers:number;netObjectForceN:number;maxObjectPenetrationUm:number;maxTendonPenetrationUm:number;maxResidualN:number;limitedPathChecksPass:boolean;failure:string|null}[]}
const comparison=data as Comparison
export function MultiObjectComparison(){
  return <section className="card object-comparison" aria-label="多物体数值对比审查"><div className="grip-section-head"><div><span className="eyebrow">REPRODUCIBLE COMPARISON · FIXED OBJECTS</span><h2>不同物体的路径审查</h2></div><span className="object-review-badge">非自由抓取验收</span></div>
    <p>固定支撑、无摩擦，统一尺度倍率 100%，请求相似牵引 {comparison.targetNormalizedMm.toFixed(2)} mm。仅将到达目标、五指均接触且数值检查满足门槛的工况标为“有限路径通过”；这不代表总体抓取通过。</p>
    {comparison.cases.length?<div className="object-review-scroll"><table><thead><tr><th>固定物体 · 尺寸 mm</th><th>接受牵引</th><th>接触指</th><th>末态合力 N</th><th>路径物体穿透 μm</th><th>路径腱孔穿透 μm</th><th>末态最大残差 N</th><th>有限路径</th></tr></thead><tbody>{comparison.cases.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.dimensionsMm.map(v=>v.toFixed(0)).join(' × ')}</small></td><td>{c.acceptedNormalizedMm.toFixed(2)} mm</td><td>{c.contactFingers} / 5</td><td>{c.netObjectForceN.toFixed(5)}</td><td>{c.maxObjectPenetrationUm.toFixed(4)}</td><td>{c.maxTendonPenetrationUm.toFixed(4)}</td><td>{c.maxResidualN.toExponential(2)}</td><td><span className={c.limitedPathChecksPass?'object-pass':'object-not-pass'}>{c.limitedPathChecksPass?'有限路径通过':'未通过'}</span>{c.failure&&<small title={c.failure}>增量回滚</small>}</td></tr>)}</tbody></table></div>:<p>正在生成可复现的多物体路径报告；各工况运行结果不会预先标记为通过。</p>}
    <p className="object-comparison-foot">仅对所列尺寸、材料、网格和加载路径有效。最大残差是最终帧自由残差（实际相似尺度）。精确模型、失败原因和独立审查见 <code>docs/MULTI_OBJECT_GRASP_3D.md</code>。{comparison.sourceHash&&<> 数值源码 SHA-256：<code>{comparison.sourceHash.slice(0,12)}…</code></>}</p>
  </section>
}
