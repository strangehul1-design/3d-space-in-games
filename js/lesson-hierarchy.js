// Урок 4. Иерархия: ребёнок двигается вместе с родителем.
// Солнце → орбита планеты → планета → орбита луны → луна.
import * as THREE from 'three';
import { AXIS, createStage, fmt, bindSlider } from './core.js';

const TRAIL_LENGTH = 700; // сколько точек помнит след луны

export function initHierarchy(section) {
  const view = section.querySelector('.view');
  const stage = createStage(view, { camPos: [0, 8.5, 9], target: [0, -0.5, 0] });
  const { scene } = stage;

  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x1b2f52, 0.5));
  scene.add(new THREE.PointLight(0xfff0d0, 3, 0, 0)); // свет из центра солнца

  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffc53d }));
  scene.add(sun);

  // Родитель планеты - пустой объект в центре. Крутим его, а планета едет по кругу сама.
  const planetOrbit = new THREE.Object3D();
  scene.add(planetOrbit);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x4c8dff, roughness: 0.6 }),
  );
  planet.position.x = 4;
  planetOrbit.add(planet);

  const moonOrbit = new THREE.Object3D();
  planet.add(moonOrbit);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0xe8edf5, roughness: 0.9 }),
  );
  moon.position.x = 1;
  moonOrbit.add(moon);

  // Кольца орбит: кольцо луны - ребёнок планеты, поэтому летит вместе с ней
  const orbitRing = (radius, opacity) => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius);
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(128)),
      new THREE.LineBasicMaterial({ color: 0x7f9cc6, transparent: true, opacity }),
    );
    line.rotation.x = -Math.PI / 2;
    return line;
  };
  scene.add(orbitRing(4, 0.35));
  const moonRing = orbitRing(1, 0.45);
  planet.add(moonRing);

  // Локальные оси планеты и луны
  const axesFor = (obj, size) => {
    const helper = new THREE.AxesHelper(size);
    helper.setColors(new THREE.Color(AXIS.x), new THREE.Color(AXIS.y), new THREE.Color(AXIS.z));
    obj.add(helper);
    return helper;
  };
  const localAxes = [axesFor(planet, 0.9), axesFor(moon, 0.45)];

  // След луны в мировых координатах
  const trailPositions = new Float32Array(TRAIL_LENGTH * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0xffc53d }));
  trail.frustumCulled = false;
  scene.add(trail);
  let trailCount = 0;

  /* ---------- Управление ---------- */
  const speed = { planet: 0.5, moon: 2.5 };
  let paused = false;

  for (const input of section.querySelectorAll('[data-speed]')) {
    bindSlider(input, (v) => { speed[input.dataset.speed] = v; });
  }
  bindSlider(section.querySelector('[data-moon-x]'), (v) => {
    moon.position.x = v;
    moonRing.scale.setScalar(v);
    trailCount = 0; // старый след больше не про эту орбиту
  });
  section.querySelector('[data-toggle="axes"]').addEventListener('change', (e) => {
    localAxes.forEach((a) => { a.visible = e.target.checked; });
  });
  section.querySelector('[data-toggle="trail"]').addEventListener('change', (e) => {
    trail.visible = e.target.checked;
  });
  const pauseBtn = section.querySelector('[data-action="pause"]');
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Дальше' : 'Пауза';
  });

  const out = {};
  for (const k of ['lx', 'ly', 'lz', 'wx', 'wy', 'wz']) out[k] = section.querySelector(`[data-out="${k}"]`);
  const world = new THREE.Vector3();

  stage.onFrame((dt) => {
    if (!paused) {
      planetOrbit.rotation.y += speed.planet * dt;
      moonOrbit.rotation.y += speed.moon * dt;
    }
    scene.updateMatrixWorld();
    moon.getWorldPosition(world);

    if (!paused) {
      // Сдвигаем старые точки на одну назад и дописываем новую в конец
      if (trailCount < TRAIL_LENGTH) trailCount++;
      else trailPositions.copyWithin(0, 3);
      world.toArray(trailPositions, (trailCount - 1) * 3);
      trailGeometry.setDrawRange(0, trailCount);
      trailGeometry.attributes.position.needsUpdate = true;
    }

    out.lx.textContent = fmt(moon.position.x);
    out.ly.textContent = fmt(moon.position.y);
    out.lz.textContent = fmt(moon.position.z);
    out.wx.textContent = fmt(world.x);
    out.wy.textContent = fmt(world.y);
    out.wz.textContent = fmt(world.z);
  });
}
