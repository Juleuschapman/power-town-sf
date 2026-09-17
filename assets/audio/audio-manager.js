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
  const sfxFiles = { buttonClick: "button-click.wav", lightSwitchOff: "light_switch_off.wav", lightSwitchOn: "light_switch_on.wav" };

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

  function safeAudio(folder, name, loop) {
    const src = filePath(folder, name);
    if (!src) return null;
    try {
      const audio = new Audio(src);
      audio.loop = !!loop;
      audio.preload = "auto";
      audio.addEventListener("error", () => console.warn("Power Town audio file unavailable:", src), { once: true });
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

  function playSfx(name) {
    if (!settings.sfxEnabled) return null;
    const sound = safeAudio("sfx", sfxFiles[name] || name, false);
    if (!sound) return null;
    sound.volume = settings.sfxVolume;
    sound.play().catch(() => {});
    return sound;
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

  root.AudioManager = { playMusic, stopMusic, playSfx, playAmbience, stopAmbience, toggleMusic, toggleSfx, toggleAmbience, setMusicVolume, setSfxVolume, setAmbienceVolume, getSettings: () => Object.assign({}, settings) };
  root.playMusic = playMusic; root.stopMusic = stopMusic; root.playSfx = playSfx; root.playAmbience = playAmbience; root.stopAmbience = stopAmbience;
  root.toggleMusic = toggleMusic; root.toggleSfx = toggleSfx; root.toggleAmbience = toggleAmbience;
  root.setMusicVolume = setMusicVolume; root.setSfxVolume = setSfxVolume; root.setAmbienceVolume = setAmbienceVolume;
})(window);
