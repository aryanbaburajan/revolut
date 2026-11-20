import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Collider } from './collision';
export function createTank(scene:THREE.Scene,world:any,R:any,playerCollider:any,colliders:Collider[], spawn = { x: 5.5, z: 8.5 }, buildingColliderHandles:Set<number> = new Set()){
 const group=new THREE.Group();group.name='tank';group.position.set(spawn.x,0,spawn.z);group.rotation.y=-Math.PI/2;scene.add(group);
 const loader=new THREE.TextureLoader();function material(name:string){const map=loader.load(`${import.meta.env.BASE_URL}assets/${name}`);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;return new THREE.MeshBasicMaterial({map});}const armor=material('tank-armor.png'),track=material('tank-track.png');
 function part(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material){
  const radius=Math.min(w,h,d)*.22;
  const geometry=new RoundedBoxGeometry(w,h,d,4,radius);
  const uv=geometry.attributes.uv, normal=geometry.attributes.normal;
  for(let i=0;i<uv.count;i++){
   const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
   const [u,v]=nx>=ny&&nx>=nz?[d,h]:ny>=nz?[w,d]:[w,h];
   uv.setXY(i,uv.getX(i)*u*.5,uv.getY(i)*v*.5);
  }
  const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);
  const lines=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),new THREE.LineBasicMaterial({color:0x222222}));mesh.add(lines);
  return mesh;
 }
 part(group,2.1,.75,3.8,0,.75,0,armor);for(const side of [-1,1]){part(group,.5,.8,3.9,side*1.3,.48,0,track);part(group,.48,.12,3.9,side*1.3,.94,0,armor);}part(group,2,.25,2.9,0,1.25,.15,armor);
 const turret=new THREE.Group();turret.position.set(0,1.42,.15);group.add(turret);part(turret,1.6,.65,1.7,0,.325,0,armor);const barrel=new THREE.Group();barrel.position.set(0,.33,-.85);turret.add(barrel);part(barrel,.25,.25,2.5,0,0,-1.25,armor);part(turret,.52,.08,.52,0,.69,.25,armor);
 const muzzleMap=loader.load(`${import.meta.env.BASE_URL}assets/tank-muzzle-square.png`);muzzleMap.colorSpace=THREE.SRGBColorSpace;const muzzle=new THREE.Mesh(new THREE.PlaneGeometry(.25,.25),new THREE.MeshBasicMaterial({map:muzzleMap,side:THREE.DoubleSide}));muzzle.position.set(0,0,-2.501);muzzle.rotation.y=Math.PI;barrel.add(muzzle);
 let driving=false,speed=0,viewYaw=0,viewPitch=-.22,recoilX=0,recoilZ=0; function isClear(p:{x:number;z:number}, _obstacles:Collider[], radius:number, y=.5, buildingsOnly=false) {
  return !world.intersectionWithShape({x:p.x,y,z:p.z},{x:0,y:0,z:0,w:1},new R.Ball(radius),R.QueryFilterFlags.EXCLUDE_SENSORS,undefined,playerCollider,undefined,buildingsOnly ? (collider:any)=>buildingColliderHandles.has(collider.handle) : undefined);
 }
const own:Collider={kind:'box',minX:3.55,maxX:7.45,minZ:6.95,maxZ:10.05};colliders.push(own);
 function sync(){if(own.kind!=='box')return;const c=Math.abs(Math.cos(group.rotation.y)),s=Math.abs(Math.sin(group.rotation.y)),ex=1.55*c+1.95*s,ez=1.55*s+1.95*c;own.minX=group.position.x-ex;own.maxX=group.position.x+ex;own.minZ=group.position.z-ez;own.maxZ=group.position.z+ez;}
 function enter(camera:THREE.Camera){if(driving||Math.hypot(camera.position.x-group.position.x,camera.position.z-group.position.z)>4)return false;driving=true;viewYaw=group.rotation.y;viewPitch=-.22;return true;}
 function exit(camera:THREE.Camera){if(!driving)return false;group.updateMatrixWorld(true);const positions=[-2.1,2.1].map(x=>new THREE.Vector3(x,1.15,0).applyMatrix4(group.matrixWorld));camera.position.copy(positions.find(p=>isClear(p,colliders.filter(c=>c!==own),.25,p.y)) || new THREE.Vector3(0,2.5,0).applyMatrix4(group.matrixWorld));driving=false;return true;}
 function mouse(dx:number,dy:number){viewYaw-=dx*.002;viewPitch=THREE.MathUtils.clamp(viewPitch-dy*.002,-1.45,1.45);}
 function update(dt:number,keys:Set<string>,camera:THREE.Camera,onRunOver?:(x:number,z:number,angle:number)=>void){const throttle=driving?(+keys.has('KeyW'))-(+keys.has('KeyS')):0,turn=driving?(+keys.has('KeyA'))-(+keys.has('KeyD')):0;speed+=(throttle*5-speed)*(1-Math.exp(-(keys.has('Space')?7:1.5)*dt));const obstacles=colliders.filter(c=>c!==own);const steps=Math.max(1,Math.ceil((Math.abs(speed)+Math.hypot(recoilX,recoilZ))*dt/.15));for(let i=0;i<steps;i++){const d=dt/steps,angle=group.rotation.y+turn*(speed<-.05?-1:1)*.65*d,nx=group.position.x+(-Math.sin(angle)*speed+recoilX)*d,nz=group.position.z+(-Math.cos(angle)*speed+recoilZ)*d;let clear=true;for(const [sx,sz] of [[-1.35,-1.7],[1.35,-1.7],[-1.35,1.7],[1.35,1.7]]){const x=nx+sx*Math.cos(angle)+sz*Math.sin(angle),z=nz-sx*Math.sin(angle)+sz*Math.cos(angle);if(!isClear({x,z},obstacles,.2,.5,true)){clear=false;break}}if(clear){group.position.x=nx;group.position.z=nz;group.rotation.y=angle;if(Math.abs(speed)>=1)onRunOver?.(nx,nz,angle)}else{speed=0;recoilX=0;recoilZ=0;break;}}recoilX*=Math.exp(-2.5*dt);recoilZ*=Math.exp(-2.5*dt);sync();
 if(!driving)return;
 const relative=THREE.MathUtils.euclideanModulo(viewYaw-group.rotation.y-turret.rotation.y+Math.PI,2*Math.PI)-Math.PI;
 turret.rotation.y+=relative*(1-Math.exp(-1.8*dt));barrel.rotation.x+=(viewPitch-barrel.rotation.x)*(1-Math.exp(-1.8*dt));
 const target=group.position.clone().add(new THREE.Vector3(0,3.2,0));
 const look=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(viewPitch,viewYaw,0,'YXZ'));
 camera.position.copy(target).addScaledVector(look,-7);camera.lookAt(target);group.updateMatrixWorld(true);}
 sync();
 function reposition(position:{x:number;z:number}) {
  group.position.set(position.x,0,position.z);
  group.rotation.y=-Math.PI/2;
  speed=recoilX=recoilZ=0;
  driving=false;
  sync();
  group.updateMatrixWorld(true);
 }
 return {group,turret,barrel,enter,exit,update,mouse,reposition,recoil(){const angle=group.rotation.y+turret.rotation.y;recoilX+=Math.sin(angle)*2.5;recoilZ+=Math.cos(angle)*2.5;},get driving(){return driving},get speed(){return speed}};
}
