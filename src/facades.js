import * as THREE from 'three';

// Four adjacent 32px ink tiles: glazed, dark, boarded and broken.
export function facadeMaterial(){
  const pixels=new Uint8Array(128*32*4);
  for(let y=0;y<32;y++) for(let x=0;x<128;x++){
    const u=x%32, variant=x>>5;
    const frame=u<3||u>28||y<3||y>28;
    let ink=frame||u===15||y===16;
    if(variant===1) ink ||= (u+y)%13>1;
    if(variant===2) ink ||= Math.abs(y-u*.55-3)<2 || Math.abs(y-u*.55-12)<2;
    if(variant===3) ink=frame || (u<14 && y>12+Math.sin(u)*3);
    const value=ink?32:variant===3?160:242;
    pixels.set([value,value,value,255],(y*128+x)*4);
  }
  const atlas=new THREE.DataTexture(pixels,128,32);
  atlas.colorSpace=THREE.SRGBColorSpace;atlas.magFilter=THREE.LinearFilter;atlas.needsUpdate=true;
  const mat=new THREE.MeshBasicMaterial();
  mat.onBeforeCompile=s=>{
    s.uniforms.windowAtlas={value:atlas};
    s.vertexShader='attribute vec3 facadeData; varying vec3 facade; varying vec2 wall; varying float roof;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      facade=facadeData; roof=abs(normal.y);
      wall=roof>.5?position.xz:vec2(dot(position.xz,vec2(normal.z,-normal.x)),position.y);`);
    s.fragmentShader='uniform sampler2D windowAtlas; varying vec3 facade; varying vec2 wall; varying float roof;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cell=vec2(wall.x/3.,wall.y/facade.y);
      float hatch=(wall.x+wall.y)*(facade.z==1.?2.3:.85);
      float line=abs(fract(hatch)-.5);
      float aa=max(fwidth(hatch),.01);
      float shade=smoothstep(.04-aa,.04+aa,line);
      if(facade.z==2.) shade=smoothstep(.08,.14,length(fract(wall*1.8)-.5));
      diffuseColor.rgb*=mix(.28,1.,shade);
      vec2 pane=(fract(cell)-vec2(.18,.22))/vec2(.64,.56);
      if(roof<.5 && all(greaterThanEqual(pane,vec2(0.))) && all(lessThanEqual(pane,vec2(1.)))){
        float hash=fract(sin(dot(floor(cell),vec2(12.9898,78.233))+facade.x)*43758.5453);
        float tile=hash<.62?0.:hash<.8?1.:hash<.92?2.:3.;
        diffuseColor.rgb=texture2D(windowAtlas,vec2((tile+(.5+pane.x*31.)/32.)*.25,(.5+pane.y*31.)/32.)).rgb;
      }`);
  };
  return mat;
}
