// The equipped viewmodel stays anchored to the camera, independently of the world.
export function equipPistol(container) {
  const pistol = document.createElement('img');
  pistol.className = 'equipped-pistol';
  pistol.src = `${import.meta.env.BASE_URL}reference-pistol.png`;
  pistol.alt = '';
  pistol.draggable = false;
  pistol.setAttribute('aria-hidden', 'true');
  container.appendChild(pistol);
}
