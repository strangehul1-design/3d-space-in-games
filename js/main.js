// Точка входа: запускает каждую 3D-сцену, когда до неё докрутили,
// и подсвечивает в шапке текущий урок.
import { initHero } from './hero.js';
import { initCoords } from './lesson-coords.js';
import { initTransform } from './lesson-transform.js';
import { initMesh } from './lesson-mesh.js';
import { initHierarchy } from './lesson-hierarchy.js';
import { initCamera } from './lesson-camera.js';
import { initLight } from './lesson-light.js';
import { initLoop } from './lesson-loop.js';

const SCENES = {
  hero: initHero,
  coords: initCoords,
  transform: initTransform,
  mesh: initMesh,
  hierarchy: initHierarchy,
  camera: initCamera,
  light: initLight,
  loop: initLoop,
};

function showError(section, error) {
  console.error(error);
  const view = section.querySelector('.view');
  const p = document.createElement('p');
  p.className = 'view-error';
  p.textContent = 'Не получилось запустить 3D-сцену. Проверь интернет и обнови страницу.';
  view.append(p);
}

// Ждём шрифты, чтобы подписи осей в 3D нарисовались нужным шрифтом (но не дольше 1.5 с)
await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);

// Сцена запускается чуть заранее - за 400px до появления на экране
const starter = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    starter.unobserve(entry.target);
    const section = entry.target;
    Promise.resolve()
      .then(() => SCENES[section.dataset.scene](section))
      .catch((error) => showError(section, error));
  }
}, { rootMargin: '400px 0px' });

document.querySelectorAll('[data-scene]').forEach((section) => starter.observe(section));

// Подсветка текущего раздела в шапке. На первом экране не подсвечено ничего.
const links = new Map(
  [...document.querySelectorAll('.lessons-nav a')].map((a) => [a.hash.slice(1), a]),
);
const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    links.forEach((a) => a.removeAttribute('aria-current'));
    const link = links.get(entry.target.id);
    if (!link) continue;
    link.setAttribute('aria-current', 'true');
    // На телефоне шапка прокручивается вбок - держим текущий раздел посередине
    const nav = link.parentElement;
    nav.scrollTo({ left: link.offsetLeft - (nav.clientWidth - link.clientWidth) / 2 });
  }
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('.hero, .lesson, .doc').forEach((s) => spy.observe(s));
