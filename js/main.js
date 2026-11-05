import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Reflector } from "three/addons/objects/Reflector.js";

/* ------------------------------------------------------------------
   Camera calibration to the room photo (assets/room.jpg)
   The photo is 1672 × 941 px plus 640 px of extended floor underneath.
   Measured from the photo: rack bar centre y 448.5 px, posts x 599.6 / 1072.2 px,
   foot bottoms y 716.5 px. Assumed bar height 1.60 m and a level camera.
   ------------------------------------------------------------------ */
const IMG = { w: 1672, h: 941, pad: 640, cx: 836, cy: 470.5 };
const FOV_V = 40;                                        // degrees, full photo height
const F_PX = IMG.cy / Math.tan(THREE.MathUtils.degToRad(FOV_V / 2));
const PX_PER_M = 167.5;                                  // at the rack's depth
const RACK_Z = -F_PX / PX_PER_M;                         // ≈ −7.72 m
const CAM_H = (716.5 - IMG.cy) / PX_PER_M;               // ≈ 1.47 m
const BAR_Y = CAM_H + (IMG.cy - 448.5) / PX_PER_M;       // = 1.60 m
const POST_X = ((1072.2 - 599.6) / 2) / PX_PER_M;        // ≈ 1.41 m
const TUBE_R = 0.0105;
const CORNER_R = 0.064;
const RACK_BOX = { x0: 566, x1: 1106, y0: 444, y1: 718 }; // rack outline in photo pixels

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("scene");
const hintEl = document.getElementById("hint");
const backBtn = document.getElementById("step-back");
const loadingEl = document.getElementById("loading");

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV_V, IMG.w / IMG.h, 0.05, 80);
camera.position.set(0, CAM_H, 0);

// ------------------------------------------------------------------ environment for the metal
// A small studio that mirrors the photo: dark navy walls, pale floor, one large ceiling light.
function buildEnvironment() {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: `varying vec3 vP;
        void main(){
          float y = vP.y;
          vec3 floorC = vec3(0.62, 0.66, 0.71);
          vec3 horizon = vec3(0.36, 0.40, 0.45);
          vec3 wallTop = vec3(0.06, 0.08, 0.11);
          vec3 c = y < 0.0 ? mix(horizon, floorC, smoothstep(0.0, -0.35, y))
                           : mix(horizon, wallTop, smoothstep(0.0, 0.55, y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  env.add(dome);
  const light = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 5.2) }));
  light.position.set(0, 9, 3); light.rotation.x = Math.PI / 2; light.scale.set(1.6, 1, 1);
  env.add(light);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}
scene.environment = buildEnvironment();
scene.environmentIntensity = 1.0;

// lights: a soft top light (the ceiling disc in the photo) and cool bounce from the room
const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x6f7783, 0.75);
scene.add(hemi);
const top = new THREE.DirectionalLight(0xf4f7ff, 1.25);
top.position.set(0.4, BAR_Y + 6, RACK_Z + 2.2);
top.target.position.set(0, 0.6, RACK_Z);
top.castShadow = true;
top.shadow.mapSize.set(1024, 1024);
top.shadow.camera.left = -2; top.shadow.camera.right = 2;
top.shadow.camera.top = 2; top.shadow.camera.bottom = -2;
top.shadow.camera.near = 1; top.shadow.camera.far = 12;
top.shadow.radius = 22; top.shadow.blurSamples = 16; top.shadow.bias = -0.0005;
scene.add(top, top.target);

// ------------------------------------------------------------------ room photo as a backdrop
// A plane far behind the rack that exactly fills the calibrated frustum, so any zoom
// (done by cropping the camera's view) crops the photo and the 3D objects together.
const BG_D = 40;
const bgH = 2 * BG_D * Math.tan(THREE.MathUtils.degToRad(FOV_V / 2));
const bgW = bgH * IMG.w / IMG.h;
const bgFullH = bgH * (IMG.h + IMG.pad) / IMG.h;
const bgTex = new THREE.TextureLoader().load("assets/room.jpg", () => requestRender());
bgTex.colorSpace = THREE.SRGBColorSpace;
bgTex.anisotropy = 4;
const background = new THREE.Mesh(
  new THREE.PlaneGeometry(bgW, bgFullH),
  new THREE.MeshBasicMaterial({ map: bgTex, toneMapped: false, depthWrite: false, dithering: true })
);
background.position.set(0, CAM_H + bgH / 2 - bgFullH / 2, -BG_D);
background.renderOrder = -10;
scene.add(background);

// ------------------------------------------------------------------ the rack
const metal = new THREE.MeshPhysicalMaterial({
  color: 0xc9d2dc, metalness: 1.0, roughness: 0.2, envMapIntensity: 1.35,
  clearcoat: 0.3, clearcoatRoughness: 0.2,
});
const rack = new THREE.Group();
rack.position.set(0, 0, RACK_Z);
scene.add(rack);

const FOOT_TOP = 0.66;
{
  const path = new THREE.CurvePath();
  const L = new THREE.Vector3(-POST_X, FOOT_TOP - 0.02, 0), R = new THREE.Vector3(POST_X, FOOT_TOP - 0.02, 0);
  path.add(new THREE.LineCurve3(L, new THREE.Vector3(-POST_X, BAR_Y - CORNER_R, 0)));
  path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-POST_X, BAR_Y - CORNER_R, 0), new THREE.Vector3(-POST_X, BAR_Y, 0), new THREE.Vector3(-POST_X + CORNER_R, BAR_Y, 0)));
  path.add(new THREE.LineCurve3(new THREE.Vector3(-POST_X + CORNER_R, BAR_Y, 0), new THREE.Vector3(POST_X - CORNER_R, BAR_Y, 0)));
  path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(POST_X - CORNER_R, BAR_Y, 0), new THREE.Vector3(POST_X, BAR_Y, 0), new THREE.Vector3(POST_X, BAR_Y - CORNER_R, 0)));
  path.add(new THREE.LineCurve3(new THREE.Vector3(POST_X, BAR_Y - CORNER_R, 0), R));
  const frame = new THREE.Mesh(new THREE.TubeGeometry(path, 400, TUBE_R, 20, false), metal);
  frame.castShadow = true;
  rack.add(frame);

  // teardrop feet, profile traced from the photo (pixels at the rack's depth → metres)
  const prof = [[0, 0], [12.5, 0.4], [16.8, 2.4], [19, 6], [20.2, 13], [20.4, 21], [19.6, 29], [17.8, 37.5],
    [14.6, 45.5], [10.8, 53.5], [8.0, 61.5], [5.9, 69.5], [4.1, 77.5], [2.9, 85.5], [2.05, 93], [1.78, 101], [1.76, 110.5]];
  const spline = new THREE.SplineCurve(prof.map(([r, h]) => new THREE.Vector2(r / PX_PER_M, h / PX_PER_M)));
  const pts = spline.getPoints(90);
  pts[0].x = 0; pts[pts.length - 1].x = TUBE_R;
  const footGeo = new THREE.LatheGeometry(pts, 64);
  for (const x of [-POST_X, POST_X]) {
    const foot = new THREE.Mesh(footGeo, metal);
    foot.position.x = x; foot.castShadow = true;
    rack.add(foot);
  }
}

// soft contact shadows where the feet meet the floor
function radialTexture(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, a] of stops) gr.addColorStop(o, `rgba(18,22,28,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const contactTex = radialTexture([[0, 0.55], [0.45, 0.32], [1, 0]]);
for (const x of [-POST_X, POST_X]) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, toneMapped: false }));
  s.rotation.x = -Math.PI / 2; s.position.set(x, 0.002, 0);
  rack.add(s);
}

// shadow catcher on the photographed floor
const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.ShadowMaterial({ opacity: 0.15 }));
shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.set(0, 0.001, RACK_Z);
shadowFloor.receiveShadow = true;
scene.add(shadowFloor);

// faint, blurred reflection in the polished floor (only the rack and jacket are reflected)
const reflector = new Reflector(new THREE.PlaneGeometry(8, 6), {
  textureWidth: 512, textureHeight: 512, clipBias: 0.003,
  shader: {
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uOpacity: { value: 0.12 } },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv;
      void main(){ vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uOpacity; varying vec4 vUv;
      void main(){
        vec2 uv = vUv.xy / vUv.w;
        vec4 c = vec4(0.0);
        for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++)
          c += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * 0.0022);
        c /= 25.0;
        vec3 rgb = c.rgb / max(c.a, 0.001);          // un-premultiply so edges don't go grey
        gl_FragColor = vec4(rgb, c.a * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  },
});
reflector.material.transparent = true;
reflector.material.depthWrite = false;
reflector.rotation.x = -Math.PI / 2;
reflector.position.set(0, 0, RACK_Z);
reflector.renderOrder = -5;
scene.add(reflector);
{
  const original = reflector.onBeforeRender;
  reflector.onBeforeRender = function (r, s, c) {
    background.visible = false; shadowFloor.visible = false;
    const clear = new THREE.Color(); r.getClearColor(clear); const a = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    original.call(this, r, s, c);
    r.setClearColor(clear, a);
    background.visible = true; shadowFloor.visible = true;
  };
}

// ------------------------------------------------------------------ hanger: swivel hook on the bar
// pivot = the hook's seat on the bar; it swings about the bar. The swivel turns the hanger
// (and jacket) about the vertical axis beneath the hook.
const pivot = new THREE.Group();
pivot.position.set(0, BAR_Y, RACK_Z);
scene.add(pivot);
const swivel = new THREE.Group();
pivot.add(swivel);

const hookMat = new THREE.MeshPhysicalMaterial({ color: 0xbfc8d2, metalness: 1, roughness: 0.3 });
{
  const r = TUBE_R + 0.0045;
  const pts = [
    [0, -0.07, 0], [0, -0.045, 0], [0, -0.03, 0.004], [0, -0.016, 0.011],
    [0, -0.002, r], [0, r * 0.72, r * 0.72], [0, r, 0], [0, r * 0.72, -r * 0.72], [0, 0.0, -r], [0, -0.011, -r * 0.8],
  ].map(p => new THREE.Vector3(...p));
  const hook = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0032, 10, false), hookMat);
  hook.castShadow = true;
  pivot.add(hook);
  const swivelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.012, 16), hookMat);
  swivelCap.position.y = -0.074;
  pivot.add(swivelCap);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.09, 10), hookMat);
  neck.position.y = -0.125;
  swivel.add(neck);
}

// ------------------------------------------------------------------ jacket
const JACKET_DROP = 0.155;          // swivel → collar top
const YAW_SIDE = -Math.PI / 2;      // side to the visitor, front facing left
const YAW_BACK = -Math.PI;          // back to the visitor
let jacket = null, morphMesh = null;
const jacketHit = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.74, 0.36), new THREE.MeshBasicMaterial({ visible: false }));
jacketHit.position.y = -JACKET_DROP - 0.34;
swivel.add(jacketHit);

const rackHit = new THREE.Mesh(new THREE.PlaneGeometry(POST_X * 2 + 0.3, BAR_Y + 0.12), new THREE.MeshBasicMaterial({ visible: false }));
rackHit.position.set(0, (BAR_Y + 0.12) / 2 - 0.02, 0);
rack.add(rackHit);

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.load("assets/denim_jacket.glb", gltf => {
  jacket = gltf.scene;
  jacket.position.y = -JACKET_DROP;
  jacket.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      if (o.morphTargetInfluences) morphMesh = o;
      o.material.envMapIntensity = 0.12;
      // the export carries a full-white sheen; keep a faint denim nap instead
      if (o.material.sheenColor) { o.material.sheenColor.setScalar(0.14); o.material.sheenRoughness = 0.7; }
      o.material.transparent = true; o.material.opacity = 0;
    }
  });
  // the GLB's own looping sway is replaced by live physics here
  jacket.children.forEach(c => c.rotation.set(0, 0, 0));
  swivel.add(jacket);
  fadeJacket = 0.0001; fadeStart = performance.now();
  loadingEl.classList.add("done");
  requestRender();
}, undefined, err => {
  console.error(err);
  loadingEl.textContent = "The jacket could not be loaded. Refresh to try again.";
});
let fadeJacket = 0, fadeStart = 0;

// ------------------------------------------------------------------ framing (zoom = crop of the calibrated view)
function viewportAspect() { return canvas.clientWidth / Math.max(1, canvas.clientHeight); }
function roomCrop(a) {
  const imgA = IMG.w / IMG.h;
  if (a >= imgA) return { cx: IMG.cx, cy: IMG.cy, w: IMG.w };     // wide: full width, trim top/bottom evenly
  const w = Math.max(IMG.h * a, (RACK_BOX.x1 - RACK_BOX.x0) * 1.12);
  const h = w / a;
  // tall screens: keep the whole rack in view, keep the ceiling light, extend the floor below
  const cy = h <= IMG.h ? IMG.cy : Math.min(h / 2, IMG.h + IMG.pad - h / 2);
  return { cx: IMG.cx, cy, w };
}
function rackCrop(a) {
  const rw = RACK_BOX.x1 - RACK_BOX.x0, rh = RACK_BOX.y1 - RACK_BOX.y0;
  const fillW = a >= 1 ? 0.84 : 0.94, fillH = 0.8;
  const w = Math.min(Math.max(rw / fillW, (rh / fillH) * a), roomCrop(a).w);
  const h = w / a;
  // centre on the rack, but never look past the top of the photo or the end of the extended floor
  const cy = Math.min(Math.max((RACK_BOX.y0 + RACK_BOX.y1) / 2 + 4, h / 2), IMG.h + IMG.pad - h / 2);
  return { cx: (RACK_BOX.x0 + RACK_BOX.x1) / 2, cy, w };
}
const CEILING_LIGHT = { x0: 330, x1: 1340, y1: 112 };   // the bright disc in the photo, in pixels
let headerOnLight = null;
function applyCrop(c) {
  const a = viewportAspect(), h = c.w / a;
  const x0 = c.cx - c.w / 2, y0 = c.cy - h / 2;
  camera.setViewOffset(IMG.w, IMG.h, x0, y0, c.w, h);
  // switch the header to dark ink when it sits on the ceiling light
  const vw = canvas.clientWidth, vh = canvas.clientHeight;
  const yImg = y0 + (40 / vh) * h;
  const leftX = x0 + (60 / vw) * c.w, rightX = x0 + ((vw - 60) / vw) * c.w;
  const onLight = yImg < CEILING_LIGHT.y1 && leftX > CEILING_LIGHT.x0 && rightX < CEILING_LIGHT.x1;
  if (onLight !== headerOnLight) { headerOnLight = onLight; document.body.classList.toggle("header-on-light", onLight); }
}

const view = { name: "room", from: null, to: null, t: 1, dur: 1.6, current: null };
function cropFor(name) { return name === "rack" ? rackCrop(viewportAspect()) : roomCrop(viewportAspect()); }
function goTo(name) {
  if (view.name === name && view.t >= 1) return;
  view.from = view.current ? { ...view.current } : cropFor(view.name);
  view.name = name; view.t = 0; view.dur = reduceMotion ? 0.35 : 1.6;
  document.body.dataset.view = name;
  backBtn.hidden = name !== "rack";
  updateHint();
  requestRender();
}
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ------------------------------------------------------------------ hanging physics
// θ: swing about the bar (toward/away from the visitor); φ: small sideways rock along the bar;
// ψ: turn on the swivel, a damped torsion spring that follows a hand-turned target.
const P = {
  theta: 0, thetaV: 0, phi: 0, phiV: 0,
  psi: YAW_SIDE, psiV: 0, psiTarget: YAW_SIDE,
  turnFrom: YAW_SIDE, turnTo: YAW_SIDE, turnT: 1, turnDur: 1.5,
  hemX: 0, hemXV: 0, hemZ: 0, hemZV: 0, twistLag: 0, twistLagV: 0,
  facing: "side",
};
const G_OVER_L = 9.81 / 0.47;
let simTime = 0;

function turnJacket() {
  P.facing = P.facing === "side" ? "back" : "side";
  P.turnFrom = P.psiTarget;
  P.turnTo = P.facing === "back" ? YAW_BACK : YAW_SIDE;
  P.turnT = 0;
  P.turnDur = reduceMotion ? 0.6 : 1.5;
  // the hand that turns it also nudges the hem a little
  if (!reduceMotion) { P.thetaV += 0.26; P.phiV += P.facing === "back" ? -0.12 : 0.12; }
  updateHint();
}

function stepPhysics(dt) {
  simTime += dt;
  // hand-turned target (eased), torsion spring follows with a little overshoot
  if (P.turnT < 1) {
    P.turnT = Math.min(1, P.turnT + dt / P.turnDur);
    P.psiTarget = P.turnFrom + (P.turnTo - P.turnFrom) * easeInOut(P.turnT);
  }
  const breeze = reduceMotion ? 0 : 1;
  const kT = 34, cT = 5.4;
  const psiA = kT * (P.psiTarget - P.psi) - cT * P.psiV
    + breeze * (0.5 * Math.sin(simTime * 0.53) + 0.3 * Math.sin(simTime * 1.37 + 0.8));
  P.psiV += psiA * dt; P.psi += P.psiV * dt;

  // physical pendulum about the bar; turning couples a little energy into the swing
  const thetaA = -G_OVER_L * Math.sin(P.theta) - 0.85 * P.thetaV + 0.055 * psiA
    + breeze * (0.22 * Math.sin(simTime * 0.71) + 0.12 * Math.sin(simTime * 1.9 + 2.1));
  P.thetaV += thetaA * dt; P.theta += P.thetaV * dt;
  // rocking along the bar is stiffer (hook seat), so it is quicker and smaller
  const phiA = -60 * P.phi - 3.2 * P.phiV + 0.03 * psiA + breeze * 0.3 * Math.sin(simTime * 1.13 + 0.4);
  P.phiV += phiA * dt; P.phi += P.phiV * dt;

  // cloth: the hem lags behind the swing and the turn (drives the jacket's sway shape keys).
  // The hem's lag points opposite to the body's acceleration.
  const k = 70, c = 7.5;
  P.hemZV += (k * (thetaA * 0.025 - P.hemZ) - c * P.hemZV) * dt; P.hemZ += P.hemZV * dt;
  P.hemXV += (k * (-phiA * 0.02 - P.hemX) - c * P.hemXV) * dt; P.hemX += P.hemXV * dt;
  P.twistLagV += (55 * (-P.psiV * 0.012 - P.twistLag) - 6 * P.twistLagV) * dt; P.twistLag += P.twistLagV * dt;
}

function poseJacket() {
  pivot.rotation.set(P.theta, 0, P.phi);
  swivel.rotation.y = P.psi;
  if (morphMesh) {
    // world-space hem offset → jacket-local axes (Sway_Side = local +x, Sway_Depth = local −z)
    const cs = Math.cos(P.psi), sn = Math.sin(P.psi);
    const lx = cs * P.hemX - sn * P.hemZ + P.twistLag;
    const lz = sn * P.hemX + cs * P.hemZ;
    const inf = morphMesh.morphTargetInfluences;
    inf[0] = THREE.MathUtils.clamp(lx / 0.035, -1, 1);
    inf[1] = THREE.MathUtils.clamp(-lz / 0.025, -1, 1);
  }
}

// ------------------------------------------------------------------ input
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const targets = [jacketHit, rackHit];
  if (jacket) targets.unshift(jacket);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o) { if (o === jacket || o === jacketHit) return "jacket"; o = o.parent; }
  return "rack";
}
function activate(target) {
  if (view.name === "room") { if (target) goTo("rack"); return; }
  if (target === "jacket") turnJacket();
  else if (!target) goTo("room");
}
let down = null;
canvas.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener("pointerup", e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 10) return;
  activate(pick(e.clientX, e.clientY));
});
canvas.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  const t = pick(e.clientX, e.clientY);
  canvas.classList.toggle("pointer", !!t);
});
canvas.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(view.name === "room" ? "rack" : "jacket"); }
  if (e.key === "Escape") goTo("room");
});
backBtn.addEventListener("click", () => goTo("room"));
window.addEventListener("keydown", e => { if (e.key === "Escape" && document.activeElement !== canvas) goTo("room"); });

function updateHint() {
  const verb = matchMedia("(pointer: coarse)").matches ? "Tap" : "Click";
  const text = view.name === "room" ? `${verb} the rack to step closer`
    : P.facing === "side" ? `${verb} the jacket to see the back` : `${verb} the jacket to turn it back`;
  if (hintEl.textContent === text) return;
  hintEl.classList.add("swap");
  setTimeout(() => { hintEl.textContent = text; hintEl.classList.remove("swap"); }, 250);
}

// ------------------------------------------------------------------ sizing + loop
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  if (view.t >= 1) view.current = cropFor(view.name);
  applyCrop(view.current || cropFor(view.name));
  requestRender();
}
window.addEventListener("resize", resize);

let needsRender = true;
function requestRender() { needsRender = true; }
const clock = new THREE.Clock();
let acc = 0;
const STEP = 1 / 120;

function update(dt) {
  // camera move
  if (view.t < 1) {
    view.t = Math.min(1, view.t + dt / view.dur);
    const to = cropFor(view.name), k = easeInOut(view.t), f = view.from;
    view.current = {
      cx: f.cx + (to.cx - f.cx) * k,
      cy: f.cy + (to.cy - f.cy) * k,
      w: Math.exp(Math.log(f.w) + (Math.log(to.w) - Math.log(f.w)) * k),
    };
    applyCrop(view.current);
  }
  // fixed-step physics for stable springs at any frame rate
  acc += dt;
  while (acc >= STEP) { stepPhysics(STEP); acc -= STEP; }
  poseJacket();
  if (fadeJacket > 0 && fadeJacket < 1) {
    fadeJacket = Math.min(1, (performance.now() - fadeStart) / 700);
    jacket.traverse(o => { if (o.isMesh) { o.material.opacity = fadeJacket; if (fadeJacket >= 1) o.material.transparent = false; } });
  }
}
function frame() {
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
  if (!canvas.classList.contains("ready")) canvas.classList.add("ready");
  requestAnimationFrame(frame);
}
view.current = roomCrop(viewportAspect());
resize();
updateHint();
requestAnimationFrame(frame);

// test handle, only with ?debug in the address
if (new URLSearchParams(location.search).has("debug")) window.__jackob = { get jacket() { return jacket; }, get fade() { return fadeJacket; }, get view() { return view.name; }, get facing() { return P.facing; }, P, camera, renderer, activate, goTo, turnJacket,
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60); },
  get crop() { return view.current; } };
