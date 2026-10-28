//! Small, dependency-free numerical kernels shared by the browser and Rust.
//! This is not a port of the full MATLAB solver. Units are chosen by the caller.

/// Axial Hookean energy, E = EA (l-l0)^2/(2 l0).
#[no_mangle]
pub extern "C" fn stretch_energy(length: f64, rest: f64, ea: f64) -> f64 {
    if rest <= 0.0 { return f64::NAN; }
    let delta = length - rest;
    0.5 * ea * delta * delta / rest
}

/// dE/dl. The nodal gradient follows by multiplying by the unit edge tangent.
#[no_mangle]
pub extern "C" fn stretch_dedl(length: f64, rest: f64, ea: f64) -> f64 {
    if rest <= 0.0 { return f64::NAN; }
    ea * (length / rest - 1.0)
}

/// One implicit-Euler step of m*x''+c*x'+k*(x-l0)=force.
#[no_mangle]
pub extern "C" fn sdof_step(x: f64, velocity: f64, m: f64, c: f64, k: f64, l0: f64, force: f64, dt: f64) -> f64 {
    let denom = m / (dt * dt) + c / dt + k;
    (m * (x / (dt * dt) + velocity / dt) + c * x / dt + k * l0 + force) / denom
}

/// Dimensionless integrated signed turning curvature 2*tan(phi/2).
#[no_mangle]
pub extern "C" fn turning_curvature(ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let a = ax.hypot(ay);
    let b = bx.hypot(by);
    let denominator = a * b + ax * bx + ay * by;
    if a == 0.0 || b == 0.0 || denominator.abs() < 1e-14 { return f64::NAN; }
    2.0 * (ax * by - ay * bx) / denominator
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn energy_derivative() {
        let h = 1e-6;
        let fd = (stretch_energy(1.2+h, 1.0, 8.0) - stretch_energy(1.2-h, 1.0, 8.0))/(2.0*h);
        assert!((fd-stretch_dedl(1.2, 1.0, 8.0)).abs() < 1e-8);
    }
    #[test] fn oscillator_residual() {
        let (x, v, dt) = (1.0, 0.2, 0.01);
        let next = sdof_step(x, v, 1.0, 0.1, 10.0, 1.0, 0.4, dt);
        let residual = ((next-x)/dt-v)/dt + 0.1*(next-x)/dt + 10.0*(next-1.0) - 0.4;
        assert!(residual.abs() < 1e-10);
    }
    #[test] fn curvature_quarter_turn() {
        assert!((turning_curvature(1.0, 0.0, 0.0, 1.0) - 2.0).abs() < 1e-12);
    }
}
