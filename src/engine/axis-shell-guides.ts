import type {Vec3} from './simulation'

/** Azimuthal segments used only to display the revolved meridian. */
export const AXIS_SHELL_DISPLAY_SEGMENTS=24

/** Display-only guides for the constrained coordinates of the shell meridian.
 * The cap's rim is fixed vertically but is allowed to slide radially; do not
 * depict its rim as a fully fixed support. Positions are in scene coordinates.
 */
export function axisShellGuideSegments(kind:'inflation'|'eversion',positions:readonly Vec3[]):number[] {
  const segments=AXIS_SHELL_DISPLAY_SEGMENTS
  if(positions.length<segments*2||positions.length%segments!==0)throw Error('Invalid axisymmetric display mesh')
  if(kind==='inflation'){
    const center=positions[0]
    // Center radius is fixed; its vertical coordinate is free.
    return [center[0],-.18,center[2],center[0],Math.max(.40,center[1]+.24),center[2]]
  }
  const lines:number[]=[],start=positions.length-segments
  // Eight short radial sliders remain at the boundary's constrained height.
  for(let j=0;j<segments;j+=segments/8){
    const [x,y,z]=positions[start+j],r=Math.hypot(x,z)
    const angle=2*Math.PI*j/segments
    // The overlay must not crash the renderer if a non-default run collapses
    // the rim; the solver and its diagnostics remain responsible for validity.
    const dx=r>1e-12?x/r:Math.cos(angle),dz=r>1e-12?z/r:Math.sin(angle)
    lines.push(x-.10*dx,y,z-.10*dz,x+.22*dx,y,z+.22*dz)
  }
  return lines
}
