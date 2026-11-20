import * as THREE from 'three';
import { createWeaponWheel } from './weapon-wheel.js';

export function createGunController({ scene, camera, renderer, ground, targets, buildings, onHit, onShotgunHit, onRocketFire, onKatanaHit, audio, isDriving = () => false }) {
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
    { name: 'Pistol', hip: sprite('pistol-ink.png', 1, .7), ground: sprite('pistol-ink.png', 1, .7, 4), ammo: 12, cap: 12, interval: 300, reload: 1200 },
    { name: 'Assault rifle', hip: sprite('ak47-ink.png', 1.4, .46), ground: sprite('ak47-ink.png', 1.3, .43, 4), ammo: 30, cap: 30, interval: 100, reload: 1800 },
    { name: 'Shotgun', hip: sprite('shotgun-sprite.png', 1.5, 1.5 * 180 / 1180), ground: sprite('shotgun-sprite.png', 1.4, 1.4 * 180 / 1180, 4), ammo: 8, cap: 8, interval: 750, reload: 2200 },
    { name: 'Rocket launcher', hip: sprite('rocket-launcher.png', 1.5, 1.5 * 253 / 1154), ground: sprite('rocket-launcher.png', 1.4, 1.4 * 253 / 1154, 4), ammo: 1, cap: 1, interval: 900, reload: 2500 },
    { name: 'Katana', hip: sprite('katana-sprite.png', 1.8, 1.8 * 118 / 1172), ground: sprite('katana-sprite.png', 1.8, 1.8 * 118 / 1172, 4), melee: true, interval: 650, reload: 1200 },
  ];
  models.forEach((g, i) => { viewScene.add(g.hip); g.ground.scale.setScalar(.5); g.ground.rotation.set(-Math.PI / 2, 0, 0, 'YXZ'); g.ground.position.set(i ? 1.8 : 1.4, .07, i ? 1.8 : 2.2); scene.add(g.ground); });
  // The current scene starts equipped; the second gun can be selected by scrolling.
  let selected = 0, held = true, firing = false, lastShot = -Infinity, reloadEnd = 0, recoilImpulse = 0, recoilDisplay = 0, raise = 0;
  let katanaSwingStarted = -Infinity, katanaStrikePending = false;
  const hud = document.createElement('div'); hud.className = 'ammo-display'; document.querySelector('#app').append(hud);
  const showWheel = createWeaponWheel(document.querySelector('#app'));
  const ray = new THREE.Raycaster();
  function updateHud() { const gun = models[selected]; hud.textContent = held ? (gun.melee ? `KATANA${reloadEnd ? ' · Reloading' : ''}` : `${gun.ammo} / ${gun.cap}${reloadEnd ? ' · Reloading' : ''}`) : 'Unarmed'; }
  function shoot(now) {
    const gun = models[selected]; if (!held || reloadEnd || now - lastShot < gun.interval) return;
    if (gun.melee) {
      lastShot = now;
      katanaSwingStarted = now;
      katanaStrikePending = true;
      audio.play('katana');
      return;
    }
    if (!gun.ammo) { reload(); return; }
    recoilSide = (Math.random() - .5) * .18;
    audio.play(selected === 3 ? 'cannon' : selected === 2 ? 'shotgun' : selected === 1 ? 'rifle' : 'pistol');
    gun.ammo--; lastShot = now; recoilImpulse = Math.min(1, recoilImpulse + (selected === 2 ? .8 : selected === 1 ? .32 : .48)); updateHud();
    camera.updateMatrixWorld(true);
    if (selected === 3) {
      onRocketFire(now);
      return;
    }
    ray.setFromCamera(new THREE.Vector2(), camera);
    if (selected === 2) {
      onShotgunHit(ray.ray.origin, ray.ray.direction, now);
      return;
    }
    const hits = ray.intersectObjects([ground, ...buildings, targets], true);
    const hit = hits.find(h => h.object instanceof THREE.Mesh && !h.object.userData.impact);
    if (hit) {
      const hitZombie = onHit(hit, ray.ray.direction, 25);
      if (hitZombie) audio.impact('meat', hit.point, now);
      else if (hit.object === ground || buildings.includes(hit.object)) audio.impact('concrete', hit.point, now);
    }
  }
  function reload() {
    const gun = models[selected];
    if (!held || reloadEnd || (!gun.melee && gun.ammo >= gun.cap)) return;
    if (gun.melee && nowInKatanaSwing()) return;
    reloadEnd = performance.now() + gun.reload;
    audio.play('reload');
    updateHud();
  }
  function drop() { if (!held) return; const gun = models[selected]; const direction = new THREE.Vector3(); camera.getWorldDirection(direction); gun.ground.position.copy(camera.position).addScaledVector(direction, .8); gun.ground.position.y = .07; gun.ground.visible = true; const next = models.findIndex(model => !model.ground.visible);
    held = next >= 0; if (held) selected = next; followReady = false; firing = false; reloadEnd = 0; updateHud(); }
  function pickup() { let nearest = -1, distance = 1.6; models.forEach((gun, i) => { if (!gun.ground.visible) return; const d = Math.hypot(gun.ground.position.x - camera.position.x, gun.ground.position.z - camera.position.z); if (d < distance) { distance = d; nearest = i; } }); if (nearest >= 0) { selected = nearest; held = true; followReady = false; reloadEnd = 0; firing = false; models[selected].ground.visible = false; updateHud(); } }
  models.forEach(g => g.ground.visible = false);
  const locked = () => document.pointerLockElement === renderer.domElement && !isDriving();
  const nowInKatanaSwing = () => performance.now() - katanaSwingStarted < 650;
  function selectWeapon(index) {
    if (models[index].ground.visible || (held && index === selected)) return;
    selected = index;
    katanaStrikePending = false;
    katanaSwingStarted = -Infinity;
    held = true;
    followReady = false;
    reloadEnd = 0;
    firing = false;
    showWheel(selected);
    updateHud();
  }

  const weaponKeys = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 };
  window.addEventListener('keydown', event => {
    if (!locked() || event.repeat) return;
    const weapon = weaponKeys[event.code];
    if (weapon !== undefined) selectWeapon(weapon);
    if (event.code === 'KeyR') reload();
    if (event.code === 'KeyG') drop();
    if (event.code === 'KeyE' || event.code === 'KeyF') pickup();
  });
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mousedown', e => { if (!locked()) return; if (e.button === 0) { firing = true; shoot(performance.now()); } });
  window.addEventListener('mouseup', e => { if (e.button === 0) firing = false; });
  window.addEventListener('blur', () => { firing = false; katanaStrikePending = false; });
  document.addEventListener('pointerlockchange', () => { if (!locked()) { firing = false; katanaStrikePending = false; } });
  window.addEventListener('wheel', e => { if (!locked() || !e.deltaY || !held) return; e.preventDefault(); let next = selected; do { next = (next + (e.deltaY > 0 ? 1 : models.length - 1)) % models.length; } while (next !== selected && models[next].ground.visible); selectWeapon(next); }, { passive: false });
  updateHud();
  const values = {'held-size':.5,'held-x':.3,'held-y':-.13,'held-z':-.8};
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
    const mode = 'held';
    const gun = models[selected].hip;
    const raising = now - lastShot < 200;
    raiseAmount = THREE.MathUtils.damp(raiseAmount, Number(raising), raising ? 24 : 3, dt);
    const lowered = 1 - raiseAmount;
    holdPoint.set(
      values[mode + '-x'] + .08 * lowered,
      values[mode + '-y'] - .22 * lowered,
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
    // The barrel runs along local X; rotate around local Z to kick its muzzle upward.
    gun.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, recoil * recoilSide, recoil * .32)));

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
      if (reloadEnd && now >= reloadEnd) { if (!models[selected].melee) models[selected].ammo = models[selected].cap; reloadEnd = 0; updateHud(); }
      if (isDriving()) firing = false;
      if (katanaStrikePending && (!held || !models[selected].melee || !locked())) katanaStrikePending = false;
      if (katanaStrikePending && now - katanaSwingStarted >= 270) {
        katanaStrikePending = false;
        camera.updateMatrixWorld(true);
        ray.setFromCamera(new THREE.Vector2(), camera);
        const hit = ray.intersectObjects([ground, ...buildings, targets], true)
          .find(item => item.object instanceof THREE.Mesh && !item.object.userData.impact);
        const point = hit ? hit.point : ray.ray.at(30, new THREE.Vector3());
        onKatanaHit({ point }, ray.ray.direction, now);
      }
      if (firing && selected === 1 && locked()) shoot(now);
      recoilDisplay += (recoilImpulse - recoilDisplay) * (1 - Math.exp(-45 * dt)); recoilImpulse *= Math.exp(-9 * dt);
      for (const [i, gun] of models.entries()) {
        gun.hip.visible = held && selected === i;
      }
      if (held) {
        updateGunFollow(dt, recoilDisplay, now, velocity);
        if (models[selected].melee && !reloadEnd) {
          const progress = (now - katanaSwingStarted) / 650;
          if (progress >= 0 && progress < 1) {
            const smooth = t => t * t * (3 - 2 * t);
            let sweep;
            if (progress < .2) sweep = .2 * smooth(progress / .2);
            else if (progress < .52) sweep = THREE.MathUtils.lerp(.2, -1, smooth((progress - .2) / .32));
            else sweep = -1 + smooth((progress - .52) / .48);
            const sword = models[selected].hip;
            sword.position.x += sweep * .65;
            sword.position.y += Math.abs(sweep) * .12;
            sword.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sweep * .35, -sweep * .9)));
          }
        }
        if (reloadEnd) {
          const gun = models[selected].hip;
          const elapsed = models[selected].reload - (reloadEnd - now);
          const progress = THREE.MathUtils.clamp(elapsed / models[selected].reload, 0, 1);
          const eased = progress * progress * (3 - 2 * progress);
          const rotations = Math.round(models[selected].reload / 1000 * 4);
          const angle = eased * Math.PI * 2 * rotations;
          // The grip is the hold point in each sprite's local coordinates.
          const grip = models[selected].melee
            ? new THREE.Vector3(-.67, 0, 0)
            : selected === 1
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
      camera.fov += (70 - camera.fov) * (1 - Math.exp(-12 * dt)); camera.updateProjectionMatrix();


    },

  };
}
