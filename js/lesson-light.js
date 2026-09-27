// Урок 6. Свет и материал: шероховатость, металличность и тени.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage, addGrid, loadRobot, Animator, bindSlider, setStatus, REDUCED_MOTION } from './core.js';

export async function initLight(section) {
  const view = section.querySelector('.view');
  const stage = createStage(view, { camPos: [4.5, 3.2, 6.5], target: [0, 0.9, 0], shadows: true });
  const { scene, renderer } = stage;

  // Мягкое окружение: без него металл отражал бы пустоту и казался чёрным
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a3358, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  addGrid(scene, 20, 20).position.y = 0.002;

  // Солнце - направленный свет, как от очень далёкой лампы
  const sun = new THREE.DirectionalLight(0xfff4e0, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  // Шарик в небе показывает, откуда светит солнце
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4e0 }));
  scene.add(sunBall);

  // Один материал на две формы: меняешь его - меняются обе
  const material = new THREE.MeshStandardMaterial({ color: 0x4c8dff, roughness: 0.35, metalness: 0.2 });
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.19, 180, 24), material);
  knot.position.set(-1.4, 1.2, 0.3);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.6, 64, 32), material);
  ball.position.set(1.5, 0.6, 0.8);
  for (const m of [knot, ball]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  /* ---------- Управление ---------- */
  const angles = { elevation: 45, azimuth: 40 };
  function placeSun() {
    const el = THREE.MathUtils.degToRad(angles.elevation);
    const az = THREE.MathUtils.degToRad(angles.azimuth);
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    sun.position.copy(dir).multiplyScalar(10);
    sunBall.position.copy(dir).multiplyScalar(4.5);
  }

  for (const input of section.querySelectorAll('[data-mat]')) {
    bindSlider(input, (v) => { material[input.dataset.mat] = v; });
  }
  for (const input of section.querySelectorAll('[data-sun]')) {
    bindSlider(input, (v) => { angles[input.dataset.sun] = v; placeSun(); }, 0);
  }
  section.querySelector('[data-color="material"]').addEventListener('input', (e) => material.color.set(e.target.value));
  section.querySelector('[data-color="light"]').addEventListener('input', (e) => {
    sun.color.set(e.target.value);
    sunBall.material.color.set(e.target.value);
  });
  section.querySelector('[data-toggle="shadows"]').addEventListener('change', (e) => {
    sun.castShadow = e.target.checked;
  });

  stage.onFrame((dt) => { if (!REDUCED_MOTION) knot.rotation.y += dt * 0.25; });

  // Робот - чтобы было видно, как тень повторяет сложную форму
  setStatus(view, 'Загружаю робота…');
  const { root, model, clips } = await loadRobot(1.6);
  setStatus(view, null);
  root.position.set(0.1, 0, -1.3);
  scene.add(root);
  const anim = new Animator(model, clips);
  anim.play('Idle');
  stage.onFrame((dt) => anim.update(dt));
}
