import * as THREE from 'three';

function cityHref(id) {
  const url = new URL(location.href);
  url.searchParams.set('city', id);
  return url.href;
}

function createGlobeTexture(land) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const x = lon => (lon + 180) / 360 * canvas.width;
  const y = lat => (90 - lat) / 180 * canvas.height;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ededed';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  for (const { geometry } of land.features) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => {
          if (i === 0) ctx.moveTo(x(lon), y(lat));
          else ctx.lineTo(x(lon), y(lat));
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
      ctx.stroke();
    }
  }

  // Fade meridians before they converge into a dense spot at either pole.
  const grid = document.createElement('canvas');
  grid.width = canvas.width;
  grid.height = canvas.height;
  const gridCtx = grid.getContext('2d');
  gridCtx.beginPath();
  gridCtx.strokeStyle = '#00000024';
  gridCtx.lineWidth = 1;
  for (let lon = -180; lon < 180; lon += 15) {
    gridCtx.moveTo(x(lon), 0);
    gridCtx.lineTo(x(lon), canvas.height);
  }
  gridCtx.stroke();
  gridCtx.globalCompositeOperation = 'destination-in';
  const fade = gridCtx.createLinearGradient(0, 0, 0, canvas.height);
  fade.addColorStop(0, 'transparent');
  fade.addColorStop(.14, 'black');
  fade.addColorStop(.86, 'black');
  fade.addColorStop(1, 'transparent');
  gridCtx.fillStyle = fade;
  gridCtx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(grid, 0, 0);
  ctx.beginPath();
  ctx.strokeStyle = '#00000024';
  ctx.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 15) {
    ctx.moveTo(0, y(lat));
    ctx.lineTo(canvas.width, y(lat));
  }
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function showCityMenu(app, cities) {
  const menu = document.createElement('main');
  menu.className = 'city-menu';
  menu.innerHTML = `
    <header class="city-menu-header"><h1>REVOLUT.</h1><p>Select a drop zone</p></header>
    <div class="city-globe"></div>
    <nav class="city-list" aria-label="Cities"></nav>
  `;
  app.replaceChildren(menu);
  const list = menu.querySelector('.city-list');
  for (const city of cities) {
    const link = document.createElement('a');
    link.href = cityHref(city.id);
    const name = document.createElement('strong');
    name.textContent = city.name;
    const region = document.createElement('span');
    region.textContent = city.region;
    link.append(name, region);
    list.append(link);
  }
  const viewport = menu.querySelector('.city-globe');
  drawGlobe(viewport, cities).catch(error => {
    console.error(error);
    viewport.textContent = 'Globe unavailable. Choose a city from the list.';
  });
}

async function drawGlobe(viewport, cities) {
  const response = await fetch(import.meta.env.BASE_URL + 'data/globe-land.json');
  if (!response.ok) throw new Error('Could not load globe coastlines');
  const land = await response.json();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 20);
  camera.position.z = 4;
  camera.updateMatrixWorld();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Drag or use arrow keys to rotate the globe');
  canvas.tabIndex = 0;
  viewport.append(canvas);

  const globeTexture = createGlobeTexture(land);
  globeTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 48),
    new THREE.MeshBasicMaterial({ map: globeTexture }),
  );
  sphere.rotation.set(.25, -Math.PI / 2 - THREE.MathUtils.degToRad(78), 0);
  scene.add(sphere);
  const outline = new THREE.Mesh(
    new THREE.SphereGeometry(1.008, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide }),
  );
  sphere.add(outline);

  const pins = cities.map(city => {
    const anchor = document.createElement('a');
    anchor.className = 'city-pin';
    anchor.href = cityHref(city.id);
    anchor.setAttribute('aria-label', city.name);
    const label = document.createElement('span');
    label.className = 'city-pin-label';
    label.textContent = city.name;
    label.setAttribute('aria-hidden', 'true');
    anchor.append(label);
    viewport.append(anchor);
    const lat = THREE.MathUtils.degToRad(city.lat);
    const lon = THREE.MathUtils.degToRad(city.lon);
    const position = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    return { anchor, position };
  });
  const projected = new THREE.Vector3();

  function render() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    sphere.updateMatrixWorld();
    for (const { anchor, position } of pins) {
      projected.copy(position).applyMatrix4(sphere.matrixWorld);
      anchor.hidden = projected.z <= 1 / camera.position.z;
      projected.project(camera);
      anchor.style.left = `${(projected.x + 1) * width / 2}px`;
      anchor.style.top = `${(1 - projected.y) * height / 2}px`;
      anchor.classList.toggle('label-left', projected.x > .45);
      anchor.classList.toggle('label-below', projected.y > .65);
    }
    renderer.render(scene, camera);
  }

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.position.z = 4 * Math.max(1, 1 / camera.aspect);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();

  function rotate(x, y) {
    sphere.rotation.y += x;
    sphere.rotation.x = THREE.MathUtils.clamp(sphere.rotation.x + y, -Math.PI / 2, Math.PI / 2);
    render();
  }
  let drag;
  let velocityX = 0;
  let velocityY = 0;
  let animationFrame = 0;

  function stopMomentum() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    velocityX = velocityY = 0;
  }

  function startMomentum() {
    let previousTime = performance.now();
    function animate(now) {
      const dt = Math.min((now - previousTime) / 1000, .05);
      previousTime = now;
      rotate(velocityX * dt, velocityY * dt);
      const damping = Math.exp(-3 * dt);
      velocityX *= damping;
      velocityY *= damping;
      if (Math.hypot(velocityX, velocityY) < .01) {
        stopMomentum();
        return;
      }
      animationFrame = requestAnimationFrame(animate);
    }
    animationFrame = requestAnimationFrame(animate);
  }

  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    stopMomentum();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const now = performance.now();
    const dx = (event.clientX - drag.x) * .008;
    const dy = (event.clientY - drag.y) * .008;
    const dt = Math.max((now - drag.time) / 1000, .008);
    velocityX = THREE.MathUtils.clamp(dx / dt, -4, 4);
    velocityY = THREE.MathUtils.clamp(dy / dt, -4, 4);
    rotate(dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.time = now;
  });
  canvas.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    if (performance.now() - drag.time < 100 && Math.hypot(velocityX, velocityY) > .01) startMomentum();
    drag = undefined;
  });
  canvas.addEventListener('pointercancel', () => { drag = undefined; stopMomentum(); });
  canvas.addEventListener('lostpointercapture', () => { drag = undefined; });
  canvas.addEventListener('keydown', event => {
    const direction = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] }[event.key];
    if (!direction) return;
    event.preventDefault();
    stopMomentum();
    rotate(...direction);
  });
}
