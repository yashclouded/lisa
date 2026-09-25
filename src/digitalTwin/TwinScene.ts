// LISA Digital Twin — imperative three.js scene.
//
// Geometry follows the build plan (agent.md): LED → 14 mm cuvette chamber →
// razor slit → 30×30 mm tube → 1000 l/mm film on the phone lens, phone on a
// 33.4° wedge. Units are centimetres. The scene owns no science: it is told
// what the simulator produced (intensities, transmitted colour) and draws it.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  WEDGE_ANGLE_RAD,
  SENSOR_X_MIN,
  SENSOR_X_MAX,
  diffractionAngle,
  sensorX,
  drawSensorFrame,
  nmToRGB,
  RGB,
} from './twinModel';

export type PartId =
  | 'enclosure'
  | 'led'
  | 'diffuser'
  | 'cuvette'
  | 'slit'
  | 'grating'
  | 'sensor'
  | 'phone';
export type ModeId = 'normal' | 'cutaway' | 'exploded';
export type ViewId = 'hero' | 'front' | 'top' | 'side' | 'optical' | 'sensor' | 'free';

export interface OpticsState {
  lightOn: boolean;
  /** 0–8 while a measurement animates (pipeline stage); 9 = everything shown. */
  reveal: number;
  /** 151-point intensity reaching the sensor (sample or blank). */
  sensorIntensities: number[];
  /** Colour of light leaving the cuvette, from the simulated T(λ). */
  transmitted: RGB;
  /** Whether the cuvette holds reacted sample (tinted) or the blank. */
  showSample: boolean;
}

export interface ScreenState {
  id: string;
  headline: string;
  sub: string;
  tone: 'pass' | 'caution' | 'alert' | 'neutral';
}

// ---- Optical frame -------------------------------------------------------

const A0 = WEDGE_ANGLE_RAD;
const AXIS_C = new THREE.Vector3(Math.cos(A0), 0, -Math.sin(A0)); // camera axis
const AXIS_H = new THREE.Vector3(Math.sin(A0), 0, Math.cos(A0)); // ⟂ C in the dispersion plane
const LOCAL_X = AXIS_H.clone().negate(); // phone/sensor local +x (right-handed with Y, C)
const PHONE_BASIS = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(LOCAL_X, new THREE.Vector3(0, 1, 0), AXIS_C)
);
const G = new THREE.Vector3(12.3, 0, 0); // grating on the lens (assembled)
const F_ASSEMBLED = 0.45; // lens-to-sensor (pinhole-equivalent), cm
const SENSOR_W = SENSOR_X_MAX - SENSOR_X_MIN; // per unit focal length
const FAN_NM = Array.from({ length: 61 }, (_, i) => 400 + i * 5);
const TICK_NM = [450, 500, 550, 600, 650, 700];

/** World direction of first-order light of wavelength nm leaving the grating. */
const rayDir = (nm: number) => {
  const dev = A0 + diffractionAngle(nm);
  return new THREE.Vector3(Math.cos(dev), 0, -Math.sin(dev));
};

// ---- Parts ---------------------------------------------------------------

interface Part {
  id: PartId;
  group: THREE.Group;
  base: THREE.Vector3;
  explode: THREE.Vector3;
  label: CSS2DObject;
}

export const PART_NAMES: Record<PartId, string> = {
  enclosure: 'Enclosure',
  led: 'White LED',
  diffuser: 'Diffuser',
  cuvette: 'Sample cuvette',
  slit: 'Slit',
  grating: 'Diffraction grating',
  sensor: 'Image sensor',
  phone: 'Phone camera',
};

const LABEL_TEXT: Record<PartId, string> = {
  enclosure: 'ENCLOSURE · 300 gsm card',
  led: 'WHITE LED',
  diffuser: 'DIFFUSER',
  cuvette: 'SAMPLE CUVETTE · 10 mm',
  slit: 'SLIT · 0.1–0.2 mm',
  grating: 'GRATING · 1000 l/mm',
  sensor: 'IMAGE PLANE',
  phone: 'PHONE CAMERA',
};

// ---- Shaders: light as a slow travelling modulation, not particles -------

const BEAM_VERT = /* glsl */ `
  varying float vX; varying float vY;
  void main() { vX = position.x; vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uLen;
  varying float vX; varying float vY;
  void main() {
    float flow = 0.72 + 0.28 * sin(vX * uLen * 2.6 - uTime * 5.0);
    float ends = smoothstep(0.0, 0.04, vX) * smoothstep(1.0, 0.96, vX);
    float edge = 1.0 - smoothstep(0.3, 0.5, abs(vY));
    gl_FragColor = vec4(uColor, uOpacity * flow * ends * edge);
  }`;
const FAN_VERT = /* glsl */ `
  attribute vec3 tint; attribute float alpha; attribute float u;
  varying vec3 vTint; varying float vAlpha; varying float vU;
  void main() { vTint = tint; vAlpha = alpha; vU = u;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FAN_FRAG = /* glsl */ `
  uniform float uTime; uniform float uLen; uniform float uOpacity;
  varying vec3 vTint; varying float vAlpha; varying float vU;
  void main() {
    float flow = 0.75 + 0.25 * sin(vU * uLen * 2.6 - uTime * 5.0);
    float ends = smoothstep(0.0, 0.06, vU);
    gl_FragColor = vec4(vTint, vAlpha * uOpacity * flow * ends);
  }`;

type BeamKey = 'led' | 'cuvette' | 'post' | 'tube' | 'zero';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class TwinScene {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private ro: ResizeObserver;
  private parts = new Map<PartId, Part>();
  private pickables: THREE.Object3D[] = [];
  private time = { value: 0 };
  private reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // State driven from React
  private mode: ModeId = 'normal';
  private view: ViewId = 'hero';
  private selected: PartId | null = null;
  private optics: OpticsState | null = null;

  // Animated scalars
  private explodeT = 0;
  private cutK = 4; // clip plane keeps z ≤ cutK
  private phoneGhost = 1;
  private tween: {
    fromPos: THREE.Vector3;
    fromTgt: THREE.Vector3;
    toPos: THREE.Vector3;
    toTgt: THREE.Vector3;
    t: number;
  } | null = null;

  // Scene objects that react to state
  private cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 4);
  private enclosureMats: THREE.MeshStandardMaterial[] = [];
  private phoneMats: THREE.Material[] = [];
  private ledMat!: THREE.MeshStandardMaterial;
  private ledLight!: THREE.PointLight;
  private diffuserMat!: THREE.MeshStandardMaterial;
  private liquidMat!: THREE.MeshStandardMaterial;
  private beams = {} as Record<BeamKey, THREE.Mesh>;
  private fan!: THREE.Mesh;
  private fanMat!: THREE.ShaderMaterial;
  private sensorCanvas = document.createElement('canvas');
  private sensorTex: THREE.CanvasTexture;
  private screenCanvas = document.createElement('canvas');
  private screenTex: THREE.CanvasTexture;
  private screen: ScreenState | null = null;
  private selectBox = new THREE.Box3();
  private selectHelper: THREE.Box3Helper;
  private ticks: CSS2DObject[] = [];

  private downAt: { x: number; y: number } | null = null;
  private disposed = false;

  constructor(
    private container: HTMLElement,
    private onSelect: (id: PartId | null) => void,
    private onFreeView: () => void,
    /** Attachment only: no phone and no image plane (the Hardware design view). */
    private hardwareOnly = false
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, container.clientWidth < 700 ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.className = 'twin-canvas';
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'twin-labels';
    container.appendChild(this.labels.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.55;

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-6, 14, 10);
    this.scene.add(key, new THREE.HemisphereLight(0xf4f1ea, 0x8a8f96, 0.5));

    this.sensorCanvas.width = 512;
    this.sensorCanvas.height = 32;
    this.sensorTex = new THREE.CanvasTexture(this.sensorCanvas);
    this.sensorTex.colorSpace = THREE.SRGBColorSpace;
    this.screenCanvas.width = 1024;
    this.screenCanvas.height = 496;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTex.anisotropy = 4;

    this.build();
    if (hardwareOnly) {
      for (const id of ['phone', 'sensor'] as const) this.parts.get(id)!.group.visible = false;
      this.pickables = this.pickables.filter((o) => !['phone', 'sensor'].includes(o.userData.part));
    }

    this.selectHelper = new THREE.Box3Helper(this.selectBox, new THREE.Color('#0b6e7f'));
    this.selectHelper.visible = false;
    this.scene.add(this.selectHelper);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 70;
    this.controls.addEventListener('start', () => {
      if (this.tween) this.tween = null;
      if (this.view !== 'free') {
        this.view = 'free';
        this.onFreeView();
      }
    });
    const [pos, tgt] = this.viewPose('hero');
    this.camera.position.copy(pos);
    this.controls.target.copy(tgt);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointermove', this.onMove);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(this.frame);
  }

  // ---- Public API ---------------------------------------------------------

  setMode(mode: ModeId) {
    this.mode = mode;
    this.updateLabels();
    if (this.view !== 'free') this.flyTo(this.view);
  }

  setView(view: ViewId) {
    this.view = view;
    this.updateLabels();
    if (view !== 'free') this.flyTo(view);
  }

  setSelected(id: PartId | null) {
    this.selected = id;
    this.updateLabels();
  }

  setOptics(optics: OpticsState) {
    this.optics = optics;
    const { lightOn, reveal, transmitted, showSample, sensorIntensities } = optics;
    const on = (stage: number) => lightOn && reveal >= stage;

    this.ledMat.emissiveIntensity = lightOn ? 2.4 : 0;
    this.ledLight.intensity = lightOn ? 5 : 0;
    this.diffuserMat.emissiveIntensity = lightOn ? 0.5 : 0;

    // Liquid: the simulated transmitted colour. Squared for visual contrast —
    // the hue is physical, the depth is exaggerated (see README).
    const liquid = showSample ? transmitted.map((c) => c * c) : [0.93, 0.96, 0.98];
    this.liquidMat.color.setRGB(liquid[0], liquid[1], liquid[2], THREE.SRGBColorSpace);

    const white = new THREE.Color(1, 1, 1);
    const tint = showSample
      ? new THREE.Color().setRGB(transmitted[0], transmitted[1], transmitted[2], THREE.SRGBColorSpace)
      : white;
    const lum = showSample ? 0.2126 * transmitted[0] + 0.7152 * transmitted[1] + 0.0722 * transmitted[2] : 1;
    this.setBeam('led', on(0), white, 0.38);
    this.setBeam('cuvette', on(1), white.clone().lerp(tint, 0.5), 0.36);
    this.setBeam('post', on(2), tint, 0.34 * lum + 0.06);
    this.setBeam('tube', on(3), tint, 0.5 * lum + 0.1);
    this.setBeam('zero', on(3), tint, 0.14);

    // Fan: colour of each wavelength, opacity from the simulated intensity.
    const tints = this.fan.geometry.getAttribute('tint') as THREE.BufferAttribute;
    const alphas = this.fan.geometry.getAttribute('alpha') as THREE.BufferAttribute;
    FAN_NM.forEach((nm, i) => {
      const idx = Math.round((nm - 400) / 2);
      const level = Math.max(0, Math.min(1, (sensorIntensities[idx] ?? 0) / 235));
      const [r, g, b] = nmToRGB(nm);
      for (let k = 4 * i; k < 4 * i + 4; k++) {
        tints.setXYZ(k, r, g, b);
        alphas.setX(k, 0.6 * level);
      }
    });
    tints.needsUpdate = true;
    alphas.needsUpdate = true;
    this.fan.visible = on(3);

    if (on(4)) drawSensorFrame(this.sensorCanvas, sensorIntensities);
    else this.clearCanvas(this.sensorCanvas, '#0b0c0e');
    this.sensorTex.needsUpdate = true;
    this.drawScreen();
  }

  setScreen(screen: ScreenState) {
    this.screen = screen;
    this.drawScreen();
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.controls.dispose();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointermove', this.onMove);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat) => mat.dispose());
    });
    this.sensorTex.dispose();
    this.screenTex.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // free the GL context, browsers cap them
    el.remove();
    this.labels.domElement.remove();
  }

  // ---- Construction ------------------------------------------------------

  private build() {
    const add = (
      id: PartId,
      base: THREE.Vector3,
      explode: THREE.Vector3,
      labelAt: THREE.Vector3,
      quat?: THREE.Quaternion
    ) => {
      const group = new THREE.Group();
      group.position.copy(base);
      if (quat) group.quaternion.copy(quat);
      group.userData.part = id;
      const label = this.makeLabel(id);
      label.position.copy(labelAt);
      label.element.classList.toggle('twin-label--below', labelAt.y < 0);
      group.add(label);
      this.scene.add(group);
      this.parts.set(id, { id, group, base: base.clone(), explode, label });
      return group;
    };
    const mesh = (group: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, pick = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.userData.part = group.userData.part;
      group.add(m);
      if (pick) this.pickables.push(m);
      return m;
    };

    // Enclosure: chamber, tube and the alignment wedge — matte black card.
    const enc = add('enclosure', new THREE.Vector3(), new THREE.Vector3(0, -3.6, 0), new THREE.Vector3(6.1, 1.6, 0));
    const card = () => {
      const m = new THREE.MeshStandardMaterial({
        color: 0x1b1c1f,
        roughness: 0.9,
        side: THREE.DoubleSide,
        clippingPlanes: [this.cutPlane],
      });
      this.enclosureMats.push(m);
      return m;
    };
    mesh(enc, new RoundedBoxGeometry(2.9, 4.3, 1.9, 2, 0.05), card()).position.set(-0.5, 0.4, 0);
    mesh(enc, new RoundedBoxGeometry(10.35, 3, 3, 2, 0.05), card()).position.set(6.125, 0, 0);
    // Wedge: fills the gap between the square tube end (x = 11.3) and the
    // phone back plane through G tilted at α₀.
    const zAt = (z: number) => G.x + z * Math.tan(A0);
    const shape = new THREE.Shape([
      new THREE.Vector2(11.3, -1.5),
      new THREE.Vector2(11.3, 1.5),
      new THREE.Vector2(zAt(1.5), 1.5),
      new THREE.Vector2(Math.max(11.32, zAt(-1.5)), -1.5),
    ]);
    const wedge = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    wedge.rotateX(Math.PI / 2);
    wedge.translate(0, 1.5, 0);
    mesh(enc, wedge, card());

    // LED on its small board.
    const led = add('led', new THREE.Vector3(-1.45, 0, 0), new THREE.Vector3(-2.8, 0, 0), new THREE.Vector3(0, 0.75, 0));
    mesh(led, new THREE.BoxGeometry(0.08, 1.1, 1.1), new THREE.MeshStandardMaterial({ color: 0x24302a, roughness: 0.6 })).position.x = -0.2;
    this.ledMat = new THREE.MeshStandardMaterial({ color: 0xf6f5f0, emissive: 0xfff4e2, emissiveIntensity: 0, roughness: 0.2 });
    const body = mesh(led, new THREE.CylinderGeometry(0.2, 0.2, 0.3, 24), this.ledMat);
    body.rotation.z = Math.PI / 2;
    const dome = mesh(led, new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.ledMat);
    dome.rotation.z = -Math.PI / 2;
    dome.position.x = 0.15;
    this.ledLight = new THREE.PointLight(0xfff4e2, 0, 5, 2);
    this.ledLight.position.x = 0.4;
    led.add(this.ledLight);

    // Opal diffuser.
    const dif = add('diffuser', new THREE.Vector3(-0.85, 0, 0), new THREE.Vector3(-1.7, 0, 0), new THREE.Vector3(0, -0.7, 0));
    this.diffuserMat = new THREE.MeshStandardMaterial({
      color: 0xf2f2ee,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.8,
      roughness: 0.9,
    });
    mesh(dif, new THREE.BoxGeometry(0.04, 1.1, 1.1), this.diffuserMat);

    // 10 mm cuvette with the reacted liquid.
    const cuv = add('cuvette', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3.2, 0));
    const glass = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.05,
      depthWrite: false,
    });
    const shell = mesh(cuv, new THREE.BoxGeometry(1.25, 4.5, 1.25), glass);
    shell.position.y = 0.75;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(shell.geometry),
      new THREE.LineBasicMaterial({ color: 0xc9cdd3, transparent: true, opacity: 0.7 })
    );
    edges.position.y = 0.75;
    cuv.add(edges);
    this.liquidMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, roughness: 0.25 });
    mesh(cuv, new THREE.BoxGeometry(1.0, 2.8, 1.0), this.liquidMat).position.y = -0.05;
    mesh(cuv, new THREE.BoxGeometry(1.3, 0.25, 1.3), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6 })).position.y = 3.1;

    // Twin razor blades; the gap is drawn ×2 wider than 0.15 mm to stay visible.
    const slit = add('slit', new THREE.Vector3(0.97, 0, 0), new THREE.Vector3(1.6, 0, 0), new THREE.Vector3(0, 0.95, 0));
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.28 });
    for (const s of [-1, 1]) mesh(slit, new THREE.BoxGeometry(0.02, 1.5, 0.85), steel).position.z = s * (0.015 + 0.425);

    // Grating film, taped over the lens — its normal is the camera axis.
    const grat = add('grating', G.clone(), AXIS_C.clone().multiplyScalar(1.3), new THREE.Vector3(0, 1.0, 0), PHONE_BASIS);
    mesh(
      grat,
      new THREE.BoxGeometry(1.5, 1.5, 0.015),
      new THREE.MeshPhysicalMaterial({
        color: 0xe4e8ee,
        metalness: 0.3,
        roughness: 0.12,
        iridescence: 1,
        iridescenceIOR: 1.7,
        iridescenceThicknessRange: [250, 900],
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      })
    );

    // Image plane: scaled with focal distance so rays land where optics says.
    const sen = add(
      'sensor',
      G.clone().addScaledVector(AXIS_C, F_ASSEMBLED),
      AXIS_C.clone().multiplyScalar(5.4),
      new THREE.Vector3(0, 0.4, 0),
      PHONE_BASIS
    );
    mesh(sen, new THREE.PlaneGeometry(SENSOR_W * 1.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, side: THREE.DoubleSide }));
    const strip = mesh(
      sen,
      new THREE.PlaneGeometry(SENSOR_W, 0.4),
      new THREE.MeshBasicMaterial({ map: this.sensorTex, toneMapped: false, side: THREE.DoubleSide })
    );
    strip.position.z = 0.002;

    // Phone: landscape, lens near one end, screen facing away from the grating.
    const lens = new THREE.Vector3(-5.8, 1.9, 0);
    const phoneCenter = G.clone()
      .addScaledVector(LOCAL_X, 5.8)
      .addScaledVector(new THREE.Vector3(0, 1, 0), -1.9)
      .addScaledVector(AXIS_C, 0.64);
    const phone = add('phone', phoneCenter, AXIS_C.clone().multiplyScalar(6.6), new THREE.Vector3(lens.x, 4.3, 0), PHONE_BASIS);
    const alu = new THREE.MeshPhysicalMaterial({ color: 0x2a2c30, metalness: 0.55, roughness: 0.38, clearcoat: 0.4, transparent: true });
    const glassBlack = new THREE.MeshStandardMaterial({ color: 0x08090a, metalness: 0.4, roughness: 0.15, transparent: true });
    const screenMat = new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false, transparent: true });
    this.phoneMats.push(alu, glassBlack, screenMat);
    mesh(phone, new RoundedBoxGeometry(15, 7.4, 0.8, 4, 0.55), alu);
    mesh(phone, new THREE.PlaneGeometry(14.3, 6.8), screenMat).position.z = 0.405;
    mesh(phone, new RoundedBoxGeometry(2.5, 2.5, 0.2, 3, 0.4), alu).position.set(lens.x + 0.5, lens.y - 0.5, -0.48);
    for (const [dx, dy] of [
      [0, 0],
      [1.0, -1.0],
    ]) {
      const l = mesh(phone, new THREE.CylinderGeometry(0.38, 0.38, 0.1, 32), glassBlack);
      l.rotation.x = Math.PI / 2;
      l.position.set(lens.x + dx, lens.y + dy, -0.6);
    }

    // Light path.
    const beam = () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0.5, 0, 0);
      const m = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color(1, 1, 1) },
            uOpacity: { value: 0.4 },
            uTime: this.time,
            uLen: { value: 1 },
          },
          vertexShader: BEAM_VERT,
          fragmentShader: BEAM_FRAG,
          transparent: true,
          depthWrite: false,
        })
      );
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      return m;
    };
    this.beams = { led: beam(), cuvette: beam(), post: beam(), tube: beam(), zero: beam() };

    const fanGeo = new THREE.BufferGeometry();
    const n = FAN_NM.length;
    // Per wavelength: apex top/bottom at the grating, landing top/bottom on
    // the image plane. Top + bottom sheets make the fan read from above; a
    // vertical ribbon every 20 nm makes it read from the side.
    fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
    fanGeo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
    fanGeo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n * 4), 1));
    fanGeo.setAttribute('u', new THREE.BufferAttribute(new Float32Array(Array.from({ length: n * 4 }, (_, k) => (k % 4 < 2 ? 0 : 1))), 1));
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = 4 * i;
      if (i < n - 1) {
        const b = a + 4;
        index.push(a, a + 2, b, a + 2, b + 2, b); // top sheet
        index.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); // bottom sheet
      }
      if (i % 4 === 0) index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // ribbon
    }
    fanGeo.setIndex(index);
    this.fanMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time, uLen: { value: 1 }, uOpacity: { value: 1 } },
      vertexShader: FAN_VERT,
      fragmentShader: FAN_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.fan = new THREE.Mesh(fanGeo, this.fanMat);
    this.fan.frustumCulled = false;
    this.fan.visible = false;
    this.fan.renderOrder = 3;
    this.scene.add(this.fan);

    for (const nm of TICK_NM) {
      const el = document.createElement('div');
      el.className = 'twin-tick';
      el.textContent = `${nm}`;
      const tick = new CSS2DObject(el);
      tick.userData.nm = nm;
      this.ticks.push(tick);
      this.scene.add(tick);
    }

    // Soft contact shadow — a gradient, not a shadow map.
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(22,24,29,0.28)');
    grad.addColorStop(1, 'rgba(22,24,29,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(30, 20, 1);
    shadow.position.set(6.5, -7.2, -3.5);
    this.scene.add(shadow);

    this.updateLabels();
  }

  private makeLabel(id: PartId) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'twin-label';
    el.innerHTML = `<span class="twin-label__text"></span>`;
    el.querySelector('span')!.textContent = LABEL_TEXT[id];
    el.addEventListener('click', () => this.onSelect(id));
    return new CSS2DObject(el);
  }

  private updateLabels() {
    for (const p of this.parts.values()) {
      const show = this.view !== 'sensor' && (this.mode === 'exploded' || this.selected === p.id);
      p.label.visible = show;
      p.label.element.classList.toggle('is-selected', this.selected === p.id);
    }
  }

  // ---- Per-frame ---------------------------------------------------------

  private frame = () => {
    if (this.disposed) return;
    const dt = Math.min(0.1, this.clock.getDelta());
    if (!this.reduceMotion) this.time.value += dt;
    const k = this.reduceMotion ? 1 : 1 - Math.exp(-dt * 5);

    // Explode / cutaway / ghosting ease toward their targets.
    this.explodeT += ((this.mode === 'exploded' ? 1 : 0) - this.explodeT) * k;
    this.cutK += ((this.mode === 'normal' ? 4 : 0) - this.cutK) * k;
    this.cutPlane.constant = this.cutK;
    const ghostTarget = this.view === 'sensor' ? 0.14 : 1;
    this.phoneGhost += (ghostTarget - this.phoneGhost) * k;
    for (const m of this.phoneMats) {
      m.opacity = this.phoneGhost;
      m.depthWrite = this.phoneGhost > 0.95;
    }

    const e = ease(Math.min(1, Math.max(0, this.explodeT)));
    for (const p of this.parts.values()) p.group.position.copy(p.base).addScaledVector(p.explode, e);

    this.layoutLight();

    if (this.selected) {
      this.selectBox.setFromObject(this.parts.get(this.selected)!.group, true).expandByScalar(0.08);
      this.selectHelper.visible = true;
    } else {
      this.selectHelper.visible = false;
    }

    if (this.tween) {
      const t = (this.tween.t = Math.min(1, this.tween.t + dt / 1.1));
      const s = ease(t);
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, s);
      this.controls.target.lerpVectors(this.tween.fromTgt, this.tween.toTgt, s);
      if (t >= 1) this.tween = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  private pos(id: PartId) {
    return this.parts.get(id)!.group.position;
  }

  private layoutLight() {
    const led = this.pos('led').clone().add(new THREE.Vector3(0.32, 0, 0));
    const dif = this.pos('diffuser');
    const cuv = this.pos('cuvette');
    const slit = this.pos('slit');
    const grat = this.pos('grating');
    const sensor = this.pos('sensor');
    const f = Math.max(0.05, sensor.clone().sub(grat).dot(AXIS_C));

    this.place(this.beams.led, led, dif, 0.9, 0.7);
    this.place(this.beams.cuvette, dif, cuv, 1.0, 0.8);
    this.place(this.beams.post, cuv, slit, 1.0, 0.8);
    this.place(this.beams.tube, slit, grat, 1.0, 0.05);
    this.place(this.beams.zero, grat, grat.clone().add(new THREE.Vector3(1.4, 0, 0)), 0.5, 0.03);

    // Fan from the grating to the image plane at focal distance f.
    const posAttr = this.fan.geometry.getAttribute('position') as THREE.BufferAttribute;
    FAN_NM.forEach((nm, i) => {
      const land = sensor.clone().addScaledVector(LOCAL_X, f * sensorX(nm));
      const start = grat.clone().addScaledVector(rayDir(nm), 0.02);
      posAttr.setXYZ(4 * i, start.x, 0.3, start.z);
      posAttr.setXYZ(4 * i + 1, start.x, -0.3, start.z);
      posAttr.setXYZ(4 * i + 2, land.x, 0.2, land.z);
      posAttr.setXYZ(4 * i + 3, land.x, -0.2, land.z);
    });
    posAttr.needsUpdate = true;
    this.fanMat.uniforms.uLen.value = f;

    const sensorGroup = this.parts.get('sensor')!.group;
    sensorGroup.scale.set(f, Math.min(1, f), 1);

    const showTicks = this.view === 'sensor';
    for (const t of this.ticks) {
      t.visible = showTicks;
      t.position
        .copy(sensor)
        .addScaledVector(LOCAL_X, f * sensorX(t.userData.nm))
        .add(new THREE.Vector3(0, -0.2 * Math.min(1, f), 0));
    }
  }

  private place(m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, h: number, w: number) {
    const d = to.clone().sub(from);
    const len = d.length();
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    m.scale.set(Math.max(1e-3, len), h, w);
    (m.material as THREE.ShaderMaterial).uniforms.uLen.value = len;
  }

  private setBeam(key: BeamKey, visible: boolean, color: THREE.Color, opacity: number) {
    const m = this.beams[key];
    m.visible = visible;
    const u = (m.material as THREE.ShaderMaterial).uniforms;
    u.uColor.value.copy(color);
    u.uOpacity.value = opacity;
  }

  // ---- Camera ------------------------------------------------------------

  private viewPose(view: Exclude<ViewId, 'free'>): [THREE.Vector3, THREE.Vector3] {
    // Portrait stages pull the camera back instead of cropping the instrument.
    const wide = (this.mode === 'exploded' ? (this.hardwareOnly ? 1.15 : 1.6) : 1) * Math.max(1, 1.6 / this.camera.aspect);
    const around = (tgt: THREE.Vector3, offset: THREE.Vector3) => [tgt.clone().addScaledVector(offset, wide), tgt] as [THREE.Vector3, THREE.Vector3];
    switch (view) {
      case 'front':
        return around(new THREE.Vector3(6.5, -1, -3), new THREE.Vector3(0, 1.5, 27));
      case 'top':
        return around(new THREE.Vector3(6.5, 0, -3.5), new THREE.Vector3(0, 30, 0.01));
      case 'side':
        return around(new THREE.Vector3(5, -0.5, -2), new THREE.Vector3(-21, 4, 3.5));
      case 'optical': {
        const t = new THREE.Vector3(this.mode === 'exploded' ? 7.5 : 6.5, 0, -0.5);
        return [t.clone().add(new THREE.Vector3(-1.5, 9, 10).multiplyScalar(wide)), t];
      }
      case 'sensor': {
        const s = this.parts.get('sensor')!;
        // Final (not current) sensor position, so the flight lands correctly.
        const sensor = s.base.clone().addScaledVector(s.explode, this.mode === 'exploded' ? 1 : 0);
        const dist = this.mode === 'exploded' ? 2.6 : 0.9;
        return [sensor.clone().addScaledVector(AXIS_C, dist).add(new THREE.Vector3(0, 0.25 * dist, 0)), sensor];
      }
      default:
        if (this.hardwareOnly)
          return around(new THREE.Vector3(this.mode === 'exploded' ? 9.5 : 6, -0.8, -0.8), new THREE.Vector3(5, 7, 18));
        return around(new THREE.Vector3(this.mode === 'exploded' ? 9.5 : 7.5, -1.2, -3), new THREE.Vector3(7, 9, 21));
    }
  }

  private flyTo(view: Exclude<ViewId, 'free'>) {
    const [toPos, toTgt] = this.viewPose(view);
    this.tween = {
      fromPos: this.camera.position.clone(),
      fromTgt: this.controls.target.clone(),
      toPos,
      toTgt,
      t: this.reduceMotion ? 1 : 0,
    };
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Re-frame the active preset for the new aspect (a free camera is left alone).
    if (this.view !== 'free') {
      const [pos, tgt] = this.viewPose(this.view);
      this.camera.position.copy(pos);
      this.controls.target.copy(tgt);
      this.tween = null;
    }
  }

  // ---- Picking -----------------------------------------------------------

  private raycaster = new THREE.Raycaster();
  private pick(ev: PointerEvent): PartId | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    // Skip enclosure faces that are clipped away in cutaway.
    const hit = hits.find((h) => h.object.userData.part !== 'enclosure' || h.point.z <= this.cutK + 1e-3);
    return (hit?.object.userData.part as PartId) ?? null;
  }

  private onDown = (ev: PointerEvent) => {
    this.downAt = { x: ev.clientX, y: ev.clientY };
  };
  private onUp = (ev: PointerEvent) => {
    if (!this.downAt) return;
    const moved = Math.hypot(ev.clientX - this.downAt.x, ev.clientY - this.downAt.y);
    this.downAt = null;
    if (moved < 5) this.onSelect(this.pick(ev));
  };
  private onMove = (ev: PointerEvent) => {
    if (ev.buttons) return;
    this.renderer.domElement.style.cursor = this.pick(ev) ? 'pointer' : 'grab';
  };

  // ---- Canvases ----------------------------------------------------------

  private clearCanvas(c: HTMLCanvasElement, color: string) {
    const g = c.getContext('2d');
    if (!g) return;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
  }

  /** The phone screen mirrors the twin's own result, labelled SIMULATED. */
  private drawScreen() {
    const g = this.screenCanvas.getContext('2d');
    if (!g) return;
    const { width: w, height: h } = this.screenCanvas;
    g.fillStyle = '#0e0f11';
    g.fillRect(0, 0, w, h);
    g.font = '600 26px -apple-system, "SF Pro Text", Inter, sans-serif';
    g.fillStyle = 'rgba(242,241,238,0.9)';
    g.fillText('LISA', 48, 62);
    g.fillStyle = 'rgba(242,241,238,0.5)';
    g.font = '500 20px -apple-system, "SF Pro Text", Inter, sans-serif';
    g.fillText(`SIMULATED · ${this.screen?.id ?? ''}`, 118, 62);
    g.drawImage(this.sensorCanvas, 48, 100, w - 96, 64);
    if (this.screen) {
      const tone = { pass: '#6fcf9f', caution: '#e2b35c', alert: '#ee8079', neutral: 'rgba(242,241,238,0.9)' }[this.screen.tone];
      g.fillStyle = tone;
      g.font = '600 92px -apple-system, "SF Pro Display", Inter, sans-serif';
      g.fillText(this.screen.headline, 48, 300);
      g.fillStyle = 'rgba(242,241,238,0.62)';
      g.font = '500 28px -apple-system, "SF Pro Text", Inter, sans-serif';
      g.fillText(this.screen.sub, 52, 360);
    }
    this.screenTex.needsUpdate = true;
  }
}
