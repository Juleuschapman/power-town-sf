/* Power Town SF shared audio manager. Audio files are optional and can be added later. */
(function (root) {
  "use strict";

  const STORAGE_KEY = "powerTownAudioSettings";
  const defaults = { musicVolume: 0.25, sfxVolume: 0.65, ambienceVolume: 0.35, musicEnabled: true, sfxEnabled: true, ambienceEnabled: true };
  let settings = loadSettings();
  let music = null;
  let ambience = null;
  let musicFade = null;
  let ambienceFade = null;
  const sfxFiles = { wrongAction: "wrong-action.wav", lightSwitchOff: "light_switch_off.wav", lightSwitchOn: "light_switch_on.wav", placeGas: "assets/audio/place-natural-gas.wav", placeSolar: "assets/audio/place-solar.wav", placeWind: "assets/audio/place-wind.wav", placeNuclear: "assets/audio/place-nuclear.wav" };
  // During the temporary sound pass, only these three approved sounds may play.
  // Other synth/file definitions remain available for a later sound-design pass.
  const activeSfx = new Set(["wrongAction", "lightSwitchOff", "lightSwitchOn", "placeGas", "placeSolar", "placeWind", "placeNuclear"]);
  const synthSfx = new Set(["repairSuccess", "electricityConnect", "powerRestored", "moneyTransaction", "levelComplete", "emergencyAlert", "windEmergency", "transformerPower", "towerPlacement", "cut", "treeMovement"]);
  const synthLastPlayed = Object.create(null);
  let audioContext = null;

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return Object.assign({}, defaults, saved || {});
    } catch (error) {
      return Object.assign({}, defaults);
    }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (error) { /* storage is optional */ }
  }

  function clamp(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
  }

  function filePath(folder, name) {
    if (!name) return "";
    const value = String(name);
    return value.includes("/") ? value : `assets/audio/${folder}/${value}${/\.[a-z0-9]+$/i.test(value) ? "" : ".mp3"}`;
  }

  function safeAudio(folder, name, loop, silentMissing = false) {
    const src = filePath(folder, name);
    if (!src) return null;
    try {
      const audio = new Audio(src);
      audio.loop = !!loop;
      audio.preload = "auto";
      if (!silentMissing) audio.addEventListener("error", () => console.warn("Power Town audio file unavailable:", src), { once: true });
      return audio;
    } catch (error) {
      return null;
    }
  }

  function fade(audio, target, duration, done) {
    if (!audio) return;
    const start = Number.isFinite(audio.volume) ? audio.volume : 0;
    const began = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - began) / duration);
      audio.volume = start + (target - start) * progress;
      if (progress < 1) requestAnimationFrame(tick); else if (done) done();
    };
    requestAnimationFrame(tick);
  }

  function playMusic(name) {
    if (musicFade) cancelAnimationFrame(musicFade);
    const next = safeAudio("music", name, true);
    if (!next) return null;
    next.volume = 0;
    const previous = music;
    music = next;
    if (previous) fade(previous, 0, 300, () => { previous.pause(); previous.src = ""; });
    if (settings.musicEnabled) {
      next.play().catch(() => {});
      fade(next, settings.musicVolume, 350);
    }
    return next;
  }

  function stopMusic() {
    if (!music) return;
    const old = music;
    music = null;
    fade(old, 0, 300, () => { old.pause(); old.src = ""; });
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      if (!AudioContextClass) return null;
      try { audioContext = new AudioContextClass(); } catch (error) { return null; }
    }
    return audioContext;
  }

  function scheduleSynth(name, context) {
    const output = context.createGain();
    output.gain.value = Math.max(0, Math.min(1, settings.sfxVolume)) * 0.72;
    output.connect(context.destination);
    const start = context.currentTime + 0.01;
    const tone = (frequency, duration, offset, type = "sine", peak = 0.2, endFrequency = frequency) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), start + offset + duration);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(peak, start + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
      oscillator.connect(gain).connect(output);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration + 0.02);
    };
    if (name === "repairSuccess") {
      tone(180, 0.08, 0, "triangle", 0.25, 260);
      tone(420, 0.14, 0.055, "sine", 0.19, 560);
    } else if (name === "electricityConnect") {
      tone(260, 0.16, 0, "sawtooth", 0.15, 1100);
      tone(880, 0.12, 0.035, "sine", 0.12, 1450);
    } else if (name === "powerRestored") {
      tone(300, 0.2, 0, "sine", 0.2, 620);
      tone(620, 0.28, 0.12, "sine", 0.18, 980);
      tone(980, 0.32, 0.25, "triangle", 0.16, 1180);
    } else if (name === "moneyTransaction") {
      tone(620, 0.1, 0, "sine", 0.17, 760);
      tone(920, 0.14, 0.07, "sine", 0.15, 1120);
    } else if (name === "levelComplete") {
      tone(392, 0.22, 0, "sine", 0.18, 392);
      tone(494, 0.22, 0.16, "sine", 0.18, 494);
      tone(587, 0.22, 0.32, "sine", 0.18, 587);
      tone(784, 0.42, 0.48, "triangle", 0.21, 784);
    } else if (name === "emergencyAlert") {
      tone(560, 0.18, 0, "square", 0.12, 470);
      tone(560, 0.18, 0.22, "square", 0.12, 470);
    } else if (name === "windEmergency") {
      tone(170, 0.35, 0, "sawtooth", 0.1, 90);
      tone(260, 0.28, 0.08, "triangle", 0.12, 120);
    } else if (name === "transformerPower") {
      tone(110, 0.2, 0, "sine", 0.2, 125);
      tone(330, 0.16, 0.035, "triangle", 0.14, 390);
    } else if (name === "towerPlacement") {
      tone(150, 0.1, 0, "triangle", 0.2, 105);
      tone(520, 0.08, 0.06, "square", 0.12, 560);
    } else if (name === "cut") {
      tone(760, 0.055, 0, "square", 0.14, 540);
      tone(980, 0.055, 0.065, "square", 0.12, 690);
    } else if (name === "treeMovement") {
      tone(120, 0.16, 0, "triangle", 0.2, 78);
      tone(220, 0.12, 0.08, "sine", 0.12, 150);
    }
    setTimeout(() => { try { output.disconnect(); } catch (error) {} }, 1200);
    return output;
  }

  function playSynth(name) {
    if (!settings.sfxEnabled || !synthSfx.has(name)) return null;
    const now = performance.now();
    const cooldown = name === "levelComplete" ? 900 : name === "emergencyAlert" ? 500 : 80;
    if (now - (synthLastPlayed[name] || -Infinity) < cooldown) return null;
    synthLastPlayed[name] = now;
    const context = getAudioContext();
    if (!context) return null;
    const resume = context.state === "suspended" ? context.resume() : Promise.resolve();
    resume.then(() => scheduleSynth(name, context)).catch(() => {});
    return context;
  }

  function playSfx(name) {
    if (!settings.sfxEnabled || !activeSfx.has(name)) return null;
    if (/^place[A-Z]/.test(name)) return playPlacementSound(name);
    if (synthSfx.has(name)) return playSynth(name);
    const sound = safeAudio("sfx", sfxFiles[name] || name, false, /^place[A-Z]/.test(name));
    if (!sound) return null;
    sound.volume = settings.sfxVolume;
    sound.play().catch(() => {});
    return sound;
  }

  const placementVolumes = { placeGas: 1.00, placeSolar: 0.80, placeWind: 0.90, placeNuclear: 0.85 };
  const placementAudio = Object.create(null);
  let placementAudioUnlocked = false;
  if (root.document) {
    const unlockPlacementAudio = () => { placementAudioUnlocked = true; };
    root.document.addEventListener("pointerdown", unlockPlacementAudio, { once: true, passive: true });
  }
  Object.keys(placementVolumes).forEach(key => {
    try {
      const audio = new Audio(sfxFiles[key]);
      audio.preload = "auto";
      audio.volume = placementVolumes[key];
      audio.addEventListener("error", () => console.warn("Power Town placement audio unavailable:", sfxFiles[key]), { once: true });
      placementAudio[key] = audio;
    } catch (error) {
      placementAudio[key] = null;
    }
  });

  function normalizePlantType(type) {
    return String(type || "").trim().toLowerCase().replace(/[ _-]+/g, "");
  }

  function playPlacementSound(type) {
    const key = {
      gas: "placeGas",
      naturalgas: "placeGas",
      solar: "placeSolar",
      wind: "placeWind",
      nuke: "placeNuclear",
      nuclear: "placeNuclear"
    }[normalizePlantType(type)];
    placementAudioUnlocked = true; // Successful placement is itself a user gesture (including keyboard activation).
    const template = key ? placementAudio[key] : null;
    if (!template) return null;
    try {
      const sound = template.cloneNode();
      sound.volume = placementVolumes[key];
      sound.currentTime = 0;
      const play = sound.play();
      if (play && play.catch) play.catch(() => {});
      return sound;
    } catch (error) {
      return null;
    }
  }

  function playAmbience(name) {
    if (ambienceFade) cancelAnimationFrame(ambienceFade);
    const next = safeAudio("ambience", name, true);
    if (!next) return null;
    next.volume = 0;
    const previous = ambience;
    ambience = next;
    if (previous) fade(previous, 0, 300, () => { previous.pause(); previous.src = ""; });
    if (settings.ambienceEnabled) {
      next.play().catch(() => {});
      fade(next, settings.ambienceVolume, 350);
    }
    return next;
  }

  function stopAmbience() {
    if (!ambience) return;
    const old = ambience;
    ambience = null;
    fade(old, 0, 300, () => { old.pause(); old.src = ""; });
  }

  function toggleMusic() { settings.musicEnabled = !settings.musicEnabled; saveSettings(); if (music) settings.musicEnabled ? music.play().catch(() => {}) : music.pause(); return settings.musicEnabled; }
  function toggleSfx() { settings.sfxEnabled = !settings.sfxEnabled; saveSettings(); return settings.sfxEnabled; }
  function toggleAmbience() { settings.ambienceEnabled = !settings.ambienceEnabled; saveSettings(); if (ambience) settings.ambienceEnabled ? ambience.play().catch(() => {}) : ambience.pause(); return settings.ambienceEnabled; }
  function setMusicVolume(value) { settings.musicVolume = clamp(value); saveSettings(); if (music) music.volume = settings.musicEnabled ? settings.musicVolume : 0; return settings.musicVolume; }
  function setSfxVolume(value) { settings.sfxVolume = clamp(value); saveSettings(); return settings.sfxVolume; }
  function setAmbienceVolume(value) { settings.ambienceVolume = clamp(value); saveSettings(); if (ambience) ambience.volume = settings.ambienceEnabled ? settings.ambienceVolume : 0; return settings.ambienceVolume; }

  root.AudioManager = { playMusic, stopMusic, playSfx, playPlacementSound, playSynth, playAmbience, stopAmbience, toggleMusic, toggleSfx, toggleAmbience, setMusicVolume, setSfxVolume, setAmbienceVolume, getSettings: () => Object.assign({}, settings) };
  root.playMusic = playMusic; root.stopMusic = stopMusic; root.playSfx = playSfx; root.playAmbience = playAmbience; root.stopAmbience = stopAmbience;
  root.toggleMusic = toggleMusic; root.toggleSfx = toggleSfx; root.toggleAmbience = toggleAmbience;
  root.setMusicVolume = setMusicVolume; root.setSfxVolume = setSfxVolume; root.setAmbienceVolume = setAmbienceVolume;
})(window);
