import * as THREE from 'three';
import {planEncounters} from './encounters.js';
import { stance, radius } from './locomotion.ts';
import { roadWidths } from './city.js';
export function createRange(scene:THREE.Scene, world:any, R:any, roads:any[], layout:any, landmarks:any, onKill:(now:number)=>void = () => {}, onPlayerHit:(amount:number)=>void = () => {}, spawn = { x: 0, z: 5 }){
 const load=(name:string)=>{const t=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/${name}`);t.colorSpace=THREE.SRGBColorSpace;return t};
 const targets = new THREE.Group();
 scene.add(targets);
 const bodyMaterials = ['zombie-torso.png', 'zombie-torso-2.png', 'zombie-torso-3.png'].map(name =>
   new THREE.MeshBasicMaterial({map:load(name), alphaTest:.3, side:THREE.DoubleSide}));
 const armMaterial = new THREE.MeshBasicMaterial({map:load('zombie-arm.png'), alphaTest:.3, side:THREE.DoubleSide});
 const legMaterial = new THREE.MeshBasicMaterial({map:load('zombie-leg.png'), alphaTest:.3, side:THREE.DoubleSide});
 const colors = ['#ff1744', '#ff8500', '#fff000', '#25ed45', '#00d9ff', '#3b48ff', '#ed20ff'];
 const splashGeometry = new THREE.PlaneGeometry(4.6,4.6);
 const splashes = Array.from({length:8}, () => {
   const canvas = document.createElement('canvas');
   canvas.width = canvas.height = 256;
   const ctx = canvas.getContext('2d')!;
   const offset = Math.floor(Math.random() * colors.length);
   // Small irregular patches leave gaps between colors and around the center.
   for (let i = 0; i < 90; i++) {
     const angle = Math.random() * Math.PI * 2;
     const distance = Math.pow(Math.random(), .7) * 106;
     const cx = 128 + Math.cos(angle) * distance;
     const cy = 128 + Math.sin(angle) * distance;
     const size = (2 + Math.random() * 14) * (1 - distance / 170);
     ctx.fillStyle = colors[(offset + Math.floor(Math.random() * colors.length)) % colors.length];
     ctx.beginPath();
     for (let j = 0; j < 9; j++) {
       const a = j * Math.PI * 2 / 9;
       const r = size * (.45 + Math.random() * .75);
       const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * (.5 + Math.random() * .5);
       if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
     }
     ctx.closePath();
     ctx.fill();
   }
   const texture = new THREE.CanvasTexture(canvas);
   texture.colorSpace = THREE.SRGBColorSpace;
   const material = new THREE.MeshBasicMaterial({map:texture, alphaTest:.1, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
   return {material, batches: [] as {mesh:THREE.InstancedMesh, count:number}[]};
 });
 const splashTransform = new THREE.Object3D();
 function addSplash(x:number, y:number, z:number) {
   const splash = splashes[Math.floor(Math.random()*splashes.length)];
   let batch = splash.batches[splash.batches.length - 1];
   if (!batch || batch.count === 64) {
     const mesh = new THREE.InstancedMesh(splashGeometry, splash.material, 64);
     mesh.count = 0;
     mesh.frustumCulled = false;
     mesh.raycast = () => {};
     scene.add(mesh);
     batch = {mesh, count:0};
     splash.batches.push(batch);
   }
   splashTransform.position.set(x, y + .045, z);
   splashTransform.rotation.set(-Math.PI/2, 0, Math.random()*Math.PI*2);
   splashTransform.scale.set(.8 + Math.random()*.6, .8 + Math.random()*.6, 1);
   splashTransform.updateMatrix();
   batch.mesh.setMatrixAt(batch.count++, splashTransform.matrix);
   batch.mesh.count = batch.count;
   batch.mesh.instanceMatrix.needsUpdate = true;
 }
 function clearBloodStains() {
   for (const splash of splashes) {
     for (const batch of splash.batches) {
       scene.remove(batch.mesh);
       batch.mesh.dispose();
     }
     splash.batches.length = 0;
   }
 }
 const controller = world.createCharacterController(.02);
 controller.enableSnapToGround(.1);
 const standingHeight = stance(false) * 2;
 const visualScale = standingHeight / 1.98;
 const zombieHalfHeight = stance(false);
 const shape = new R.Capsule(zombieHalfHeight - radius, radius);
 const identity = {x:0,y:0,z:0,w:1};
 world.step();
 const zombies: any[] = [];
 const fallen: any[] = [];
 const spawns = planEncounters(layout, landmarks, (p:{x:number;z:number}) =>
   Math.hypot(p.x - spawn.x, p.z - spawn.z) >= 5 && layout.vacant(p,.32) && !world.intersectionWithShape({x:p.x,y:zombieHalfHeight+.02,z:p.z},identity,shape));
 const bodyGeometry = new THREE.PlaneGeometry(1.15, 1.16);
 const armGeometry = new THREE.PlaneGeometry(.55, 1.08).translate(0, -.54, 0);
 const legGeometry = new THREE.PlaneGeometry(.43, .95).translate(0, -.475, 0);
 const activeLimit = 1200;
 const capacity = activeLimit + spawns.length;
 const batches = [
   ...bodyMaterials.map(material => new THREE.InstancedMesh(bodyGeometry, material, capacity)),
   new THREE.InstancedMesh(armGeometry, armMaterial, capacity),
   new THREE.InstancedMesh(armGeometry, armMaterial, capacity),
   new THREE.InstancedMesh(legGeometry, legMaterial, capacity),
   new THREE.InstancedMesh(legGeometry, legMaterial, capacity),
 ];
 for (const [batchIndex, mesh] of batches.entries()) {
   mesh.count = 0;
   mesh.frustumCulled = false;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   const raycast = mesh.raycast.bind(mesh);
   mesh.raycast = (raycaster, intersections) => {
     const hits: THREE.Intersection[] = [];
     raycast(raycaster, hits);
     intersections.push(...hits.filter(hit => hit.instanceId !== undefined && hit.instanceId < zombies.length && (batchIndex >= bodyMaterials.length || zombies[hit.instanceId].torsoVariant === batchIndex)));
   };
   targets.add(mesh);
 }
 const hiddenBodyMatrix = new THREE.Matrix4().makeTranslation(0, -100000, 0);
 function renderInstances() {
   const all = [...zombies, ...fallen];
   all.forEach((zombie, index) => {
     zombie.group.updateMatrixWorld(true);
     for (let variant = 0; variant < bodyMaterials.length; variant++) batches[variant].setMatrixAt(index, zombie.torsoVariant === variant ? zombie.spriteBody.matrixWorld : hiddenBodyMatrix);
     const parts = [...zombie.arms.map((arm:THREE.Group) => arm.children[0]), ...zombie.legs.map((leg:THREE.Group) => leg.children[0])];
     parts.forEach((part:THREE.Object3D, batch:number) => batches[batch + bodyMaterials.length].setMatrixAt(index, part.matrixWorld));
   });
   for (const mesh of batches) { mesh.count = all.length; mesh.boundingSphere = null; mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, all.length * 16); mesh.instanceMatrix.needsUpdate = true; }
 }

 const densityModes: Record<string, {fraction:number; limit:number}> = {
   walking: {fraction:.45, limit:600},
   jeep: {fraction:.65, limit:850},
   tank: {fraction:.85, limit:1100},
   helicopter: {fraction:1, limit:activeLimit},
 };
 let lastStreamingCheck = -Infinity;
 let lastMode = '';
 function activate(spawn:any, i:number) {
   const {x,z} = spawn;
   if (spawn.torsoVariant === undefined) spawn.torsoVariant = Math.floor(Math.random() * bodyMaterials.length);
   const group = new THREE.Group();
   group.scale.setScalar(visualScale);
   const body = new THREE.Object3D();
   body.position.set(0, 1.4, .02);
   group.add(body);
   const arms = [-1, 1].map(side => {
     const pivot = new THREE.Group();
     pivot.position.set(side * .22, 1.52, .04);
     const arm = new THREE.Object3D();
     arm.scale.x = side;
     pivot.add(arm); group.add(pivot); return pivot;
   });
   const legs = [-1, 1].map(side => {
     const pivot = new THREE.Group();
     pivot.position.set(side * .13, .91, 0);
     const leg = new THREE.Object3D();
     leg.scale.x = side;
     pivot.add(leg); group.add(pivot); return pivot;
   });
   const bodyPhysics = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x,spawn.y ?? zombieHalfHeight+.02,z));
   const collider = world.createCollider(R.ColliderDesc.capsule(zombieHalfHeight-radius,radius).setSensor(true), bodyPhysics);
   group.position.set(x,(spawn.y ?? zombieHalfHeight+.02)-zombieHalfHeight-.02,z);
   const zombie = {group, spriteBody:body, torsoVariant:spawn.torsoVariant, arms, legs, body:bodyPhysics, collider, x, z, vx:spawn.vx || 0, vz:spawn.vz || 0, hit:0, health:spawn.health, spawn, phase:i * .7, simulationSlot:i % 3};
   spawn.active = zombie;
   zombies.push(zombie);
 }
 function deactivate(index:number) {
   const zombie = zombies[index], pos = zombie.body.translation(), spawn = zombie.spawn;
   spawn.x = pos.x; spawn.y = pos.y; spawn.z = pos.z;
   spawn.vx = zombie.vx; spawn.vz = zombie.vz; spawn.health = zombie.health;
   spawn.active = null;
   world.removeRigidBody(zombie.body);
   zombies.splice(index, 1);
 }
 function stream(player:THREE.Vector3, now:number, mode:string) {
   if (mode === lastMode && now - lastStreamingCheck < 500) return;
   lastStreamingCheck = now;
   lastMode = mode;
   const {fraction, limit} = densityModes[mode] || densityModes.walking;
   for (let i=zombies.length-1;i>=0;i--) {
     const zombie=zombies[i], p=zombie.body.translation();
     if (zombie.spawn.densityRank >= fraction || Math.hypot(p.x-player.x,p.z-player.z)>75) deactivate(i);
   }
   if (zombies.length > limit) {
     const nearest=[...zombies].sort((a,b)=>{
       const ap=a.body.translation(), bp=b.body.translation();
       return Math.hypot(ap.x-player.x,ap.z-player.z)-Math.hypot(bp.x-player.x,bp.z-player.z);
     });
     const keep=new Set(nearest.slice(0,limit));
     for (let i=zombies.length-1;i>=0;i--) if(!keep.has(zombies[i])) deactivate(i);
   }
   const candidates = spawns.map((spawn:any,i:number) => ({spawn,i,d:Math.hypot(spawn.x-player.x,spawn.z-player.z)}))
     .filter(({spawn,d}:any) => !spawn.dead && !spawn.active && spawn.densityRank < fraction && d < 65)
     .sort((a:any,b:any) => a.d-b.d);
   for (const {spawn,i} of candidates) {
     if (zombies.length>=limit) break;
     activate(spawn,i);
   }
 }
 stream(new THREE.Vector3(spawn.x,0,spawn.z),0,'walking');
 renderInstances();
 let seed=9281;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646};const dummy=new THREE.Object3D();
 const roadGrid = new Map<string, {ax:number,az:number,bx:number,bz:number,width:number}[]>();
 const cellSize = 16;
 for (const road of roads) {
   const width = (roadWidths[road.highway] || 3) / 2;
   for (let i = 1; i < road.points.length; i++) {
     const a = road.points[i-1], b = road.points[i];
     const segment = {ax:a.x, az:a.z, bx:b.x, bz:b.z, width};
     const padding = width + 1;
     for (let x = Math.floor((Math.min(a.x,b.x)-padding)/cellSize); x <= Math.floor((Math.max(a.x,b.x)+padding)/cellSize); x++) {
       for (let z = Math.floor((Math.min(a.z,b.z)-padding)/cellSize); z <= Math.floor((Math.max(a.z,b.z)+padding)/cellSize); z++) {
         const key = `${x},${z}`;
         if (!roadGrid.has(key)) roadGrid.set(key, []);
         roadGrid.get(key)!.push(segment);
       }
     }
   }
 }
 function onRoad(x:number,z:number, margin:number) {
   const nearby = roadGrid.get(`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`) || [];
   return nearby.some(road => {
     const dx=road.bx-road.ax, dz=road.bz-road.az, length=dx*dx+dz*dz;
     const t=length ? THREE.MathUtils.clamp(((x-road.ax)*dx+(z-road.az)*dz)/length,0,1) : 0;
     return Math.hypot(x-road.ax-t*dx,z-road.az-t*dz) < road.width+margin;
   });
 }
 function vegetation(name:string,count:number,bush:boolean){
   const material = new THREE.MeshBasicMaterial({map:load(name),alphaTest:.2,side:THREE.DoubleSide});
   const angle = {value:0};
   material.onBeforeCompile = shader => {
     shader.uniforms.billboardYaw = angle;
     shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float billboardYaw;');
     shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
       vec3 center = instanceMatrix[3].xyz;
       float w = length(instanceMatrix[0].xyz);
       float h = length(instanceMatrix[1].xyz);
       vec3 billboard = center + vec3(position.x*w*cos(billboardYaw), position.y*h, -position.x*w*sin(billboardYaw));
       vec4 mvPosition = modelViewMatrix * vec4(billboard, 1.0);
       gl_Position = projectionMatrix * mvPosition;
     `);
   };
   material.customProgramCacheKey = () => 'vegetation-billboard-v1';
   const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,count);
   mesh.frustumCulled=false; mesh.raycast=()=>{}; scene.add(mesh);
   let placed = 0, attempts = 0;
   while (placed < count && attempts++ < count * 60) {
     const x=random()*58-29,z=random()*58-29;
     if (bush && random()>.015+.985*Math.pow(Math.min(Math.hypot(x,z)/41,1),4)) continue;
     const h=bush?.72+random()*.6:.18+random()*.26;
     const w=bush?h*1.35:.22+random()*.25;
     if (onRoad(x,z,w/2)) continue;
     dummy.position.set(x,h/2,z); dummy.rotation.set(0,0,0); dummy.scale.set(w,h,1); dummy.updateMatrix();
     mesh.setMatrixAt(placed++,dummy.matrix);
   }
   mesh.count = placed;
   mesh.instanceMatrix.needsUpdate=true;
   return (yaw:number) => { angle.value=yaw; };
 }
 const bushes=vegetation('foliage.png',532,true), grass=vegetation('grass.png',12000,false);
 let simulationFrame = 0;
 let nextPlayerHit = 0;
 function step(dt:number, player:THREE.Vector3, mode='walking') {
   simulationFrame++;
   stream(player, performance.now(), mode);
   const neighboursByCell = new Map<string, any[]>();
   for (const zombie of zombies) {
     const pos = zombie.body.translation();
     zombie.x = pos.x; zombie.z = pos.z;
     const key = `${Math.floor(pos.x/2.5)},${Math.floor(pos.z/2.5)}`;
     if (!neighboursByCell.has(key)) neighboursByCell.set(key, []);
     neighboursByCell.get(key)!.push(zombie);
   }
   for (const zombie of zombies) {
     const spawn = zombie.spawn;
     if (Math.hypot(player.x-spawn.group.x,player.z-spawn.group.z)<22 ||
         Math.hypot(player.x-zombie.x,player.z-zombie.z)<22) spawn.group.awake=true;
     if (!spawn.group.awake && (!spawn.patrol || Math.hypot(player.x-zombie.x,player.z-zombie.z)>35)) continue;
     const distant = mode === 'helicopter' && Math.hypot(player.x-zombie.x,player.z-zombie.z)>25;
     if (distant && (simulationFrame + zombie.simulationSlot) % 3 !== 0) continue;
     const movementDt = distant ? dt * 3 : dt;
     const destination=spawn.group.awake ? player : spawn.patrol[spawn.leg];
     const dx=destination.x-zombie.x, dz=destination.z-zombie.z;
     if (!spawn.group.awake && Math.hypot(dx,dz)<1.2) spawn.leg=1-spawn.leg;
     const distance = Math.hypot(dx,dz) || 1;
     let sx = 0, sz = 0, ax = 0, az = 0, neighbours = 0;
     const cellX=Math.floor(zombie.x/2.5), cellZ=Math.floor(zombie.z/2.5);
     for (let x=cellX-1;x<=cellX+1;x++) for (let z=cellZ-1;z<=cellZ+1;z++) for (const other of neighboursByCell.get(`${x},${z}`) || []) {
       if (other === zombie) continue;
       const ox = zombie.x-other.x, oz = zombie.z-other.z, d = Math.hypot(ox,oz);
       if (d > .001 && d < 2.5) {
         sx += ox / (d*d); sz += oz / (d*d);
         ax += other.vx; az += other.vz; neighbours++;
       }
     }
     const targetX = (distance > 1 ? dx/distance*1.5 : 0) + sx*1.4 + (neighbours ? ax/neighbours*.15 : 0);
     const targetZ = (distance > 1 ? dz/distance*1.5 : 0) + sz*1.4 + (neighbours ? az/neighbours*.15 : 0);
     const speed = Math.hypot(targetX,targetZ) || 1;
     const blend = 1-Math.exp(-5*movementDt);
     zombie.vx += (targetX / speed * Math.min(speed,1.5)-zombie.vx)*blend;
     zombie.vz += (targetZ / speed * Math.min(speed,1.5)-zombie.vz)*blend;
     controller.computeColliderMovement(zombie.collider, {x:zombie.vx*movementDt,y:-.1*(movementDt/dt),z:zombie.vz*movementDt}, R.QueryFilterFlags.EXCLUDE_SENSORS);
     const move = controller.computedMovement();
     const pos = zombie.body.translation();
     zombie.body.setNextKinematicTranslation({x:pos.x+move.x,y:pos.y+move.y,z:pos.z+move.z});
   }
   const now=performance.now();
   if(mode==='walking' && now>=nextPlayerHit && zombies.some(zombie=>{
     const p=zombie.body.translation();
     return Math.hypot(player.x-p.x,player.z-p.z)<1.3 && Math.abs(player.y-p.y)<1.6;
   })) { nextPlayerHit=now+1000; onPlayerHit(20); }
 }
 function update(now:number, yaw:number, player:THREE.Vector3) {
   bushes(yaw); grass(yaw);
   for (const corpse of fallen) {
     const progress = THREE.MathUtils.clamp((now - corpse.started) / 350, 0, 1);
     const eased = 1 - Math.pow(1 - progress, 3);
     corpse.group.rotation.x = -Math.PI / 2 * eased;
     for (const limb of corpse.limbs) limb.pivot.rotation.x = limb.angle * (1 - eased);
   }
   zombies.forEach(zombie => {
     const pos = zombie.body.translation();
     zombie.group.position.set(pos.x,pos.y-zombieHalfHeight-.02,pos.z);
     const dx = player.x-pos.x, dz = player.z-pos.z;
     zombie.group.rotation.y = Math.atan2(dx,dz);
     const movement = Math.min(1, Math.hypot(zombie.vx, zombie.vz) / 1.5);
     const stride = Math.sin(now*.006+zombie.phase) * movement;
     const armBob = Math.sin(now*.0035+zombie.phase) * movement;
     zombie.arms[0].rotation.x = -1.05 + armBob * .08;
     zombie.arms[1].rotation.x = -1.05 - armBob * .08;
     zombie.legs[0].rotation.x = stride * .55;
     zombie.legs[1].rotation.x = -stride * .55;
     zombie.group.rotation.z = zombie.hit && now-zombie.hit < 500 ? .16*Math.exp(-(now-zombie.hit)/150)*Math.sin((now-zombie.hit)/35) : 0;
   });
   renderInstances();
 }
 function damage(zombie:any, now:number, amount:number, refresh=true) {
   zombie.hit = now;
   zombie.health = Math.max(0, zombie.health - amount);
   if (zombie.health <= 0) {
     const position = zombie.body.translation();
     addSplash(position.x, position.y - zombieHalfHeight - .02, position.z);
     zombie.group.position.set(position.x, position.y - zombieHalfHeight - .02 + .06, position.z);
     zombie.group.rotation.order = 'YXZ';
     zombie.group.rotation.z = 0;
     fallen.push({group:zombie.group, spriteBody:zombie.spriteBody, torsoVariant:zombie.torsoVariant, arms:zombie.arms, legs:zombie.legs, started:now, limbs:[...zombie.arms, ...zombie.legs].map((pivot:THREE.Group) => ({pivot, angle:pivot.rotation.x}))});
     zombie.spawn.dead = true;
     zombie.spawn.active = null;
     world.removeRigidBody(zombie.body);
     zombies.splice(zombies.indexOf(zombie), 1);
     onKill(now);
     if (refresh) renderInstances();
   }
 }
 function shoot(_ray:unknown, now:number, hit:THREE.Intersection, amount=25) {
   const zombie = batches.includes(hit.object as THREE.InstancedMesh) && hit.instanceId !== undefined ? zombies[hit.instanceId] : undefined;
   if (!zombie) return false;
   damage(zombie, now, amount);
   return true;
 }
 function closestAimTarget(camera:THREE.Camera, visible:(point:THREE.Vector3)=>boolean) {
   const candidates:{point:THREE.Vector3, distance:number}[] = [];
   const position = new THREE.Vector3(), projected = new THREE.Vector3();
   camera.updateMatrixWorld(true);
   const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
   for (const zombie of zombies) {
     const p = zombie.body.translation();
     position.set(p.x, p.y + .08, p.z);
     projected.copy(position).project(camera);
     if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
     candidates.push({point:position.clone(), distance:Math.hypot(projected.x * aspect, projected.y)});
   }
   candidates.sort((a,b) => a.distance - b.distance);
   return candidates.find(candidate => visible(candidate.point))?.point;
 }
 function slice(plane:THREE.Plane, now:number) {
   let changed = false;
   const point = new THREE.Vector3();
   const extent = radius + (zombieHalfHeight - radius) * Math.abs(plane.normal.y);
   for (let i = zombies.length - 1; i >= 0; i--) {
     const zombie = zombies[i], position = zombie.body.translation();
     point.set(position.x, position.y, position.z);
     if (Math.abs(plane.distanceToPoint(point)) > extent) continue;
     damage(zombie, now, zombie.health, false);
     changed = true;
   }
   if (changed) renderInstances();
 }
 function runOver(x:number,z:number,angle:number,now:number,halfWidth=.85,halfLength=1.65) {
   const cos=Math.cos(angle), sin=Math.sin(angle);
   let changed=false;
   for (let i=zombies.length-1;i>=0;i--) {
     const zombie=zombies[i], position=zombie.body.translation();
     if (position.y > 2) continue;
     const dx=position.x-x, dz=position.z-z;
     const localX=dx*cos-dz*sin, localZ=dx*sin+dz*cos;
     if (Math.abs(localX)<=halfWidth+radius && Math.abs(localZ)<=halfLength+radius) { damage(zombie,now,zombie.health,false); changed=true; }
   }
   if(changed) renderInstances();
 }
 function explode(point:THREE.Vector3,now:number, blastRadius:number) {
   let changed=false;
   for(let i=zombies.length-1;i>=0;i--) {
     const p=zombies[i].body.translation();
     if (Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z)<=blastRadius) { damage(zombies[i],now,zombies[i].health,false); changed=true; }
   }
   if(changed) renderInstances();
   return changed;
 }
 function fireShotgun(origin:THREE.Vector3, direction:THREE.Vector3, now:number, visible:(point:THREE.Vector3)=>boolean) {
   const point = new THREE.Vector3(), offset = new THREE.Vector3();
   let nearestHit: THREE.Vector3 | undefined;
   let nearestDistance = Infinity;
   for (let i = zombies.length - 1; i >= 0; i--) {
     const zombie = zombies[i], position = zombie.body.translation();
     point.set(position.x, position.y, position.z);
     offset.subVectors(point, origin);
     const distance = offset.length();
     if (distance > 15 || distance === 0 || offset.dot(direction) / distance < Math.cos(12 * Math.PI / 180) || !visible(point)) continue;
     damage(zombie, now, zombie.health, false);
     if (distance < nearestDistance) {
       nearestDistance = distance;
       nearestHit = point.clone();
     }
   }
   if (nearestHit) renderInstances();
   return nearestHit;
 }
 function fireTurret(origin:THREE.Vector3, direction:THREE.Vector3, now:number, visible:(point:THREE.Vector3)=>boolean) {
   const point=new THREE.Vector3(), offset=new THREE.Vector3();
   let nearestHit: THREE.Vector3 | undefined;
   let nearestDistance = Infinity;
   for(let i=zombies.length-1;i>=0;i--) {
     const zombie=zombies[i], p=zombie.body.translation();
     point.set(p.x,p.y,p.z);
     offset.subVectors(point,origin);
     const distance=offset.length();
     if(distance<1 || distance>120 || offset.dot(direction)/distance<Math.cos(10*Math.PI/180) || !visible(point)) continue;
     damage(zombie,now,25,false);
     if (distance < nearestDistance) {
       nearestDistance = distance;
       nearestHit = point.clone();
     }
   }
   if (nearestHit) renderInstances();
   return nearestHit;
 }
 return {targets,step,update,shoot,closestAimTarget,slice,runOver,explode,fireShotgun,fireTurret,clearBloodStains, get ambientTargets() { return {children:zombies.map(zombie => zombie.group)}; }};
}
