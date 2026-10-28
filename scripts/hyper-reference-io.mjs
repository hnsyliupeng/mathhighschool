/** Compact the original per-node cable output without changing the solver. */
export function makeHyperReference({raw,steps,commit,runner,warnings}) {
  const n=40,rows=raw.trim().split(/\r?\n/).filter(Boolean).map(line=>line.trim().split(/\s+/).map(Number))
  if(rows.length!==steps*n||rows.some(row=>row.length!==3||row.some(x=>!Number.isFinite(x))))throw Error(`Expected ${steps*n} finite rows, received ${rows.length}`)
  const trajectory=[],frames=[]
  for(let i=0;i<steps;i++){
    const step=i+1,at=i*n;trajectory.push(rows[at+19][2])
    if(step===1||step===steps||step%100===0||(step<=200&&step%25===0))frames.push({step,positions:rows.slice(at,at+n).flatMap(row=>[row[1],row[2]])})
  }
  return {
    metadata:{reference_repository:'https://github.com/weicheng-huang-mechanics/DDG_Tutorial',reference_commit:commit,runner,
      modifications:'Removed plotting, close/clc and iteration logging, instrumented maximum-iteration exits, and printed 12 significant digits. No physics, force ramp, solver tolerances, initial coordinates or time step were changed.',
      sampling:'Zero-based probe node 19 (the 20th of 40) is recorded every 1 ms. All 40 nodes are recorded at step 1, every 25 steps through 200, every 100 steps thereafter, and the final step.',
      original_solver:'Newton tolerance 1e-4, maximum_iter 10 (the source can exit after the 11th iteration); browser solver uses tolerance 1e-7 and line search.',warnings},
    steps,dt:.001,probeNode:19,trajectory,frames
  }
}
