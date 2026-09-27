// Урок 2. Трансформ: позиция, поворот и масштаб объекта.
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
  createStage, addGrid, addLights, addShadowFloor, makeAxes,
  loadRobot, Animator, fmt, bindSeg, setStatus,
} from './core.js';

export async function initTransform(section) {
  const view = section.querySelector('.view');
  const stage = createStage(view, { camPos: [2.8, 2.4, 4], target: [0, 0.85, 0], shadows: true });
  const { scene, camera, renderer, controls } = stage;

  addGrid(scene, 10, 10);
  addLights(scene, { shadows: true });
  addShadowFloor(scene, 10);
  const worldAxes = makeAxes(0.8, 0.015);
  worldAxes.position.set(-3.5, 0.01, -3.5); // маленькие оси мира в углу
  scene.add(worldAxes);

  setStatus(view, 'Загружаю робота…');
  const { root, model, clips } = await loadRobot(1.8);
  setStatus(view, null);
  scene.add(root);
  const anim = new Animator(model, clips);
  anim.play('Idle');
  stage.onFrame((dt) => anim.update(dt));

  // Манипулятор: стрелки, кольца и кубики, как в редакторах движков
  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.attach(root);
  scene.add(gizmo.getHelper());
  gizmo.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });
  gizmo.addEventListener('objectChange', show);

  /* ---------- Табло ---------- */
  const cell = (name) => section.querySelector(`[data-out="${name}"]`);
  const cells = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'].map(cell);
  const deg = THREE.MathUtils.radToDeg;

  function show() {
    const p = root.position, r = root.rotation, s = root.scale;
    const values = [
      fmt(p.x), fmt(p.y), fmt(p.z),
      fmt(deg(r.x), 0), fmt(deg(r.y), 0), fmt(deg(r.z), 0),
      fmt(s.x), fmt(s.y), fmt(s.z),
    ];
    cells.forEach((el, i) => { el.textContent = values[i]; });
  }
  show();

  /* ---------- Режимы ---------- */
  const buttons = [...section.querySelectorAll('[data-mode]')];
  const selectMode = bindSeg(buttons, (btn) => gizmo.setMode(btn.dataset.mode));

  // W, E, R - как в Unity. Смотрим на физическую клавишу, поэтому работает и в русской раскладке.
  const hotkeys = { KeyW: 'translate', KeyE: 'rotate', KeyR: 'scale' };
  view.addEventListener('keydown', (e) => {
    const mode = hotkeys[e.code];
    if (!mode) return;
    e.preventDefault();
    selectMode(buttons.find((b) => b.dataset.mode === mode));
  });
  view.addEventListener('pointerdown', () => view.focus({ preventScroll: true }));

  section.querySelector('[data-action="reset"]').addEventListener('click', () => {
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    show();
  });
}
