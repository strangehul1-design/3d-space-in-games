// Общие детали для всех 3D-сцен на странице:
// окно со сценой, оси, сетка, свет, робот и его анимации.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Цвета осей, как во всех 3D-редакторах: X красная, Y зелёная, Z синяя
export const AXIS = { x: 0xe5484d, y: 0x35b562, z: 0x4c8dff };
export const VIEW_BG = 0x0f2240;
const GRID_CENTER = 0x3d5c8a;
const GRID_LINES = 0x21395c;

// Человек попросил систему поменьше анимаций - не крутим декорации сами по себе
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Один общий игровой цикл на всю страницу ---------- */
const stages = new Set();
let last = performance.now();

function loop(now) {
  // dt - сколько секунд прошло с прошлого кадра. Ограничиваем 0.1 с,
  // чтобы после переключения вкладки робот не телепортировался.
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  for (const stage of stages) {
    if (stage.visible) stage.tick(dt, now / 1000);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- Окно со сценой ---------- */
export function createStage(container, options = {}) {
  const {
    camPos = [6, 5, 8],
    target = [0, 0, 0],
    fov = 45,
    shadows = false,
    orbit = true,
  } = options;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VIEW_BG);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  camera.position.set(...camPos);

  let controls = null;
  if (orbit) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...target);
    controls.enableDamping = true;
    controls.enableZoom = false; // колесо мыши листает страницу, а не приближает сцену
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.49; // не даём заглянуть под пол
    controls.update();
  } else {
    camera.lookAt(...target);
  }

  const updaters = [];
  const stage = {
    renderer, scene, camera, controls, container,
    visible: false,
    width: 1,
    height: 1,
    onFrame(fn) { updaters.push(fn); },
    render() { renderer.render(scene, camera); },
    tick(dt, time) {
      for (const fn of updaters) fn(dt, time);
      controls?.update();
      stage.render();
    },
  };

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    stage.width = w;
    stage.height = h;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  // Рисуем сцену, только пока её видно - так страница не тормозит
  new IntersectionObserver(([entry]) => { stage.visible = entry.isIntersecting; })
    .observe(container);

  stages.add(stage);
  return stage;
}

/* ---------- Сетка, свет, пол ---------- */
export function addGrid(scene, size = 20, divisions = 20) {
  const grid = new THREE.GridHelper(size, divisions, GRID_CENTER, GRID_LINES);
  scene.add(grid);
  return grid;
}

export function addLights(scene, { shadows = false, shadowSize = 10 } = {}) {
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x1b2f52, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(5, 10, 6);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -shadowSize;
    cam.right = cam.top = shadowSize;
    cam.near = 1;
    cam.far = 40;
    sun.shadow.bias = -0.0005;
  }
  scene.add(sun);
  return sun;
}

// Прозрачный пол: сам не виден, но на нём видны тени
export function addShadowFloor(scene, size = 30) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return floor;
}

/* ---------- Оси со стрелками и подписями ---------- */
export function makeAxes(length = 4, radius = 0.03) {
  const group = new THREE.Group();
  for (const name of ['x', 'y', 'z']) {
    const material = new THREE.MeshBasicMaterial({ color: AXIS[name] });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.5, radius * 10, 16), material);
    shaft.position.y = length / 2;
    tip.position.y = length + radius * 5;

    const label = makeLabel(name.toUpperCase(), AXIS[name]);
    label.position.y = length + radius * 20;

    // Цилиндр по умолчанию смотрит вверх, по Y. Поворачиваем «руку» к своей оси.
    const arm = new THREE.Group();
    arm.add(shaft, tip, label);
    if (name === 'x') arm.rotation.z = -Math.PI / 2;
    if (name === 'z') arm.rotation.x = Math.PI / 2;
    group.add(arm);
  }
  return group;
}

// Текстовая подпись, которая всегда повёрнута к камере (спрайт)
export function makeLabel(text, color = 0xffffff, size = 0.5) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 80px Unbounded, sans-serif';
  ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.setScalar(size);
  sprite.renderOrder = 10;
  return sprite;
}

/* ---------- Робот ---------- */
// Модель лежит в открытом репозитории three.js. Если первый адрес не ответит, берём второй.
const ROBOT_URLS = [
  'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
  'https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
];
let robotSource = null;

function loadRobotSource() {
  robotSource ??= (async () => {
    const loader = new GLTFLoader();
    for (const url of ROBOT_URLS) {
      try {
        return await loader.loadAsync(url);
      } catch {
        console.warn('Модель не загрузилась:', url);
      }
    }
    return null;
  })();
  return robotSource;
}

// Возвращает робота нужной высоты. root - то, что двигаем; model - то, что анимируем.
// Без интернета получится простой робот из кубиков.
export async function loadRobot(height = 1.8) {
  const gltf = await loadRobotSource();
  const root = new THREE.Group();

  if (!gltf) {
    const model = makeBlockRobot();
    model.scale.setScalar(height / 1.8);
    root.add(model);
    return { root, model, clips: [] };
  }

  const model = SkeletonUtils.clone(gltf.scene); // у каждой сцены свой робот
  model.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  // Меряем высоту только по жёстким частям. У кистей (SkinnedMesh) сырые размеры
  // в «единицах скелета» - в сто раз больше, с ними робот сжался бы до муравья.
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  model.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  model.scale.setScalar(height / (box.max.y - box.min.y));
  root.add(model);
  return { root, model, clips: gltf.animations };
}

function makeBlockRobot() {
  const robot = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xffc53d, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.6 });
  const part = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    robot.add(m);
  };
  part(0.7, 0.8, 0.45, body, 0, 1.05, 0);    // корпус
  part(0.5, 0.4, 0.45, body, 0, 1.65, 0);    // голова
  part(0.34, 0.08, 0.02, dark, 0, 1.68, 0.23); // визор
  part(0.22, 0.65, 0.25, dark, -0.18, 0.33, 0); // ноги
  part(0.22, 0.65, 0.25, dark, 0.18, 0.33, 0);
  part(0.16, 0.6, 0.16, dark, -0.47, 1.05, 0);  // руки
  part(0.16, 0.6, 0.16, dark, 0.47, 1.05, 0);
  return robot;
}

// Плавно переключает анимации робота: Idle, Walking, Running, Wave, Dance...
export class Animator {
  constructor(model, clips) {
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of clips) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;
  }

  play(name, fade = 0.25) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = next;
  }

  // Проиграть один раз и вернуться к другой анимации
  playOnce(name, then = 'Idle') {
    const action = this.actions[name];
    if (!action) return this.play(then);
    this.play(name);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    const done = (e) => {
      if (e.action !== action) return;
      this.mixer.removeEventListener('finished', done);
      if (this.current === action) this.play(then);
    };
    this.mixer.addEventListener('finished', done);
  }

  update(dt) { this.mixer.update(dt); }
}

/* ---------- Мелочи ---------- */
// Число для табло: 2 знака, настоящий минус вместо дефиса
export function fmt(n, digits = 2) {
  const s = (Math.abs(n) < 0.5 * 10 ** -digits ? 0 : n).toFixed(digits);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}

// Поворот по кратчайшему пути: из 350° в 10° - через 0°, а не назад через 180°
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function setStatus(container, text) {
  let el = container.querySelector('.view-status');
  if (!text) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('p');
    el.className = 'view-status';
    container.append(el);
  }
  el.textContent = text;
}

// Подключает ползунок: при движении вызывает fn(число) и пишет значение в <output>
export function bindSlider(input, fn, digits = 2) {
  const out = input.parentElement.querySelector('output');
  const update = () => {
    const v = parseFloat(input.value);
    if (out) out.textContent = fmt(v, digits);
    fn(v);
  };
  input.addEventListener('input', update);
  update();
  return update;
}

// Группа кнопок, из которых нажата одна
export function bindSeg(buttons, fn) {
  const select = (btn) => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
    fn(btn);
  };
  for (const b of buttons) b.addEventListener('click', () => select(b));
  return select;
}
