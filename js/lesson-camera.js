// Урок 5. Камера: угол обзора, пирамида видимости (frustum) и отсечение лишнего.
import * as THREE from 'three';
import { createStage, addGrid, addLights, bindSeg, bindSlider } from './core.js';

const ASPECT = 16 / 9;        // пропорции экрана игрока
const HIDDEN_COLOR = 0x5a6b85; // так красим то, что камера не рисует
const HELPER_LAYER = 1;       // слой «только для вида сбоку»

// Декорации: [форма, x, z, цвет]
const PROPS = [
  ['tree', -2, 0, 0x35b562], ['rock', 1.5, 1.5, 0x9aa9bf], ['gem', 0, -3, 0x4c8dff],
  ['tree', 3, -5, 0x35b562], ['tree', -4.5, -4, 0x2f9e57], ['rock', -1, -7, 0x9aa9bf],
  ['gem', 5.5, -1, 0xff7aa8], ['tree', -7, 1, 0x35b562], ['rock', 7, 2.5, 0x9aa9bf],
  ['tree', 1, -11, 0x2f9e57], ['gem', -3, -12, 0xffc53d], ['rock', 8, -8, 0x9aa9bf],
];

function makeProp(kind, color) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
  if (kind === 'tree') {
    const g = new THREE.ConeGeometry(0.7, 2, 7);
    g.translate(0, 1, 0);
    return new THREE.Mesh(g, material);
  }
  if (kind === 'rock') {
    const g = new THREE.DodecahedronGeometry(0.6);
    g.translate(0, 0.4, 0);
    return new THREE.Mesh(g, material);
  }
  const g = new THREE.OctahedronGeometry(0.45);
  g.translate(0, 0.9, 0);
  return new THREE.Mesh(g, material);
}

export function initCamera(section) {
  const view = section.querySelector('.view');
  const stage = createStage(view, { camPos: [13, 11, 12], target: [0, 0, -3] });
  const { scene, renderer, camera: sideCamera } = stage;
  sideCamera.layers.enable(HELPER_LAYER);

  addGrid(scene, 34, 34);
  addLights(scene);

  const props = PROPS.map(([kind, x, z, color]) => {
    const mesh = makeProp(kind, color);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    return { mesh, color: new THREE.Color(color) };
  });

  /* ---------- Камера игрока ---------- */
  const rig = new THREE.Object3D(); // штатив: двигаем и поворачиваем его
  rig.position.set(0, 1.6, 6);
  scene.add(rig);

  const persp = new THREE.PerspectiveCamera(50, ASPECT, 0.5, 16);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 16);
  rig.add(persp, ortho);

  // Корпус камеры, чтобы её было видно со стороны. Сама себя она не видит.
  const body = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe4ecf7, roughness: 0.5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.6), bodyMat);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.25, 20), bodyMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.4;
  body.add(box, lens);
  rig.add(body);

  const helpers = { persp: new THREE.CameraHelper(persp), ortho: new THREE.CameraHelper(ortho) };
  const yellow = new THREE.Color(0xffc53d);
  for (const h of Object.values(helpers)) {
    h.setColors(yellow, yellow, new THREE.Color(0x7eaeff), new THREE.Color(0xffffff), new THREE.Color(0x7f9cc6));
    scene.add(h);
  }
  body.traverse((o) => o.layers.set(HELPER_LAYER));
  Object.values(helpers).forEach((h) => h.layers.set(HELPER_LAYER));

  let active = persp;
  let fov = 50;

  function applyLens() {
    persp.fov = fov;
    persp.updateProjectionMatrix();
    // Ортографии задаём такую высоту кадра, как у перспективы на расстоянии 6 м
    const halfH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 6;
    ortho.top = halfH; ortho.bottom = -halfH;
    ortho.left = -halfH * ASPECT; ortho.right = halfH * ASPECT;
    ortho.updateProjectionMatrix();
    helpers.persp.update();
    helpers.ortho.update();
    helpers.persp.visible = active === persp;
    helpers.ortho.visible = active === ortho;
  }

  bindSlider(section.querySelector('[data-fov]'), (v) => { fov = v; applyLens(); }, 0);
  bindSlider(section.querySelector('[data-yaw]'), (v) => { rig.rotation.y = THREE.MathUtils.degToRad(-v); }, 0);
  bindSeg([...section.querySelectorAll('[data-cam]')], (btn) => {
    active = btn.dataset.cam === 'ortho' ? ortho : persp;
    applyLens();
  });

  /* ---------- Что попадает в пирамиду ---------- */
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4();
  const visibleOut = section.querySelector('[data-out="visible"]');
  section.querySelector('[data-out="total"]').textContent = props.length;

  stage.onFrame(() => {
    scene.updateMatrixWorld();
    matrix.multiplyMatrices(active.projectionMatrix, active.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    let visible = 0;
    for (const p of props) {
      const inside = frustum.intersectsObject(p.mesh);
      p.mesh.material.color.set(inside ? p.color : HIDDEN_COLOR);
      if (inside) visible++;
    }
    visibleOut.textContent = visible;
  });

  /* ---------- Два окна в одном холсте ---------- */
  const insetFrame = view.querySelector('.inset');
  stage.render = () => {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, stage.width, stage.height);
    renderer.render(scene, sideCamera);

    // Маленькое окно рисуем ровно под рамкой из CSS
    const v = view.getBoundingClientRect();
    const r = insetFrame.getBoundingClientRect();
    const x = r.left - v.left;
    const y = v.bottom - r.bottom; // у WebGL отсчёт снизу
    renderer.setScissorTest(true);
    renderer.setScissor(x, y, r.width, r.height);
    renderer.setViewport(x, y, r.width, r.height);
    renderer.render(scene, active);
    renderer.setScissorTest(false);
  };
}
