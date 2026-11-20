import * as THREE from 'three';

// Reference ink impact sprite, attached to the struck surface in local coordinates.
export function createImpacts(scene) {
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/impact.png`);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(.25, .17);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .15, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const capacity = 100;
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.count = 0;
  mesh.userData.impact = true;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const marks = [];
  let nextSlot = 0;
  const world = new THREE.Matrix4(), instance = new THREE.Matrix4();
  const transform = new THREE.Object3D();
  function targetMatrix(object, instanceId) {
    world.copy(object.matrixWorld);
    if (object.isInstancedMesh && instanceId !== undefined) {
      object.getMatrixAt(instanceId, instance);
      world.multiply(instance);
    }
    return world;
  }
  return {
    add(hit, direction) {
      if (!hit.face) return;
      const object = hit.object;
      const matrix = targetMatrix(object, hit.instanceId);
      const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix)).normalize();
      if (normal.dot(direction) > 0) normal.negate();
      transform.position.copy(hit.point).addScaledVector(normal, .005);
      transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      transform.rotateZ(Math.random() * Math.PI * 2);
      transform.updateMatrix();
      const local = matrix.clone().invert().multiply(transform.matrix);
      const slot = nextSlot;
      nextSlot = (nextSlot + 1) % capacity;
      marks[slot] = { object, instanceId: hit.instanceId, local };
      mesh.setMatrixAt(slot, transform.matrix);
      mesh.count = marks.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
    update() {
      marks.forEach((mark, slot) => mesh.setMatrixAt(slot, targetMatrix(mark.object, mark.instanceId).multiply(mark.local)));
      if (marks.length) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
