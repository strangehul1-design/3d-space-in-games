// Урок 7. Игровой цикл: ввод → движение (скорость × dt) → столкновения → картинка.
import * as THREE from 'three';
import {
  createStage, addGrid, addLights, addShadowFloor,
  loadRobot, Animator, fmt, lerpAngle, bindSlider, setStatus,
} from './core.js';

const WALK = 2.2;          // м/с шагом
const RUN = 5;             // м/с бегом
const ARENA = 9.5;         // край поля
const PICK_DISTANCE = 0.9; // ближе этого - кристалл собран
const CRYSTALS = [[4, -3], [-5, -5], [-6, 4], [6, 5], [0, -8]];
const CAMERA_OFFSET = new THREE.Vector3(0, 6.5, 7.5); // камера висит сзади и сверху

const KEY_DIRS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};
const RUN_KEYS = ['ShiftLeft', 'ShiftRight'];

export async function initLoop(section) {
  const view = section.querySelector('.view');
  const stage = createStage(view, { camPos: [0, 6.5, 7.5], target: [0, 0.8, 0], shadows: true, orbit: false });
  const { scene, camera } = stage;

  addGrid(scene, 20, 20);
  addLights(scene, { shadows: true, shadowSize: 12 });
  addShadowFloor(scene, 24);

  // Бортик по краю поля
  const border = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-ARENA, 0.02, -ARENA), new THREE.Vector3(ARENA, 0.02, -ARENA),
      new THREE.Vector3(ARENA, 0.02, ARENA), new THREE.Vector3(-ARENA, 0.02, ARENA),
    ]),
    new THREE.LineBasicMaterial({ color: 0x7eaeff }),
  );
  scene.add(border);

  // Кристаллы
  const crystals = CRYSTALS.map(([x, z]) => {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({ color: 0xffc53d, emissive: 0x7a4a00, roughness: 0.3, flatShading: true }),
    );
    mesh.position.set(x, 0.7, z);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  });

  setStatus(view, 'Загружаю робота…');
  const { root, model, clips } = await loadRobot(1.6);
  setStatus(view, null);
  scene.add(root);
  const anim = new Animator(model, clips);
  anim.play('Idle');

  /* ---------- Ввод: клавиатура и кнопки на экране ---------- */
  const keys = new Set();
  const isGameKey = (code) => code in KEY_DIRS || RUN_KEYS.includes(code);
  view.addEventListener('keydown', (e) => {
    if (!isGameKey(e.code)) return;
    e.preventDefault(); // стрелки не листают страницу, пока играешь
    keys.add(e.code);
  });
  view.addEventListener('keyup', (e) => keys.delete(e.code));
  view.addEventListener('blur', () => keys.clear());
  view.addEventListener('pointerdown', () => view.focus({ preventScroll: true }));

  for (const btn of section.querySelectorAll('[data-key]')) {
    const code = btn.dataset.key;
    const press = (e) => { e.preventDefault(); keys.add(code); btn.classList.add('is-down'); };
    const release = () => { keys.delete(code); btn.classList.remove('is-down'); };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  }

  /* ---------- Табло и кнопки ---------- */
  const out = {};
  for (const k of ['fps', 'dt', 'x', 'z', 'gems', 'gemsTotal', 'msg']) {
    out[k] = section.querySelector(`[data-out="${k}"]`);
  }
  out.gemsTotal.textContent = crystals.length;

  let timeScale = 1;
  bindSlider(section.querySelector('[data-timescale]'), (v) => { timeScale = v; });

  let collected = 0;
  let celebrating = false;
  function restart() {
    collected = 0;
    celebrating = false;
    crystals.forEach((c) => { c.visible = true; });
    root.position.set(0, 0, 0);
    root.rotation.y = 0;
    out.gems.textContent = 0;
    out.msg.hidden = true;
    anim.play('Idle');
  }
  section.querySelector('[data-action="restart"]').addEventListener('click', restart);
  restart();

  /* ---------- Сам игровой цикл ---------- */
  const dir = new THREE.Vector3();
  const camGoal = new THREE.Vector3();
  let fps = 60;
  let sinceReadout = 0;

  stage.onFrame((realDt, time) => {
    const dt = realDt * timeScale; // игровое время может идти медленнее настоящего

    // 1. Ввод: складываем направления всех нажатых клавиш
    dir.set(0, 0, 0);
    for (const code of keys) {
      const d = KEY_DIRS[code];
      if (d) { dir.x += d[0]; dir.z += d[1]; }
    }
    const moving = dir.lengthSq() > 0;
    const running = RUN_KEYS.some((k) => keys.has(k));

    // 2. Движение: позиция += направление × скорость × dt
    if (moving) {
      dir.normalize();
      root.position.addScaledVector(dir, (running ? RUN : WALK) * dt);
      root.position.x = THREE.MathUtils.clamp(root.position.x, -ARENA, ARENA);
      root.position.z = THREE.MathUtils.clamp(root.position.z, -ARENA, ARENA);
      root.rotation.y = lerpAngle(root.rotation.y, Math.atan2(dir.x, dir.z), Math.min(1, dt * 12));
      celebrating = false;
      anim.play(running ? 'Running' : 'Walking');
    } else if (!celebrating) {
      anim.play('Idle');
    }
    anim.update(dt);

    // 3. Столкновения: считаем расстояние до каждого кристалла
    for (const c of crystals) {
      if (!c.visible) continue;
      c.rotation.y += dt * 2;
      c.position.y = 0.7 + Math.sin(time * 3 + c.position.x) * 0.12;
      const dx = c.position.x - root.position.x;
      const dz = c.position.z - root.position.z;
      if (Math.hypot(dx, dz) < PICK_DISTANCE) {
        c.visible = false;
        collected++;
        out.gems.textContent = collected;
        if (collected === crystals.length) {
          out.msg.textContent = 'Все кристаллы собраны!';
          out.msg.hidden = false;
          celebrating = true;
          anim.play('Dance');
        }
      }
    }

    // Камера плавно догоняет робота
    camGoal.copy(root.position).add(CAMERA_OFFSET);
    camera.position.lerp(camGoal, Math.min(1, realDt * 4));
    camera.lookAt(root.position.x, 0.8, root.position.z);

    // Табло: обновляем 4 раза в секунду, иначе цифры не успеть прочитать
    fps += (1 / Math.max(realDt, 0.001) - fps) * 0.1;
    sinceReadout += realDt;
    if (sinceReadout > 0.25) {
      sinceReadout = 0;
      out.fps.textContent = Math.round(fps);
      out.dt.textContent = (dt * 1000).toFixed(1);
      out.x.textContent = fmt(root.position.x);
      out.z.textContent = fmt(root.position.z);
    }
    // 4. Картинку рисует stage сразу после этой функции
  });
}
