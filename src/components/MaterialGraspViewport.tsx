import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import type {DynamicFrame,MaterialObjectId,ObjectMesh} from '../engine/material-grasp3d'
import type {Vec3} from '../engine/gripper3d'

export interface MaterialViewportHandle {reset:()=>void;save:()=>void;exportGif:(frames:DynamicFrame[])=>Promise<void>}
const xyz=(p:Vec3)=>new THREE.Vector3(p[0],p[2],-p[1])
const colors=['#e18b62','#6c9d89','#6a9db4','#a18cba','#c4a666']
const palette:Record<MaterialObjectId,string>={screwdriver:'#d17c4e',egg:'#ead3ad','bottle-cap':'#6d98b4',cloth:'#d78d8b'}

/** Render the solver's actual moving triangle vertices, pad centres and clips. */
export const MaterialGraspViewport=forwardRef<MaterialViewportHandle,{mesh:ObjectMesh;frame:DynamicFrame;id:MaterialObjectId;showWire:boolean;showContacts:boolean}>(function MaterialGraspViewport({mesh,frame,id,showWire,showContacts},ref){
  const host=useRef<HTMLDivElement>(null),api=useRef<MaterialViewportHandle|null>(null),current=useRef({frame,showWire,showContacts}),[error,setError]=useState('')
  current.current={frame,showWire,showContacts}
  useImperativeHandle(ref,()=>({reset:()=>api.current?.reset(),save:()=>api.current?.save(),exportGif:async frames=>{if(!api.current)throw Error('三维视图尚未准备好');await api.current.exportGif(frames)}}),[])
  useEffect(()=>{
    if(!host.current)return
    const root=host.current,scene=new THREE.Scene();scene.background=new THREE.Color('#edf4ed')
    const camera=new THREE.OrthographicCamera(-.18,.18,.145,-.145,.001,3),target=new THREE.Vector3(0,.075,-.012)
    camera.position.set(.24,.19,.29);camera.lookAt(target)
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;root.appendChild(renderer.domElement);setError('')}
    catch{setError('无法初始化 WebGL，请检查浏览器的硬件加速。');return}
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enableDamping=true;controls.minZoom=.55;controls.maxZoom=3.5
    scene.add(new THREE.HemisphereLight('#ffffff','#b4c5af',2.1))
    const light=new THREE.DirectionalLight('#fff5e7',2.1);light.position.set(.15,.35,.2);scene.add(light)
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(.7,.7),new THREE.MeshStandardMaterial({color:'#e5eee3',roughness:1,side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;floor.position.y=-.0002;scene.add(floor)
    const grid=new THREE.GridHelper(.42,21,'#bdcfbd','#d2dfd1');grid.position.y=0;scene.add(grid)
    const vertices=new Float32Array(mesh.positions.length*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setIndex(mesh.triangles.flat())
    if(id==='screwdriver')mesh.faceMaterial.forEach((m,i)=>geometry.addGroup(i*3,3,m))
    const materials=[new THREE.MeshStandardMaterial({color:palette[id],roughness:id==='cloth'?.9:.58,metalness:id==='bottle-cap'?.12:0,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#9ba6a3',metalness:.65,roughness:.34,side:THREE.DoubleSide})]
    const object=new THREE.Mesh(geometry,id==='screwdriver'?materials:materials[0]);object.frustumCulled=false;scene.add(object)
    const wire=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#355e54',wireframe:true,transparent:true,opacity:.25,depthWrite:false}));wire.frustumCulled=false;wire.renderOrder=2;scene.add(wire)
    const padGeometry=new THREE.SphereGeometry(.0075,24,16),pads=colors.map(color=>{const pad=new THREE.Mesh(padGeometry,new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.04}));scene.add(pad);return pad})
    const targetGeometry=new THREE.SphereGeometry(.002,12,8),targetMaterial=new THREE.MeshBasicMaterial({color:'#7e9d8a',transparent:true,opacity:.5,wireframe:true}),targets=colors.map(()=>{const o=new THREE.Mesh(targetGeometry,targetMaterial);scene.add(o);return o})
    const lines=colors.map(color=>{const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3)),line=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.55}));scene.add(line);return line})
    const marker=new THREE.InstancedMesh(new THREE.SphereGeometry(.00115,10,7),new THREE.MeshBasicMaterial({color:'#ffc759',depthTest:false}),512);marker.frustumCulled=false;marker.renderOrder=4;scene.add(marker)
    const clips=new THREE.InstancedMesh(new THREE.SphereGeometry(.0021,10,8),new THREE.MeshStandardMaterial({color:'#cc9b45',metalness:.4,roughness:.5}),Math.max(mesh.clipNodes.length,1));clips.frustumCulled=false;scene.add(clips)
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1)
    const update=(f:DynamicFrame)=>{
      f.positions.forEach((p,i)=>vertices.set([p[0],p[2],-p[1]],3*i));(geometry.attributes.position as THREE.BufferAttribute).needsUpdate=true;geometry.computeVertexNormals()
      f.tips.forEach((p,i)=>{pads[i].position.copy(xyz(p));targets[i].position.copy(xyz(f.targets[i]));const a=lines[i].geometry.attributes.position as THREE.BufferAttribute;a.array.set([...xyz(p).toArray(),...xyz(f.targets[i]).toArray()]);a.needsUpdate=true})
      let n=0;for(const c of f.contacts){if(n>=512)break;m.compose(xyz(c.point),q,one);marker.setMatrixAt(n++,m)}marker.count=n;marker.instanceMatrix.needsUpdate=true
      clips.count=f.clipsActive?mesh.clipNodes.length:0;for(let i=0;i<clips.count;i++){m.compose(xyz(f.positions[mesh.clipNodes[i]]),q,one);clips.setMatrixAt(i,m)}clips.instanceMatrix.needsUpdate=true
    }
    let dirty=true,latest:DynamicFrame|null=null,display=''
    const show=()=>{wire.visible=current.current.showWire;marker.visible=current.current.showContacts;targets.forEach(x=>x.visible=current.current.showContacts);lines.forEach(x=>x.visible=current.current.showContacts)}
    const render=()=>{const f=current.current.frame,s=`${current.current.showWire}:${current.current.showContacts}`;if(f!==latest){update(f);latest=f;dirty=true}if(s!==display){show();display=s;dirty=true}const moved=controls.update();if(dirty||moved){renderer.render(scene,camera);dirty=false}raf=requestAnimationFrame(render)}
    const resize=()=>{const w=root.clientWidth,h=root.clientHeight;if(!w||!h)return;const view=id==='egg'?.19:id==='bottle-cap'?.17:id==='screwdriver'?.26:.30;camera.left=-view*w/h/2;camera.right=view*w/h/2;camera.top=view/2;camera.bottom=-view/2;camera.updateProjectionMatrix();renderer.setSize(w,h,false);dirty=true}
    const observer=new ResizeObserver(resize);observer.observe(root);let raf=0;resize();render()
    api.current={
      reset:()=>{camera.position.set(.24,.19,.29);camera.zoom=1;camera.updateProjectionMatrix();controls.target.copy(target);controls.update();dirty=true},
      save:()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download=`material-grasp-${id}.png`;a.click()},
      exportGif:async frames=>{
        if(frames.length<2)throw Error('至少需要两个已接受的动力学帧')
        const {GIFEncoder,quantize,applyPalette}=await import('gifenc'),ratio=Math.min(1,520/renderer.domElement.width,520/renderer.domElement.height),width=Math.max(1,Math.round(renderer.domElement.width*ratio)),height=Math.max(1,Math.round(renderer.domElement.height*ratio))
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('无法创建 GIF 画布')
        const gif=GIFEncoder(),count=Math.min(25,frames.length)
        for(let i=0;i<count;i++){
          const f=frames[Math.round(i*(frames.length-1)/(count-1))];update(f);show();renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,width,height)
          ctx.fillStyle='rgba(246,250,244,.92)';ctx.fillRect(8,8,255,27);ctx.fillStyle='#385e4b';ctx.font='bold 10px sans-serif';ctx.fillText(`REDUCED PAD BENCH  ·  t = ${f.time.toFixed(2)} s`,15,25)
          const rgba=ctx.getImageData(0,0,width,height).data,pal=quantize(rgba,256),indexed=applyPalette(rgba,pal);gif.writeFrame(indexed,width,height,{palette:pal,delay:i===count-1?650:160,repeat:0})
        }
        gif.finish();const bytes=new Uint8Array(gif.bytes()),url=URL.createObjectURL(new Blob([bytes.buffer],{type:'image/gif'})),a=document.createElement('a');a.href=url;a.download=`material-grasp-${id}.gif`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);latest=null;dirty=true
      }
    }
    return()=>{api.current=null;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.LineSegments){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(x=>x.dispose())}});materials[1].dispose();renderer.dispose();renderer.domElement.remove()}
  },[mesh,id])
  return <div ref={host} className="material-three" data-testid="material-viewport" aria-label="自由物体弹簧网格与五个位移驱动指垫的三维动力学视图">{error&&<div className="gripper-render-error">{error}</div>}</div>
})
