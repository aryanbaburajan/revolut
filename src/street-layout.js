import { roadWidths } from './city.js';

export function seededRandom(seed) {
  return () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
}
export function inside(p, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x) result = !result;
  }
  return result;
}
function grid() {
  const cells = new Map();
  const key = (x,z) => x + ',' + z;
  return {
    insert(item,x,z,X,Z) {
      for(let i=Math.floor(x/32);i<=Math.floor(X/32);i++) for(let j=Math.floor(z/32);j<=Math.floor(Z/32);j++){
        const k=key(i,j); if(!cells.has(k)) cells.set(k,[]); cells.get(k).push(item);
      }
    },
    near(p,r) {
      const items=new Set();
      for(let i=Math.floor((p.x-r)/32);i<=Math.floor((p.x+r)/32);i++) for(let j=Math.floor((p.z-r)/32);j<=Math.floor((p.z+r)/32);j++)
        for(const item of cells.get(key(i,j))||[]) items.add(item);
      return items;
    }
  };
}
export function projection(p,a,b) {
  const dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
  const x=a.x+dx*t,z=a.z+dz*t;
  return {x,z,d:Math.hypot(p.x-x,p.z-z)};
}
export function streetLayout(data) {
  const roads=grid(), buildings=grid(), segments=[], nodes=new Map(), junctions=grid();
  for(const road of data.roads) {
    let along=0;
    for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i],length=Math.hypot(b.x-a.x,b.z-a.z);
      if(!length) continue;
      const width=roadWidths[road.highway]||3, s={a,b,road,length,width,along}; along+=length;
      if(road.tags?.tunnel==='yes'||road.tags?.bridge==='yes') continue;
      segments.push(s);roads.insert(s,Math.min(a.x,b.x)-width,Math.min(a.z,b.z)-width,Math.max(a.x,b.x)+width,Math.max(a.z,b.z)+width);
      for(const p of [a,b]){
        const k=p.x.toFixed(2)+','+p.z.toFixed(2);
        if(!nodes.has(k)) nodes.set(k,{...p,edges:[]});nodes.get(k).edges.push(s);
      }
    }
  }
  const crosses=[...nodes.values()].filter(n=>n.edges.length>=3);
  for(const p of crosses) junctions.insert(p,p.x,p.z,p.x,p.z);
  function nearest(p) {
    let best;
    for(const s of roads.near(p,48)){
      const q=projection(p,s.a,s.b);
      if(!best||q.d<best.d) best={...q,segment:s};
    }
    return best;
  }
  const retail=data.pois.filter(p=>p.tags?.shop || p.category==='shop');
  const facades=data.buildings.map((b,index)=>{
    const ring=b.points, xs=ring.map(p=>p.x),zs=ring.map(p=>p.z);
    const bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
    buildings.insert(b,...bounds);
    const shop=!!b.tags?.shop||['retail','commercial','supermarket'].includes(b.tags?.building)||retail.some(p=>p.position.x>=bounds[0]&&p.position.x<=bounds[2]&&p.position.z>=bounds[1]&&p.position.z<=bounds[3]&&inside(p.position,ring));
    const area=ring.reduce((v,a,i)=>{const c=ring[(i+1)%ring.length];return v+a.x*c.z-c.x*a.z},0);
    let door,best=Infinity;
    ring.forEach((a,i)=>{
      const c=ring[(i+1)%ring.length],dx=c.x-a.x,dz=c.z-a.z,len=Math.hypot(dx,dz);
      if(len<.01)return;
      const nx=Math.sign(area)*dz/len,nz=-Math.sign(area)*dx/len;
      const p={x:(a.x+c.x)/2,z:(a.z+c.z)/2};
      const street=nearest(p);
      const score=(street?.d??500)+(len<1.1?1000:0)+(street&&(street.x-p.x)*nx+(street.z-p.z)*nz<0?8:0);
      if(score<best){best=score;door={...p,nx,nz,len,street};}
    });
    const height=Math.max(3,Math.min(Number(b.height)||8,300));
    return {ring,door,height,shop,index,bounds,floors:Math.max(1,Math.round(Number(b.tags?.['building:levels'])||height/3))};
  });
  function vacant(p,r){
    for(const b of buildings.near(p,r)){
      if(inside(p,b.points)||b.points.some((a,i)=>projection(p,a,b.points[(i+1)%b.points.length]).d<r))return false;
    }
    return true;
  }
  return {segments,roads,facades,crosses,junctions,nearest,vacant,grid};
}
