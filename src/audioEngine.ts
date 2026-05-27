// Acoustic guitar synthesis using Web Audio API
// Uses additive synthesis with body resonance simulation
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playGuitarNote(frequency: number, stringIndex: number) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // String character: lower strings are bassier
  const bassRatio = (5 - stringIndex) / 5; // 1.0 for low E, 0 for high E
  const decayTime = 2.0 + bassRatio * 1.5; // bass strings sustain longer

  // --- Karplus-Strong style via delay feedback ---
  const sampleRate = ctx.sampleRate;
  const delayTime = 1 / frequency;

  // Noise burst (pluck excitation)
  const burstDuration = 0.02;
  const bufferSize = Math.floor(sampleRate * burstDuration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // Shaped noise burst - stronger at start
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  // Body resonance filter (acoustic guitar body frequencies)
  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = 'peaking';
  bodyFilter.frequency.value = 200 + bassRatio * 120;
  bodyFilter.gain.value = 8;
  bodyFilter.Q.value = 2;

  const bodyFilter2 = ctx.createBiquadFilter();
  bodyFilter2.type = 'peaking';
  bodyFilter2.frequency.value = 400;
  bodyFilter2.gain.value = 4;
  bodyFilter2.Q.value = 1.5;

  // Bright pluck high pass
  const pluckFilter = ctx.createBiquadFilter();
  pluckFilter.type = 'bandpass';
  pluckFilter.frequency.value = frequency * 3;
  pluckFilter.Q.value = 2;

  // Low-pass to tame harshness (acoustic warmth)
  const warmFilter = ctx.createBiquadFilter();
  warmFilter.type = 'lowpass';
  warmFilter.frequency.value = 4000 - bassRatio * 1500;
  warmFilter.Q.value = 0.5;

  // Harmonics via oscillators (sustain body)
  const harmonicData: [number, number, number][] = [
    // [multiple, gainAmount, decayMult]
    [1, 0.55, 1.0],
    [2, 0.20, 0.6],
    [3, 0.10, 0.4],
    [4, 0.05, 0.3],
    [5, 0.025, 0.2],
    [6, 0.015, 0.15],
  ];

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0, now);
  masterGain.gain.linearRampToValueAtTime(0.55 + bassRatio * 0.1, now + 0.003);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

  masterGain.connect(bodyFilter);
  bodyFilter.connect(bodyFilter2);
  bodyFilter2.connect(warmFilter);
  warmFilter.connect(ctx.destination);

  // Harmonic oscillators
  harmonicData.forEach(([mult, gain, decayMult]) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = mult === 1 ? 'sawtooth' : 'sine';
    osc.frequency.value = frequency * mult;
    // Slight inharmonicity for acoustic character
    osc.detune.value = mult > 1 ? (Math.random() - 0.5) * 3 : 0;

    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + decayTime * decayMult);

    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + decayTime * decayMult + 0.05);
  });

  // Pluck transient (noise + bright filter)
  const transientGain = ctx.createGain();
  transientGain.gain.setValueAtTime(0.18 + bassRatio * 0.08, now);
  transientGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  noiseSource.connect(pluckFilter);
  pluckFilter.connect(transientGain);
  transientGain.connect(warmFilter);
  noiseSource.start(now);
  noiseSource.stop(now + burstDuration);

  // Subtle room reverb via a short delay
  const reverbDelay = ctx.createDelay(0.1);
  reverbDelay.delayTime.value = 0.035;
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0.08;
  warmFilter.connect(reverbDelay);
  reverbDelay.connect(reverbGain);
  reverbGain.connect(ctx.destination);
}
