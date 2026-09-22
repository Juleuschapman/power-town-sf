#!/usr/bin/env node
// Generate the Natural Gas plant placement cue as a layered, short mono WAV.
// This is intentionally deterministic so the approved sound can be regenerated.
const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const duration = 1.02;
const length = Math.round(sampleRate * duration);
const samples = new Float64Array(length);
let seed = 0x4e475053;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function noise() { return random() * 2 - 1; }
function env(t, start, attack, release) {
  if (t < start || t > start + attack + release) return 0;
  if (t < start + attack) return (t - start) / Math.max(attack, 1e-5);
  return Math.exp(-(t - start - attack) / Math.max(release, 1e-5));
}
function add(sample, value) { samples[sample] += value; }
function addTone(start, lengthSeconds, fromHz, toHz, amplitude, wave = 'sine', attack = 0.004) {
  const startSample = Math.floor(start * sampleRate);
  const count = Math.floor(lengthSeconds * sampleRate);
  let phase = 0;
  for (let i = 0; i < count && startSample + i < length; i++) {
    const t = i / sampleRate;
    const p = i / Math.max(count - 1, 1);
    const frequency = fromHz + (toHz - fromHz) * p;
    phase += (Math.PI * 2 * frequency) / sampleRate;
    const decay = Math.exp(-t / Math.max(lengthSeconds * 0.42, 0.01));
    const a = (i < attack * sampleRate ? i / (attack * sampleRate) : 1) * decay * amplitude;
    let v = Math.sin(phase);
    if (wave === 'triangle') v = 2 * Math.abs(2 * (phase / (Math.PI * 2) - Math.floor(phase / (Math.PI * 2) + 0.5))) - 1;
    add(startSample + i, v * a);
  }
}
function addFilteredNoise(start, lengthSeconds, amplitude, lowPass, highPass = 0) {
  const startSample = Math.floor(start * sampleRate);
  const count = Math.floor(lengthSeconds * sampleRate);
  let low = 0;
  let previous = 0;
  const lp = Math.exp(-2 * Math.PI * lowPass / sampleRate);
  const hp = highPass ? Math.exp(-2 * Math.PI * highPass / sampleRate) : 0;
  for (let i = 0; i < count && startSample + i < length; i++) {
    const t = i / sampleRate;
    const p = i / Math.max(count - 1, 1);
    const n = noise();
    low = (1 - lp) * n + lp * low;
    let v = low;
    if (highPass) { const next = (1 - hp) * (previous + v - previous); previous = v; v = next; }
    const a = (p < 0.025 ? p / 0.025 : 1) * Math.exp(-t / Math.max(lengthSeconds * 0.55, 0.01)) * amplitude;
    add(startSample + i, v * a);
  }
}

// 1) Heavy construction thunk: low pitch drop plus a compact filtered impact.
addTone(0.045, 0.28, 105, 48, 0.78, 'sine', 0.002);
addFilteredNoise(0.045, 0.16, 0.42, 900, 35);
// 2) Metal clank: short, inharmonic resonances immediately after the thunk.
addTone(0.19, 0.25, 920, 610, 0.23, 'sine', 0.001);
addTone(0.195, 0.2, 1460, 1010, 0.17, 'triangle', 0.001);
addTone(0.205, 0.15, 2180, 1500, 0.09, 'sine', 0.001);
addFilteredNoise(0.19, 0.11, 0.16, 3400, 700);
// 3) Very short low machinery rumble underneath the placement.
addTone(0.02, 0.62, 62, 43, 0.18, 'sine', 0.012);
addFilteredNoise(0.08, 0.5, 0.09, 150, 25);
// 4) Soft muffled gas ignition “whump”, not an explosion.
addTone(0.39, 0.32, 78, 38, 0.32, 'sine', 0.008);
addFilteredNoise(0.39, 0.24, 0.22, 260, 20);
// 5) Tiny pneumatic pressure release at the end.
addFilteredNoise(0.73, 0.25, 0.17, 5200, 1300);

let peak = 0;
for (const value of samples) peak = Math.max(peak, Math.abs(value));
const gain = peak > 0 ? 0.9 / peak : 1;
const dataSize = length * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVE', 8);
buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
for (let i = 0; i < length; i++) {
  const value = Math.max(-1, Math.min(1, samples[i] * gain));
  buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}
const output = path.join(__dirname, 'assets', 'audio', 'sfx', 'place-gas.wav');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, buffer);
console.log(`Wrote ${output} (${buffer.length} bytes, ${duration.toFixed(2)} seconds, ${sampleRate} Hz, mono 16-bit PCM)`);
