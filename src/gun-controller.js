import * as THREE from 'three';
import { createWeaponWheel } from './weapon-wheel.js';

export function createGunController({ scene, camera, renderer, ground, targets, buildings, onHit, audio, isDriving = () => false }) {
  scene.add(camera);
  const viewScene = new THREE.Scene();
  const viewCamera = new THREE.PerspectiveCamera();

  const loader = new THREE.TextureLoader();
  function sprite(file, width, height, count = 8) {
    const group = new THREE.Group(), geometry = new THREE.PlaneGeometry(width, height);
    const map = loader.load(`${import.meta.env.BASE_URL}assets/${file}`); map.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: .1, side: THREE.DoubleSide, depthWrite: true, color: i === 0 || i === count - 1 ? 0xffffff : 0xaaaaaa });
      const layer = new THREE.Mesh(geometry, material); layer.position.z = (i / Math.max(1, count - 1) - .5) * .03; group.add(layer);
    }
    return group;
  }
  const models = [
    { name: 'Pistol', hip: sprite('pistol-ink.png', 1, .7), ads: sprite('pistol-rear.png', .53, .8), ground: sprite('pistol-ink.png', 1, .7, 4), ammo: 12, cap: 12, interval: 300, reload: 1200 },
    { name: 'Assault rifle', hip: sprite('ak47-ink.png', 1.4, .46), ads: sprite('ak47-rear.png', 2.34, 1.56), ground: sprite('ak47-ink.png', 1.3, .43, 4), ammo: 30, cap: 30, interval: 100, reload: 1800 },
    { name: 'Shotgun', hip: sprite('shotgun-source-ink.png', 1.5, .315), ads: sprite('shotgun-rear.svg', .8, .8), ground: sprite('shotgun-source-ink.png', 1.4, .294, 4), ammo: 8, cap: 8, interval: 750, reload: 2200 },
  ];
  models.forEach((g, i) => { viewScene.add(g.hip, g.ads); g.ground.scale.setScalar(.5); g.ground.rotation.set(-Math.PI / 2, 0, 0, 'YXZ'); g.ground.position.set(i ? 1.8 : 1.4, .07, i ? 1.8 : 2.2); scene.add(g.ground); });
  // The current scene starts equipped; the second gun can be selected by scrolling.
  let selected = 0, held = true, aiming = false, firing = false, lastShot = -Infinity, reloadEnd = 0, recoilImpulse = 0, recoilDisplay = 0, raise = 0;
  const hud = document.createElement('div'); hud.className = 'ammo-display'; document.querySelector('#app').append(hud);
  const showWheel = createWeaponWheel(document.querySelector('#app'));
  const ray = new THREE.Raycaster();
  function updateHud() { const gun = models[selected]; hud.textContent = held ? `${gun.ammo} / ${gun.cap}${reloadEnd ? ' · Reloading' : ''}` : 'Unarmed'; }
  function shoot(now) {
    const gun = models[selected]; if (!held || reloadEnd || now - lastShot < gun.interval) return;
    if (!gun.ammo) { reload(); return; }
    recoilSide = (Math.random() - .5) * .18;
    audio.play(selected === 2 ? 'shotgun' : selected === 1 ? 'rifle' : 'pistol');
    gun.ammo--; lastShot = now; recoilImpulse = Math.min(1, recoilImpulse + (selected === 2 ? .8 : selected === 1 ? .32 : .48)); updateHud();
    camera.updateMatrixWorld(true);
    const pellets = selected === 2 ? 16 : 1;
    let meatHit, concreteHit;
    for (let i = 0; i < pellets; i++) {
      ray.setFromCamera(new THREE.Vector2(), camera);
      if (pellets > 1) {
        const angle = Math.random() * Math.PI * 2, radius = Math.sqrt(Math.random()) * .14;
        ray.ray.direction.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -1).normalize().applyQuaternion(camera.quaternion);
      }
      const hits = ray.intersectObjects([ground, ...buildings, targets], true);
      const hit = hits.find(h => h.object instanceof THREE.Mesh && !h.object.userData.impact);
      if (!hit) continue;
      if (onHit(hit, ray.ray.direction, pellets > 1 ? 8 : 25)) meatHit ??= hit.point;
      else if (hit.object === ground || buildings.includes(hit.object)) concreteHit ??= hit.point;
    }
    if (meatHit) audio.impact('meat', meatHit, now);
    else if (concreteHit) audio.impact('concrete', concreteHit, now);
  }
  function reload() {
    const gun = models[selected];
    if (!held || reloadEnd || gun.ammo >= gun.cap) return;
    reloadEnd = performance.now() + gun.reload;
    audio.play('reload');
    updateHud();
  }
  function drop() { if (!held) return; const gun = models[selected]; const direction = new THREE.Vector3(); camera.getWorldDirection(direction); gun.ground.position.copy(camera.position).addScaledVector(direction, .8); gun.ground.position.y = .07; gun.ground.visible = true; const next = models.findIndex(model => !model.ground.visible);
    held = next >= 0; if (held) selected = next; followReady = false; aiming = firing = false; reloadEnd = 0; updateHud(); }
  function pickup() { let nearest = -1, distance = 1.6; models.forEach((gun, i) => { if (!gun.ground.visible) return; const d = Math.hypot(gun.ground.position.x - camera.position.x, gun.ground.position.z - camera.position.z); if (d < distance) { distance = d; nearest = i; } }); if (nearest >= 0) { selected = nearest; held = true; followReady = false; reloadEnd = 0; aiming = firing = false; models[selected].ground.visible = false; updateHud(); } }
  models.forEach(g => g.ground.visible = false);
  const locked = () => document.pointerLockElement === renderer.domElement && !isDriving();
  window.addEventListener('keydown', e => { if (!locked() || e.repeat) return; if (e.code === 'KeyT') reload(); if (e.code === 'KeyG') drop(); if (e.code === 'KeyE' || e.code === 'KeyF') pickup(); });
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mousedown', e => { if (!locked()) return; if (e.button === 2) aiming = true; if (e.button === 0) { firing = true; shoot(performance.now()); } });
  window.addEventListener('mouseup', e => { if (e.button === 2) aiming = false; if (e.button === 0) firing = false; });
  window.addEventListener('blur', () => { aiming = firing = false; });
  document.addEventListener('pointerlockchange', () => { if (!locked()) aiming = firing = false; });
  window.addEventListener('wheel', e => { if (!locked() || !e.deltaY || !held) return; e.preventDefault(); let next = selected; do { next = (next + (e.deltaY > 0 ? 1 : models.length - 1)) % models.length; } while (next !== selected && models[next].ground.visible); if (next === selected) return; selected = next; followReady = false; reloadEnd = 0; firing = false; showWheel(selected); updateHud(); }, { passive: false });
  updateHud();
  const values = {'held-size':.5,'ads-size':.425,'held-x':.3,'held-y':-.13,'held-z':-.8,'ads-x':0,'ads-y':-.16,'ads-z':-1.2};
  let recoilSide = 0;
  let followReady = false;
  let raiseAmount = 0;
  const followRate = 20;
  const holdPoint = new THREE.Vector3();
  const easedPosition = new THREE.Vector3();
  const movementOffset = new THREE.Vector3();
  const aimPoint = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  const muzzleOffset = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const aimMatrix = new THREE.Matrix4();
  const barrelRotation = new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2);
  const aimRotation = new THREE.Quaternion();
  const easedRotation = new THREE.Quaternion();
  const previousLook = new THREE.Quaternion();
  const inverseLook = new THREE.Quaternion();
  const lookDelta = new THREE.Quaternion();

  function updateGunFollow(dt, recoil, now, velocity) {
    const mode = aiming ? 'ads' : 'held';
    const gun = aiming ? models[selected].ads : models[selected].hip;
    const raising = aiming || now - lastShot < 200;
    raiseAmount = THREE.MathUtils.damp(raiseAmount, Number(raising), raising ? 24 : 3, dt);
    const lowered = 1 - raiseAmount;
    holdPoint.set(
      values[mode + '-x'] + .08 * lowered,
      aiming && selected === 1 ? -.275 : values[mode + '-y'] - .22 * lowered,
      values[mode + '-z'] + .12 * lowered
    );

    // All held poses are camera-local. Only a change in look direction rebases the last pose.
    inverseLook.copy(camera.quaternion).invert();
    lookDelta.multiplyQuaternions(inverseLook, previousLook);
    previousLook.copy(camera.quaternion);
    if (!followReady) {
      easedPosition.copy(holdPoint);
      easedRotation.identity();
    } else {
      easedPosition.applyQuaternion(lookDelta);
      easedRotation.premultiply(lookDelta);
    }
    movementOffset.copy(velocity).applyQuaternion(inverseLook).multiplyScalar(-1 / followRate);
    movementOffset.add(holdPoint);
    easedPosition.lerp(movementOffset, -Math.expm1(-followRate * dt));
    gun.position.copy(easedPosition);
    gun.scale.setScalar(values[mode + '-size']);

    if (raising) aimPoint.set(0, 0, -100);
    else aimPoint.set(-.2, -.65, -1).normalize().multiplyScalar(100);
    muzzleOffset.set(selected !== 0 ? .42 : .29, selected !== 0 ? .08 : .14, 0).multiplyScalar(gun.scale.x);
    muzzle.copy(muzzleOffset).applyQuaternion(easedRotation).add(gun.position);
    for (let i = 0; i < 4; i++) {
      aimMatrix.lookAt(muzzle, aimPoint, up);
      aimRotation.setFromRotationMatrix(aimMatrix).multiply(barrelRotation);
      muzzle.copy(muzzleOffset).applyQuaternion(aimRotation).add(gun.position);
    }
    if (followReady) easedRotation.slerp(aimRotation, -Math.expm1(-(raising ? 24 : 3) * dt));
    else easedRotation.copy(aimRotation);
    followReady = true;
    gun.quaternion.copy(easedRotation);
 // The ADS artwork is drawn from behind, so its face points toward the camera.
 if(aiming)gun.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2));
 // The rear-view rifle artwork is centered on the sight, facing the camera.
 if(aiming&&selected !== 0)gun.quaternion.identity();
 // The barrel runs along local X; rotate around local Z to kick its muzzle upward.
 if (aiming) {
  gun.position.y -= recoil * .16;
  gun.position.z += recoil * .3;
  gun.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(recoil * 1.05, recoil * recoilSide * 2, 0)));
 }
 else gun.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, recoil*recoilSide, recoil*.32)));

}

  return {
    render() {
      if (!held || isDriving()) return;
      viewCamera.projectionMatrix.copy(camera.projectionMatrix);
      viewCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(viewScene, viewCamera);
      renderer.autoClear = autoClear;
    },
    update(dt, now, velocity) {
      hud.style.display = isDriving() ? 'none' : '';
      if (reloadEnd && now >= reloadEnd) { models[selected].ammo = models[selected].cap; reloadEnd = 0; updateHud(); }
      if (isDriving()) firing = aiming = false;
      if (firing && selected === 1 && locked()) shoot(now);
      recoilDisplay += (recoilImpulse - recoilDisplay) * (1 - Math.exp(-45 * dt)); recoilImpulse *= Math.exp(-9 * dt);
      const aimingInput = aiming;
      if (reloadEnd) aiming = false;
      for (const [i, gun] of models.entries()) {
        gun.hip.visible = held && selected === i && !aiming;
        gun.ads.visible = held && selected === i && aiming;
      }
      if (held) {
        updateGunFollow(dt, recoilDisplay, now, velocity);
        if (reloadEnd) {
          const gun = aiming ? models[selected].ads : models[selected].hip;
          const elapsed = models[selected].reload - (reloadEnd - now);
          const progress = THREE.MathUtils.clamp(elapsed / models[selected].reload, 0, 1);
          const eased = progress * progress * (3 - 2 * progress);
          const rotations = Math.round(models[selected].reload / 1000 * 4);
          const angle = eased * Math.PI * 2 * rotations;
          // The grip is the hold point in each sprite's local coordinates.
          const grip = selected === 1
            ? new THREE.Vector3(-0.12, -0.08, 0)
            : new THREE.Vector3(-0.12, -0.12, 0);
          const scaledGrip = grip.multiply(gun.scale);
          const holdPoint = scaledGrip.clone().applyQuaternion(gun.quaternion).add(gun.position);
          gun.rotateZ(-angle);
          gun.position.copy(holdPoint).sub(scaledGrip.applyQuaternion(gun.quaternion));
        }
      } else {
        followReady = false;
        raiseAmount = 0;
      }
      aiming = aimingInput;
      const targetFov = aiming && !reloadEnd ? 45 : 70; camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-12 * dt)); camera.updateProjectionMatrix();


    },

  };
}
