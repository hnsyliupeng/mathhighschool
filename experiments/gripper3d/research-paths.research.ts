/* Opt-in integration experiment, NEVER imported into the production app.
 * The mock substitutes only the solid kernel; contact, CCD, rollback and
 * gripper geometry are the production code. Run cases separately:
 *   GRIPPER_RESEARCH_CASE=coarse npx vitest run --config experiments/gripper3d/vitest.research.config.ts
 *   GRIPPER_RESEARCH_CASE=fine   npx vitest run --config experiments/gripper3d/vitest.research.config.ts
 *   GRIPPER_RESEARCH_CASE=finer npx vitest run --config experiments/gripper3d/vitest.research.config.ts
 *   npx vite-node experiments/gripper3d/combine-paths.ts
 * Results under /tmp; final comparison intentionally fails if coarse/fine
 * end-force differences exceed 5%. These paths are not a safety certificate.
 */
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {expect,it,vi} from 'vitest'

vi.mock('../../src/engine/hexahedron',async importOriginal=>{
  const actual=await importOriginal<typeof import('../../src/engine/hexahedron')>()
  const {neoHookeanHexEnhanced}=await import('./incompatible-hex')
  return {...actual,neoHookeanHex:neoHookeanHexEnhanced}
})
import {ContinuousGripper3D} from '../../src/engine/continuous-gripper3d'
import {defaultGripper3DParams} from '../../src/engine/gripper3d'

const specs={coarse:{meshLevel:1 as const,pull:.003},fine:{meshLevel:2 as const,pull:.003},finer:{meshLevel:3 as const,pull:.0005}}
const name=process.env.GRIPPER_RESEARCH_CASE as keyof typeof specs
it('runs one experimental incompatible-element path with unchanged contact and safety',()=>{
  if(!specs[name])throw Error('GRIPPER_RESEARCH_CASE must be coarse, fine, or finer')
  const params={...defaultGripper3DParams,...specs[name]},solver=new ContinuousGripper3D(params),n=Math.ceil(params.pull/params.step),history=[]
  let failure:string|null=null
  for(let i=1;i<=n;i++){
    const frame=solver.step(Math.min(params.pull,i*params.step)),row={pullMm:frame.pull*1000,converged:frame.converged,tipMm:frame.tipDeflection*1000,tipAngleDeg:frame.tipAngleDeg,tensionN:frame.tension,penetrationUm:frame.checkPenetration*1e6,complementarityUm:frame.complementarity*1e6,residualN:frame.residual,minJ:frame.minJ,pathJLowerBound:frame.minPathJ,substeps:frame.substeps,message:frame.message||null}
    console.log(name,JSON.stringify(row));if(!frame.converged){failure=frame.message||'nonconvergence';break}history.push(row)
  }
  const paths=['src/engine/gripper3d.ts','src/engine/continuous-gripper3d.ts','src/engine/hexahedron.ts','src/engine/hex-jacobian-bound.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts','experiments/gripper3d/incompatible-hex.ts'],hash=createHash('sha256');for(const p of paths)hash.update(p).update(readFileSync(p))
  const report={name,codeHash:hash.digest('hex'),params,hexes:solver.hexes.length,failure,history,scope:'Research-only nonconforming element substituted via test mock; not the production GUI, not a physical experiment or a full validation.'}
  writeFileSync(`/tmp/gripper3d-incompatible-${name}.json`,JSON.stringify(report,null,2)+'\n')
  expect(failure).toBeNull();expect(history.length).toBe(n)
})
