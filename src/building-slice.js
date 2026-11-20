import * as THREE from 'three';

const cutMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });

// Clip the original triangles and interpolate all attributes at the cut.
function clipGeometry(geometry, plane, keepAbove, footprint, height, constraints) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const attributes = source.attributes;
  const names = Object.keys(attributes);
  const outputs = [0, 1].map(() => Object.fromEntries(names.map(name => [name, []])));
  let output = outputs[0];
  const vertex = index => Object.fromEntries(names.map(name => {
    const a = attributes[name];
    return [name, Array.from({ length: a.itemSize }, (_, i) => a.array[index * a.itemSize + i])];
  }));
  const distance = v => plane.distanceToPoint(new THREE.Vector3(...v.position)) * (keepAbove ? 1 : -1);
  const interpolate = (a, b, t) => Object.fromEntries(names.map(name => [name, a[name].map((value, i) => THREE.MathUtils.lerp(value, b[name][i], t))]));
  const append = v => names.forEach(name => output[name].push(...v[name]));
  for (let i = 0; i < attributes.position.count; i += 3) {
    const group = geometry.userData.sliced && geometry.groups.find(group => i >= group.start && i < group.start + group.count);
    output = outputs[group?.materialIndex === 1 ? 1 : 0];
    const triangle = [vertex(i), vertex(i + 1), vertex(i + 2)];
    const clipped = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], da = distance(a), db = distance(b);
      if (da >= 0) clipped.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) clipped.push(interpolate(a, b, da / (da - db)));
    }
    for (let j = 1; j + 1 < clipped.length; j++) { append(clipped[0]); append(clipped[j]); append(clipped[j + 1]); }
  }
  // Intersect the cut with the vertical building footprint, including cuts that meet the roof or ground.
  const heightAt = point => -(plane.normal.x * point.x + plane.normal.z * point.y + plane.constant) / plane.normal.y;
  const footprintContour = footprint.map(p => new THREE.Vector2(p.x, p.z));
  const footprintTriangles = THREE.ShapeUtils.triangulateShape(footprintContour, []);
  const normal = plane.normal.clone().multiplyScalar(keepAbove ? -1 : 1);
  const facade = Array.from(attributes.facadeData.array.slice(0, 3));
  output = outputs[1];
  for (const triangle of footprintTriangles) {
    let contour = triangle.map(index => footprintContour[index].clone());
    const distances = [
      point => heightAt(point),
      point => height - heightAt(point),
      ...constraints.map(constraint => point => constraint.distanceToPoint(new THREE.Vector3(point.x, heightAt(point), point.y))),
    ];
    for (const distanceToBoundary of distances) {
      const clipped = [];
      for (let i = 0; i < contour.length; i++) {
        const a = contour[i], b = contour[(i + 1) % contour.length];
        const da = distanceToBoundary(a), db = distanceToBoundary(b);
        if (da >= -1e-7) clipped.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) clipped.push(a.clone().lerp(b, da / (da - db)));
      }
      contour = clipped;
    }
    for (let i = 1; i + 1 < contour.length; i++) {
      const points = [contour[0], contour[i], contour[i + 1]].map(v => new THREE.Vector3(v.x, heightAt(v), v.y));
      if (new THREE.Vector3().subVectors(points[1], points[0]).cross(new THREE.Vector3().subVectors(points[2], points[0])).dot(normal) < 0) points.reverse();
      for (const point of points) append({ position: point.toArray(), normal: normal.toArray(), uv: [point.x, point.z], facadeData: facade });
    }
  }
  const result = new THREE.BufferGeometry();
  for (const name of names) result.setAttribute(name, new THREE.Float32BufferAttribute([...outputs[0][name], ...outputs[1][name]], attributes[name].itemSize));
  const wallVertexCount = outputs[0].position.length / 3;
  result.addGroup(0, wallVertexCount, 0);
  result.addGroup(wallVertexCount, outputs[1].position.length / 3, 1);
  result.userData.sliced = true;
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

export function sliceBuilding({ scene, world, R, record, buildings, handles, material, ink, plane, floating, fragments }) {
  if (record.cut) return false;
  const offset = record.y || 0;
  const localPlane = plane.clone();
  localPlane.constant += localPlane.normal.y * offset;
  const constraints = record.constraints || [];
  const lower = clipGeometry(record.geometry, localPlane, false, record.footprint, record.height, constraints);
  const upper = clipGeometry(record.geometry, localPlane, true, record.footprint, record.height, constraints);
  if (!lower.attributes.position.count || !upper.attributes.position.count) { lower.dispose(); upper.dispose(); return false; }
  record.cut = true;
  handles.delete(record.collider.handle);
  if (record.body) world.removeRigidBody(record.body);
  else world.removeCollider(record.collider, true);
  if (record.mesh) {
    scene.remove(record.mesh);
    const index = buildings.indexOf(record.mesh);
    if (index !== -1) buildings.splice(index, 1);
    record.mesh.children[0].geometry.dispose();
    record.geometry.dispose();
    fragments.delete(record);
    const floatingIndex = floating.indexOf(record);
    if (floatingIndex !== -1) floating.splice(floatingIndex, 1);
  }
  const colliderFor = (geometry, body) => {
    const vertices = new Float32Array(geometry.attributes.position.array);
    const indices = Uint32Array.from({ length: vertices.length / 3 }, (_, i) => i);
    const collider = world.createCollider(R.ColliderDesc.trimesh(vertices, indices), body);
    handles.add(collider.handle);
    return collider;
  };
  const makeMesh = geometry => {
    const mesh = new THREE.Mesh(geometry, [material, cutMaterial]);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), ink));
    scene.add(mesh); buildings.push(mesh);
    return mesh;
  };
  function addSection(geometry, above) {
    const mesh = makeMesh(geometry);
    mesh.position.y = offset;
    const moving = above || Boolean(record.body);
    const body = moving ? world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, offset, 0)) : undefined;
    const collider = colliderFor(geometry, body);
    const boundary = localPlane.clone();
    if (!above) boundary.negate();
    const section = { geometry, mesh, body, collider, y: offset, velocity: (record.velocity || 0) + (above ? 24 : 0), footprint: record.footprint, height: record.height, constraints: [...constraints, boundary], cut: false };
    fragments.add(section);
    if (moving) floating.push(section);
  }
  addSection(lower, false);
  addSection(upper, true);
  return true;
}
