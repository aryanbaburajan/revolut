import * as THREE from 'three';
/** Arcade jeep: +Z local is rear; front points along -Z. */
export function createJeep(scene:THREE.Scene, world:any, R:any, playerCollider:any){
 const group=new THREE.Group();group.name='jeep';group.position.set(0,0,8.5);group.rotation.y=-Math.PI/2;scene.add(group);
 const loader=new THREE.TextureLoader();
 function inkTexture(name:string){const map=loader.load(`${import.meta.env.BASE_URL}assets/${name}`);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;return map;}
 const body=new THREE.MeshBasicMaterial({map:inkTexture('fighter-metal.png')}),dark=new THREE.MeshBasicMaterial({map:inkTexture('suv-tire.png')}),metal=new THREE.MeshBasicMaterial({map:inkTexture('suv-metal.png')}),seat=new THREE.MeshBasicMaterial({map:inkTexture('suv-seat.png')});
 function part(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){
  const geometry=new THREE.BoxGeometry(w,h,d),uv=geometry.getAttribute('uv');
  for(let face=0;face<6;face++){const [u,v]=face<2?[d,h]:face<4?[w,d]:[w,h];for(let i=face*4;i<face*4+4;i++)uv.setXY(i,uv.getX(i)*u,uv.getY(i)*v);}
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x252525}));m.add(edge);return m;
 }
 part(group,0,.52,0,1.55,.22,3.05,body);part(group,0,.88,-1.05,1.5,.48,.95,body);
 // Front face sits just ahead of the hood to avoid coplanar flicker.
 const frontMap=loader.load(`${import.meta.env.BASE_URL}assets/jeep-front-ink.png`);frontMap.colorSpace=THREE.SRGBColorSpace;
 const front=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.48),new THREE.MeshBasicMaterial({map:frontMap,side:THREE.DoubleSide}));front.position.set(0,.88,-1.526);front.rotation.y=Math.PI;group.add(front);
 part(group,0,.9075,1.25,1.5,.555,.26,body);for(const x of [-.72,.72])part(group,x,.825,.3975,.11,.39,1.445,body);
 // Illustrated exterior panels sit just off the corresponding solid faces.
 function panel(file:string,w:number,h:number,x:number,y:number,z:number,rx:number,ry:number,flip=false){
  const map=loader.load(`${import.meta.env.BASE_URL}assets/${file}`);map.colorSpace=THREE.SRGBColorSpace;
  // Center-crop the image to the face aspect ratio after it loads.
  map.onUpdate=()=>{const image=map.image as HTMLImageElement;if(!image?.width||!image.height)return;const source=image.width/image.height,target=w/h;if(source>target){map.repeat.x=target/source;map.offset.x=(1-map.repeat.x)/2;}else{map.repeat.y=source/target;map.offset.y=(1-map.repeat.y)/2;}if(flip){map.offset.x+=map.repeat.x;map.repeat.x*=-1;}map.onUpdate=()=>{};};
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,0);group.add(mesh);
 }
 for(const side of [-1,1])panel('jeep-side-ink.png',1.445,.39,side*.776,.825,.3975,0,side*Math.PI/2,side===1);
 panel('jeep-rear-ink.png',1.5,.555,0,.9075,1.381,0,0);
 panel('jeep-hood-ink.png',1.5,.95,0,1.121,-1.05,-Math.PI/2,0);
 // Cover exposed hood and rear-quarter side faces with the illustrated body panel.
 for(const side of [-1,1]){
  panel('jeep-front-side-ink.png',.95,.48,side*.751,.88,-1.05,0,side*Math.PI/2,side===-1);
  panel('jeep-side-ink.png',.26,.555,side*.751,.9075,1.25,0,side*Math.PI/2,side===1);
  panel('jeep-side-ink.png',3.05,.22,side*.776,.52,0,0,side*Math.PI/2);
 }

 part(group,0,.84,-.48,1.42,.25,.18,dark);for(const x of [-.46,.46]){part(group,x,.80,.32,.37,.18,.55,seat);part(group,x,1.215,.655,.37,.65,.12,seat);}for(const x of [-.55,.55])part(group,x,1.375,-.64,.06,.51,.07,metal);
 part(group,0,1.66,-.64,1.18,.06,.07,metal);part(group,0,.48,-1.58,1.7,.12,.12,metal);part(group,0,.48,1.58,1.7,.12,.12,metal);
 const wheels:THREE.Group[]=[];for(const x of [-.83,.83])for(const z of [-1.05,1.05]){const pivot=new THREE.Group();pivot.position.set(x,.38,z);group.add(pivot);const tire=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.20,16),dark);tire.rotation.z=Math.PI/2;pivot.add(tire);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.205,12),metal);hub.rotation.z=Math.PI/2;pivot.add(hub);wheels.push(pivot);}
 const steering=new THREE.Group();steering.position.set(-.48,1.08,-.30);steering.rotation.x=-.3;group.add(steering);const ring=new THREE.Mesh(new THREE.TorusGeometry(.19,.026,8,24),dark);steering.add(ring);part(steering,0,0,0,.36,.025,.025,metal);part(steering,0,0,0,.025,.36,.025,metal);
 const accelerator=new THREE.Group(),brake=new THREE.Group();accelerator.position.set(-.29,.48,-.43);brake.position.set(-.55,.48,-.43);group.add(accelerator,brake);part(accelerator,0,-.12,0,.09,.25,.05,metal);part(brake,0,-.12,0,.12,.25,.05,metal);
 const gear=new THREE.Group();gear.position.set(.02,.66,.05);group.add(gear);part(gear,0,.15,0,.035,.30,.035,metal);part(gear,0,.31,0,.09,.09,.09,dark);
 let speed=0,driving=false,steer=0,gearNumber=1,wheelSpin=0;
 const identity = {x:0,y:0,z:0,w:1};
 function isClear(p:{x:number,z:number}, _colliders:unknown, radius=.16){
  return !world.intersectionWithShape({x:p.x,y:.5,z:p.z},identity,new R.Ball(radius),R.QueryFilterFlags.EXCLUDE_SENSORS,undefined,playerCollider);
 }
 const colliders = null;
 function clear(x:number,z:number,angle:number){const sin=Math.sin(angle),cos=Math.cos(angle);for(const [sx,sz] of [[-.68,-1.35],[.68,-1.35],[-.68,1.35],[.68,1.35],[0,0]])if(!isClear({x:x+sx*cos+sz*sin,z:z-sx*sin+sz*cos},colliders,.16))return false;return true;}
 // Select an unobstructed position near the player's starting point.
 for(let radius=4;radius<50;radius+=2){
  let found=false;
  for(let i=0;i<16;i++){
   const angle=i*Math.PI/8,x=Math.sin(angle)*radius,z=5+Math.cos(angle)*radius;
   if(clear(x,z,group.rotation.y)){group.position.set(x,0,z);found=true;break;}
  }
  if(found)break;
 }
 group.updateMatrixWorld(true);
 function enter(camera:THREE.Camera){if(driving||camera.position.distanceTo(group.position)>3)return false;driving=true;speed=0;return true;}
 function exit(camera:THREE.Camera){if(!driving)return false;group.updateMatrixWorld(true);const positions=[-1.1,1.1].map(x=>new THREE.Vector3(x,1,0).applyMatrix4(group.matrixWorld));camera.position.copy(positions.find(p=>isClear(p,colliders,.2)) || new THREE.Vector3(0,2.2,0).applyMatrix4(group.matrixWorld));driving=false;return true;}
 function update(dt:number,keys:Set<string>,camera:THREE.Camera,onRunOver?:(x:number,z:number,angle:number)=>void){
  const forward=driving&&keys.has('KeyW'),back=driving&&keys.has('KeyS'),handbrake=driving&&keys.has('Space');
  const braking=handbrake||(back&&speed>.05)||(forward&&speed<-.05);
  const desired=driving?(+keys.has('KeyA')-+keys.has('KeyD')):0;steer+=(desired-steer)*(1-Math.exp(-8*dt));
  if(braking){const amount=9*dt;speed=Math.sign(speed)*Math.max(0,Math.abs(speed)-amount);}
  else if(forward!==back)speed+=(forward?5:-4)*dt;
  else speed*=Math.exp(-1.4*dt);
  speed=THREE.MathUtils.clamp(speed,-3,12);
  gearNumber=speed<-.05?-1:speed<2.5?1:speed<5.5?2:3;
  const steps=Math.max(1,Math.ceil(Math.abs(speed*dt)/.15)),stepDt=dt/steps;
  for(let i=0;i<steps;i++){const angle=group.rotation.y+steer*speed*.28*stepDt;const nx=group.position.x-Math.sin(angle)*speed*stepDt,nz=group.position.z-Math.cos(angle)*speed*stepDt;
   if(clear(nx,nz,angle)){group.position.x=nx;group.position.z=nz;group.rotation.y=angle;if(driving && Math.abs(speed)>=1) onRunOver?.(nx,nz,angle);}else{speed=0;break;}}
  animate(dt,speed,steer,!!forward,!!back,braking);
  if(driving){group.updateMatrixWorld(true);camera.position.copy(new THREE.Vector3(-.47,1.48,.15).applyMatrix4(group.matrixWorld));}
 }
 function animate(dt:number,speed:number,steer:number,forward:boolean,back:boolean,braking:boolean){
  gearNumber=speed<-.05?-1:speed<2.5?1:speed<5.5?2:3;
  steering.rotation.z=steer*.85;accelerator.rotation.x=(forward||(back&&speed<=0))&&!braking?-.45:0;brake.rotation.x=braking?-.45:0;const shifts:Record<number,[number,number]>={[-1]:[.25,.32],1:[-.22,-.28],2:[-.22,.28],3:[0,-.28],4:[0,.28],5:[.22,-.28]};const [gx,gz]=shifts[gearNumber];gear.rotation.z=-gx;gear.rotation.x=gz;
  wheelSpin+=speed*dt/.36;wheels.forEach((wheel,i)=>{wheel.rotation.y=i%2===0?steer*.4:0;wheel.children.forEach(child=>{child.rotation.set(0,0,Math.PI/2);child.rotateY(wheelSpin);});});
 }
 function snapshot(){return {position:group.position.toArray(),rotation:group.rotation.y,speed,driving}}
 function restore(state:any){if(!state||!Array.isArray(state.position)||state.position.length!==3||!state.position.every(Number.isFinite)||!Number.isFinite(state.rotation))return;group.position.fromArray(state.position);group.rotation.y=state.rotation;speed=Number.isFinite(state.speed)?THREE.MathUtils.clamp(state.speed,-3,12):0;driving=state.driving===true;group.updateMatrixWorld(true)}
 return {group,enter,exit,update,animate,snapshot,restore,get driving(){return driving},get gear(){return gearNumber<0?'R':String(gearNumber)},get speed(){return speed},get steering(){return steer}};
}
