import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const wrap=document.querySelector('#canvas-wrap'), scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x151612,.018);
const camera=new THREE.PerspectiveCamera(34,1,.1,300); camera.position.set(26,15,34);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; wrap.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.target.set(0,7,0); controls.minDistance=16; controls.maxDistance=62;
scene.add(new THREE.HemisphereLight(0xdde3cf,0x353026,2.25));
const key=new THREE.DirectionalLight(0xfff1c8,4.2); key.position.set(-8,22,13); key.castShadow=true; key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-30;key.shadow.camera.right=30;key.shadow.camera.top=30;key.shadow.camera.bottom=-30;scene.add(key);
const rim=new THREE.DirectionalLight(0xb7ca91,2);rim.position.set(12,8,-15);scene.add(rim);
const fossil=new THREE.Group(); fossil.name='Voxel_Tyrannosaurus_Fossil'; scene.add(fossil);
const geo=new THREE.BoxGeometry(1,1,1); const mat=new THREE.MeshStandardMaterial({color:0xd8cba7,roughness:.82,metalness:.03});
const edgeMat=new THREE.LineBasicMaterial({color:0x796e55,transparent:true,opacity:.32});
function cube(x,y,z,sx=.72,sy=.72,sz=.72){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;fossil.add(m);return m}
function bone(a,b,w=.48){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=A.distanceTo(B),mid=A.clone().add(B).multiplyScalar(.5);const m=cube(mid.x,mid.y,mid.z,w,d,w);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());return m}
function chain(points,w=.46){for(let i=0;i<points.length-1;i++)bone(points[i],points[i+1],Math.max(.22,w-i*.012));points.forEach((p,i)=>cube(...p,Math.max(.25,w*1.13-i*.01))) }

// Spine and long counterbalancing tail (side view runs on X axis).
const spine=[[-5.5,11.8,0],[-3.8,10.9,0],[-2,10.3,0],[0,10.1,0],[2,9.8,0],[4,9.2,0],[6,8.4,0],[8,7.5,0],[10,6.6,0],[12,5.9,0],[14,5.4,0],[16,5.1,0],[18,4.9,0]];chain(spine,.58);
// Neck rising into skull.
chain([[-5.2,11.7,0],[-6.2,13.1,0],[-7.4,14.3,0],[-8.7,15.2,0]],.58);
// Skull shell: stepped top, snout, cheeks, eye/temporal openings kept hollow.
for(let x=-13;x<=-8;x++)for(let y=15;y<=18;y++)for(let z=-1;z<=1;z++){
  const snout=x<-10.5, eye=x>-10.8&&y>16&&z===0, temporal=x>-9.5&&y===16&&z===0;
  if(!eye&&!temporal && (y<18||x>-12.5) && (!snout||y<17.6)) cube(x,y,z,.53,.52,.58);
}
// brow, nasal bridge and jaw rails
bone([-13.5,17.2,-1.2],[-8,18,-1.2],.42);bone([-13.5,17.2,1.2],[-8,18,1.2],.42);
bone([-13.3,14.4,-1],[-8.1,14.7,-1],.42);bone([-13.3,14.4,1],[-8.1,14.7,1],.42);cube(-7.8,16.2,0,1,1.5,1.35);
// teeth, clearly separated from open mouth.
for(let x=-12.8;x<=-8.4;x+=.78){cube(x,15.25,-1.02,.22,.56,.2);cube(x,15.25,1.02,.22,.56,.2)}
for(let x=-12.6;x<=-8.6;x+=.82){cube(x,14.05,-.92,.2,.46,.18);cube(x,14.05,.92,.2,.46,.18)}
// Ribs around thorax.
for(let i=0;i<7;i++){const x=-3.7+i*1.05,top=10.8-i*.12,width=2.7-i*.15,bottom=6.5+i*.12;[-1,1].forEach(side=>{bone([x,top,side*.35],[x,bottom+1,side*width],.34);bone([x,bottom+1,side*width],[x,bottom,side*.7],.34)})}
// sternum and shoulder girdle
chain([[-3.7,9.8,0],[-3.2,8.2,0],[-2.8,6.5,0]],.36);bone([-4.5,10.2,-2.5],[-3.7,8.2,0],.42);bone([-4.5,10.2,2.5],[-3.7,8.2,0],.42);
// Tiny forelimbs.
[-1,1].forEach(side=>{bone([-4.2,10,side*2.1],[-5.2,8.3,side*2.1],.35);bone([-5.2,8.3,side*2.1],[-6.6,8.1,side*2.05],.29);bone([-6.6,8.1,side*2.05],[-7.2,8.4,side*2.05],.2);bone([-6.6,8.1,side*2.05],[-7.1,7.8,side*2.05],.2)});
// Pelvis with broad ilia.
[-1,1].forEach(side=>{bone([3.1,9.7,side*.6],[5.2,9.1,side*2.1],.65);bone([5.2,9.1,side*2.1],[4.6,6.9,side*1.7],.58);bone([4.6,6.9,side*1.7],[3.3,7.7,side*.5],.5)});
// Powerful hind legs and three-toed feet.
[-1,1].forEach(side=>{const z=side*1.7;bone([4.4,8,z],[2.8,4.5,z],.66);cube(3.6,6.2,z,.78,.72,.72);bone([2.8,4.5,z],[4.1,1.9,z],.55);cube(4.05,1.65,z,.65,.6,.65);bone([4.1,1.4,z],[2.8,.55,z],.4);bone([4.1,1.35,z],[4.2,.38,z],.4);bone([4.1,1.4,z],[5.4,.6,z],.4);cube(2.35,.42,z,.75,.3,.36);cube(4.2,.22,z,.8,.3,.36);cube(5.85,.48,z,.72,.3,.36)});
// Sacral processes and tail chevrons.
for(let i=0;i<10;i++){const p=spine[i+3];cube(p[0],p[1]+.72,p[2],.25,.65,.25);if(i>2)bone([p[0],p[1]-.3,0],[p[0]+.25,p[1]-1,0],.22)}
// subtle voxel edge grid
fossil.traverse(o=>{if(o.isMesh){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMat);e.scale.copy(o.scale);e.position.copy(o.position);e.quaternion.copy(o.quaternion);fossil.add(e)}});
fossil.position.y=-.25;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,50),new THREE.ShadowMaterial({color:0x000000,opacity:.38}));floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(80,80,0x34372f,0x252721);grid.position.y=-.1;grid.material.transparent=true;grid.material.opacity=.28;scene.add(grid);

const views={perspective:{p:[27,15,34],t:[1,8,0]},front:{p:[0,8,42],t:[0,8,0],rot:true},side:{p:[0,8,42],t:[0,8,0]},top:{p:[0,42,.01],t:[0,8,0]}};
let tween=null,spinning=false;
function setView(name){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));const v=views[name];if(v.rot){fossil.rotation.y=Math.PI/2}else fossil.rotation.y=0;const start=camera.position.clone(),end=new THREE.Vector3(...v.p),ts=performance.now();tween={start,end,ts,target:new THREE.Vector3(...v.t)}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelector('#rotate').onclick=e=>{spinning=!spinning;e.currentTarget.setAttribute('aria-pressed',spinning);e.currentTarget.classList.toggle('active',spinning)};
document.querySelector('#download').onclick=()=>new GLTFExporter().parse(fossil,g=>{const blob=new Blob([g],{type:'model/gltf-binary'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='voxel-trex-fossil.glb';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},console.error,{binary:true,onlyVisible:true});
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();
function animate(now){requestAnimationFrame(animate);if(tween){const q=Math.min(1,(now-tween.ts)/700),e=1-Math.pow(1-q,3);camera.position.lerpVectors(tween.start,tween.end,e);controls.target.lerp(tween.target,.14);if(q===1)tween=null}if(spinning)fossil.rotation.y+=.003;controls.update();renderer.render(scene,camera)}requestAnimationFrame(animate);
