import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {fitOrthographicGeometry} from '../camera-fit'
import type {Vec3} from '../simulation'

function makeCamera(aspect:number){
  const c=new THREE.OrthographicCamera(-2.4*aspect,2.4*aspect,2.4,-2.4,.1,100)
  c.position.set(4.7,3.8,6.4);c.lookAt(0,0,0);c.updateMatrixWorld();return c
}
function inBounds(camera:THREE.OrthographicCamera,points:Vec3[]){
  for(const p of points){const v=new THREE.Vector3(...p).project(camera);expect(Math.abs(v.x)).toBeLessThanOrEqual(.6500001);expect(Math.abs(v.y)).toBeLessThanOrEqual(.6500001)}
}
describe('orthographic view fitting',()=>{
  it.each([.65,1,2.4])('keeps initial and stretched shapes in view at aspect %s',aspect=>{
    const camera=makeCamera(aspect),target=new THREE.Vector3(),initial:Vec3[]=[[-1,1,0],[1,1,0],[0,-1,1]],deformed:Vec3[]=[[-1,1,0],[.2,-10,.2],[1,-7,-1]]
    const before=[...deformed.map(p=>[...p])],zoom=fitOrthographicGeometry(camera,target,[initial,deformed])
    expect(zoom).not.toBeNull();expect(zoom!).toBeGreaterThan(0);expect(zoom!).toBeLessThan(1)
    inBounds(camera,[...initial,...deformed]);expect(deformed).toEqual(before)
    // Repeated updates on a stationary shape must not drift or zoom further.
    const position=camera.position.clone(),savedTarget=target.clone()
    fitOrthographicGeometry(camera,target,[initial,deformed]);expect(camera.position.distanceTo(position)).toBeLessThan(1e-12);expect(target.distanceTo(savedTarget)).toBeLessThan(1e-12)
  })
  it('does not alter the camera for empty or non-finite geometry',()=>{
    const camera=makeCamera(1),target=new THREE.Vector3(),original=camera.position.clone()
    expect(fitOrthographicGeometry(camera,target,[])).toBeNull()
    expect(fitOrthographicGeometry(camera,target,[[[NaN,0,0]]])).toBeNull()
    expect(camera.position.distanceTo(original)).toBe(0);expect(target.length()).toBe(0)
  })
})
