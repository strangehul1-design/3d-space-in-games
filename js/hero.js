// Первый экран: клик по полу - робот идёт в эту точку.
// Главная идея - рейкаст: луч из камеры через курсор ищет пересечение с полом.
import * as THREE from 'three';
import {
  AXIS, createStage, addGrid, addLights, addShadowFloor, makeAxes,
  loadRobot, Animator, fmt, lerpAngle, setStatus,
} from './core.js';

const WALK_SPEED = 1.6; // метров в секунду

export async function initHero(section) {
  const view = section.querySelector('.view');
  const wide = matchMedia('(min-width: 901px)').matches;
  // На широком экране сдвигаем центр влево, чтобы робот стоял справа от заголовка
  const stage = createStage(view, {
    camPos: wide ? [2.6, 4, 8.6] : [4.5, 4.6, 8.5],
    target: wide ? [-2.6, 0.7, 0] : [0, 0.7, 0],
    shadows: true,
  });
  const { scene, camera, renderer } = stage;

  addGrid(scene, 40, 40);
  addLights(scene, { shadows: true });
  const floor = addShadowFloor(scene, 40);
  scene.add(makeAxes(2.2));

  // Кольцо под курсором и метка цели
  const ring = (color, opacity) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.32, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    return m;
  };
  const cursor = ring(0xffffff, 0.85);
  const goal = ring(AXIS.y, 1);

  setStatus(view, 'Загружаю робота…');
  const { root, model, clips } = await loadRobot(1.8);
  setStatus(view, null);
  scene.add(root);
  const anim = new Animator(model, clips);
  anim.playOnce('Wave', 'Idle'); // робот здоровается

  /* ---------- Рейкаст ---------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const out = {
    x: section.querySelector('[data-out="x"]'),
    y: section.querySelector('[data-out="y"]'),
    z: section.querySelector('[data-out="z"]'),
  };

  function pickFloor(e) {
    const r = renderer.domElement.getBoundingClientRect();
    // Координаты мыши в диапазоне от -1 до 1 - так их понимает камера
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(floor)[0]?.point ?? null;
  }

  const canvas = renderer.domElement;
  canvas.addEventListener('pointermove', (e) => {
    const p = pickFloor(e);
    cursor.visible = !!p;
    if (!p) return;
    cursor.position.set(p.x, 0.01, p.z);
    out.x.textContent = fmt(p.x);
    out.y.textContent = fmt(p.y);
    out.z.textContent = fmt(p.z);
  });
  canvas.addEventListener('pointerleave', () => { cursor.visible = false; });

  // Клик от поворота камеры отличаем по тому, насколько сдвинулась мышь
  const target = new THREE.Vector3();
  let walking = false;
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const p = pickFloor(e);
    if (!p) return;
    target.set(p.x, 0, p.z);
    goal.position.set(p.x, 0.012, p.z);
    goal.visible = true;
    walking = true;
    anim.play('Walking');
  });

  /* ---------- Каждый кадр ---------- */
  const toGoal = new THREE.Vector3();
  stage.onFrame((dt, time) => {
    anim.update(dt);
    goal.scale.setScalar(1 + Math.sin(time * 6) * 0.08);
    if (!walking) return;

    toGoal.subVectors(target, root.position);
    const dist = toGoal.length();
    if (dist < 0.05) {
      walking = false;
      goal.visible = false;
      anim.play('Idle');
      return;
    }
    // Поворачиваемся к цели и шагаем: скорость × время кадра
    root.rotation.y = lerpAngle(root.rotation.y, Math.atan2(toGoal.x, toGoal.z), Math.min(1, dt * 10));
    root.position.addScaledVector(toGoal.normalize(), Math.min(dist, WALK_SPEED * dt));
  });
}
