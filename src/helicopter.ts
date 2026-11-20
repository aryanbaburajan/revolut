import * as THREE from 'three';
import type { Collider } from './collision';
/** Flyable helicopter, nose along local -Z. */
export function createHelicopter(scene:THREE.Scene,world:any,R:any,playerCollider:any,colliders:Collider[],x:number,z:number,buildingColliderHandles:Set<number>,onCrash:(position:THREE.Vector3,occupied:boolean)=>void){
 const group=new THREE.Group();group.name='helicopter';group.position.set(x,0,z);scene.add(group);
 const texture=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/fighter-metal.png`);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 const detailTexture=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/suv-metal.png`);
 detailTexture.colorSpace=THREE.SRGBColorSpace;detailTexture.wrapS=detailTexture.wrapT=THREE.RepeatWrapping;
 const metal=new THREE.MeshBasicMaterial({map:texture});
 const dark=new THREE.MeshBasicMaterial({map:detailTexture,color:0x777777});
 const glass=new THREE.MeshBasicMaterial({map:detailTexture,color:0xbcbcbc,side:THREE.DoubleSide});
 const ink = new THREE.LineBasicMaterial({color:0x252525});
 function outline(points:THREE.Vector3[]) {
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),ink);group.add(line);return line;
 }
 function tube(a:THREE.Vector3,b:THREE.Vector3,radius:number,material:THREE.Material=dark) {
  const direction=b.clone().sub(a);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),10),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  group.add(mesh);return mesh;
 }
 // Faceted cabin with a sloped nose, bevelled sides and a narrowed rear.
 const stations=[
  {z:-1.75, half:.38, bottom:.95, top:1.28},
  {z:-1.25, half:.72, bottom:.75, top:1.88},
  {z:-.55, half:.82, bottom:.7, top:2.05},
  {z:.9, half:.82, bottom:.72, top:2.1},
  {z:1.35, half:.55, bottom:.88, top:1.85},
 ];
 const vertices:number[]=[], indices:number[]=[];
 for(const station of stations){
  const {z,half,bottom,top}=station, bevel=Math.min(.18,half*.3,(top-bottom)*.25);
  for(const [x,y] of [[-half+bevel,bottom],[half-bevel,bottom],[half,bottom+bevel],[half,top-bevel],[half-bevel,top],[-half+bevel,top],[-half,top-bevel],[-half,bottom+bevel]])vertices.push(x,y,z);
 }
 for(let row=0;row<stations.length-1;row++)for(let edge=0;edge<8;edge++){
  const a=row*8+edge,b=row*8+(edge+1)%8,c=(row+1)*8+edge,d=(row+1)*8+(edge+1)%8;
  indices.push(a,b,c,b,d,c);
 }
 for(let edge=1;edge<7;edge++)indices.push(0,edge+1,edge,(stations.length-1)*8,(stations.length-1)*8+edge,(stations.length-1)*8+edge+1);
 const indexedHull=new THREE.BufferGeometry();
 indexedHull.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 indexedHull.setIndex(indices);
 const hullGeometry=indexedHull.toNonIndexed();
 indexedHull.dispose();
 hullGeometry.computeVertexNormals();
 const uvValues:number[]=[];
 const positions=hullGeometry.getAttribute('position'),normals=hullGeometry.getAttribute('normal');
 for(let i=0;i<positions.count;i++){
  const nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i)),nz=Math.abs(normals.getZ(i));
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  if(nx>=ny&&nx>=nz)uvValues.push(z*.5,y*.5);
  else if(ny>=nz)uvValues.push(x*.5,z*.5);
  else uvValues.push(x*.5,y*.5);
 }
 hullGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvValues,2));
 const hull=new THREE.Mesh(hullGeometry,metal);group.add(hull);
 group.add(new THREE.LineSegments(new THREE.EdgesGeometry(hullGeometry,20),ink));
 for(const side of [-1,1]) {
  // Cabin-door outline follows the side of the fuselage.
  outline([new THREE.Vector3(side*.82,.95,-.25),new THREE.Vector3(side*.84,1.85,-.25),new THREE.Vector3(side*.76,1.95,.85),new THREE.Vector3(side*.72,.93,.85),new THREE.Vector3(side*.82,.95,-.25)]);
  tube(new THREE.Vector3(side*.76,.4,-1.55),new THREE.Vector3(side*.76,.4,1.55),.065);
  tube(new THREE.Vector3(side*.76,.4,-1.55),new THREE.Vector3(side*.76,.58,-1.8),.065);
  tube(new THREE.Vector3(side*.76,.4,1.55),new THREE.Vector3(side*.76,.56,1.72),.065);
  for(const z of [-.75,.75])tube(new THREE.Vector3(side*.76,.4,z),new THREE.Vector3(side*.57,.95,z),.052);
 }
 // Angular cockpit windows form a separate group so the pilot has a clear view.
 const canopy=new THREE.Group();
 function windowPanel(points:number[][]) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
  geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  canopy.add(new THREE.Mesh(geometry,glass));
  canopy.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p as [number,number,number]))),ink));
 }
 windowPanel([[-.35,1.31,-1.76],[.35,1.31,-1.76],[.64,1.84,-1.26],[-.64,1.84,-1.26]]);
 for(const side of [-1,1]) {
  windowPanel([[side*.73,1.3,-1.25],[side*.83,1.3,-.55],[side*.83,1.9,-.55],[side*.73,1.84,-1.25]]);
  windowPanel([[side*.83,1.3,-.48],[side*.83,1.3,.55],[side*.83,1.9,.55],[side*.83,1.9,-.48]]);
 }
 group.add(canopy);
 // Tapered tail boom and fins.
 const boom=new THREE.Mesh(new THREE.CylinderGeometry(.12,.36,3.3,16,1),metal);
 boom.rotation.x=Math.PI/2;boom.position.set(0,1.53,2.65);group.add(boom);
 for(const side of [-1,1])tube(new THREE.Vector3(side*.34,1.53,1.05),new THREE.Vector3(side*.12,1.53,4.25),.016);
 const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.lineTo(.7,0);finShape.lineTo(.43,1.05);finShape.lineTo(.12,1.05);finShape.closePath();
 const fin=new THREE.Mesh(new THREE.ExtrudeGeometry(finShape,{depth:.09,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2}),metal);
 fin.rotation.y=Math.PI/2;fin.position.set(-.045,1.48,3.7);group.add(fin);
 const stabilizer=new THREE.Mesh(new THREE.BoxGeometry(2.1,.08,.45),metal);stabilizer.position.set(0,1.58,3.6);group.add(stabilizer);
 // Four tapered rotor blades and a separate tail rotor.
 tube(new THREE.Vector3(0,1.94,0),new THREE.Vector3(0,2.48,0),.09,metal);
 const rotor=new THREE.Group();rotor.position.set(0,2.45,0);group.add(rotor);
 const hub=new THREE.Mesh(new THREE.SphereGeometry(.18,16,10),dark);rotor.add(hub);
 const bladeShape=new THREE.Shape();bladeShape.moveTo(.12,-.12);bladeShape.lineTo(3.25,-.09);bladeShape.lineTo(3.42,.04);bladeShape.lineTo(.12,.12);bladeShape.closePath();
 for(let i=0;i<4;i++){
  const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape,{depth:.055,bevelEnabled:false}),dark);
  blade.rotation.set(-Math.PI/2,i*Math.PI/2,0,'YXZ');rotor.add(blade);
 }
 const tailRotor=new THREE.Group();tailRotor.position.set(.21,1.92,4.02);group.add(tailRotor);
 const tailHub=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),dark);tailRotor.add(tailHub);
 for(let i=0;i<4;i++){
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,.12),dark);
  blade.position.set(0,Math.cos(i*Math.PI/2)*.28,Math.sin(i*Math.PI/2)*.28);
  blade.rotation.x=i*Math.PI/2;tailRotor.add(blade);
 }
 let destroyed=false,flying=false,speed=0,verticalSpeed=0,heading=0,airPitch=0,bank=0,mouseYaw=0,mousePitch=0,sideSpeed=0,velocityX=0,velocityZ=0,rollVelocity=0;group.rotation.order="YZX";
 const liftDirection=new THREE.Vector3();
 const attitude=new THREE.Quaternion(), turn=new THREE.Quaternion();
 const axisX=new THREE.Vector3(1,0,0), axisY=new THREE.Vector3(0,1,0), axisZ=new THREE.Vector3(0,0,1);
 function orient(level:number){group.quaternion.setFromAxisAngle(axisY,heading).slerp(attitude,level);}
 function isClear(p:{x:number;z:number}, _obstacles:Collider[], radius:number, y=.5) {
  return !world.intersectionWithShape({x:p.x,y,z:p.z},{x:0,y:0,z:0,w:1},new R.Ball(radius),R.QueryFilterFlags.EXCLUDE_SENSORS,undefined,playerCollider);
 }
 const own:Collider[]=[{kind:'box',minX:x-.85,maxX:x+.85,minZ:z-1.75,maxZ:z+1.75},{kind:'box',minX:x-1,maxX:x+1,minZ:z+1,maxZ:z+4}];colliders.push(...own);
 function syncCollision(){const sin=Math.sin(heading),cos=Math.cos(heading);for(let i=0;i<own.length;i++){const c=own[i];if(c.kind!=='box')continue;const hw=i===0?.85:1,hd=i===0?1.75:2.0;const ex=Math.abs(cos)*hw+Math.abs(sin)*hd,ez=Math.abs(sin)*hw+Math.abs(cos)*hd;c.minX=group.position.x-ex;c.maxX=group.position.x+ex;c.minZ=group.position.z-ez;c.maxZ=group.position.z+ez;}}
 function enter(camera:THREE.Camera){if(destroyed||flying||Math.hypot(camera.position.x-group.position.x,camera.position.z-group.position.z)>5)return false;flying=true;mouseYaw=heading;if(canopy)canopy.visible=false;return true;}
 function exit(camera:THREE.Camera){if(!flying)return false;group.updateMatrixWorld(true);const candidates=[[-2,1,2],[2,1,2],[0,3,0],[0,1,-3]];const positions=candidates.map(([x,y,z])=>new THREE.Vector3(x,y,z).applyMatrix4(group.matrixWorld));const p=positions.find(p=>isClear(p,colliders,.4,p.y)) || positions[2];camera.position.copy(p);flying=false;if(canopy)canopy.visible=true;return true;}
 function mouse(dx:number,dy:number){mouseYaw-=dx*.002;mousePitch-=dy*.002;}
 const parts=[{center:[0,1.35,-.2],half:[.85,.7,1.6]}, {center:[0,1.6,2.7],half:[.36,.5,1.7]}, {center:[0,2.45,0],half:[3.4,.08,3.4]}];
 function hitsBuilding(origin:THREE.Vector3,rotation:THREE.Quaternion){
  return parts.some(({center,half})=>{
   const point=new THREE.Vector3(...center as [number,number,number]).applyQuaternion(rotation).add(origin);
   return world.intersectionWithShape(point,rotation,new R.Cuboid(...half),R.QueryFilterFlags.EXCLUDE_SENSORS,undefined,playerCollider,undefined,(collider:any)=>buildingColliderHandles.has(collider.handle));
  });
 }
 function crash(origin:THREE.Vector3){
  const occupied=flying;destroyed=true;flying=false;scene.remove(group);
  for(const collider of own){const index=colliders.indexOf(collider);if(index>=0)colliders.splice(index,1);}
  onCrash(origin,occupied);
 }
 function update(dt:number,keys:Set<string>,camera:THREE.Camera){
  if(destroyed)return;
  if(!flying){
   if(group.position.y>0){
    verticalSpeed-=9.8*dt;
    const startY=group.position.y, endY=Math.max(0,startY+verticalSpeed*dt), steps=Math.max(1,Math.ceil((startY-endY)/.5));
    for(let i=1;i<=steps;i++){
     const y=THREE.MathUtils.lerp(startY,endY,i/steps), origin=new THREE.Vector3(group.position.x,y,group.position.z);
     const rotation=new THREE.Quaternion().setFromAxisAngle(axisY,heading).slerp(attitude,THREE.MathUtils.smoothstep(y,0,2));
     if(hitsBuilding(origin,rotation)){crash(origin);return;}
    }
    group.position.y=endY;if(endY===0){verticalSpeed=0;speed=sideSpeed=velocityX=velocityZ=0}orient(THREE.MathUtils.smoothstep(endY,0,2));syncCollision();group.updateMatrixWorld(true);
   }
   return;
  }
  const thrust = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  const roll = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const previousHeading=heading, previousPitch=airPitch;
  heading += (mouseYaw - heading) * (1 - Math.exp(-6 * dt));
  rollVelocity += (-roll * 1.6 - rollVelocity) * (1 - Math.exp(-4 * dt));
  bank += rollVelocity * dt;
  airPitch += (mousePitch - airPitch) * (1 - Math.exp(-6 * dt));
  attitude.premultiply(turn.setFromAxisAngle(axisY,heading-previousHeading));
  attitude.multiply(turn.setFromAxisAngle(axisZ,rollVelocity*dt));
  attitude.multiply(turn.setFromAxisAngle(axisX,airPitch-previousPitch)).normalize();
  const airborne = THREE.MathUtils.smoothstep(group.position.y, 0, 2);
  liftDirection.set(0,1,0).applyQuaternion(attitude);
  verticalSpeed += (thrust * 5 * liftDirection.y - verticalSpeed) * (1 - Math.exp(-.8 * dt));
  velocityX+=liftDirection.x*7*airborne*dt;
  velocityZ+=liftDirection.z*7*airborne*dt;
  const drag=Math.exp(-.18*dt);
  velocityX*=drag; velocityZ*=drag;
  const horizontalSpeed=Math.hypot(velocityX,velocityZ);
  if(horizontalSpeed>24){velocityX*=24/horizontalSpeed;velocityZ*=24/horizontalSpeed;}
  speed=-Math.sin(heading)*velocityX-Math.cos(heading)*velocityZ;
  sideSpeed=Math.cos(heading)*velocityX-Math.sin(heading)*velocityZ;
  const nx=group.position.x+velocityX*dt,nz=group.position.z+velocityZ*dt,ny=Math.max(0,group.position.y+verticalSpeed*dt);
  // Test the fuselage, tail and rotor against building colliders at the next pose.
  const origin=new THREE.Vector3(nx,ny,nz);
  if(hitsBuilding(origin,attitude)){crash(origin);return;}
  const obstacles=colliders.filter(c=>!own.includes(c));
  const clear=(x:number,y:number,z:number)=>isClear({x,z},obstacles,1.2,y+1.3);
  if(clear(nx,ny,nz)) group.position.set(nx,ny,nz);
  else {
   // Preserve steering and movement along clear axes when a nearby prop blocks one direction.
   if(clear(group.position.x,ny,group.position.z) || (ny>group.position.y && !clear(group.position.x,group.position.y,group.position.z))) group.position.y=ny;
   else if(ny!==group.position.y) verticalSpeed=0;
   if(clear(nx,group.position.y,group.position.z)) group.position.x=nx; else velocityX=0;
   if(clear(group.position.x,group.position.y,nz)) group.position.z=nz; else velocityZ=0;
  }
  orient(THREE.MathUtils.smoothstep(group.position.y,0,2));
  if(ny===0&&verticalSpeed<0)verticalSpeed=0;rotor.rotation.y-=dt*12;tailRotor.rotation.x-=dt*18;syncCollision();group.updateMatrixWorld(true);
  // Align the view with the center of the nose's front cockpit frame.
  camera.position.copy(new THREE.Vector3(0,1.115,.05).applyMatrix4(group.matrixWorld));
 }
 function snapshot(){return {position:group.position.toArray(),heading,airPitch,bank,attitude:attitude.toArray(),speed,sideSpeed,velocityX,velocityZ,verticalSpeed,flying}}
 function restore(state:any){if(!state||!Array.isArray(state.position)||state.position.length!==3||!state.position.every(Number.isFinite)||!Number.isFinite(state.heading))return;group.position.fromArray(state.position);heading=state.heading;mouseYaw=heading;airPitch=Number.isFinite(state.airPitch)?state.airPitch:0;mousePitch=airPitch;bank=Number.isFinite(state.bank)?state.bank:0;if(Array.isArray(state.attitude)&&state.attitude.length===4&&state.attitude.every(Number.isFinite)&&state.attitude.some((v:number)=>v!==0))attitude.fromArray(state.attitude).normalize();else attitude.setFromEuler(new THREE.Euler(airPitch,heading,bank,'YZX'));speed=Number.isFinite(state.speed)?state.speed:0;sideSpeed=Number.isFinite(state.sideSpeed)?state.sideSpeed:0;velocityX=Number.isFinite(state.velocityX)?state.velocityX:-Math.sin(heading)*speed+Math.cos(heading)*sideSpeed;velocityZ=Number.isFinite(state.velocityZ)?state.velocityZ:-Math.cos(heading)*speed-Math.sin(heading)*sideSpeed;verticalSpeed=Number.isFinite(state.verticalSpeed)?state.verticalSpeed:0;flying=state.flying===true;orient(THREE.MathUtils.smoothstep(group.position.y,0,2));if(canopy)canopy.visible=!flying;syncCollision();group.updateMatrixWorld(true)}
 function respawn(position:THREE.Vector3){
  if(!destroyed)return;
  destroyed=false;flying=false;
  speed=verticalSpeed=heading=airPitch=bank=mouseYaw=mousePitch=sideSpeed=velocityX=velocityZ=rollVelocity=0;
  attitude.identity();group.position.copy(position);orient(0);
  if(canopy)canopy.visible=true;
  for(const collider of own)if(!colliders.includes(collider))colliders.push(collider);
  scene.add(group);syncCollision();group.updateMatrixWorld(true);
 }
 return {group,animate(dt:number,active:boolean,local:boolean){if(canopy)canopy.visible=!local;if(active){rotor.rotation.y-=dt*12;tailRotor.rotation.x-=dt*18;}},enter,exit,update,mouse,snapshot,restore,respawn,get flying(){return flying},get speed(){return speed}};
}
