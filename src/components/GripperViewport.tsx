import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import type {GripperFrame,GripperMesh,Point2} from '../engine/gripper'

export interface GripperViewportHandle {reset:()=>void;save:()=>void}
interface Props {mesh:GripperMesh;frame:GripperFrame;showMesh:boolean;showReference:boolean;showForces:boolean}
// The solver uses x along the finger and y across it. Rotate the presentation to
// match the supplied sketch: root below, tendon running vertically.
const world=(p:Point2,z=0)=>new THREE.Vector3(p[1],p[0],z)
const low=new THREE.Color('#276f7e'),mid=new THREE.Color('#6db9a7'),high=new THREE.Color('#e6a258')
function stressColor(v:number){const t=Math.max(0,Math.min(1,v/30000));return t<.5?low.clone().lerp(mid,t*2):mid.clone().lerp(high,(t-.5)*2)}

export const GripperViewport=forwardRef<GripperViewportHandle,Props>(function GripperViewport({mesh,frame,showMesh,showReference,showForces},ref){
  const mount=useRef<HTMLDivElement>(null),current=useRef({frame,showMesh,showReference,showForces})
  current.current={frame,showMesh,showReference,showForces}
  const api=useRef<GripperViewportHandle>({reset:()=>{},save:()=>{}}),[error,setError]=useState(false)
  useImperativeHandle(ref,()=>({reset:()=>api.current.reset(),save:()=>api.current.save()}),[])
  useEffect(()=>{
    const host=mount.current;if(!host)return
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true})}catch{setError(true);return}
    setError(false);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor('#f2f6f0');renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement)
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.05,.05,.06,-.06,.001,10),target=new THREE.Vector3(.014,.033,0)
    camera.position.set(target.x,target.y,1);camera.lookAt(target)
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableRotate=false;controls.enableDamping=true;controls.minZoom=.55;controls.maxZoom=8;controls.target.copy(target);controls.update()
    const grid:number[]=[]
    for(let i=-24;i<=28;i++){const x=i*.005;grid.push(x,-.05,-.002,x,.15,-.002);grid.push(-.12,x,-.002,.15,x,-.002)}
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));scene.add(new THREE.LineSegments(gg,new THREE.LineBasicMaterial({color:'#b4c8b9',transparent:true,opacity:.2})))
    const pos=new Float32Array(mesh.triangles.length*9),colors=new Float32Array(pos.length),wire=new Float32Array(mesh.triangles.length*18)
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
    const body=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));body.frustumCulled=false;scene.add(body)
    const wireGeo=new THREE.BufferGeometry();wireGeo.setAttribute('position',new THREE.BufferAttribute(wire,3));const lines=new THREE.LineSegments(wireGeo,new THREE.LineBasicMaterial({color:'#154e5c',transparent:true,opacity:.35}));lines.frustumCulled=false;scene.add(lines)
    const boundaries=new Map<string,{a:number;b:number;count:number}>()
    for(const t of mesh.triangles)for(const [a,b] of [[t.nodes[0],t.nodes[1]],[t.nodes[1],t.nodes[2]],[t.nodes[2],t.nodes[0]]]){const key=a<b?`${a}:${b}`:`${b}:${a}`,v=boundaries.get(key);if(v)v.count++;else boundaries.set(key,{a,b,count:1})}
    const original:number[]=[];for(const {a,b,count} of boundaries.values())if(count===1){const p=world(mesh.reference[a],.0003),q=world(mesh.reference[b],.0003);original.push(...p.toArray(),...q.toArray())}
    const refGeo=new THREE.BufferGeometry();refGeo.setAttribute('position',new THREE.Float32BufferAttribute(original,3));const reference=new THREE.LineSegments(refGeo,new THREE.LineDashedMaterial({color:'#78958b',dashSize:.0014,gapSize:.001,transparent:true,opacity:.62}));reference.computeLineDistances();scene.add(reference)
    const clamp=new THREE.Mesh(new THREE.PlaneGeometry(.021,.003),new THREE.MeshBasicMaterial({color:'#37564f'}));clamp.position.set(.007,-.002,0.001);scene.add(clamp)
    const cableGeo=new THREE.BufferGeometry(),cableData=new Float32Array((frame.tendon.length-1)*18);cableGeo.setAttribute('position',new THREE.BufferAttribute(cableData,3))
    const cable=new THREE.Mesh(cableGeo,new THREE.MeshBasicMaterial({color:'#e5544d',side:THREE.DoubleSide}));cable.frustumCulled=false;scene.add(cable)
    const ringGeo=new THREE.RingGeometry(.00155,.002,28),dotGeo=new THREE.CircleGeometry(.0009,24)
    const rings=mesh.guides.map(()=>{const mat=new THREE.MeshBasicMaterial({color:'#edf8f3',side:THREE.DoubleSide}),r=new THREE.Mesh(ringGeo,mat);scene.add(r);return r})
    const dots=mesh.guides.map(()=>{const d=new THREE.Mesh(dotGeo,new THREE.MeshBasicMaterial({color:'#f5a852',side:THREE.DoubleSide}));scene.add(d);return d})
    const arrows=mesh.guides.map(()=>{const a=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),.005,0xf6aa57,.0022,.0014);scene.add(a);return a})
    const actuator=new THREE.Mesh(new THREE.RingGeometry(.0018,.0025,24),new THREE.MeshBasicMaterial({color:'#e5544d',side:THREE.DoubleSide}));scene.add(actuator)
    const sensor=new THREE.Mesh(new THREE.RingGeometry(.00065,.0013,24),new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide}));scene.add(sensor)
    const update=(f:GripperFrame)=>{
      for(let i=0;i<mesh.triangles.length;i++){
        const triangle=mesh.triangles[i],color=stressColor(f.stress[i]),v=triangle.nodes.map(id=>world(f.positions[id],0))
        for(let j=0;j<3;j++){pos.set(v[j].toArray(),i*9+j*3);colors.set([color.r,color.g,color.b],i*9+j*3);wire.set(v[j].toArray(),i*18+j*6);wire.set(v[(j+1)%3].toArray(),i*18+j*6+3)}
      }
      ;(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;(geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate=true;(wireGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true
      for(let i=0;i<f.tendon.length-1;i++){
        const a=world(f.tendon[i],.003),b=world(f.tendon[i+1],.003),d=b.clone().sub(a).normalize(),n=new THREE.Vector3(-d.y,d.x,0).multiplyScalar(.00065)
        const A=a.clone().add(n),B=a.clone().sub(n),C=b.clone().add(n),D=b.clone().sub(n)
        cableData.set([...A.toArray(),...B.toArray(),...C.toArray(),...B.toArray(),...D.toArray(),...C.toArray()],i*18)
      }
      ;(cableGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true
      actuator.position.copy(world(f.tendon[0],.004));sensor.position.copy(world(f.tip,.004))
      f.contacts.forEach((c,i)=>{
        rings[i].position.copy(world(c.center,.004));(rings[i].material as THREE.MeshBasicMaterial).color.set(c.active?'#f6aa57':'#e4f2ea')
        dots[i].position.copy(world(c.point,.005));dots[i].visible=c.active
        const direction=new THREE.Vector3(c.force[1],c.force[0],0),length=Math.min(.012,c.magnitude*.35)
        arrows[i].visible=current.current.showForces&&c.active&&length>1e-5
        if(arrows[i].visible){arrows[i].position.copy(world(c.point,.006));arrows[i].setDirection(direction.normalize());arrows[i].setLength(length,Math.min(.0022,length*.55),Math.min(.0014,length*.4))}
      })
    }
    let latest:GripperFrame|null=null,raf=0
    const render=()=>{const state=current.current;if(latest!==state.frame){latest=state.frame;update(state.frame)}lines.visible=state.showMesh;reference.visible=state.showReference;controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(render)}
    const resize=()=>{const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;const h=.12,w=h*width/height;camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false)}
    const observer=new ResizeObserver(resize);observer.observe(host);resize();render()
    api.current={reset:()=>{camera.position.set(target.x,target.y,1);camera.zoom=1;camera.updateProjectionMatrix();controls.target.copy(target);controls.update()},save:()=>{renderer.render(scene,camera);const link=document.createElement('a');link.download='tendon-gripper.png';link.href=renderer.domElement.toDataURL('image/png');link.click()}}
    return ()=>{cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Line){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove()}
  },[mesh])
  return <div className="gripper-three" ref={mount} aria-label="超弹性指体与牵引腱接触的三维渲染视图">{error&&<div className="gripper-render-error">无法初始化 WebGL。请检查浏览器的硬件加速。</div>}</div>
})
