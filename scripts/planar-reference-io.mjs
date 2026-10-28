/** Parsing and compacting raw, per-node DDG_Tutorial output. */
export function compactPlanar(raw,expectedSteps,kind){
  const n=40,rows=raw.trim().split(/\r?\n/).filter(Boolean).map(line=>line.trim().split(/\s+/).map(Number))
  if(rows.length!==expectedSteps*n||rows.some(row=>row.length!==3||row.some(v=>!Number.isFinite(v))))throw Error(`${kind}: expected ${expectedSteps*n} finite rows, found ${rows.length}`)
  const trajectory=[],frames=[]
  for(let i=0;i<expectedSteps;i++){
    const step=i+1,at=i*n
    trajectory.push(rows[at+19][2])
    // Full configuration at each second and densely around the snap-through.
    if(step===1||step===expectedSteps||step%100===0||(kind==='buckling'&&step>=690&&step<=710)||(kind==='snap'&&step>=1400&&step<=1650&&step%10===0)){
      frames.push({step,positions:rows.slice(at,at+n).flatMap(row=>[row[1],row[2]])})
    }
  }
  return {steps:expectedSteps,dt:.01,probeNode:19,trajectory,frames}
}

export function makePlanarReference({bucklingRaw,snapRaw,bucklingSteps,snapSteps,commit,runner,warnings={buckling:[],snap:[]}}){
  return {
    metadata:{
      reference_repository:'https://github.com/weicheng-huang-mechanics/DDG_Tutorial',reference_commit:commit,runner,
      modifications:'Removed plotting, close/clc and per-iteration logging; instrumented maximum-iteration exits; printed 12 significant digits. Case 3 records all timesteps rather than only those after 5 s. No physics, loading, solver tolerances, or time steps were changed.',
      sampling:'Probe is zero-based node 19 (the 20th of 40). Its y-coordinate is recorded at every time step. All 40 node coordinates are saved at step 1, each 1 s, every step from 6.9 to 7.1 s for buckling, and every 0.1 s from 14 to 16.5 s for snap-through (within each captured interval).',
      original_solver:'Newton tolerance 1e-4 and maximum_iter 10 (the source can return on the 11th iteration); browser solver uses a 1e-7 residual tolerance and a line search.',
      warnings
    },
    buckling:compactPlanar(bucklingRaw,bucklingSteps,'buckling'),snap:compactPlanar(snapRaw,snapSteps,'snap')
  }
}
