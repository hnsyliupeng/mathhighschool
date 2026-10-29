import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {FINGERS} from '../engine/bionic-hand3d'
import type {Mesh3D,Vec3} from '../engine/gripper3d'
import type {ObjectMesh,MaterialObjectId} from '../engine/material-grasp3d'
import type {TendonDynamicFrame} from '../engine/tendon-dynamic-grasp'

interface Props {mesh:Mesh3D;objectMesh:ObjectMesh;fixtureNodes:number[];frame:TendonDynamicFrame;id:MaterialObjectId;wire:boolean;xray:boolean;contacts:boolean}
export interface TendonDynamicViewportHandle {reset:()=>void;save:()=>void;exportGif:(frames:TendonDynamicFrame[])=>Promise<void>}
const v=(p:Vec3)=>new THREE.Vector3(...p)
const palette:Record<MaterialObjectId,string>={egg:'#e8b58c',screwdriver:'#d49f5f','bottle-cap':'#8ab4d5',cloth:'#d4a979'}

export const TendonDynamicViewport=forwardRef<TendonDynamicViewportHandle,Props>(function TendonDynamicViewport(props,ref){
  const host=useRef<HTMLDivElement>(null),current=useRef(props),api=useRef<TendonDynamicViewportHandle|null>(null),[error,setError]=useState('')
  current.current=props
  useImperativeHandle(ref,()=>({reset:()=>api.current?.reset(),save:()=>api.current?.save(),exportGif:async frames=>{if(!api.current)throw Error('视图尚未准备');await api.current.exportGif(frames)}}),[])
  useEffect(()=>{
    const root=host.current;if(!root)return
    const {mesh,objectMesh,id,fixtureNodes}=props,scene=new THREE.Scene();scene.background=new THREE.Color('#edf4ef')
    const camera=new THREE.OrthographicCamera(-.14,.14,.12,-.12,.001,4),target=new THREE.Vector3(0,.037,.053)
    camera.up.set(0,0,1)
    const reset=()=>{camera.position.set(-.23,-.25,.22);camera.zoom=1;camera.lookAt(target);camera.updateProjectionMatrix()};reset()
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;root.appendChild(renderer.domElement);setError('')}catch{setError('无法初始化 WebGL');return}
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enableDamping=true;controls.minZoom=.5;controls.maxZoom=4
    scene.add(new THREE.HemisphereLight('#ffffff','#8aa69a',2.1));const light=new THREE.DirectionalLight('#fff6e8',1.8);light.position.set(-.18,-.1,.28);scene.add(light)
    const grid=new THREE.GridHelper(.42,21,'#b8cdbf','#d3e1d8');grid.rotation.x=Math.PI/2;grid.position.z=-.022;scene.add(grid)
    const palm=new THREE.Mesh(new THREE.BoxGeometry(.104,.068,.012),new THREE.MeshStandardMaterial({color:'#7aa99e',roughness:.8}));palm.position.set(0,-.034,-.006);scene.add(palm)
    const mount=new THREE.Mesh(new THREE.BoxGeometry(.012,.012,.012),new THREE.MeshStandardMaterial({color:'#7aa99e',roughness:.8}));mount.position.set(-.049,-.008,.004);scene.add(mount)
    const cableGeometry=new THREE.CylinderGeometry(1,1,1,8),cableMaterial=new THREE.MeshStandardMaterial({color:'#d14c48',roughness:.45,depthTest:true})
    const hands=FINGERS.map((spec,i)=>{
      const points=new Float32Array(mesh.reference.length*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(points,3));geometry.setIndex(mesh.surface.flatMap(face=>face.nodes))
      const material=new THREE.MeshStandardMaterial({color:i===0?'#58998b':'#74b9a8',roughness:.74,transparent:true,opacity:.64,side:THREE.DoubleSide,depthWrite:false})
      const body=new THREE.Mesh(geometry,material);body.frustumCulled=false;body.renderOrder=1;scene.add(body)
      const wire=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#245f5c',wireframe:true,transparent:true,opacity:.16,depthWrite:false}));wire.frustumCulled=false;wire.renderOrder=3;scene.add(wire)
      const cable=new THREE.InstancedMesh(cableGeometry,cableMaterial,props.frame.fingers[i].tendon.length-1);cable.frustumCulled=false;cable.renderOrder=4;scene.add(cable)
      return {spec,points,geometry,material,wire,cable}
    })
    const objectPoints=new Float32Array(objectMesh.positions.length*3),objectGeometry=new THREE.BufferGeometry();objectGeometry.setAttribute('position',new THREE.BufferAttribute(objectPoints,3));objectGeometry.setIndex(objectMesh.triangles.flat())
    if(id==='screwdriver')objectMesh.faceMaterial.forEach((m,i)=>objectGeometry.addGroup(i*3,3,m))
    const objectMaterials=[new THREE.MeshStandardMaterial({color:palette[id],roughness:.65,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#a7b3b1',roughness:.3,metalness:.6,side:THREE.DoubleSide})]
    const object=new THREE.Mesh(objectGeometry,id==='screwdriver'?objectMaterials:objectMaterials[0]);object.frustumCulled=false;scene.add(object)
    const objectWire=new THREE.Mesh(objectGeometry,new THREE.MeshBasicMaterial({color:'#775d4a',wireframe:true,transparent:true,opacity:.23,depthWrite:false}));objectWire.frustumCulled=false;objectWire.renderOrder=3;scene.add(objectWire)
    const pointGeometry=new THREE.SphereGeometry(.00085,9,7),markers=new THREE.InstancedMesh(pointGeometry,new THREE.MeshBasicMaterial({color:'#ffbf52',depthTest:false}),1024);markers.frustumCulled=false;markers.renderOrder=5;scene.add(markers)
    const pins=new THREE.InstancedMesh(new THREE.SphereGeometry(.0017,10,8),new THREE.MeshStandardMaterial({color:'#f5c45c',metalness:.3,roughness:.4}),Math.max(1,fixtureNodes.length));pins.frustumCulled=false;pins.renderOrder=6;scene.add(pins)
    const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),identity=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),size=new THREE.Vector3(),offset=new THREE.Vector3()
    const update=(f:TendonDynamicFrame)=>{
      palm.position.z=-.006+f.wristRise;mount.position.z=.004+f.wristRise
      hands.forEach((item,i)=>{
        const finger=f.fingers[i];finger.positions.forEach((p,j)=>item.points.set(p,j*3));(item.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;item.geometry.computeVertexNormals()
        for(let j=0;j<finger.tendon.length-1;j++){const a=v(finger.tendon[j]),b=v(finger.tendon[j+1]),delta=b.clone().sub(a),length=delta.length();offset.copy(a).add(b).multiplyScalar(.5);quat.setFromUnitVectors(up,delta.normalize());size.set(.0004*item.spec.scale,length,.0004*item.spec.scale);matrix.compose(offset,quat,size);item.cable.setMatrixAt(j,matrix)}item.cable.instanceMatrix.needsUpdate=true
      })
      f.objectPositions.forEach((p,i)=>objectPoints.set(p,3*i));(objectGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;objectGeometry.computeVertexNormals()
      let n=0;for(const c of f.contacts){if(n===1024)break;matrix.compose(v(c.point),identity,new THREE.Vector3(1,1,1));markers.setMatrixAt(n++,matrix)}markers.count=n;markers.instanceMatrix.needsUpdate=true
      pins.count=f.fixtureActive?fixtureNodes.length:0;for(let i=0;i<pins.count;i++){matrix.compose(v(f.objectPositions[fixtureNodes[i]]),identity,new THREE.Vector3(1,1,1));pins.setMatrixAt(i,matrix)}pins.instanceMatrix.needsUpdate=true
    }
    let dirty=true,latest:TendonDynamicFrame|null=null,display='',raf=0
    const show=()=>{const {wire,xray,contacts}=current.current;hands.forEach(item=>{item.wire.visible=wire;item.material.opacity=xray?.56:1;item.material.depthWrite=!xray});objectWire.visible=wire;markers.visible=contacts}
    const render=()=>{const state=current.current,key=`${state.wire}:${state.xray}:${state.contacts}`;if(state.frame!==latest){latest=state.frame;update(state.frame);dirty=true}if(key!==display){display=key;show();dirty=true}const moved=controls.update();if(dirty||moved){renderer.render(scene,camera);dirty=false}raf=requestAnimationFrame(render)}
    const resize=()=>{const w=root.clientWidth,h=root.clientHeight;if(!w||!h)return;const view=id==='cloth'?.22:.18;camera.left=-view*w/h/2;camera.right=view*w/h/2;camera.top=view/2;camera.bottom=-view/2;camera.updateProjectionMatrix();renderer.setSize(w,h,false);dirty=true}
    const observer=new ResizeObserver(resize);observer.observe(root);resize();render()
    api.current={reset:()=>{reset();controls.target.copy(target);controls.update();dirty=true},save:()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download=`tendon-dynamic-${id}.png`;a.click()},exportGif:async frames=>{
      if(frames.length<2)throw Error('至少需要两个已接受帧')
      const {GIFEncoder,quantize,applyPalette}=await import('gifenc'),scale=Math.min(1,520/renderer.domElement.width,520/renderer.domElement.height),width=Math.max(1,Math.round(renderer.domElement.width*scale)),height=Math.max(1,Math.round(renderer.domElement.height*scale)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('无法创建画布')
      const gif=GIFEncoder(),count=Math.min(30,frames.length)
      for(let i=0;i<count;i++){const f=frames[Math.round(i*(frames.length-1)/(count-1))];update(f);show();renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,width,height);ctx.fillStyle='rgba(245,250,244,.92)';ctx.fillRect(8,8,315,27);ctx.fillStyle='#315a49';ctx.font='bold 10px sans-serif';ctx.fillText(`REDUCED TENDON HAND · SAMPLED · ${f.time.toFixed(2)} s · ${f.fixtureActive?'FIXTURE ON':'FIXTURE OFF'}`,15,25);const rgba=ctx.getImageData(0,0,width,height).data,pal=quantize(rgba,256),indices=applyPalette(rgba,pal);gif.writeFrame(indices,width,height,{palette:pal,delay:i===count-1?650:150,repeat:0})}
      gif.finish();const bytes=new Uint8Array(gif.bytes()),url=URL.createObjectURL(new Blob([bytes.buffer],{type:'image/gif'})),a=document.createElement('a');a.href=url;a.download=`tendon-dynamic-${id}.gif`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);latest=null;dirty=true
    }}
    return()=>{api.current=null;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove()}
  },[props.mesh,props.objectMesh,props.fixtureNodes,props.id])
  return <div role="region" ref={host} className="tendon-three" data-testid="tendon-viewport" aria-label="五根腱驱实体指、腱线及可变形物体的降阶动力学三维视图">{error&&<div role="alert" className="gripper-render-error">{error}</div>}</div>
})
