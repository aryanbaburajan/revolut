// Temporary weapon selector, shown on each scroll.
export function createWeaponWheel(container) {
  const wheel = document.createElement('div');
  wheel.className = 'weapon-wheel';
  wheel.setAttribute('aria-label', 'Weapon selector');
  const names = ['PISTOL', 'RIFLE', 'SHOTGUN', 'ROCKET', 'KATANA'];
  const sectors = names.map((name, index) => {
    const sector = document.createElement('div');
    sector.className = 'weapon-wheel-sector';
    const start = -Math.PI / 2 + index * Math.PI * 2 / names.length;
    const end = start + Math.PI * 2 / names.length;
    const points = ['50% 50%'];
    for (let i = 0; i <= 12; i++) {
      const angle = start + (end - start) * i / 12;
      points.push(`${50 + Math.cos(angle) * 75}% ${50 + Math.sin(angle) * 75}%`);
    }
    sector.style.clipPath = `polygon(${points.join(',')})`;
    const label = document.createElement('span');
    const middle = (start + end) / 2;
    label.style.left = `${50 + Math.cos(middle) * 32}%`;
    label.style.top = `${50 + Math.sin(middle) * 32}%`;
    label.textContent = name;
    sector.append(label); wheel.append(sector);
    return sector;
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'weapon-wheel-lines'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', names.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / names.length; return `M50 50 L${50 + 50 * Math.cos(a)} ${50 + 50 * Math.sin(a)}`; }).join(' '));
  svg.append(path); wheel.append(svg);
  const center = document.createElement('div'); center.className = 'weapon-wheel-center'; center.textContent = 'WEAPONS'; wheel.append(center);
  container.appendChild(wheel);
  let timer;
  return selected => {
    sectors.forEach((sector, i) => sector.classList.toggle('selected', i === selected));
    wheel.classList.add('visible');
    clearTimeout(timer);
    timer = setTimeout(() => wheel.classList.remove('visible'), 500);
  };
}
