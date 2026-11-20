import type { Camera, Vector3 } from 'three';

const sfxPath = 'audio/sfx/';
const single = (name: string) => [sfxPath + name + '.wav'];
const variants = (name: string, count: number) =>
  Array.from({ length: count }, (_, i) => sfxPath + name + '-' + (i + 1) + '.wav');
const cues = {
  pistol: { files: ['audio/gunshots/pistol-shot.mp3'], db: -7, priority: 4, loud: true },
  rifle: { files: ['audio/gunshots/rifle-shot.mp3'], db: -9, priority: 4, loud: true },
  shotgun: { files: single('shotgun'), db: -6, priority: 4, loud: true },
  cannon: { files: variants('cannon', 3), db: -6, priority: 4, loud: true },
  explosion: { files: single('explosion'), db: -9, priority: 4, loud: true },
  openingLand: { files: single('opening-land'), db: -9, priority: 4, loud: true },
  reload: { files: variants('reload', 3), db: -15, priority: 3, loud: false },
  katana: { files: ['audio/sfx/katana.mp3'], db: -10, priority: 4, loud: false },
  coin: { files: single('coin'), db: -17, priority: 3, loud: false },
  land: { files: single('land'), db: -20, priority: 2, loud: false },
  concrete: { files: single('concrete'), db: -23, priority: 1, loud: false },
  meat: { files: single('meat'), db: -19, priority: 1, loud: false },
  step: { files: variants('step', 6), db: -28, priority: 0, loud: false },
  zombie: { files: variants('zombie', 4), db: -27, priority: 0, loud: false },
};
const loops = { wind: -22, industrial: -34, jeep: -9, tracks: -9, rotor: -22 };
type Cue = keyof typeof cues;
type Loop = keyof typeof loops;
const loopPath = (kind: Loop) => sfxPath + kind + '.ogg';
const gainForDb = (db: number) => 10 ** (db / 20);
const MAX_VOICES = 8;

export function createGameAudio(camera: Camera) {
  let context: AudioContext | undefined;
  let effects: DynamicsCompressorNode;
  let background: GainNode;
  const clips = new Map<string, AudioBuffer>();
  const playingLoops = new Map<Loop, { source: AudioBufferSourceNode; gain: GainNode; target: number }>();
  const voices: { source: AudioBufferSourceNode; priority: number }[] = [];
  const lastVariant = new Map<Cue, AudioBuffer>();
  let nextImpact = 0;
  let nextCoin = 0;
  let nextGroan = 0;
  let musicRequested = false;
  let pendingMusic = false;
  let masterVolume = .9;
  try {
    const saved = JSON.parse(localStorage.getItem('game-audio-levels') || 'null');
    if (Number.isFinite(saved?.master)) masterVolume = Math.max(0, Math.min(1, saved.master));
  } catch {}

  const music = new Audio(import.meta.env.BASE_URL + 'audio/music/landing.mp3');
  music.preload = 'auto';
  music.loop = true;
  music.volume = masterVolume * gainForDb(-9);

  function tryMusic() {
    if (pendingMusic || !music.paused) return;
    pendingMusic = true;
    void music.play().catch(() => {}).finally(() => { pendingMusic = false; });
  }

  const sounds = [
    ...Object.values(cues).flatMap(cue => cue.files),
    ...(Object.keys(loops) as Loop[]).map(loopPath),
  ];
  const downloads = sounds.map(async path => {
    try {
      const response = await fetch(import.meta.env.BASE_URL + path);
      if (response.ok) return { path, data: await response.arrayBuffer() };
    } catch {}
  });

  function prepare() {
    if (context) return;
    try {
      const ctx = context = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = masterVolume;
      master.connect(ctx.destination);

      // Control peaks on the effects bus without moving the soundtrack gain.
      effects = ctx.createDynamicsCompressor();
      effects.threshold.value = -10;
      effects.knee.value = 0;
      effects.ratio.value = 16;
      effects.attack.value = .001;
      effects.release.value = .12;
      effects.connect(master);

      background = ctx.createGain();
      background.connect(effects);
      for (const download of downloads) {
        void download.then(async file => {
          if (file) clips.set(file.path, await ctx.decodeAudioData(file.data));
        }).catch(() => {});
      }
    } catch {
      // The game remains playable when Web Audio is unavailable.
    }
  }

  function init() {
    if (musicRequested) tryMusic();
    prepare();
    if (context?.state === 'suspended') void context.resume().catch(() => {});
  }

  function duck(now: number) {
    const gain = background.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(gainForDb(-5), now, .008);
    gain.setTargetAtTime(1, now + .045, .07);
  }

  function play(kind: Cue, position?: Vector3, offsetDb = 0) {
    const ctx = context;
    if (!ctx || ctx.state !== 'running' || document.hidden) return false;
    const cue = cues[kind];
    const buffers = cue.files.map(path => clips.get(path)).filter(buffer => buffer !== undefined);
    if (!buffers.length) return false;
    const alternatives = buffers.filter(buffer => buffer !== lastVariant.get(kind));
    const available = alternatives.length ? alternatives : buffers;
    const buffer = available[Math.floor(Math.random() * available.length)];

    const now = ctx.currentTime;
    if (voices.length >= MAX_VOICES) {
      const weakest = voices.reduce((a, b) => a.priority <= b.priority ? a : b);
      if (weakest.priority > cue.priority) return false;
      voices.splice(voices.indexOf(weakest), 1);
      weakest.source.stop(now);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = gainForDb(cue.db + offsetDb);
    source.connect(gain);
    let pan: StereoPannerNode | undefined;
    if (position) {
      const relative = position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
      const distance = relative.length();
      const range = kind === 'explosion' ? 50 : 12;
      gain.gain.value /= 1 + distance / range;
      pan = ctx.createStereoPanner();
      pan.pan.value = relative.x / Math.max(1, distance);
      gain.connect(pan).connect(effects);
    } else {
      gain.connect(effects);
    }
    const voice = { source, priority: cue.priority };
    voices.push(voice);
    source.onended = () => {
      const index = voices.indexOf(voice);
      if (index >= 0) voices.splice(index, 1);
      source.disconnect();
      gain.disconnect();
      pan?.disconnect();
    };
    source.start();
    lastVariant.set(kind, buffer);
    if (cue.loud) duck(now);
    return true;
  }

  function setLoop(kind: Loop, amount: number) {
    const ctx = context;
    if (!ctx || ctx.state !== 'running') return;
    let loop = playingLoops.get(kind);
    if (!amount) {
      if (!loop) return;
      playingLoops.delete(kind);
      loop.gain.gain.setTargetAtTime(0, ctx.currentTime, .045);
      loop.source.stop(ctx.currentTime + .25);
      return;
    }
    if (!loop) {
      const buffer = clips.get(loopPath(kind));
      if (!buffer) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0;
      source.connect(gain).connect(background);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      loop = { source, gain, target: 0 };
      playingLoops.set(kind, loop);
    }
    const target = gainForDb(loops[kind]) * amount;
    if (Math.abs(loop.target - target) > .0001) {
      loop.target = target;
      loop.gain.gain.setTargetAtTime(target, ctx.currentTime, .06);
    }
  }

  function updateEnvironment(now: number, diving: boolean, grounded: boolean,
    vehicle: 'jeep' | 'tracks' | 'rotor' | null, speed: number,
    range: { ambientTargets: { children: { position: Vector3 }[] } }) {
    const active = !document.hidden;
    setLoop('wind', active && diving ? .25 + .75 * Math.min(1, Math.abs(speed) / 50) : 0);
    setLoop('industrial', active && !diving && (grounded || vehicle !== null && vehicle !== 'rotor') ? 1 : 0);
    setLoop('jeep', active && vehicle === 'jeep' ? .55 + .45 * Math.min(1, Math.abs(speed) / 12) : 0);
    setLoop('tracks', active && vehicle === 'tracks' && Math.abs(speed) > .1 ? .55 + .45 * Math.min(1, Math.abs(speed) / 5) : 0);
    setLoop('rotor', active && vehicle === 'rotor' ? 1 : 0);
    if (!active || diving || now < nextGroan || context?.state !== 'running') return;
    nextGroan = now + 4000 + Math.random() * 4000;
    const nearby = range.ambientTargets.children.filter(zombie => zombie.position.distanceToSquared(camera.position) < 24 ** 2);
    if (nearby.length) play('zombie', nearby[Math.floor(Math.random() * nearby.length)].position);
  }

  return {
    prepare, init, play, updateEnvironment,
    playMusic() { musicRequested = true; tryMusic(); },
    impact(kind: 'concrete' | 'meat', position: Vector3, now: number) {
      if (now >= nextImpact && play(kind, position)) nextImpact = now + 90;
    },
    streak(count: number, now: number) {
      if (now >= nextCoin && play('coin', undefined, count >= 100 ? 3 : 0)) nextCoin = now + 1250;
    },
  };
}
