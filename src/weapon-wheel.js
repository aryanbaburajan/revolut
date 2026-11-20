// Temporary weapon selector, shown on each scroll.
export function createWeaponWheel(container) {
  const wheel = document.createElement('div');
  wheel.className = 'weapon-wheel';
  wheel.setAttribute('aria-label', 'Weapon selector');
  wheel.innerHTML = '<div class="weapon-wheel-sector"><span>PISTOL</span></div><div class="weapon-wheel-sector"><span>RIFLE</span></div><div class="weapon-wheel-sector"><span>SHOTGUN</span></div><div class="weapon-wheel-sector"><span>ROCKET</span></div><svg class="weapon-wheel-lines" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 V100 M0 50 H100"/></svg><div class="weapon-wheel-center">WEAPONS</div>';
  container.appendChild(wheel);
  let timer;
  return (selected) => {
    [...wheel.children].slice(0, 4).forEach((sector, i) => sector.classList.toggle('selected', i === selected));
    wheel.classList.add('visible');
    clearTimeout(timer);
    timer = setTimeout(() => wheel.classList.remove('visible'), 500);
  };
}
