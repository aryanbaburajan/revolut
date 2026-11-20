import * as T from 'three';
import {inside,projection,seededRandom} from './street-layout.js';

export function dressStreets(scene,world,R,city,jeep,additionalVehicles=[]){
  const {layout}=city, rand=seededRandom(49287);
  const box=new T.BoxGeometry(), cylinder=new T.CylinderGeometry(.5,.5,1,10), crown=new T.IcosahedronGeometry(.5,0);
  const batches=new Map(), materials=new Map(), dummy=new T.Object3D();
  function add(geo,color,x,y,z,w,h,d,yaw=0,roll=0){
    if(!materials.has(color))materials.set(color,new T.MeshBasicMaterial({color}));
    const key=geo.uuid+color;
    if(!batches.has(key)) batches.set(key,{geo,mat:materials.get(color),poses:[]});
    dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,yaw,roll,'YXZ');dummy.updateMatrix();
    batches.get(key).poses.push(dummy.matrix.clone());
  }
  const reserved=layout.grid(), wrecks=[],fires=[],cars=[];
  function reserve(p,r){reserved.insert({...p,r},p.x-r,p.z-r,p.x+r,p.z+r);}
  reserve({x:0,z:5},8);reserve(jeep.group.position,5);
  for(const position of additionalVehicles) reserve(position,6);
  function free(p,r){
    if(!layout.vacant(p,r))return false;
    for(const q of reserved.near(p,r))if(Math.hypot(q.x-p.x,q.z-p.z)<q.r+r)return false;
    for(const s of layout.roads.near(p,r))if(projection(p,s.a,s.b).d<s.width/2+r)return false;
    for(const j of layout.junctions.near(p,r+4))if(Math.hypot(j.x-p.x,j.z-p.z)<4+r)return false;
    return true;
  }
  const ink=0x252525, light=0xe8e8e8, gray=0x929292;
  function solid(x,y,z,w,h,d,yaw){
    world.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}));
  }
  const shops=[];
  for(const f of layout.facades){
    const door=f.door;if(!door)continue;
    const {nx,nz}=door,yaw=Math.atan2(nx,nz),w=Math.min(door.len*.84,f.shop?5:1.25),h=Math.min(2.7,f.height*.85);
    const x=door.x+nx*.07,z=door.z+nz*.07;
    add(box,ink,x,h/2,z,w,h,.1,yaw);
    add(box,f.shop?gray:0xcccccc,x+nx*.06,h*.5,z+nz*.06,w*.83,h*.89,.04,yaw);
    if(f.shop&&w>2){
      add(box,ink,x+nx*.09,h*.5,z+nz*.09,.08,h,.05,yaw);
      add(box,light,x+nx*.32,h,z+nz*.32,w,.17,.7,yaw);
      if(door.street)shops.push(door.street);
    }else add(box,ink,x+w*.27*nz+nx*.1,1,z-w*.27*nx+nz*.1,.09,.16,.05,yaw);
    reserve({x:x+nx*.55,z:z+nz*.55},Math.min(2,w/2+.4));
    if(rand()<.38){
      f.ring.forEach((a,i)=>{const b=f.ring[(i+1)%f.ring.length],l=Math.hypot(a.x-b.x,a.z-b.z);if(l>.1)add(box,gray,(a.x+b.x)/2,f.height+.25,(a.z+b.z)/2,.19,.5,l,Math.atan2(b.x-a.x,b.z-a.z));});
    }
    const [xmin,zmin,xmax,zmax]=f.bounds;
    for(let i=0;i<5;i++){
      const p={x:xmin+rand()*(xmax-xmin),z:zmin+rand()*(zmax-zmin)};
      if(!inside(p,f.ring)||f.ring.some((a,j)=>projection(p,a,f.ring[(j+1)%f.ring.length]).d<2))continue;
      const y=f.height,kind=rand();
      if(kind<.33){add(cylinder,gray,p.x,y+1.4,p.z,2,2.8,2);add(cylinder,ink,p.x,y+2.8,p.z,2.12,.14,2.12);}
      else if(kind<.6){add(box,ink,p.x,y+2,p.z,.09,4,.09);for(const dy of [2.5,3.4])add(box,gray,p.x,y+dy,p.z,2,.08,.08);}
      else {add(box,light,p.x,y+.6,p.z,2.4,1.2,1.4);for(let j=0;j<5;j++)add(box,ink,p.x-.8+j*.35,y+1.21,p.z,.1,.025,.95);}
      break;
    }
  }
  const civil=['primary','secondary','tertiary','residential','unclassified','service','trunk','motorway'];
  const models=['car','wreck','lamp','tree','sign','barrel','bin','barricade','cart','shelter'];
  function prop(kind,p,yaw){
    const {x,z}=p,cos=Math.cos(yaw),sin=Math.sin(yaw);
    const piece=(geo,col,dx,y,dz,w,h,d,roll=0)=>add(geo,col,x+dx*cos+dz*sin,y,z-dx*sin+dz*cos,w,h,d,yaw,roll);
    let w=1,h=1,d=1;
    switch(kind){
      case 'car':case 'wreck':
        cars.push({x,z,yaw,wreck:kind==='wreck'});if(kind==='wreck')wrecks.push(p);w=1.8;h=1.4;d=3.3;break;
      case 'lamp':piece(cylinder,gray,0,2.6,0,.16,5.2,.16);piece(box,ink,0,5.15,.42,.32,.15,1);w=d=.2;h=5;break;
      case 'tree':piece(cylinder,ink,0,1.6,0,.38,3.2,.38);piece(crown,gray,0,3.7,0,2.8,3.2,2.6);w=d=.4;h=3;break;
      case 'sign':piece(box,ink,0,1.2,0,.09,2.4,.09);piece(box,gray,0,2.3,0,.83,.52,.1);w=d=.16;h=2.5;break;
      case 'shelter':for(const dz of [-1.15,1.15])piece(box,ink,-.5,1.2,dz,.1,2.4,.1);piece(box,gray,0,2.45,0,1.6,.16,2.8);piece(box,gray,0,.5,0,.65,.14,2);w=1.4;d=2.6;h=2.4;break;
      case 'barrel':piece(cylinder,gray,0,.5,0,.72,1,.72);for(const y of [.2,.8])piece(cylinder,ink,0,y,0,.75,.08,.75);w=d=.75;break;
      case 'bin':piece(box,gray,0,.63,0,1.4,1.2,.9);piece(box,ink,0,1.26,0,1.48,.12,.98);w=1.48;h=1.3;break;
      case 'barricade':for(const dz of [-.7,.7])piece(box,ink,0,.43,dz,.4,.86,.13);piece(box,light,0,.66,0,.22,.45,1.9);for(const dz of [-.6,0,.6])piece(box,ink,0,.68,dz,.24,.45,.16);w=.4;d=1.9;break;
      case 'cart':piece(box,gray,0,.35,0,.7,.6,1.1,.9);for(const dz of [-.4,.4])piece(crown,ink,.45,.56,dz,.23,.23,.23);break;
    }
    solid(x,h/2,z,w,h,d,yaw);
  }
  function roadside(s,t,kind,side){
    const dx=(s.b.x-s.a.x)/s.length,dz=(s.b.z-s.a.z)/s.length;
    const r=['car','wreck','shelter'].includes(kind)?1.95:kind==='tree'?1.5:1;
    const off=s.width/2+r+.35;
    const p={x:s.a.x+t*dx-side*dz*off,z:s.a.z+t*dz+side*dx*off};
    if(!free(p,r))return;
    reserve(p,r);prop(kind,p,Math.atan2(dx,dz));
  }
  for(const poi of city.pois.filter(p=>p.tags?.highway==='bus_stop'||p.tags?.public_transport==='platform')){
    const q=layout.nearest(poi.position);if(q){const s=q.segment;roadside(s,Math.hypot(q.x-s.a.x,q.z-s.a.z),'shelter',1);}
  }
  for(const s of layout.segments){
    if(!civil.includes(s.road.highway))continue;
    const oneWay=['yes','1','true','-1'].includes(s.road.tags?.oneway);
    if(s.width>=6&&!oneWay&&s.road.highway!=='motorway'&&s.road.tags?.junction!=='roundabout'&&Number(s.road.tags?.lanes||2)>=2){
      for(let t=-(s.along%7);t<s.length;t+=7){
        const a=Math.max(0,t),b=Math.min(t+3,s.length);if(b<=a)continue;
        const mid=(a+b)/2/s.length,x=s.a.x+(s.b.x-s.a.x)*mid,z=s.a.z+(s.b.z-s.a.z)*mid;
        if([...layout.junctions.near({x,z},8)].some(j=>Math.hypot(j.x-x,j.z-z)<s.width/2+2))continue;
        add(box,0xffffff,x,.026,z,.14,.01,b-a,Math.atan2(s.b.x-s.a.x,s.b.z-s.a.z));
      }
    }
    for(let t=12-(s.along%24);t<s.length;t+=24)if(t>=0){
      const kind=models[Math.floor(rand()*models.length)];
      roadside(s,t,kind,rand()<.5?1:-1);
    }
  }
  const bodies=[];
  for(const f of layout.facades){
    if(!f.door||rand()>.43)continue;
    const q=f.door,offset=(rand()<.5?-1:1)*(1.5+rand()*Math.min(4,q.len/3));
    const p={x:q.x+q.nx*.85+q.nz*offset,z:q.z+q.nz*.85-q.nx*offset};
    if(!free(p,.65))continue;
    reserve(p,.65);
    const choice=rand();
    if(choice<.15)prop('barrel',p,0);
    else if(choice<.3)prop('bin',p,Math.atan2(q.nx,q.nz));
    else if(choice<.34){bodies.push(p);for(let i=0;i<5;i++)add(cylinder,0x561a20,p.x+rand()*.7,.025,p.z+rand()*.7,.15+rand()*.5,.015,.16+rand()*.4);}
    else for(let i=0;i<4;i++)add(box,i%2?gray:light,p.x+(rand()-.5)*.9,.034,p.z+(rand()-.5)*.9,.12+rand()*.22,.03,.22,rand()*6);
  }
  const bodyTexture=new T.TextureLoader().load(import.meta.env.BASE_URL+'assets/zombie-body.png');
  const bodyMat=new T.MeshBasicMaterial({map:bodyTexture,alphaTest:.35,side:T.DoubleSide});
  const bodyMesh=new T.InstancedMesh(new T.PlaneGeometry(1,1.9),bodyMat,bodies.length);
  bodies.forEach((p,i)=>{dummy.position.set(p.x,.05,p.z);dummy.rotation.set(-Math.PI/2,0,rand()*6);dummy.scale.setScalar(1);dummy.updateMatrix();bodyMesh.setMatrixAt(i,dummy.matrix);});scene.add(bodyMesh);
  jeep.group.updateMatrixWorld(true);
  const inverse=jeep.group.matrixWorld.clone().invert();
  jeep.group.traverse(part=>{
    if(!part.isMesh)return;
    const mesh=new T.InstancedMesh(part.geometry,part.material,cars.length),local=inverse.clone().multiply(part.matrixWorld);
    cars.forEach((p,i)=>{dummy.position.set(p.x,p.wreck ? .21 : 0,p.z);dummy.rotation.set(0,p.yaw,p.wreck ? .28 : 0,'YXZ');dummy.scale.setScalar(1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix.clone().multiply(local));mesh.setColorAt(i,new T.Color(p.wreck?0x888888:0xffffff));});
    scene.add(mesh);
  });
  for(const {geo,mat,poses} of batches.values()){
    const mesh=new T.InstancedMesh(geo,mat,poses.length);poses.forEach((m,i)=>mesh.setMatrixAt(i,m));scene.add(mesh);
  }
  const byDistance=[...wrecks].sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  for(const p of byDistance)if(fires.length<3&&fires.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>65))fires.push(p);
  const flames=new T.InstancedMesh(crown,new T.MeshBasicMaterial({color:0xff6920}),fires.length*5);
  const smoke=new T.InstancedMesh(crown,new T.MeshBasicMaterial({color:0x666666,transparent:true,opacity:.55,depthWrite:false}),fires.length*18);
  flames.frustumCulled=smoke.frustumCulled=false;scene.add(flames,smoke);
  function update(now){
    const time=now*.001;
    fires.forEach((p,i)=>{
      for(let j=0;j<5;j++){
        const h=1.8+.7*Math.sin(time*8+j*3);
        dummy.position.set(p.x+Math.sin(j*4)*.65,.8+h/2,p.z+Math.cos(j*4)*.65);
        dummy.rotation.set(0,time+j,0);dummy.scale.set(.85,h,.85);dummy.updateMatrix();flames.setMatrixAt(i*5+j,dummy.matrix);
      }
      for(let j=0;j<18;j++){
        const t=(j/18+time*.045)%1,size=1.1+5*t;
        dummy.position.set(p.x+t*t*11+Math.sin(j+t*6)*t*2,2+t*65,p.z+Math.cos(j+t*5)*t*2);
        dummy.scale.set(size,size*1.35,size);dummy.updateMatrix();smoke.setMatrixAt(i*18+j,dummy.matrix);
      }
    });flames.instanceMatrix.needsUpdate=smoke.instanceMatrix.needsUpdate=true;
  }
  return {shops,wrecks,fires,update};
}
