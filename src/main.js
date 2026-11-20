import {dressStreets} from './street-props.js';
import { createCity } from './city.js';
import { createSky } from './sky.ts';
import { createJeep } from './jeep.ts';
import { createTank } from './tank.ts';
import { createHelicopter } from './helicopter.ts';
import { createRange } from './range.ts';
import { createPlayerController } from './player-controller.js';
import { createImpacts } from './impacts.js';
import { createGameAudio } from './audio.ts';
import { createGunController } from './gun-controller.js';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import '@fontsource/geist/700.css';
import './style.css';


async function main() {
await RAPIER.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const updateSky = createSky(scene);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.02, 1500);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.37, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.querySelector('#app').appendChild(renderer.domElement);
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), white);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
world.createCollider(new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })));

const city = await createCity(scene, world, RAPIER);

const player = createPlayerController(RAPIER, world, camera);
world.step();
const jeep = createJeep(scene, world, RAPIER, player.collider);
const vehicleColliders = [];
const tank = createTank(scene, world, RAPIER, player.collider, vehicleColliders);
const helicopter = createHelicopter(scene, world, RAPIER, player.collider, vehicleColliders, 0, -12, city.buildingColliderHandles, helicopterCrash);
function placeVehicle(vehicle, clearance, startRadius) {
  const shape = new RAPIER.Ball(clearance);
  for (let radius = startRadius; radius < 120; radius += 2) {
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16, x = Math.sin(angle) * radius, z = 5 + Math.cos(angle) * radius;
      if (Math.hypot(x-jeep.group.position.x,z-jeep.group.position.z) < clearance+4) continue;
      if (vehicle !== tank && Math.hypot(x-tank.group.position.x,z-tank.group.position.z) < clearance+4) continue;
      if (vehicle === helicopter) {
        const parts = [{center:[0,1.35,-.2],half:[.85,.7,1.6]}, {center:[0,1.6,2.7],half:[.36,.5,1.7]}, {center:[0,2.45,0],half:[3.4,.08,3.4]}];
        const blocked = parts.some(({center,half}) => world.intersectionWithShape(
          {x:x+center[0],y:center[1],z:z+center[2]}, {x:0,y:0,z:0,w:1},
          new RAPIER.Cuboid(...half), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          undefined, player.collider, undefined, collider => city.buildingColliderHandles.has(collider.handle)
        ));
        if (blocked) continue;
      }
      if (!world.intersectionWithShape({x,y:clearance+.1,z},{x:0,y:0,z:0,w:1},shape,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,player.collider)) {
        vehicle.group.position.set(x,0,z); vehicle.group.updateMatrixWorld(true); return;
      }
    }
  }
}
placeVehicle(tank, 2.4, 8);
placeVehicle(helicopter, 3.4, 14);
const helicopterSpawn = helicopter.group.position.clone();
const isDriving = () => jeep.driving || tank.driving || helicopter.flying;
const streets = dressStreets(scene, world, RAPIER, city, jeep, [tank.group.position, helicopter.group.position]);
let playerHealth = 100;
const healthBar = document.createElement('div');
healthBar.className = 'health-bar';
healthBar.setAttribute('role', 'progressbar');
healthBar.setAttribute('aria-label', 'Health');
healthBar.setAttribute('aria-valuemin', '0');
healthBar.setAttribute('aria-valuemax', '100');
healthBar.innerHTML = '<div class="health-bar-fill"></div>';
document.querySelector('#app').appendChild(healthBar);
function updateHealth() {
  healthBar.firstElementChild.style.width = `${playerHealth}%`;
  healthBar.setAttribute('aria-valuenow', String(playerHealth));
}
updateHealth();
const streakDisplay = document.createElement('div');
streakDisplay.className = 'streak-display';
streakDisplay.setAttribute('aria-live', 'polite');
document.querySelector('#app').appendChild(streakDisplay);
const streakWindow = 5000;
let streak = 0, lastKill = -Infinity;
const earlyStreakMilestones = new Set([5, 10, 25, 50]);
let pendingStreakCue = 0;
const range = createRange(scene, world, RAPIER, city.roads, city.layout, streets, now => {
  streak = now - lastKill < streakWindow ? streak + 1 : 1;
  lastKill = now;
  if (earlyStreakMilestones.has(streak) || streak % 100 === 0) {
    pendingStreakCue = Math.max(pendingStreakCue, streak);
  }
  streakDisplay.textContent = `${streak} KILL STREAK`;
  const streakGrowth = Math.expm1(2.3 * Math.min(1, (streak - 1) / 499)) / Math.expm1(2.3);
  streakDisplay.style.setProperty('--streak-scale', String(1 + 9 * streakGrowth));
  streakDisplay.style.setProperty('--streak-fringe', `${8 + 48 * streakGrowth}px`);
  streakDisplay.classList.add('visible');
}, amount => {
  if (skyTransition || playerHealth <= 0) return;
  playerHealth = Math.max(0, playerHealth - amount);
  updateHealth();
  if (playerHealth === 0) respawnInSky();
});

const keys = new Set();
let jumpQueued = false;
let jumped = false;
let stepDistance = 0;
const audio = createGameAudio(camera);
audio.prepare();
let skyDrop = false;
let skyTransition = false;
const skyFade = document.createElement('div');
skyFade.className = 'sky-fade';
document.querySelector('#app').appendChild(skyFade);
const openingTitle = document.createElement('div');
openingTitle.className = 'opening-title';
openingTitle.textContent = 'REVOLUT.';
document.querySelector('#app').appendChild(openingTitle);
let openingDive = true;
function respawnInSky() {
  if (skyTransition) return;
  skyTransition = true;
  jumped = false;
  stepDistance = 0;
  skyFade.classList.add('visible');
  setTimeout(() => {
    jumpQueued = false;
    player.teleportToSky();
    if (playerHealth === 0) { playerHealth = 100; updateHealth(); }
    player.updateCamera();
    skyDrop = true;
    skyFade.classList.remove('visible');
    setTimeout(() => { skyTransition = false; }, 120);
  }, 120);
}
function helicopterCrash(position, occupied) {
  if (occupied) {
    player.setDriving(false, position);
    yaw = helicopter.group.rotation.y; pitch = 0; camera.rotation.set(pitch, yaw, 0);
  }
  audio.play('explosion', position);
  for (let i = 0; i < 12; i++) {
    const offset = new THREE.Vector3((Math.random()-.5)*6, (Math.random()-.5)*4+1, (Math.random()-.5)*6);
    setTimeout(() => addExplosion(position.clone().add(offset), performance.now()), i * 55);
  }
  if (occupied) respawnInSky();
  setTimeout(() => helicopter.respawn(helicopterSpawn), 3000);
}
window.addEventListener('keydown', (event) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'KeyF' && !event.repeat) {
    const current = jeep.driving ? jeep : tank.driving ? tank : helicopter.flying ? helicopter : null;
    if (current) {
      if (current.exit(camera)) {
        player.setDriving(false, camera.position);
        player.updateCamera();
        yaw = current.group.rotation.y; pitch = 0; camera.rotation.set(pitch, yaw, 0);
      }
      event.stopImmediatePropagation();
      return;
    }
    const vehicles = [jeep, tank, helicopter].sort((a,b) => a.group.position.distanceTo(camera.position) - b.group.position.distanceTo(camera.position));
    for (const vehicle of vehicles) {
      if (!vehicle.enter(camera)) continue;
      player.setDriving(true);
      jumped = false;
      stepDistance = 0;
      yaw = vehicle.group.rotation.y; pitch = 0; camera.rotation.set(pitch, yaw, 0);
      jumpQueued = false;
      event.stopImmediatePropagation();
      return;
    }
  }
  if (event.code === 'Space' && !event.repeat && !isDriving()) jumpQueued = true;
  if (event.code === 'KeyR' && !event.repeat && !skyTransition && !isDriving()) respawnInSky();
  keys.add(event.code);
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); jumpQueued = false; });

const crosshair = document.createElement('div');
crosshair.className = 'crosshair';
crosshair.setAttribute('aria-hidden', 'true');
document.querySelector('#app').appendChild(crosshair);
let yaw = 0;
let pitch = 0;
renderer.domElement.addEventListener('click', () => {
  audio.init();
  if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked) { keys.clear(); jumpQueued = false; }
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (tank.driving) { tank.mouse(event.movementX, event.movementY); return; }
  if (helicopter.flying) { helicopter.mouse(event.movementX, event.movementY); return; }
  yaw -= event.movementX * 0.002;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.002, -1.35, 1.35);
  camera.rotation.set(pitch, yaw, 0);
});

const impacts = createImpacts(scene);
player.updateCamera();
const guns = createGunController({ scene, camera, renderer, ground, targets: range.targets, buildings: city.buildingMeshes, isDriving, audio, onHit: (hit, direction, damage) => {
  impacts.add(hit, direction);
  return range.shoot({ ray: { direction } }, performance.now(), hit, damage);
} });

let vehicleFiring = false, turretFiring = false;
let lastVehicleShot = -Infinity, lastTurretShot = -Infinity;
let missiles = 6, missileReloadEnd = 0;
const missileDisplay = document.createElement('div');
missileDisplay.className = 'ammo-display';
missileDisplay.style.display = 'none';
document.querySelector('#app').appendChild(missileDisplay);
function reloadMissiles(now) {
  if (missiles >= 6 || missileReloadEnd) return;
  missileReloadEnd = now + 2500;
  audio.play('reload');
}
window.addEventListener('keydown', event => {
  if (event.code === 'KeyT' && !event.repeat && helicopter.flying && document.pointerLockElement === renderer.domElement) reloadMissiles(performance.now());
});
const vehicleRay = new THREE.Raycaster();
const explosionGeometry = new THREE.BoxGeometry(1, 1, 1);
const explosionEdges = new THREE.EdgesGeometry(explosionGeometry);
const explosions = [];
const turretTracers = [];
function addExplosion(position, now) {
  const group = new THREE.Group();
  const fill = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, depthWrite:false});
  const outline = new THREE.LineBasicMaterial({color:0x000000, transparent:true, depthWrite:false});
  group.position.copy(position);
  group.userData.impact = true;
  scene.add(group);
  const offsets = [[0,0,0],[-.65,.2,0],[.6,.35,.15]];
  const blocks = offsets.map((offset, i) => {
    const block = new THREE.Group();
    block.add(new THREE.Mesh(explosionGeometry,fill),new THREE.LineSegments(explosionEdges,outline));
    group.add(block);
    return {group:block, size:[1,.5,.23][i], offset:new THREE.Vector3(...offset)};
  });
  explosions.push({group, started:now, fill, outline, blocks});
}
function updateExplosions(now) {
  for (let i=turretTracers.length-1;i>=0;i--) {
    if (now-turretTracers[i].started<90) continue;
    scene.remove(turretTracers[i].lines);
    turretTracers[i].lines.geometry.dispose();
    turretTracers[i].lines.material.dispose();
    turretTracers.splice(i,1);
  }
  for (let i=explosions.length-1;i>=0;i--) {
    const effect=explosions[i], progress=(now-effect.started)/500;
    if (progress>=1) {
      scene.remove(effect.group); effect.fill.dispose(); effect.outline.dispose(); explosions.splice(i,1); continue;
    }
    const expansion=1-Math.exp(-progress*16);
    for (const block of effect.blocks) {
      block.group.position.copy(block.offset).multiplyScalar(expansion*2.3);
      block.group.scale.setScalar(block.size*expansion*4.2);
    }
    const opacity=progress<.2 ? 1 : 1-(progress-.2)/.8;
    effect.fill.opacity=effect.outline.opacity=opacity;
  }
}
window.addEventListener('mousedown', event => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (event.button === 0 && (tank.driving || helicopter.flying)) vehicleFiring = true;
  if (event.button === 2 && helicopter.flying) turretFiring = true;
});
window.addEventListener('mouseup', event => {
  if (event.button === 0) vehicleFiring = false;
  if (event.button === 2) turretFiring = false;
});
window.addEventListener('blur', () => { vehicleFiring = turretFiring = false; });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement) vehicleFiring = turretFiring = false;
});
function fireVehicle(now) {
  if (!tank.driving && !helicopter.flying) {
    missileDisplay.style.display = 'none';
    vehicleFiring = turretFiring = false;
    return;
  }
  if (missileReloadEnd && now >= missileReloadEnd) { missiles = 6; missileReloadEnd = 0; }
  missileDisplay.style.display = helicopter.flying ? '' : 'none';
  if (helicopter.flying) missileDisplay.textContent = `${missiles} / 6${missileReloadEnd ? ' · Reloading' : ''}`;
  const missileReady = !helicopter.flying || (!missileReloadEnd && missiles > 0);
  const interval = helicopter.flying ? 1000 / 3 : 900;
  const missileShot = vehicleFiring && missileReady && now - lastVehicleShot >= interval;
  const turretShot = helicopter.flying && turretFiring && now - lastTurretShot >= 120;
  if (!missileShot && !turretShot) return;
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  if (missileShot) {
    lastVehicleShot = now;
    if (helicopter.flying) {
      missiles--;
      if (!missiles) reloadMissiles(now);
      missileDisplay.textContent = `${missiles} / 6${missileReloadEnd ? ' · Reloading' : ''}`;
    } else if (tank.driving) {
      tank.recoil();
      audio.play('cannon');
    }
    vehicleRay.setFromCamera(new THREE.Vector2(), camera);
    const hits = vehicleRay.intersectObjects([ground, ...city.buildingMeshes, range.targets], true);
    const hit = hits.find(item => item.object instanceof THREE.Mesh && !item.object.userData.impact);
    if (hit) {
      impacts.add(hit, vehicleRay.ray.direction);
      addExplosion(hit.point, now);
      audio.play('explosion', hit.point);
      range.explode(hit.point, now, 4);
    }
  }
  if (turretShot) {
    lastTurretShot = now;
    const origin=camera.getWorldPosition(new THREE.Vector3());
    const direction=camera.getWorldDirection(new THREE.Vector3());
    const obstructionRay=new THREE.Raycaster();
    const meatHit = range.fireTurret(origin,direction,now,point => {
      const delta=point.clone().sub(origin), distance=delta.length();
      obstructionRay.set(origin,delta.multiplyScalar(1/distance));
      obstructionRay.far=distance;
      return obstructionRay.intersectObjects([ground,...city.buildingMeshes],false).length===0;
    });
    const tracerPoints=[];
    let concreteHit;
    for(let i=0;i<5;i++) {
      const spread=new THREE.Vector2((Math.random()-.5)*.28,(Math.random()-.5)*.28);
      vehicleRay.setFromCamera(spread,camera);
      const hit=vehicleRay.intersectObjects([ground,...city.buildingMeshes],false)[0];
      if(hit) {
        impacts.add(hit,vehicleRay.ray.direction);
        concreteHit ??= hit.point;
      }
      const end=hit ? hit.point : vehicleRay.ray.at(120,new THREE.Vector3());
      tracerPoints.push(origin.x,origin.y,origin.z,end.x,end.y,end.z);
    }
    if (meatHit) audio.impact('meat', meatHit, now);
    else if (concreteHit) audio.impact('concrete', concreteHit, now);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(tracerPoints,3));
    const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x111111}));
    lines.raycast=()=>{};
    scene.add(lines);
    turretTracers.push({lines,started:now});
  }
}

const movementVelocity = new THREE.Vector3();
const descentFeet = new THREE.Vector3();
const descentVelocity = new THREE.Vector3();
const descentRay = new THREE.Raycaster();
const downDirection = new THREE.Vector3(0, -1, 0);
let openingMusicStarted = false;
function startOpeningMusicBeforeLanding() {
  if (openingMusicStarted) return;
  player.getFeetPosition(descentFeet);
  descentRay.set(descentFeet, downDirection);
  const surface = descentRay.intersectObjects([ground, ...city.buildingMeshes], false)[0];
  if (!surface) return;
  let verticalSpeed = player.getMovementVelocity(descentVelocity).y;
  let distance = 0;
  for (let i = 0; i < 210; i++) {
    const gliding = keys.has('Space') && verticalSpeed < 0;
    verticalSpeed -= 12 * step;
    if (gliding) verticalSpeed += (Math.max(verticalSpeed, -3) - verticalSpeed) * (1 - Math.exp(-5 * step));
    distance -= verticalSpeed * step;
  }
  if (surface.distance <= distance || player.isGrounded()) {
    openingMusicStarted = true;
    audio.playMusic();
  }
}
const clock = new THREE.Clock();
let accumulator = 0;
const step = 1 / 60;
renderer.setAnimationLoop(() => {
  const frameTime = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();
  if (streak && now - lastKill >= streakWindow) {
    streak = 0;
    streakDisplay.classList.remove('visible');
  }

  accumulator += frameTime;
  while (accumulator >= step) {
    const previousX = camera.position.x;
    const previousZ = camera.position.z;
    const wasGrounded = !isDriving() && player.isGrounded();
    if (!isDriving()) {
      player.step(step, keys, yaw, jumpQueued);
      const grounded = player.isGrounded();
      if (!skyDrop && !skyTransition && wasGrounded && jumpQueued && !grounded &&
          player.getMovementVelocity(movementVelocity).y > 0) jumped = true;
      if (jumped && grounded) {
        jumped = false;
        audio.play('land');
      }
      if (skyDrop && openingDive) startOpeningMusicBeforeLanding();
      if (skyDrop && player.isGrounded()) {
        skyDrop = false;
        if (openingDive) {
          openingDive = false;
          openingTitle.classList.add('hidden');
        }
        const landing = player.getFeetPosition(new THREE.Vector3());
        addExplosion(landing, now);
        audio.play('openingLand');
        range.explode(landing, now, 8);
      }
    }
    const previousHeading = jeep.group.rotation.y;
    jeep.update(step, keys, camera, (x, z, angle) => range.runOver(x, z, angle, now));
    if (jeep.driving) {
      yaw += jeep.group.rotation.y - previousHeading;
      camera.rotation.set(pitch, yaw, 0);
    }
    tank.update(step, keys, camera, (x,z,angle) => range.runOver(x,z,angle,now,1.55,2));
    helicopter.update(step, keys, camera);
    if (helicopter.flying) camera.quaternion.copy(helicopter.group.quaternion);
    jumpQueued = false;
    range.step(step, camera.position, helicopter.flying ? 'helicopter' : tank.driving ? 'tank' : jeep.driving ? 'jeep' : 'walking');
    world.timestep = step;
    world.step();
    if (!isDriving()) {
      player.updateCamera();
      if (wasGrounded && player.isGrounded() && !skyDrop && !skyTransition) {
        const distance = Math.hypot(camera.position.x - previousX, camera.position.z - previousZ);
        stepDistance = distance > .001 ? stepDistance + distance : 0;
        const crouching = player.isCrouching();
        if (stepDistance >= (crouching ? 1.05 : 1.65)) {
          audio.play('step', undefined, crouching ? -4 : 0);
          stepDistance = 0;
        }
      } else {
        stepDistance = 0;
      }
    }
    accumulator -= step;
  }
  fireVehicle(now);
  guns.update(frameTime, now, player.getMovementVelocity(movementVelocity));
  if (pendingStreakCue) {
    audio.streak(pendingStreakCue, now);
    pendingStreakCue = 0;
  }
  if (skyDrop) {
    camera.fov = 115;
    camera.updateProjectionMatrix();
  }
  renderer.autoClear = true;
  range.update(now, yaw, camera.position);
  impacts.update();
  updateExplosions(now);
  streets.update(now);
  const vehicle = helicopter.flying ? 'rotor' : tank.driving ? 'tracks' : jeep.driving ? 'jeep' : null;
  const audioSpeed = tank.driving ? tank.speed : jeep.driving ? jeep.speed : movementVelocity.y;
  audio.updateEnvironment(now, skyDrop, player.isGrounded(), vehicle, audioSpeed, range);
  updateSky(camera);
  renderer.render(scene, camera);
  guns.render();

});
player.teleportToSky();
player.updateCamera();
skyDrop = true;
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

}

main().catch(console.error);
