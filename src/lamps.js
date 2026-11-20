import * as THREE from 'three';

// Two reference utility poles, positioned within the existing ground plane.
export function addLamps(scene, world, RAPIER) {
  const poleXs = [-3, 3], poleZ = -3;
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/utility-pole-wood.png`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const wood = new THREE.MeshBasicMaterial({ map: texture });
  const insulator = new THREE.MeshBasicMaterial({ color: 0xe4e4e4 });
  function poleParts(w, h, d, material, positions) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv;
    for (let face = 0; face < 6; face++) {
      const [u, v] = face < 2 ? [d, h] : face < 4 ? [w, d] : [w, h];
      for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, .12 + uv.getX(i) * u * .7, .12 + uv.getY(i) * v * .7);
    }
    const faces = geometry.groups.filter(face => face.materialIndex !== 3);
    geometry.clearGroups();
    for (const face of faces) geometry.addGroup(face.start, face.count, 0);
    const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
    const transform = new THREE.Object3D();
    positions.forEach((position, i) => { transform.position.copy(position); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix); });
    mesh.computeBoundingSphere(); mesh.name = 'utility-pole-parts'; scene.add(mesh);
  }
  poleParts(.2, 5.4, .2, wood, poleXs.map(x => new THREE.Vector3(x, 2.7, poleZ)));
  poleParts(.12, .12, 1.4, wood, poleXs.map(x => new THREE.Vector3(x, 5.15, poleZ)));
  poleParts(.11, .16, .11, insulator, poleXs.flatMap(x => [-.55, 0, .55].map(z => new THREE.Vector3(x, 5.29, poleZ + z))));
  for (const x of poleXs) world.createCollider(RAPIER.ColliderDesc.cuboid(.1, 2.7, .1).setTranslation(x, 2.7, poleZ));
  const wires = [];
  for (const zOffset of [-.55, 0, .55]) {
    for (let i = 0; i < 36; i++) {
      const t = i / 36, u = (i + 1) / 36;
      wires.push(-3 + 6*t, 5.37 - .65*4*t*(1-t), poleZ + zOffset, -3 + 6*u, 5.37 - .65*4*u*(1-u), poleZ + zOffset);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x262626 }));
  lines.name = 'utility-wires'; scene.add(lines);
}
