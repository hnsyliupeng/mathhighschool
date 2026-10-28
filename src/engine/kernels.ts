export type Kernels = {
  stretch_energy: (length: number, rest: number, ea: number) => number
  stretch_dedl: (length: number, rest: number, ea: number) => number
  sdof_step: (x: number, velocity: number, mass: number, damping: number, stiffness: number, rest: number, force: number, dt: number) => number
  turning_curvature: (ax: number, ay: number, bx: number, by: number) => number
}

export const jsKernels: Kernels = {
  stretch_energy: (length, rest, ea) => rest > 0 ? ea * (length-rest)**2/(2*rest) : NaN,
  stretch_dedl: (length, rest, ea) => rest > 0 ? ea*(length/rest-1) : NaN,
  sdof_step: (x, velocity, mass, damping, stiffness, rest, force, dt) =>
    (mass*(x/(dt*dt)+velocity/dt)+damping*x/dt+stiffness*rest+force)/(mass/(dt*dt)+damping/dt+stiffness),
  turning_curvature: (ax, ay, bx, by) => {
    const a = Math.hypot(ax, ay), b = Math.hypot(bx, by)
    const denominator = a*b + ax*bx + ay*by
    return a === 0 || b === 0 || Math.abs(denominator) < 1e-14 ? NaN : 2*(ax*by-ay*bx)/denominator
  },
}

let active: Kernels = jsKernels
export const kernels = () => active

/** Rust is an optional acceleration backend. The JS implementation has the same contract. */
export async function loadRustKernels(): Promise<boolean> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}ddg_core.wasm`)
    if (!response.ok) throw new Error(`WASM: ${response.status}`)
    const bytes = await response.arrayBuffer()
    const result = await WebAssembly.instantiate(bytes, {})
    const exp = result.instance.exports as unknown as Partial<Kernels>
    // A module can instantiate successfully but expose missing or non-callable
    // symbols. Treat that exactly like a fetch/instantiate failure so an older
    // backend is never retained after a failed reload.
    const required: (keyof Kernels)[] = ['sdof_step','stretch_energy','stretch_dedl','turning_curvature']
    if (!required.every(key => typeof exp[key] === 'function')) throw new Error('Invalid WASM kernel exports')
    active = exp as Kernels
    return true
  } catch {
    active = jsKernels
    return false
  }
}
