import R from '@dimforge/rapier3d-compat';
const identity = {x:0,y:0,z:0,w:1};
const dt = 1/60;

export const radius=.16;
export const stance=(crouch:boolean)=>crouch?.45:.68;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(n,max));
type Walker={
  body:R.RigidBody;collider:R.Collider;crouch:boolean;grounded:boolean;
  vx:number;vy:number;vz:number;
  input:{down:boolean;forward:number;side:number;yaw:number;glide:boolean}
};
export function walk(world:R.World,controller:R.KinematicCharacterController,p:Walker,jump:boolean,boundary=499){
    const i=p.input,pos=p.body.translation();
    if(i.down!==p.crouch){
      const h=stance(i.down),next={...pos,y:pos.y+h-stance(p.crouch)},shape=new R.Capsule(h-radius,radius);
      if(i.down||!world.intersectionWithShape(next,identity,shape,R.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider)){p.crouch=i.down;p.collider.setShape(shape);p.body.setTranslation(next,true);pos.y=next.y;}
    }
    const gliding=i.glide&&!p.grounded&&p.vy<0;
    const speed=gliding?9:p.crouch?2.2:4.4,len=Math.max(1,Math.hypot(i.forward,i.side));
    const tx=(-Math.sin(i.yaw)*i.forward+Math.cos(i.yaw)*i.side)*speed/len;
    const tz=(-Math.cos(i.yaw)*i.forward-Math.sin(i.yaw)*i.side)*speed/len;
    const d=Math.hypot(tx-p.vx,tz-p.vz),fraction=Math.min(1,(tx||tz?18:24)*dt/(d||1));
    p.vx+=(tx-p.vx)*fraction;p.vz+=(tz-p.vz)*fraction;
    if(jump&&p.grounded&&!p.crouch)p.vy=4.5;
    p.vy-=12*dt;
    if(gliding) p.vy += (Math.max(p.vy,-3)-p.vy)*(1-Math.exp(-5*dt));
    controller.computeColliderMovement(p.collider,{x:p.vx*dt,y:p.vy*dt,z:p.vz*dt},R.QueryFilterFlags.EXCLUDE_SENSORS);
    const delta=controller.computedMovement();p.grounded=controller.computedGrounded();
    if((p.grounded&&p.vy<0)||(p.vy>0&&delta.y<p.vy*dt-.002))p.vy=0;
    p.body.setNextKinematicTranslation({x:clamp(pos.x+delta.x,-boundary,boundary),y:pos.y+delta.y,z:clamp(pos.z+delta.z,-boundary,boundary)});
  }
