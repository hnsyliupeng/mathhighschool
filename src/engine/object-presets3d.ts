import type {Vec3} from './gripper3d'
import {validateRoundedObject,type FixedRoundedObject,type RoundedPrimitive} from './rounded-object-contact'

export type ObjectPresetId='ball60'|'ball90'|'ball110'|'capsule'|'rounded-box'|'dumbbell'
export interface GraspObject extends FixedRoundedObject {id:ObjectPresetId;name:string;english:string;scale:number;dimensionsMm:[number,number,number];supportHeight:number}
export const OBJECT_PRESETS:{id:ObjectPresetId;name:string;description:string}[]=[
  {id:'ball60',name:'小球 · Ø60 mm',description:'球形，60 mm 直径'},
  {id:'ball90',name:'球体 · Ø90 mm',description:'球形，90 mm 直径'},
  {id:'ball110',name:'大球 · Ø110 mm',description:'球形，110 mm 直径'},
  {id:'capsule',name:'胶囊棒 · 90 × 60 mm',description:'圆柱中段与半球端组成的胶囊'},
  {id:'rounded-box',name:'圆角盒 · 90 × 80 × 50 mm',description:'平面矩形核的球形膨胀，带平面和圆角'},
  {id:'dumbbell',name:'双球哑铃 · 98 × 52 mm',description:'两个重叠球的并集，不是单球包围盒'},
]
/** Scale about the object's centre in the horizontal plane, while retaining a
 * fixed 18 mm bottom height. This is a prescribed, fixed support, not gravity. */
export function createGraspObject(id:ObjectPresetId,scale=1):GraspObject{
  if(!OBJECT_PRESETS.some(p=>p.id===id)||!Number.isFinite(scale)||scale<.65||scale>1.25)throw Error('物体尺寸必须为 0.65–1.25 倍，且形状必须有效')
  const supportHeight=.018,cy=.045,primitives:RoundedPrimitive[]=[],segment=(a:Vec3,b:Vec3,r:number)=>primitives.push({kind:'segment',a,b,radius:r})
  let name='',english='',dimensionsMm:[number,number,number]
  if(id==='ball60'||id==='ball90'||id==='ball110'){
    const d=Number(id.slice(4)),r=d*.0005*scale,p:Vec3=[0,cy,supportHeight+r]
    segment(p,p,r);name=id==='ball60'?'小球':id==='ball90'?'球体':'大球';english='SPHERE';dimensionsMm=[d*scale,d*scale,d*scale]
  }else if(id==='capsule'){
    const r=.03*scale,h=.015*scale,z=supportHeight+r
    segment([-h,cy,z],[h,cy,z],r);name='胶囊棒';english='CAPSULE';dimensionsMm=[90*scale,60*scale,60*scale]
  }else if(id==='rounded-box'){
    const r=.025*scale,hx=.020*scale,hy=.015*scale,z=supportHeight+r
    primitives.push({kind:'rectangle',corners:[[-hx,cy-hy,z],[hx,cy-hy,z],[hx,cy+hy,z],[-hx,cy+hy,z]],radius:r})
    name='圆角盒';english='ROUNDED BOX';dimensionsMm=[90*scale,80*scale,50*scale]
  }else{
    const r=.026*scale,h=.023*scale,z=supportHeight+r
    segment([-h,cy,z],[-h,cy,z],r);segment([h,cy,z],[h,cy,z],r)
    name='双球哑铃';english='TWO-SPHERE UNION';dimensionsMm=[98*scale,52*scale,52*scale]
  }
  const object:GraspObject={id,name,english,scale,dimensionsMm,supportHeight,primitives,stiffnessPerArea:2e8}
  validateRoundedObject(object)
  return object
}
