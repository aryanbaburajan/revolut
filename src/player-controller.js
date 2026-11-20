import { walk, radius, stance } from './locomotion.ts';

export function createPlayerController(R, world, camera, groundHeight = 0, boundary = 499, spawn = { x: 0, z: 5 }) {
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, groundHeight + .7, spawn.z));
  const collider = world.createCollider(R.ColliderDesc.capsule(stance(false) - radius, radius), body);
  const controller = world.createCharacterController(.02);
  controller.enableSnapToGround(.1);
  const player = { body, collider, crouch: false, grounded: false, vx: 0, vy: 0, vz: 0, input: {} };
  let eyeHeight = 1.15;
  return {
    collider,
    setDriving(driving, exitPosition) {
      collider.setEnabled(!driving);
      if (!driving && exitPosition) {
        const position = { x: exitPosition.x, y: Math.max(stance(player.crouch) + .02, exitPosition.y - eyeHeight + stance(player.crouch)), z: exitPosition.z };
        body.setTranslation(position, true);
        body.setNextKinematicTranslation(position);
        world.propagateModifiedBodyPositionsToColliders();
        player.vx = player.vy = player.vz = 0;
        player.grounded = false;
      }
    },
    step(dt, keys, yaw, jump) {
      player.input = {
        yaw,
        glide: keys.has('Space'),
        down: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        forward: Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
        side: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
      };
      walk(world, controller, player, jump, boundary);
      eyeHeight += ((player.crouch ? .72 : 1.15) - eyeHeight) * (1 - Math.exp(-12 * dt));
    },
    teleportToSky() {
      const position = body.translation();
      const sky = { x: position.x, y: Math.max(360, position.y + 120), z: position.z };
      body.setTranslation(sky, true);
      body.setNextKinematicTranslation(sky);
      world.propagateModifiedBodyPositionsToColliders();
      player.vx = player.vy = player.vz = 0;
      player.grounded = false;
    },
    isGrounded() {
      return player.grounded;
    },
    isCrouching() {
      return player.crouch;
    },
    getFeetPosition(out) {
      const pos = body.translation();
      return out.set(pos.x, pos.y - stance(player.crouch), pos.z);
    },
    getMovementVelocity(out) {
      return out.set(player.vx, player.grounded ? 0 : player.vy, player.vz);
    },
    updateCamera() {
      const pos = body.translation();
      camera.position.set(pos.x, pos.y - stance(player.crouch) + eyeHeight, pos.z);
    },
  };
}
