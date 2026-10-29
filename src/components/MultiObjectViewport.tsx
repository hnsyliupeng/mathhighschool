import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type {Mesh3D,Vec3} from '../engine/gripper3d'
import {FINGERS,worldPoint} from '../engine/bionic-hand3d'
import type {ObjectHandFrame} from '../engine/object-hand3d'
import type {GraspObject} from '../engine/object-presets3d'

interface Props {mesh:Mesh3D;frame:ObjectHandFrame;object:GraspObject;showWire:boolean;xray:boolean;showContacts:boolean}
export interface MultiObjectViewportHandle {reset:()=>void;save:()=>void;exportGif:(frames:ObjectHandFrame[])=>Promise<void>}
const v=(p:Vec3)=>new THREE.Vector3(...p)
const low=new THREE.Color('#297982'),mid=new THREE.Color('#81c7b3'),high=new THREE.Color('#e5aa65')
function stressColor(s:number){const t=Math.max(0,Math.min(1,s/30000));return t<.5?low.clone().lerp(mid,2*t):mid.clone().lerp(high,2*t-1)}

export const MultiObjectViewport=forwardRef<MultiObjectViewportHandle,Props>(function MultiObjectViewport({mesh,frame,object,showWire,xray,showContacts},ref){
  const mount=useRef<HTMLDivElement>(null),current=useRef({frame,showWire,xray,showContacts}),[error,setError]=useState(false)
  current.current={frame,showWire,xray,showContacts}
  const api=useRef<MultiObjectViewportHandle>({reset:()=>{},save:()=>{},exportGif:async()=>{throw Error('三维视图尚未准备好')}})
  useImperativeHandle(ref,()=>({reset:()=>api.current.reset(),save:()=>api.current.save(),exportGif:frames=>api.current.exportGif(frames)}),[])
  useEffect(()=>{
    const host=mount.current;if(!host)return
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true})}catch{setError(true);return}
    setError(false);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor('#eff5f1');renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement)
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.1,.1,.1,-.1,.001,3),target=new THREE.Vector3(0,.025,.015)
    const reset=()=>{camera.up.set(0,1,0);camera.position.set(.185,.16,.23);camera.zoom=1;camera.updateProjectionMatrix();camera.lookAt(target)}
    reset();const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.5;controls.maxZoom=5;controls.target.copy(target);controls.update()
    scene.add(new THREE.HemisphereLight(0xffffff,0x7b958e,2.1));const light=new THREE.DirectionalLight(0xffffff,1.35);light.position.set(-.1,.18,.25);scene.add(light)
    const grid:number[]=[];for(let i=-12;i<=12;i++){const t=i*.015;grid.push(t,-.10,-.021,t,.16,-.021);grid.push(-.18,t,-.021,.18,t,-.021)}
    const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));scene.add(new THREE.LineSegments(gridGeo,new THREE.LineBasicMaterial({color:'#bed0c3',transparent:true,opacity:.4})))
    // The palm is a fixed support visualization. It is not a deformable FEM
    // body and is not included in palm collision/contact calculations.
    const palm=new THREE.Mesh(new THREE.BoxGeometry(.104,.068,.012),new THREE.MeshStandardMaterial({color:'#82ada6',roughness:.85}));palm.position.set(0,-.034,-.006);scene.add(palm)
    // Visual mounting block joins the raised, opposed thumb root to the palm.
    const thumbMount=new THREE.Mesh(new THREE.BoxGeometry(.012,.012,.012),new THREE.MeshStandardMaterial({color:'#82ada6',roughness:.85}));thumbMount.position.set(-.049,-.008,.004);scene.add(thumbMount)
    // The displayed surface uses the same core/radius parameters as the
    // solver (rendering is tessellated; contact uses analytic distances).
    for(const primitive of object.primitives){
      let geometry:THREE.BufferGeometry,position:THREE.Vector3,rotation=new THREE.Quaternion()
      if(primitive.kind==='segment'){
        const a=v(primitive.a),b=v(primitive.b),delta=b.clone().sub(a),coreLength=delta.length()
        position=a.clone().add(b).multiplyScalar(.5)
        geometry=coreLength<1e-12?new THREE.SphereGeometry(primitive.radius,40,28):new THREE.CapsuleGeometry(primitive.radius,coreLength,12,32)
        if(coreLength>=1e-12)rotation.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())
      }else{
        const [a,b,c,d]=primitive.corners.map(v),u=b.clone().sub(a),w=d.clone().sub(a),x=u.clone().normalize(),y=w.clone().normalize(),z=x.clone().cross(y).normalize()
        position=a.clone().add(c).multiplyScalar(.5);rotation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))
        geometry=new RoundedBoxGeometry(u.length()+2*primitive.radius,w.length()+2*primitive.radius,2*primitive.radius,6,primitive.radius)
      }
      const shape=new THREE.Mesh(geometry,new THREE.MeshPhongMaterial({color:'#649ece',transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide,shininess:35}))
      shape.position.copy(position);shape.quaternion.copy(rotation);shape.renderOrder=2;scene.add(shape)
      const wire=new THREE.LineSegments(new THREE.WireframeGeometry(geometry),new THREE.LineBasicMaterial({color:'#6595b8',transparent:true,opacity:.11,depthWrite:false}))
      wire.position.copy(position);wire.quaternion.copy(rotation);wire.renderOrder=2;scene.add(wire)
    }
    const cableGeo=new THREE.CylinderGeometry(1,1,1,8,1),cableMat=new THREE.MeshStandardMaterial({color:'#d84b46',roughness:.6,transparent:true})
    const items=FINGERS.map((spec,i)=>{
      const vertices=new Float32Array(mesh.surface.length*9),colors=new Float32Array(vertices.length),wires=new Float32Array(mesh.surface.length*18)
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
      const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.68,roughness:.8,depthWrite:false})
      const body=new THREE.Mesh(geometry,material);body.frustumCulled=false;body.renderOrder=1;scene.add(body)
      const wireGeo=new THREE.BufferGeometry();wireGeo.setAttribute('position',new THREE.BufferAttribute(wires,3))
      const wire=new THREE.LineSegments(wireGeo,new THREE.LineBasicMaterial({color:'#326e6a',transparent:true,opacity:.20,depthWrite:false}));wire.frustumCulled=false;wire.renderOrder=3;scene.add(wire)
      const cable=new THREE.InstancedMesh(cableGeo,cableMat,frame.fingers[i].tendon.length-1);cable.instanceMatrix.setUsage(THREE.DynamicDrawUsage);cable.frustumCulled=false;cable.renderOrder=4;scene.add(cable)
      const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),.008,0xf0a44f,.0025,.0014);arrow.traverse(o=>{const child=o as THREE.Mesh|THREE.Line;if(child.material){const mats=Array.isArray(child.material)?child.material:[child.material];mats.forEach(m=>{m.transparent=true;m.depthTest=false})}o.renderOrder=7});scene.add(arrow)
      return {spec,vertices,colors,wires,geometry,wireGeo,material,wire,cable,arrow}
    })
    const markerGeo=new THREE.SphereGeometry(.00065,10,7)
    const tendonMarks=new THREE.InstancedMesh(markerGeo,new THREE.MeshBasicMaterial({color:'#efa543',depthTest:false}),240),objectMarks=new THREE.InstancedMesh(markerGeo,new THREE.MeshBasicMaterial({color:'#53c6e6',depthTest:false}),160)
    tendonMarks.frustumCulled=false;objectMarks.frustumCulled=false;tendonMarks.renderOrder=6;objectMarks.renderOrder=6;scene.add(tendonMarks,objectMarks)
    const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),unitY=new THREE.Vector3(0,1,0),offset=new THREE.Vector3(),size=new THREE.Vector3(),identity=new THREE.Quaternion()
    const update=(f:ObjectHandFrame)=>{
      let nt=0,no=0
      for(let i=0;i<items.length;i++){
        const item=items[i],finger=f.fingers[i],local=finger.local
        for(let j=0;j<mesh.surface.length;j++){
          const face=mesh.surface[j],color=stressColor(local.stress[face.tet]),points=face.nodes.map(id=>v(finger.positions[id]))
          for(let k=0;k<3;k++){item.vertices.set(points[k].toArray(),j*9+k*3);item.colors.set([color.r,color.g,color.b],j*9+k*3);item.wires.set(points[k].toArray(),j*18+k*6);item.wires.set(points[(k+1)%3].toArray(),j*18+k*6+3)}
        }
        ;(item.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;(item.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate=true;item.geometry.computeVertexNormals();(item.wireGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true
        for(let j=0;j<finger.tendon.length-1;j++){
          const a=v(finger.tendon[j]),b=v(finger.tendon[j+1]),delta=b.clone().sub(a),length=delta.length()
          offset.copy(a).add(b).multiplyScalar(.5);quat.setFromUnitVectors(unitY,delta.normalize());size.set(.0004*item.spec.scale,length,.0004*item.spec.scale);matrix.compose(offset,quat,size);item.cable.setMatrixAt(j,matrix)
        }
        item.cable.instanceMatrix.needsUpdate=true
        for(const c of local.contacts){if(nt>=240)break;matrix.compose(v(worldPoint(item.spec,c.point)),identity,new THREE.Vector3(1,1,1));tendonMarks.setMatrixAt(nt++,matrix)}
        for(const c of local.objectContacts){if(no>=160)break;matrix.compose(v(worldPoint(item.spec,c.point)),identity,new THREE.Vector3(1.3,1.3,1.3));objectMarks.setMatrixAt(no++,matrix)}
        const force=v(finger.objectForce),first=local.objectContacts[0];item.arrow.visible=!!first&&current.current.showContacts&&force.length()>1e-9
        if(first&&force.length()>1e-9){item.arrow.position.copy(v(worldPoint(item.spec,first.point)));item.arrow.setDirection(force.clone().normalize());const length=Math.max(.004,Math.min(.018,force.length()*.22));item.arrow.setLength(length,Math.min(.003,length*.4),Math.min(.002,length*.25))}
      }
      tendonMarks.count=nt;objectMarks.count=no;tendonMarks.instanceMatrix.needsUpdate=true;objectMarks.instanceMatrix.needsUpdate=true
    }
    let latest:ObjectHandFrame|null=null,raf=0,dirty=true,lastDisplay=''
    const applyDisplay=(displayFrame=current.current.frame)=>{const state=current.current;items.forEach((item,i)=>{item.wire.visible=state.showWire;item.material.opacity=state.xray?.62:1;item.material.depthWrite=!state.xray;const finger=displayFrame.fingers[i];item.arrow.visible=state.showContacts&&finger.local.objectContacts.length>0&&Math.hypot(...finger.objectForce)>1e-9});cableMat.depthTest=!state.xray;tendonMarks.visible=state.showContacts;objectMarks.visible=state.showContacts}
    // Do not redraw an unchanged scene at 60 fps while the CPU-bound worker
    // solves the next equilibrium. Orbit damping, resizing and display toggles
    // still invalidate the frame; this also keeps software WebGL usable.
    const render=()=>{
      const state=current.current,display=`${state.showWire}:${state.xray}:${state.showContacts}`
      let changed=dirty||display!==lastDisplay
      if(latest!==state.frame){latest=state.frame;update(state.frame);changed=true}
      if(changed){applyDisplay();lastDisplay=display}
      const cameraChanged=controls.update()
      if(changed||cameraChanged){renderer.render(scene,camera);dirty=false}
      raf=requestAnimationFrame(render)
    }
    const resize=()=>{const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;const h=.215,w=h*width/height;camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);dirty=true}
    const observer=new ResizeObserver(resize);observer.observe(host);resize();render()
    api.current={
      reset:()=>{reset();controls.target.copy(target);controls.update();dirty=true},
      save:()=>{renderer.render(scene,camera);const link=document.createElement('a');link.download=`multi-object-${object.id}.png`;link.href=renderer.domElement.toDataURL('image/png');link.click()},
      exportGif:async frames=>{
        if(frames.length<2)throw Error('至少需要两个收敛帧才能导出 GIF')
        const {GIFEncoder,quantize,applyPalette}=await import('gifenc'),factor=Math.min(1,520/renderer.domElement.width,520/renderer.domElement.height),width=Math.max(1,Math.round(renderer.domElement.width*factor)),height=Math.max(1,Math.round(renderer.domElement.height*factor))
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('无法创建 GIF 画布')
        const gif=GIFEncoder()
        for(let i=0;i<frames.length;i++){
          update(frames[i]);applyDisplay(frames[i]);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,width,height)
          ctx.fillStyle='rgba(247,250,244,.9)';ctx.fillRect(9,8,245,28);ctx.fillStyle='#315b4a';ctx.font='bold 11px sans-serif';ctx.fillText(`FIXED ${object.english}  ·  ${frames[i].objectContactFingers}/5 CONTACTS`,17,26)
          const rgba=ctx.getImageData(0,0,width,height).data,palette=quantize(rgba,256),index=applyPalette(rgba,palette);gif.writeFrame(index,width,height,{palette,delay:i===frames.length-1?650:180,repeat:0})
        }
        gif.finish();const bytes=new Uint8Array(gif.bytes()),url=URL.createObjectURL(new Blob([bytes.buffer],{type:'image/gif'})),link=document.createElement('a');link.href=url;link.download=`multi-object-${object.id}.gif`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);latest=null;dirty=true
      }
    }
    return ()=>{cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Line||obj instanceof THREE.LineSegments){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove()}
  },[mesh,object])
  return <div className="gripper-three" ref={mount} aria-label="可旋转的五指三维实体、五根腱和固定物体接触视图">{error&&<div className="gripper-render-error">无法初始化 WebGL。请检查浏览器硬件加速。</div>}</div>
})
