import {streetLayout} from './street-layout.js';
import {facadeMaterial} from './facades.js';
import * as THREE from 'three';
import { sliceBuilding } from './building-slice.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const roadWidths = { motorway: 12, trunk: 10, primary: 8, secondary: 7, tertiary: 6, residential: 4, service: 3, track: 2, path: 1.2, footway: 1.2 };

export async function createCity(scene, world, RAPIER, cityId) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${cityId}.json`);
  if (!response.ok) throw new Error(`Could not load the map for ${cityId}`);
  const { value: data } = await response.json();
  const layout = streetLayout(data);
  const buildingMaterial = facadeMaterial();
  const ink = new THREE.LineBasicMaterial({ color: 0x111111 });
  // Continuous world-space UVs keep intersections aligned as roads overlap.
  const vertices = [], uvs = [], indices = [];
  for (const road of data.roads) {
    const halfWidth = (roadWidths[road.highway] || 3) / 2;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const dx = b.x - a.x, dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (!length) continue;
      const x = -dz / length * halfWidth, z = dx / length * halfWidth;
      const offset = vertices.length / 3;
      for (const point of [[a.x+x,a.z+z], [a.x-x,a.z-z], [b.x+x,b.z+z], [b.x-x,b.z-z]]) {
        vertices.push(point[0], .015, point[1]);
        uvs.push(point[0] / 8, point[1] / 8);
      }
      indices.push(offset,offset+2,offset+1, offset+1,offset+2,offset+3);
    }
  }
  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeometry.setIndex(indices);
  const roadMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const roads = new THREE.Mesh(roadGeometry, roadMaterial);
  roads.raycast = () => {};
  scene.add(roads);

  const blocks = new Map();
  const buildings = [];
  const buildingColliderHandles = new Set();
  const records = new Map(), floating = [], fragments = new Set();
  for (const [index, building] of data.buildings.entries()) {
    if (building.points.length < 3) continue;
    const shape = new THREE.Shape();
    building.points.forEach((point, index) => index ? shape.lineTo(point.x, -point.z) : shape.moveTo(point.x, -point.z));
    shape.closePath();
    const height = Math.max(3, Math.min(Number(building.height) || 8, 300));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    const facade = layout.facades[index];
    const attribute = new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3);
    for(let i=0;i<attribute.count;i++) attribute.setXYZ(i,index,height/facade.floors,facade.shop?2:height>=25?1:0);
    geometry.setAttribute('facadeData',attribute);
    const key = Math.floor(facade.bounds[0] / 64) + ',' + Math.floor(facade.bounds[1] / 64);
    if (!blocks.has(key)) blocks.set(key, { walls: [], edges: [], records: [] });
    const block = blocks.get(key);
    block.walls.push(geometry);
    block.edges.push(new THREE.EdgesGeometry(geometry));
    const position = geometry.getAttribute('position');
    const vertices = new Float32Array(position.array);
    const indices = geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: position.count }, (_, i) => i);
    const collider = world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices));
    buildingColliderHandles.add(collider.handle);
    geometry.computeBoundingBox();
    const record = { geometry, collider, footprint: building.points, height, cut: false };
    block.records.push(record);
    records.set(index, { record, block });
  }
  for (const block of blocks.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(block.walls), buildingMaterial);
    const edges = new THREE.LineSegments(mergeGeometries(block.edges), ink);
    mesh.add(edges);
    buildings.push(mesh);
    scene.add(mesh);
    block.rebuild = () => {
      const active = block.records.filter(record => !record.cut);
      mesh.geometry.dispose();
      edges.geometry.dispose();
      if (!active.length) { mesh.visible = false; mesh.raycast = () => {}; return; }
      mesh.geometry = mergeGeometries(active.map(record => record.geometry));
      const outlines = active.map(record => new THREE.EdgesGeometry(record.geometry));
      edges.geometry = mergeGeometries(outlines);
      outlines.forEach(geometry => geometry.dispose());
    };
    block.edges.forEach(geometry => geometry.dispose());
  }
  function slice(hit, direction, camera) {
    const horizontal = new THREE.Vector3(direction.x, 0, direction.z);
    if (horizontal.lengthSq() < 1e-8) horizontal.set(0, 0, -1);
    horizontal.normalize();
    const side = new THREE.Vector3(-horizontal.z, 0, horizontal.x);
    const angle = (Math.random() - .5) * Math.PI / 2;
    const normal = new THREE.Vector3(0, 1, 0).addScaledVector(side, -Math.tan(angle)).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    const existingFragments = [...fragments];
    const changedBlocks = new Set();
    for (const { record, block } of records.values()) {
      if (record.cut || !frustum.intersectsBox(record.geometry.boundingBox) || !record.geometry.boundingBox.intersectsPlane(plane)) continue;
      if (sliceBuilding({ scene, world, R: RAPIER, record, buildings, handles: buildingColliderHandles, material: buildingMaterial, ink, plane, floating, fragments })) changedBlocks.add(block);
    }
    const bounds = new THREE.Box3();
    for (const record of existingFragments) {
      if (record.cut) continue;
      bounds.copy(record.geometry.boundingBox).translate(new THREE.Vector3(0, record.y, 0));
      if (!frustum.intersectsBox(bounds) || !bounds.intersectsPlane(plane)) continue;
      sliceBuilding({ scene, world, R: RAPIER, record, buildings, handles: buildingColliderHandles, material: buildingMaterial, ink, plane, floating, fragments });
    }
    for (const block of changedBlocks) block.rebuild();
    return plane;
  }
  function updateSlices(dt) {
    for (const part of floating) {
      const decay = Math.exp(-3 * dt);
      part.y += .4 * dt + part.velocity * (1 - decay) / 3;
      part.velocity *= decay;
      part.mesh.position.y = part.y;
      part.body.setNextKinematicTranslation({ x: 0, y: part.y, z: 0 });
    }
  }
  return { ...data, layout, buildingMeshes: buildings, buildingColliderHandles, slice, updateSlices };
}
