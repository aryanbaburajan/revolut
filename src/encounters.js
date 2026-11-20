import { seededRandom } from './street-layout.js';

export function planEncounters(layout, _landmarks, canSpawn) {
  const random = seededRandom(1982);
  const segments = layout.segments.filter(segment => segment.length > 2 &&
    !['steps', 'elevator'].includes(segment.road.highway));
  const weights = [];
  let totalLength = 0;
  for (const segment of segments) {
    totalLength += segment.length;
    weights.push(totalLength);
  }
  const spawns = [];
  for (let attempts = 0; spawns.length < 38000 && attempts < 600000; attempts++) {
    const distance = random() * totalLength;
    let low = 0, high = weights.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (weights[mid] < distance) low = mid + 1;
      else high = mid;
    }
    const segment = segments[low];
    const t = random(), dx = (segment.b.x-segment.a.x)/segment.length, dz = (segment.b.z-segment.a.z)/segment.length;
    const offset = (random()-.5)*segment.width*.8;
    const x = segment.a.x+(segment.b.x-segment.a.x)*t-dz*offset;
    const z = segment.a.z+(segment.b.z-segment.a.z)*t+dx*offset;
    if (Math.abs(x)>495 || Math.abs(z)>495 || !canSpawn({x,z})) continue;
    const group = {x,z,awake:false};
    const densityRank = ((Math.imul(spawns.length + 1, 2654435761) >>> 0) / 4294967296);
    spawns.push({x,z,group,densityRank,patrol:[segment.a,segment.b],leg:random()<.5?0:1,health:50});
  }
  return spawns;
}
