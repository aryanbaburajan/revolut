import * as THREE from 'three';
import { roadWidths } from './city.js';

// Place poles along the drivable street network, clear of roads and buildings.
export function createUtilityPoles(scene, world, RAPIER, data) {
  const streets = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified', 'living_street']);
  const cellSize = 24;
  const roadGrid = new Map(), buildingGrid = new Map(), poleGrid = new Map();
  const key = (x, z) => `${x},${z}`;
  function insert(grid, item, minX, minZ, maxX, maxZ) {
    for (let x = Math.floor(minX / cellSize); x <= Math.floor(maxX / cellSize); x++) {
      for (let z = Math.floor(minZ / cellSize); z <= Math.floor(maxZ / cellSize); z++) {
        const k = key(x, z);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(item);
      }
    }
  }
  for (const road of data.roads) {
    const width = (roadWidths[road.highway] || 3) / 2;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      insert(roadGrid, { a, b, width }, Math.min(a.x, b.x) - width - 1, Math.min(a.z, b.z) - width - 1, Math.max(a.x, b.x) + width + 1, Math.max(a.z, b.z) + width + 1);
    }
  }
  for (const building of data.buildings) {
    if (building.points.length < 3) continue;
    const xs = building.points.map(p => p.x), zs = building.points.map(p => p.z);
    insert(buildingGrid, building.points, Math.min(...xs) - .5, Math.min(...zs) - .5, Math.max(...xs) + .5, Math.max(...zs) + .5);
  }
  function clear(x, z) {
    const k = key(Math.floor(x / cellSize), Math.floor(z / cellSize));
    for (const { a, b, width } of roadGrid.get(k) || []) {
      const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
      const t = length ? THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / length, 0, 1) : 0;
      if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < width + .3) return false;
    }
    for (const polygon of buildingGrid.get(k) || []) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
        const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
        const t = length ? THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / length, 0, 1) : 0;
        if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < .4) return false;
      }
      if (inside) return false;
    }
    for (const pole of poleGrid.get(k) || []) if (Math.hypot(x - pole.x, z - pole.z) < 12) return false;
    return true;
  }
  const poles = [];
  for (const road of data.roads) {
    if (!streets.has(road.highway)) continue;
    let remaining = 6;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      if (!length) continue;
      const nx = -dz / length, nz = dx / length, offset = (roadWidths[road.highway] || 3) / 2 + .8;
      while (remaining <= length) {
        for (const side of [1, -1]) {
          const x = a.x + dx * remaining / length + nx * offset * side;
          const z = a.z + dz * remaining / length + nz * offset * side;
          if (!clear(x, z)) continue;
          const pole = { x, z, angle: Math.atan2(dx, dz) - Math.PI / 2 };
          poles.push(pole);
          insert(poleGrid, pole, x - 12, z - 12, x + 12, z + 12);
          break;
        }
        remaining += 24;
      }
      remaining -= length;
    }
  }
  if (!poles.length) return;
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/utility-pole-wood.png`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const wood = new THREE.MeshBasicMaterial({ map: texture });
  const ceramic = new THREE.MeshBasicMaterial({ color: 0xe4e4e4 });
  const transform = new THREE.Object3D();
  function parts(width, height, depth, material, offsets) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    if (material === wood) {
      const uv = geometry.attributes.uv;
      for (let face = 0; face < 6; face++) {
        const [u, v] = face < 2 ? [depth, height] : face < 4 ? [width, depth] : [width, height];
        for (let i = face * 4; i < face * 4 + 4; i++) {
          uv.setXY(i, .12 + uv.getX(i) * u * .7, .12 + uv.getY(i) * v * .7);
        }
      }
    }
    const mesh = new THREE.InstancedMesh(geometry, material, poles.length * offsets.length);
    let index = 0;
    for (const pole of poles) for (const offset of offsets) {
      transform.position.set(pole.x + Math.sin(pole.angle) * offset.z, offset.y, pole.z + Math.cos(pole.angle) * offset.z);
      transform.rotation.set(0, pole.angle, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index++, transform.matrix);
    }
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  parts(.2, 5.4, .2, wood, [{ y: 2.7, z: 0 }]);
  parts(.12, .12, 1.4, wood, [{ y: 5.15, z: 0 }]);
  parts(.11, .16, .11, ceramic, [-.55, 0, .55].map(z => ({ y: 5.29, z })));
  for (const pole of poles) world.createCollider(RAPIER.ColliderDesc.cuboid(.1, 2.7, .1).setTranslation(pole.x, 2.7, pole.z));

}
