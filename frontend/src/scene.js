import * as THREE from 'three';

const DEFAULT = '#7c5cff';
const BG = 0x0b0b14;

// A calm field of dots that ripples like a wave and reacts to the mouse.
export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 18, 55);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 7, 16);
  camera.lookAt(0, 0, 0);

  const COLS = 90, ROWS = 60, GAP = 0.6;
  const pos = new Float32Array(COLS * ROWS * 3);
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const k = (i * ROWS + j) * 3;
      pos[k] = (i - COLS / 2) * GAP;
      pos[k + 2] = (j - ROWS / 2) * GAP;
    }
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  const mat = new THREE.PointsMaterial({ size: 0.09, color: DEFAULT, transparent: true, opacity: 0.9 });
  scene.add(new THREE.Points(geo, mat));

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: 0, y: 0 };
  const target = new THREE.Color(DEFAULT);
  let pulseV = 0;

  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  });

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  (function frame() {
    const t = reduce ? 0 : clock.getElapsedTime();
    const amp = 0.7 + pulseV * 0.6;
    const mx = mouse.x * 18, mz = mouse.y * 12;
    for (let k = 0; k < pos.length; k += 3) {
      const x = pos[k], z = pos[k + 2];
      const d2 = (x - mx) ** 2 + (z - mz) ** 2;
      pos[k + 1] =
        Math.sin(x * 0.35 + t * 0.8) * amp +
        Math.cos(z * 0.4 + t * 0.6) * amp +
        Math.exp(-d2 / 18) * Math.sin(Math.sqrt(d2) * 1.6 - t * 3) * 1.2;
    }
    attr.needsUpdate = true;
    pulseV *= 0.94;
    mat.color.lerp(target, 0.06);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  })();

  return {
    setAccent: (css) => target.set(css || DEFAULT),
    pulse: () => { pulseV = 1; },
  };
}
