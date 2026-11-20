import * as THREE from 'three';

export function createSky(scene: THREE.Scene) {
const sunDirection=new THREE.Vector3(-.4,.85,-.5).normalize();
const sun=new THREE.Mesh(new THREE.CircleGeometry(50,64),new THREE.MeshBasicMaterial({color:0xffffff,depthWrite:false,side:THREE.DoubleSide}));sun.name='sun';const sunOutline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:64},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/32)*50,Math.sin(i*Math.PI/32)*50,.01))),new THREE.LineBasicMaterial({color:0x222222,depthWrite:false}));sun.add(sunOutline);sun.position.copy(sunDirection).multiplyScalar(600);sun.lookAt(0,0,0);scene.add(sun);
// Each cloud is a union of adjacent blocks, with outlines only on its perimeter.
const clouds=new THREE.Group();clouds.name='sky-clouds';clouds.scale.setScalar(5);scene.add(clouds);
const cloudBlocks: {x:number; y:number; z:number; size:number; height:number}[] = [];
const cloudOutline: number[] = [];
let seed = 81237;
const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
const directions = [[-1,0], [1,0], [0,-1], [0,1]];
for (let c = 0; c < 16; c++) {
 const angle = (c + random() * .6) * Math.PI * 2 / 16;
 const radius = 48 + random() * 40;
 const cx = Math.cos(angle) * radius, cz = Math.sin(angle) * radius, cy = 34 + random() * 12;
 const size = 1.8 + random() * 1.7, height = .55 + random() * .8;
 const cells: [number, number][] = [[0, 0]];
 const occupied = new Set(['0,0']);
 const cellCount = 6 + Math.floor(random() * 16);
 while (cells.length < cellCount) {
  const [x, z] = cells[Math.floor(random() * cells.length)];
  const [dx, dz] = directions[Math.floor(random() * directions.length)];
  const next: [number, number] = [x + dx, z + dz];
  const key = `${next[0]},${next[1]}`;
  if (!occupied.has(key)) { occupied.add(key); cells.push(next); }
 }
 for (const [dx, dz] of cells) {
  const x = cx + dx * size, z = cz + dz * size;
  cloudBlocks.push({x, y:cy, z, size, height});
  for (const [nx,nz,ax,az,bx,bz] of [[-1,0,-1,-1,-1,1],[1,0,1,-1,1,1],[0,-1,-1,-1,1,-1],[0,1,-1,1,1,1]]) {
   if (occupied.has(`${dx+nx},${dz+nz}`)) continue;
   const x1=x+ax*size/2,z1=z+az*size/2,x2=x+bx*size/2,z2=z+bz*size/2;
   for (const y of [cy-height/2,cy+height/2]) cloudOutline.push(x1,y,z1,x2,y,z2);
  }
 }
 const vertices = new Set<string>();
 for (const [dx,dz] of cells) for (const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
  const adjacent = [[dx,dz],[dx+sx,dz],[dx,dz+sz],[dx+sx,dz+sz]].filter(([x,z]) => occupied.has(`${x},${z}`)).length;
  if (adjacent !== 1 && adjacent !== 3) continue;
  const vx=dx*2+sx,vz=dz*2+sz,key=`${vx},${vz}`;
  if (vertices.has(key)) continue;
  vertices.add(key);
  cloudOutline.push(cx+vx*size/2,cy-height/2,cz+vz*size/2,cx+vx*size/2,cy+height/2,cz+vz*size/2);
 }
}
const cloudGeometry=new THREE.BoxGeometry(1,1,1),cloudMaterial=new THREE.MeshBasicMaterial({color:0xf4f4f4}),cloudMesh=new THREE.InstancedMesh(cloudGeometry,cloudMaterial,cloudBlocks.length),cloudTransform=new THREE.Object3D();
cloudBlocks.forEach((p,i)=>{cloudTransform.position.set(p.x,p.y,p.z);cloudTransform.scale.set(p.size,p.height,p.size);cloudTransform.updateMatrix();cloudMesh.setMatrixAt(i,cloudTransform.matrix);});cloudMesh.frustumCulled=false;clouds.add(cloudMesh);
const cloudEdges=new THREE.BufferGeometry();cloudEdges.setAttribute('position',new THREE.Float32BufferAttribute(cloudOutline,3));clouds.add(new THREE.LineSegments(cloudEdges,new THREE.LineBasicMaterial({color:0x777777})));
  return (camera: THREE.Camera) => {
    sun.position.copy(camera.position).addScaledVector(sunDirection, 600);
    clouds.position.set(camera.position.x, 200, camera.position.z);
  };
}
