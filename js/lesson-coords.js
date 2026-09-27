// Урок 1. Координаты: точка - это три числа (x, y, z).
import * as THREE from 'three';
import { AXIS, createStage, addGrid, addLights, makeAxes, fmt, bindSlider, REDUCED_MOTION } from './core.js';

export function initCoords(section) {
  const view = section.querySelector('.view');
  const stage = createStage(view, { camPos: [7, 5.5, 8.5], target: [0, 1.2, 0] });
  const { scene } = stage;

  addGrid(scene, 10, 10);
  addLights(scene);
  scene.add(makeAxes(4.6));

  // Кристалл - наша точка в пространстве
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2a4b7a, roughness: 0.25, flatShading: true }),
  );
  scene.add(gem);

  // Пунктир: каждая линия по длине равна одной координате и покрашена в цвет своей оси
  const dashed = (color) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color, dashSize: 0.14, gapSize: 0.09 }),
    );
    line.frustumCulled = false;
    scene.add(line);
    return line;
  };
  const lineY = dashed(AXIS.y); // от точки вниз до пола - это y
  const lineX = dashed(AXIS.x); // от оси Z до проекции - это x
  const lineZ = dashed(AXIS.z); // от оси X до проекции - это z

  // Засечки на осях там, где стоят x и z
  const tick = (color) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color }));
    scene.add(m);
    return m;
  };
  const tickX = tick(AXIS.x);
  const tickZ = tick(AXIS.z);

  const out = {
    x: section.querySelector('.readout [data-out="x"]'),
    y: section.querySelector('.readout [data-out="y"]'),
    z: section.querySelector('.readout [data-out="z"]'),
  };

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  function redraw() {
    const { x, y, z } = gem.position;
    const set = (line, p1, p2) => { line.geometry.setFromPoints([p1, p2]); line.computeLineDistances(); };
    set(lineY, a.set(x, y, z), b.set(x, 0, z));
    set(lineX, a.set(0, 0, z), b.set(x, 0, z));
    set(lineZ, a.set(x, 0, 0), b.set(x, 0, z));
    tickX.position.set(x, 0, 0);
    tickZ.position.set(0, 0, z);
    out.x.textContent = fmt(x);
    out.y.textContent = fmt(y);
    out.z.textContent = fmt(z);
  }

  const sliders = section.querySelectorAll('input[data-axis]');
  const updaters = [...sliders].map((input) =>
    bindSlider(input, (v) => { gem.position[input.dataset.axis] = v; redraw(); }),
  );

  section.querySelector('[data-action="reset"]').addEventListener('click', () => {
    sliders.forEach((input) => { input.value = 0; });
    updaters.forEach((fn) => fn());
  });

  stage.onFrame((dt, time) => {
    if (REDUCED_MOTION) return;
    gem.rotation.y += dt * 0.8;
    gem.rotation.x = Math.sin(time) * 0.2;
  });
}
