import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CaseDefinition } from '../data/cases'
import type { Frame } from '../engine/simulation'
import { axisShellGuideSegments } from '../engine/axis-shell-guides'
import { fitOrthographicGeometry } from '../engine/camera-fit'

export interface ViewportHandle { resetCamera:()=>void; savePng:()=>void }
interface Props { item:CaseDefinition; frameRef:React.RefObject<Frame>; showNodes:boolean; showReference:boolean; revision:number }

export const ThreeViewport=forwardRef<ViewportHandle,Props>(function ThreeViewport({item,frameRef,showNodes,showReference,revision},ref){
  const mount=useRef<HTMLDivElement>(null), api=useRef<ViewportHandle>({resetCamera:()=>{},savePng:()=>{}})
  const flags=useRef({showNodes,showReference});flags.current={showNodes,showReference}
  const [error,setError]=useState(false)
  useImperativeHandle(ref,()=>({resetCamera:()=>api.current.resetCamera(),savePng:()=>api.current.savePng()}),[])
  useEffect(()=>{
    const host=mount.current;if(!host)return
    let renderer:THREE.WebGLRenderer
    try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true})} catch {setError(true);return}
    setError(false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
    renderer.setClearColor(0xf3f5ee,1);renderer.outputColorSpace=THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)
    const scene=new THREE.Scene()
    const frame=frameRef.current
    const is3d=['空间曲线','轴对称曲面','空间曲面','杆网络'].includes(item.group)||item.model==='torus'
    const camera=new THREE.OrthographicCamera(-4,4,2,-2,.1,100)
    const planarCenter=item.id==='beam-gravity'?-1.05:item.id==='hyper-cable'?-1.2:0
    const center=new THREE.Vector3(0,is3d?0:planarCenter,0)
    if(is3d)camera.position.set(4.7,3.8,6.4);else camera.position.set(0,planarCenter,10)
    camera.lookAt(center)
    const controls=new OrbitControls(camera,renderer.domElement)
    const fitDeforming=['rod-helix','plate-gravity','plate-wrinkle'].includes(item.id)
    const initialAutoFit=item.id==='hyper-membrane'||fitDeforming
    controls.target.copy(center);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=true;controls.minZoom=initialAutoFit?.1:.6;controls.maxZoom=4
    let autoFit=initialAutoFit
    controls.addEventListener('start',()=>{autoFit=false})
    controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}
    controls.update();const defaultPos=camera.position.clone(), defaultTarget=controls.target.clone()
    const light=new THREE.HemisphereLight(0xffffff,0xc4cbbb,2);scene.add(light)
    const directional=new THREE.DirectionalLight(0xffffff,2);directional.position.set(1,5,7);scene.add(directional)

    // Quiet graph-paper grid: in XY for planar cases, horizontal XZ for spatial cases.
    const gridPositions:number[]=[]
    for(let i=-12;i<=12;i++){
      const p=i*.4
      if(is3d){gridPositions.push(-4.8,-1.35,p,4.8,-1.35,p,p,-1.35,-4.8,p,-1.35,4.8)}
      else {gridPositions.push(-4.8,p,-.4,4.8,p,-.4,p,-4.8,-.4,p,4.8,-.4)}
    }
    const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(gridPositions,3))
    const gridMat=new THREE.LineBasicMaterial({color:0xaab8a7,transparent:true,opacity:.16})
    const grid=new THREE.LineSegments(gridGeo,gridMat);scene.add(grid)

    const visibleEdges=frame.edges.filter(e=>e.visible)
    const baseGeometry=new THREE.BufferGeometry()
    const basePositions:number[]=[]
    for(const e of visibleEdges)basePositions.push(...frame.positions[e.a],...frame.positions[e.b])
    baseGeometry.setAttribute('position',new THREE.Float32BufferAttribute(basePositions,3))
    const baseMaterial=new THREE.LineDashedMaterial({color:0x8d9c8d,dashSize:.085,gapSize:.065,transparent:true,opacity:.48})
    const reference=new THREE.LineSegments(baseGeometry,baseMaterial);reference.computeLineDistances();scene.add(reference)

    const isMass=item.model==='oscillator'||item.model==='chain'
    const hasFaces=frame.faces.length>0
    const cylinderGeometry=new THREE.CylinderGeometry(1,1,1,8,1)
    const cylinderMaterial=new THREE.MeshStandardMaterial({color:hasFaces?0x6e8171:0xc88749,roughness:.62,metalness:.12})
    const cylinders=new THREE.InstancedMesh(cylinderGeometry,cylinderMaterial,Math.max(1,visibleEdges.length))
    // Instance transforms change every frame. The initial bounding sphere is
    // stale after large translations (e.g. the swimmer) and would cull the body.
    cylinders.frustumCulled=false;cylinders.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(cylinders)
    const nodeGeometry=new THREE.SphereGeometry(1,12,8)
    const nodeMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.4,metalness:.05})
    const nodes=new THREE.InstancedMesh(nodeGeometry,nodeMaterial,frame.positions.length)
    nodes.frustumCulled=false;nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(nodes)
    const fixedSet=new Set(frame.fixed)
    const nodeColors=new THREE.Color()
    for(let i=0;i<frame.positions.length;i++){nodeColors.set(fixedSet.has(i)?0x516c60:hasFaces?0x6c8371:0xe8a35a);nodes.setColorAt(i,nodeColors)}
    if(nodes.instanceColor)nodes.instanceColor.needsUpdate=true

    let surface:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>|null=null
    if(hasFaces){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(frame.positions.length*3),3));geometry.setIndex(frame.faces.flat())
      geometry.computeVertexNormals()
      const material=new THREE.MeshStandardMaterial({color:item.model==='torus'?0xd7b481:0xb5c9b0,side:THREE.DoubleSide,transparent:true,opacity:.76,roughness:.85,metalness:0})
      surface=new THREE.Mesh(geometry,material);surface.frustumCulled=false;scene.add(surface)
    }
    const supports:THREE.Mesh[]=[]
    if(!is3d && frame.fixed.length && !isMass){
      const supportGeo=new THREE.BoxGeometry(.11,.62,.24), supportMat=new THREE.MeshStandardMaterial({color:0x6a7c6c,roughness:.85})
      const first=frame.positions[frame.fixed[0]],support=new THREE.Mesh(supportGeo,supportMat);support.position.set(first[0]-.07,first[1],0);support.userData.anchor=frame.fixed[0];support.userData.offset=-.07;scene.add(support);supports.push(support)
      if((item.model==='arch'||item.model==='cable')&&frame.fixed.length>1){const last=frame.positions[frame.fixed.at(-1)!],right=new THREE.Mesh(supportGeo,supportMat);right.position.set(last[0]+.07,last[1],0);right.userData.anchor=frame.fixed.at(-1);right.userData.offset=.07;scene.add(right);supports.push(right)}
    }
    let arrow:THREE.ArrowHelper|undefined
    if(item.id==='beam-gravity'||item.id==='hyper-cable'||['plate','net','lattice','helix','cap','cylinder'].includes(item.model)){
      const isLocalLoad=item.model==='cap'||item.model==='cylinder'
      arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(isLocalLoad||item.id==='hyper-cable'?0:is3d?2.1:1.55,is3d?1.5:.7,0),.6,0xd69a5c,.15,.09);scene.add(arrow)
    } else if(item.id==='beam-buckling') {
      const right=frame.positions.at(-1)!
      arrow=new THREE.ArrowHelper(new THREE.Vector3(-1,0,0),new THREE.Vector3(right[0]+.75,right[1],0),.55,0xd69a5c,.15,.09);scene.add(arrow)
    } else if(item.model==='disk') {
      arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-.55,0),.65,0xd69a5c,.15,.09);scene.add(arrow)
    } else if(item.model==='magnetic'||item.id==='robot-swim') {
      arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(1.5,1.1,0),.65,0xd69a5c,.15,.09);scene.add(arrow)
    }
    // In the swimmer only the last vertex's vertical DOF is fixed. A horizontal
    // guide depicts that constraint without falsely clamping the vertex in x.
    let swimmerGuide:THREE.LineSegments|undefined
    if(item.id==='robot-swim'){
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-4.8,0,-.05,4.8,0,-.05],3))
      swimmerGuide=new THREE.LineSegments(geo,new THREE.LineDashedMaterial({color:0x678275,dashSize:.12,gapSize:.08,transparent:true,opacity:.65}));swimmerGuide.computeLineDistances();scene.add(swimmerGuide)
    }
    // Coordinate guides depict partial constraints, not fully fixed rim nodes:
    // the inflation center may move vertically; the cap rim may slide radially.
    let shellGuide:THREE.LineSegments|undefined
    const shellKind=item.id==='axis-inflate'?'inflation':item.id==='axis-snap'?'eversion':null
    if(shellKind){
      const points=axisShellGuideSegments(shellKind,frame.positions),geo=new THREE.BufferGeometry()
      geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3))
      const mat=new THREE.LineDashedMaterial({color:0x598077,dashSize:.075,gapSize:.045,transparent:true,opacity:.85,depthTest:false})
      shellGuide=new THREE.LineSegments(geo,mat);shellGuide.frustumCulled=false;shellGuide.computeLineDistances();scene.add(shellGuide)
    }
    if(item.model==='crawler') {
      const ground=new THREE.BufferGeometry();ground.setAttribute('position',new THREE.Float32BufferAttribute([-2.4,-.6,-.1,2.4,-.6,-.1],3))
      scene.add(new THREE.LineSegments(ground,new THREE.LineBasicMaterial({color:0x8ca18d,transparent:true,opacity:.75})))
    }
    // For the oscillator, represent masses as blocks and the elastic connector as a spring.
    const massBlocks:THREE.Mesh[]=[]
    let springLine:THREE.LineSegments|undefined
    if(isMass){
      const blockGeo=new THREE.BoxGeometry(.34,.43,.28),blockMat=new THREE.MeshStandardMaterial({color:0xc9874a,roughness:.6})
      for(let i=1;i<frame.positions.length;i++){const block=new THREE.Mesh(blockGeo,blockMat);scene.add(block);massBlocks.push(block)}
      const wall=new THREE.Mesh(new THREE.BoxGeometry(.13,.8,.3),new THREE.MeshStandardMaterial({color:0x60776a}));wall.position.set(frame.positions[0][0]-.07,0,0);scene.add(wall);supports.push(wall)
      const geo=new THREE.BufferGeometry();const mat=new THREE.LineBasicMaterial({color:0xb6763b});springLine=new THREE.LineSegments(geo,mat);scene.add(springLine);cylinders.visible=false;nodes.visible=false
    }
    const tmp=new THREE.Object3D(), up=new THREE.Vector3(0,1,0), direction=new THREE.Vector3()
    const initialCenterX=frame.positions.reduce((sum,p)=>sum+p[0],0)/frame.positions.length
    let followX=0
    const update=(current:Frame)=>{
      if(current.positions.length!==frame.positions.length)return
      if(item.id==='robot-swim'){
        const x=current.positions.reduce((sum,p)=>sum+p[0],0)/current.positions.length-initialCenterX,delta=x-followX
        camera.position.x+=delta;controls.target.x+=delta;followX=x
        grid.position.x=Math.round(x/.4)*.4
        if(swimmerGuide)swimmerGuide.position.x=x
      }
      if(autoFit&&item.id==='hyper-membrane'){
        const extent=current.positions.reduce((max,p)=>Math.max(max,Math.hypot(...p)),0),zoom=Math.min(1,2/Math.max(extent,1e-6))
        if(Math.abs(camera.zoom-zoom)>1e-4){camera.zoom=zoom;camera.updateProjectionMatrix()}
      }
      if(autoFit&&fitDeforming){
        // Fit both the current shape and, when visible, its initial reference
        // in screen coordinates. User interaction disables automatic fitting.
        fitOrthographicGeometry(camera,controls.target,flags.current.showReference?[current.positions,frame.positions]:[current.positions])
      }
      reference.visible=flags.current.showReference
      nodes.visible=flags.current.showNodes&&!isMass
      if(arrow&&item.model==='magnetic')arrow.setDirection(new THREE.Vector3(Math.cos(Math.max(0,current.time-.01)),Math.sin(Math.max(0,current.time-.01)),0).normalize())
      if(arrow&&item.id==='robot-swim'){
        const t=Math.max(0,current.time-.01);arrow.setDirection(new THREE.Vector3(Math.sin(20*t),Math.cos(20*t),0).normalize());arrow.position.x=followX+1.5
      }
      if(arrow&&item.id==='beam-buckling'){const p=current.positions.at(-1)!;arrow.position.set(p[0]+.75,p[1],p[2])}
      if(shellGuide&&shellKind){
        const values=axisShellGuideSegments(shellKind,current.positions),position=shellGuide.geometry.getAttribute('position') as THREE.BufferAttribute
        for(let i=0;i<values.length;i++)position.array[i]=values[i]
        position.needsUpdate=true
        // The guide lengths change during loading; update dash coordinates too.
        shellGuide.computeLineDistances()
      }
      for(const support of supports) if(support.userData.anchor!==undefined){
        const p=current.positions[support.userData.anchor];support.position.set(p[0]+support.userData.offset,p[1],p[2])
        if(item.id==='beam-snap'&&support.userData.anchor===0){const next=current.positions[1];support.rotation.z=Math.atan2(next[1]-p[1],next[0]-p[0])}
      }
      const radius=hasFaces?.007:item.id==='net-gravity'?.0075:(is3d?.016:.023)
      if(!isMass)visibleEdges.forEach((e,i)=>{
        const a=current.positions[e.a],b=current.positions[e.b];direction.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const len=direction.length()
        tmp.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);tmp.quaternion.setFromUnitVectors(up,direction.normalize());tmp.scale.set(radius,len,radius);tmp.updateMatrix();cylinders.setMatrixAt(i,tmp.matrix)
      })
      cylinders.instanceMatrix.needsUpdate=true
      for(let i=0;i<current.positions.length;i++){
        const p=current.positions[i],r=fixedSet.has(i)?(hasFaces?.028:.055):(item.id==='net-gravity'?.014:hasFaces?.017:is3d?.03:.042)
        tmp.position.set(...p);tmp.quaternion.identity();tmp.scale.setScalar(r);tmp.updateMatrix();nodes.setMatrixAt(i,tmp.matrix)
      }
      nodes.instanceMatrix.needsUpdate=true
      if(surface){const position=surface.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<current.positions.length;i++)position.setXYZ(i,...current.positions[i]);position.needsUpdate=true;surface.geometry.computeVertexNormals()}
      if(isMass&&springLine){
        const positions:number[]=[]
        for(let i=0;i<current.positions.length-1;i++){
          const a=current.positions[i],b=current.positions[i+1],start=a[0]+(i===0?.08:.17),end=b[0]-.17, pts:Vec3Like[]=[]
          pts.push([start,0,0]);for(let k=0;k<=14;k++){const x=start+(end-start)*(k+1)/16;pts.push([x,(k%2===0?1:-1)*.12,0])}pts.push([end,0,0])
          for(let k=0;k<pts.length-1;k++)positions.push(...pts[k],...pts[k+1])
        }
        const existing=springLine.geometry.getAttribute('position') as THREE.BufferAttribute|undefined
        if(existing&&existing.array.length===positions.length){existing.array.set(positions);existing.needsUpdate=true}
        else springLine.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
        massBlocks.forEach((block,i)=>block.position.set(...current.positions[i+1]))
      }
    }
    let latest:Frame|null=null,lastFlags='',dirty=true,raf=0
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const halfHeight=is3d?2.4:1.95;const aspect=w/h;camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.setSize(w,h,false);dirty=true}
    const observer=new ResizeObserver(resize);observer.observe(host);resize()
    // Paused scenes need not upload geometry or redraw at display refresh rate.
    // Invalidate on new simulation frames, display options, resize and camera movement.
    const animate=()=>{
      const current=frameRef.current,display=`${flags.current.showNodes}:${flags.current.showReference}`
      if(dirty||current!==latest||display!==lastFlags){update(current);latest=current;lastFlags=display;dirty=true}
      const moved=controls.update();if(dirty||moved){renderer.render(scene,camera);dirty=false}
      raf=requestAnimationFrame(animate)
    };animate()
    api.current={
      resetCamera:()=>{camera.position.copy(defaultPos);camera.position.x+=followX;camera.zoom=1;autoFit=initialAutoFit;camera.updateProjectionMatrix();controls.target.copy(defaultTarget);controls.target.x+=followX;controls.update();dirty=true},
      savePng:()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=`ddg-${item.id}-${frameRef.current.time.toFixed(2)}s.png`;a.href=renderer.domElement.toDataURL('image/png');a.click()},
    }
    return ()=>{
      cancelAnimationFrame(raf);observer.disconnect();controls.dispose()
      scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){object.geometry.dispose();const mat=object.material;if(Array.isArray(mat))mat.forEach(m=>m.dispose());else mat.dispose()}})
      renderer.dispose();renderer.domElement.remove()
    }
  },[item.id,revision])
  return <div role="region" className="three-mount" ref={mount} aria-label={`${item.title}三维交互视图`}>
    {error&&<div className="viewport-error">WebGL 不可用。请启用浏览器硬件加速以查看三维视图。</div>}
  </div>
})
type Vec3Like=[number,number,number]
