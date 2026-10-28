import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import type {Mesh3D,Vec3} from '../engine/gripper3d'
import type {ContinuousFrame} from '../engine/continuous-gripper3d'

export interface Gripper3DViewportHandle {reset:()=>void;bore:()=>void;save:()=>void;exportGif:(frames:ContinuousFrame[])=>Promise<void>}
interface Props {mesh:Mesh3D;frame:ContinuousFrame;radius:number;showWire:boolean;showForces:boolean;xray:boolean}
// Put the length of the finger vertically while retaining all three coordinates.
const world=(p:Vec3)=>new THREE.Vector3(p[1],p[0],p[2]-.004)
const low=new THREE.Color('#276e7c'),mid=new THREE.Color('#73baa9'),high=new THREE.Color('#e5a15b')
function stressColor(v:number){const t=Math.max(0,Math.min(1,v/30000));return t<.5?low.clone().lerp(mid,t*2):mid.clone().lerp(high,(t-.5)*2)}

export const Gripper3DViewport=forwardRef<Gripper3DViewportHandle,Props>(function Gripper3DViewport({mesh,frame,radius,showWire,showForces,xray},ref){
  const mount=useRef<HTMLDivElement>(null),current=useRef({frame,showWire,showForces,xray,radius})
  current.current={frame,showWire,showForces,xray,radius}
  const api=useRef<Gripper3DViewportHandle>({reset:()=>{},bore:()=>{},save:()=>{},exportGif:async()=>{throw Error('三维视图尚未准备好，无法导出 GIF')}}),[error,setError]=useState(false)
  useImperativeHandle(ref,()=>({reset:()=>api.current.reset(),bore:()=>api.current.bore(),save:()=>api.current.save(),exportGif:(frames)=>api.current.exportGif(frames)}),[])
  useEffect(()=>{
    const host=mount.current;if(!host)return
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true})}catch{setError(true);return}
    setError(false);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor('#f2f6f0');renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement)
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.05,.05,.055,-.055,.001,3),target=new THREE.Vector3(.020,.0295,0)
    camera.position.set(.16,.1035,.20);camera.lookAt(target)
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.45;controls.maxZoom=10;controls.target.copy(target);controls.update()
    scene.add(new THREE.HemisphereLight(0xffffff,0x6b8a77,2.1));const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(.05,.16,.12);scene.add(light)
    const grid:number[]=[];for(let i=-20;i<=24;i++){const x=i*.005;grid.push(x,-.04,-.045,x,.16,-.045);grid.push(-.12,x,-.045,.15,x,-.045)}
    const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));scene.add(new THREE.LineSegments(gridGeo,new THREE.LineBasicMaterial({color:'#b4c8b9',transparent:true,opacity:.25})))
    const vertices=new Float32Array(mesh.surface.length*9),colors=new Float32Array(vertices.length),wires=new Float32Array(mesh.surface.length*18)
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
    const bodyMat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.68,roughness:.77,metalness:0,depthWrite:false})
    const body=new THREE.Mesh(geometry,bodyMat);body.frustumCulled=false;body.renderOrder=1;scene.add(body)
    const wireGeo=new THREE.BufferGeometry();wireGeo.setAttribute('position',new THREE.BufferAttribute(wires,3))
    const wire=new THREE.LineSegments(wireGeo,new THREE.LineBasicMaterial({color:'#245e61',transparent:true,opacity:.30,depthWrite:false}));wire.frustumCulled=false;wire.renderOrder=2;scene.add(wire)
    const cableGeo=new THREE.CylinderGeometry(1,1,1,10,1,false),cableMat=new THREE.MeshStandardMaterial({color:'#df504a',roughness:.7,transparent:true,depthTest:false}),cable=new THREE.InstancedMesh(cableGeo,cableMat,frame.tendon.length-1)
    cable.instanceMatrix.setUsage(THREE.DynamicDrawUsage);cable.frustumCulled=false;cable.renderOrder=3;scene.add(cable)
    const clamp=new THREE.Mesh(new THREE.BoxGeometry(.018,.0015,.011),new THREE.MeshStandardMaterial({color:'#365b4c'}));clamp.position.set(.007,-.00075,0);scene.add(clamp)
    const sphereGeo=new THREE.SphereGeometry(.00042,12,8),markerMat=new THREE.MeshBasicMaterial({color:'#f5ad55',transparent:true,depthTest:false}),markers=Array.from({length:48},()=>{const m=new THREE.Mesh(sphereGeo,markerMat);m.renderOrder=5;scene.add(m);return m})
    const arrows=Array.from({length:48},()=>{const a=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),.004,0xe79539,.0018,.0011);a.traverse(o=>{const object=o as THREE.Mesh|THREE.Line;if(object.material){const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(m=>{m.transparent=true;m.depthTest=false})}o.renderOrder=6});scene.add(a);return a})
    const sensor=new THREE.Mesh(new THREE.SphereGeometry(.0007,12,10),new THREE.MeshBasicMaterial({color:'#fff7e5',transparent:true,depthTest:false}));sensor.renderOrder=5;scene.add(sensor)
    const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),unitY=new THREE.Vector3(0,1,0),offset=new THREE.Vector3(),size=new THREE.Vector3()
    const update=(f:ContinuousFrame)=>{
      for(let i=0;i<mesh.surface.length;i++){
        const face=mesh.surface[i],color=stressColor(f.stress[face.tet]);if(face.wall!==-1)color.lerp(new THREE.Color('#b9d6ae'),.18)
        const points=face.nodes.map(id=>world(f.positions[id]))
        for(let j=0;j<3;j++){vertices.set(points[j].toArray(),i*9+j*3);colors.set([color.r,color.g,color.b],i*9+j*3);wires.set(points[j].toArray(),i*18+j*6);wires.set(points[(j+1)%3].toArray(),i*18+j*6+3)}
      }
      ;(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;(geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate=true;geometry.computeVertexNormals();(wireGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true
      for(let i=0;i<f.tendon.length-1;i++){
        const a=world(f.tendon[i]),b=world(f.tendon[i+1]),delta=b.clone().sub(a),length=delta.length();offset.copy(a).add(b).multiplyScalar(.5);quat.setFromUnitVectors(unitY,delta.normalize());size.set(current.current.radius,length,current.current.radius);matrix.compose(offset,quat,size);cable.setMatrixAt(i,matrix)
      }
      cable.instanceMatrix.needsUpdate=true;sensor.position.copy(world(f.tip))
      for(let i=0;i<markers.length;i++){
        const c=f.contacts[i],visible=!!c&&current.current.showForces;markers[i].visible=visible;arrows[i].visible=visible
        // Keep hidden markers current as well: toggling visibility after a
        // rewind must not reveal stale contact positions or directions.
        if(c){const direction=new THREE.Vector3(c.force[1],c.force[0],c.force[2]),length=Math.max(.0015,Math.min(.008,direction.length()*1.8));markers[i].position.copy(world(c.point));arrows[i].position.copy(world(c.point));arrows[i].setDirection(direction.normalize());arrows[i].setLength(length,Math.min(.0018,length*.5),Math.min(.0011,length*.35))}
      }
    }
    let latest:ContinuousFrame|null=null,raf=0,axialView=false
    const applyDisplay=(displayFrame=current.current.frame)=>{const state=current.current;wire.visible=state.showWire;bodyMat.opacity=state.xray?.55:1;bodyMat.depthWrite=!state.xray;cableMat.depthTest=!state.xray;sensor.visible=!axialView;for(let i=0;i<markers.length;i++){markers[i].visible=state.showForces&&i<displayFrame.contacts.length;arrows[i].visible=markers[i].visible}}
    const render=()=>{const state=current.current;if(latest!==state.frame){latest=state.frame;update(state.frame)}applyDisplay();controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(render)}
    const resize=()=>{const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;const h=.120,w=h*width/height;camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false)}
    const observer=new ResizeObserver(resize);observer.observe(host);resize();render()
    api.current={
      reset:()=>{axialView=false;camera.up.set(0,1,0);camera.position.set(.16,.1035,.20);camera.zoom=1;camera.updateProjectionMatrix();controls.target.copy(target);controls.update()},
      bore:()=>{
        // Follow the *deformed* distal bore instead of looking along the
        // undeformed global axis, which misses the opening at large curl.
        const f=current.current.frame,center=(ids:number[])=>ids.reduce((v,id)=>v.add(world(f.positions[id])),new THREE.Vector3()).multiplyScalar(1/ids.length)
        const {y0,y1,z0,z1}=mesh.hole,previous=mesh.reference.map((p,i)=>Math.abs(p[0]-(mesh.length-mesh.length/12))<1e-10&&(Math.abs(p[1]-y0)<1e-10||Math.abs(p[1]-y1)<1e-10)&&(Math.abs(p[2]-z0)<1e-10||Math.abs(p[2]-z1)<1e-10)?i:-1).filter(i=>i>=0)
        const mouth=center(mesh.anchor),direction=mouth.clone().sub(center(previous)).normalize()
        axialView=true;camera.up.set(0,0,1);camera.position.copy(mouth).addScaledVector(direction,.18);camera.zoom=10;camera.updateProjectionMatrix();controls.target.copy(mouth);controls.update()
      },
      save:()=>{renderer.render(scene,camera);const link=document.createElement('a');link.download='tendon-gripper-3d.png';link.href=renderer.domElement.toDataURL('image/png');link.click()},
      exportGif:async frames=>{
        if(frames.length<2)throw Error('至少需要两个收敛帧才能导出 GIF')
        const {GIFEncoder,quantize,applyPalette}=await import('gifenc')
        const factor=Math.min(1,520/renderer.domElement.width,520/renderer.domElement.height),width=Math.max(1,Math.round(renderer.domElement.width*factor)),height=Math.max(1,Math.round(renderer.domElement.height*factor))
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('无法创建 GIF 画布')
        const gif=GIFEncoder()
        for(let i=0;i<frames.length;i++){
          update(frames[i]);applyDisplay(frames[i]);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,width,height)
          ctx.fillStyle='rgba(247,250,244,.88)';ctx.fillRect(9,8,215,30);ctx.fillStyle='#315b4a';ctx.font='bold 12px sans-serif';ctx.fillText(`PULL ${(frames[i].pull*1000).toFixed(2)} mm  ·  TIP ${frames[i].tipAngleDeg.toFixed(1)}°`,17,28)
          const rgba=ctx.getImageData(0,0,width,height).data,palette=quantize(rgba,256),index=applyPalette(rgba,palette)
          gif.writeFrame(index,width,height,{palette,delay:i===frames.length-1?650:180,repeat:0})
        }
        gif.finish();const bytes=new Uint8Array(gif.bytes()),url=URL.createObjectURL(new Blob([bytes.buffer],{type:'image/gif'})),link=document.createElement('a');link.href=url;link.download='tendon-gripper-3d.gif';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
        latest=null
      }
    }
    return ()=>{cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Line){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove()}
  },[mesh])
  return <div className="gripper-three" ref={mount} aria-label="可旋转的真实三维孔壁与腱接触视图">{error&&<div className="gripper-render-error">无法初始化 WebGL。请检查浏览器硬件加速。</div>}</div>
})
