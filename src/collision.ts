/** XZ collision footprints. Boxes are axis aligned; circles are useful for props. */
export type Collider =
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; radius: number };
export type Point = { x: number; z: number };
export const PLAYER_RADIUS = 0.12;

export function overlaps(p: Point, c: Collider, radius = PLAYER_RADIUS): boolean {
  if (c.kind === 'circle') return Math.hypot(p.x - c.x, p.z - c.z) < radius + c.radius;
  const x = Math.max(c.minX, Math.min(p.x, c.maxX));
  const z = Math.max(c.minZ, Math.min(p.z, c.maxZ));
  return Math.hypot(p.x - x, p.z - z) < radius;
}
export function isClear(p: Point, colliders: Collider[], radius = PLAYER_RADIUS): boolean {
  return !colliders.some(c => overlaps(p, c, radius));
}
/** Small swept increments prevent passing through obstacles, with axis sliding. */
export function moveWithCollisions(p: Point, dx: number, dz: number, colliders: Collider[]): Point {
  const active = colliders;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  const result = { ...p };
  for (let i = 0; i < steps; i++) {
    const x = result.x + dx / steps;
    if (!active.some(c => overlaps({ x, z: result.z }, c))) result.x = x;
    const z = result.z + dz / steps;
    if (!active.some(c => overlaps({ x: result.x, z }, c))) result.z = z;
  }
  return result;
}
