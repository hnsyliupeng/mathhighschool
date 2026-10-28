import * as THREE from 'three'
import type {Vec3} from './simulation'

/**
 * Fit existing orthographic orientation to current/reference geometry without
 * moving along the viewing direction. Returns the zoom, or null for no points.
 * This is presentation only; it does not alter a simulation's coordinates.
 */
export function fitOrthographicGeometry(camera:THREE.OrthographicCamera,target:THREE.Vector3,groups:readonly (readonly Vec3[])[],padding=.65):number|null {
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),point=new THREE.Vector3()
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
  for(const group of groups)for(const p of group){
    point.set(...p).sub(target)
    const x=point.dot(right),y=point.dot(up)
    if(!Number.isFinite(x)||!Number.isFinite(y))return null
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)
  }
  if(minX===Infinity)return null
  const shift=right.multiplyScalar((minX+maxX)/2).addScaledVector(up,(minY+maxY)/2)
  camera.position.add(shift);target.add(shift)
  const zoom=Math.min(1,padding*camera.right/Math.max((maxX-minX)/2,1e-6),padding*camera.top/Math.max((maxY-minY)/2,1e-6))
  camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld()
  return zoom
}
