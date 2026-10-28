import { kernels } from './kernels'

export function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length
  const a = matrix.map((row, i) => [...row, rhs[i]])
  for (let k = 0; k < n; k++) {
    let pivot = k
    for (let i = k+1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[pivot][k])) pivot = i
    if (Math.abs(a[pivot][k]) < 1e-14 || !Number.isFinite(a[pivot][k])) throw new Error('Singular linear system')
    ;[a[k], a[pivot]] = [a[pivot], a[k]]
    for (let i = k+1; i < n; i++) {
      const c = a[i][k]/a[k][k]
      if (c === 0) continue
      a[i][k] = 0
      for (let j = k+1; j <= n; j++) a[i][j] -= c*a[k][j]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let i = n-1; i >= 0; i--) {
    let sum = a[i][n]
    for (let j = i+1; j < n; j++) sum -= a[i][j]*x[j]
    x[i] = sum/a[i][i]
  }
  return x
}

export function oscillatorStep(x:number, v:number, t:number, dt:number, force=1, stiffness=10, damping=.1): [number,number] {
  const next = kernels().sdof_step(x, v, 1, damping, stiffness, 1, force*Math.sin(t+dt), dt)
  return [next, (next-x)/dt]
}

// Three free masses, connected to a fixed wall by k = [10, 20, 30] and c = [0.1, 0.1, 0.1].
export function chainMatrices(kScale=1, damping=.1) {
  const stiffness = [10*kScale, 20*kScale, 30*kScale]
  const K = Array.from({length:3}, () => new Array<number>(3).fill(0))
  const C = Array.from({length:3}, () => new Array<number>(3).fill(0))
  stiffness.forEach((k, i) => {
    K[i][i] += k; C[i][i] += damping
    if (i > 0) { K[i-1][i-1] += k; K[i-1][i] -= k; K[i][i-1] -= k; C[i-1][i-1] += damping; C[i-1][i] -= damping; C[i][i-1] -= damping }
  })
  return { K, C }
}

/** q contains displacements from [1, 2, 3], not absolute positions. */
export function chainStep(q:number[], v:number[], t:number, dt:number, forceScale=1, kScale=1, damping=.1) {
  const { K, C } = chainMatrices(kScale, damping)
  const A = K.map((row, i) => row.map((k, j) => k+C[i][j]/dt+(i === j ? 1/(dt*dt) : 0)))
  const rhs = q.map((qi, i) => (qi+dt*v[i])/(dt*dt) + C[i].reduce((sum, cij, j) => sum+cij*q[j]/dt, 0) + forceScale*(i+1)*Math.sin((i+1)*(t+dt)))
  const next = solveLinear(A, rhs)
  return { q:next, v:next.map((x, i) => (x-q[i])/dt), K, C }
}
