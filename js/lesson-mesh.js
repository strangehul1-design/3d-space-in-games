// Урок 3. Меш: модель собрана из треугольников, у вершин есть нормали.
import * as THREE from 'three';
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStage, addLights, bindSeg, bindSlider, REDUCED_MOTION } from './core.js';

// Уровни детализации для каждой формы: 0 - грубо, 5 - гладко
const SPHERE_DETAIL = [0, 1, 2, 4, 8, 16];
const TORUS_SEGMENTS = [[3, 6], [4, 10], [6, 16], [10, 28], [16, 48], [32, 96]];

function makeGeometry(shape, level) {
  if (shape === 'torus') {
    const [radial, tubular] = TORUS_SEGMENTS[level];
    return new THREE.TorusGeometry(0.75, 0.32, radial, tubular);
  }
  const geometry = new THREE.IcosahedronGeometry(1, SPHERE_DETAIL[level]);
  if (shape === 'stone') {
    // Камень: сдвигаем вершины на «шум», который зависит только от направления.
    // Одинаковые вершины соседних треугольников сдвигаются одинаково - дыр не будет.
    const pos = geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const bump = Math.sin(v.x * 3.1 + 1.7) * Math.sin(v.y * 2.3 + 0.4) * Math.sin(v.z * 2.9 + 2.2)
        + 0.5 * Math.sin(v.x * 7.3 + v.z * 5.1);
      v.multiplyScalar(1 + bump * 0.16);
      v.y *= 0.8;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

// Сколько разных вершин: одинаковые точки соседних треугольников считаем один раз
function uniqueVertices(geometry) {
  const onlyPositions = new THREE.BufferGeometry();
  onlyPositions.setAttribute('position', geometry.attributes.position.clone());
  if (geometry.index) onlyPositions.setIndex(geometry.index.clone());
  return mergeVertices(onlyPositions);
}

export function initMesh(section) {
  const view = section.querySelector('.view');
  const stage = createStage(view, { camPos: [0, 1.4, 4.2], target: [0, 0, 0] });
  const { scene } = stage;
  addLights(scene);

  const material = new THREE.MeshStandardMaterial({
    color: 0x4c8dff,
    roughness: 0.45,
    // Сдвигаем заливку чуть назад, чтобы линии каркаса не мерцали поверх неё
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  const wire = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  );
  const points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xffc53d, size: 0.06 }),
  );
  const model = new THREE.Group();
  model.add(mesh, wire, points);
  scene.add(model);
  let normals = null;

  const state = { shape: 'sphere', level: 2, wire: true, points: false, normals: false };
  const tris = section.querySelector('[data-out="tris"]');
  const verts = section.querySelector('[data-out="verts"]');

  function rebuild() {
    const geometry = makeGeometry(state.shape, state.level);
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    wire.geometry.dispose();
    wire.geometry = new THREE.WireframeGeometry(geometry);
    points.geometry.dispose();
    points.geometry = uniqueVertices(geometry);

    // Камень - с плоскими гранями, остальное гладкое
    material.flatShading = state.shape === 'stone';
    material.needsUpdate = true;

    if (normals) { scene.remove(normals); normals.dispose(); normals = null; }
    if (state.normals) {
      normals = new VertexNormalsHelper(mesh, 0.18, 0xff7aa8);
      scene.add(normals);
    }
    wire.visible = state.wire;
    points.visible = state.points;

    const triangles = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    tris.textContent = triangles.toLocaleString('ru-RU');
    verts.textContent = points.geometry.attributes.position.count.toLocaleString('ru-RU');
  }

  bindSeg([...section.querySelectorAll('[data-shape]')], (btn) => { state.shape = btn.dataset.shape; rebuild(); });
  bindSlider(section.querySelector('[data-detail]'), (v) => { state.level = v; rebuild(); }, 0);
  for (const box of section.querySelectorAll('[data-toggle]')) {
    box.addEventListener('change', () => { state[box.dataset.toggle] = box.checked; rebuild(); });
  }

  stage.onFrame((dt) => {
    if (!REDUCED_MOTION) model.rotation.y += dt * 0.3;
    if (normals) {
      model.updateMatrixWorld(true);
      normals.update(); // стрелки нормалей следуют за вращением модели
    }
  });
}
