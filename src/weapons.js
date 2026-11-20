import * as THREE from 'three';

// White solid parts with black geometry edges match the rest of the scene.
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
const black = new THREE.LineBasicMaterial({ color: 0x000000 });
function part(parent, size, position, rotation = [0, 0, 0]) {
  const geometry = new THREE.BoxGeometry(...size);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, white));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), black));
  group.position.set(...position);
  group.rotation.set(...rotation);
  parent.add(group);
  return group;
}
function pistol() {
  const gun = new THREE.Group();
  // Negative Z points toward the target.
  part(gun, [.17, .16, .58], [0, .12, -.1]); // slide
  part(gun, [.14, .10, .46], [0, .01, -.06]); // frame
  part(gun, [.13, .34, .17], [0, -.19, .09], [-.18, 0, 0]); // grip
  part(gun, [.14, .025, .19], [0, -.37, .12], [-.18, 0, 0]);
  part(gun, [.105, .025, .10], [0, .215, .12]); // rear sight
  part(gun, [.045, .04, .045], [0, .22, -.35]);
  part(gun, [.16, .025, .19], [0, -.14, -.12]); // trigger guard
  part(gun, [.025, .16, .025], [0, -.07, -.21], [-.25, 0, 0]);
  part(gun, [.025, .10, .025], [0, -.07, -.07], [.3, 0, 0]);
  for (let i = 0; i < 5; i++) part(gun, [.174, .10, .012], [0, .12, .01 + i * .035]);
  part(gun, [.175, .085, .14], [0, .13, -.36]); // muzzle cap
  return gun;
}
function rifle() {
  const gun = new THREE.Group();
  part(gun, [.19, .20, .72], [0, .08, -.18]); // receiver
  part(gun, [.16, .16, .58], [0, .07, -.77]); // handguard
  part(gun, [.065, .065, .48], [0, .08, -1.29]); // barrel
  part(gun, [.09, .09, .10], [0, .08, -1.56]);
  part(gun, [.13, .16, .40], [0, .04, .36]); // stock
  part(gun, [.16, .23, .05], [0, .04, .57]);
  part(gun, [.13, .31, .16], [0, -.18, .10], [-.2, 0, 0]); // grip
  part(gun, [.15, .38, .22], [0, -.22, -.27], [-.16, 0, 0]); // magazine
  part(gun, [.16, .025, .23], [0, -.41, -.23], [-.16, 0, 0]);
  part(gun, [.07, .045, .16], [0, .21, .06]); // sights
  part(gun, [.065, .13, .055], [0, .19, -1.12]);
  for (let i = 0; i < 5; i++) part(gun, [.164, .10, .016], [0, .07, -.57 - i * .09]);
  part(gun, [.02, .09, .11], [.105, .08, -.13]);
  return gun;
}

export function createWeapons() {
  const group = new THREE.Group();
  const guns = [pistol(), rifle()];
  guns[0].position.set(.26, -.24, -.65);
  guns[0].rotation.set(-.03, -.08, 0);
  guns[1].position.set(.28, -.25, -.57);
  guns[1].rotation.set(-.03, -.08, 0);
  group.add(...guns);
  guns[1].visible = false;
  return { group, guns };
}
