/* Fabrique la piste sonore d'un clip à partir du journal d'événements.
 *
 * Les clips sortaient muets, ce qui est rédhibitoire sur du format court. Le
 * shell journalise chaque son déclenché pendant la capture (`window.LAB.audioLog`,
 * position en images rendues) ; ce module rejoue ce journal hors-ligne et rend
 * un WAV, que tools/capture.mjs muxe dans le MP4.
 *
 * Rendu côté Node plutôt que dans le navigateur : pas de contexte audio à
 * piloter, résultat strictement déterministe, et testable en isolation.
 *
 * `synth()` est le générateur ZzFX transcrit depuis lab/vendor/littlejs.esm.min.js
 * pour que la piste rendue soit exactement ce qu'on entend en jouant. Ne pas le
 * « nettoyer » : c'est une formule, pas du code métier.
 */

const SAMPLE_RATE = 44100;

const { PI, sin, cos, tan, abs, sign, max, min, round } = Math;

/** Générateur ZzFX — transcription fidèle. Rend un tableau d'échantillons. */
export function synth(
  volume = 1, randomness = 0.05, frequency = 220, attack = 0, sustain = 0,
  release = 0.1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0,
  pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0,
  bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0, filter = 0,
) {
  const sampleRate = SAMPLE_RATE, PI2 = PI * 2;
  /* La part d'aléatoire de ZzFX est neutralisée : une piste doit se re-rendre
     à l'identique, comme l'image. */
  let startSlide = slide *= 500 * PI2 / sampleRate / sampleRate;
  let startFrequency = frequency *= PI2 / sampleRate;
  let modOffset = 0, repeat = 0, crush = 0, jump = 1, length;
  const b = [];
  let t = 0, i = 0, s = 0, f;
  const quality = 2, w = PI2 * abs(filter) * 2 / sampleRate;
  const cosw = cos(w), alpha = sin(w) / 2 / quality;
  const a0 = 1 + alpha, a1 = -2 * cosw / a0, a2 = (1 - alpha) / a0;
  const b0 = (1 + sign(filter) * cosw) / 2 / a0, b1 = -(sign(filter) + cosw) / a0, b2 = b0;
  let x2 = 0, x1 = 0, y2 = 0, y1 = 0;

  const minAttack = 9;
  attack = attack * sampleRate || minAttack;
  decay *= sampleRate; sustain *= sampleRate; release *= sampleRate; delay *= sampleRate;
  deltaSlide *= 500 * PI2 / sampleRate ** 3;
  modulation *= PI2 / sampleRate;
  pitchJump *= PI2 / sampleRate;
  pitchJumpTime *= sampleRate;
  repeatTime = repeatTime * sampleRate | 0;

  for (length = attack + decay + sustain + release + delay | 0; i < length; b[i++] = s * volume) {
    if (!(++crush % (bitCrush * 100 | 0))) {
      s = shape ? shape > 1 ? shape > 2 ? shape > 3
        ? (shape > 4 ? (t / PI2 % 1 < shapeCurve / 2 ? 1 : -1) : sin(t ** 3))
        : max(min(tan(t), 1), -1)
        : 1 - (2 * t / PI2 % 2 + 2) % 2
        : 1 - 4 * abs(round(t / PI2) - t / PI2) : sin(t);
      s = (repeatTime ? 1 - tremolo + tremolo * sin(PI2 * i / repeatTime) : 1)
        * (shape > 4 ? s : sign(s) * abs(s) ** shapeCurve)
        * (i < attack ? i / attack
          : i < attack + decay ? 1 - (i - attack) / decay * (1 - sustainVolume)
          : i < attack + decay + sustain ? sustainVolume
          : i < length - delay ? (length - i - delay) / release * sustainVolume : 0);
      s = delay ? s / 2 + (delay > i ? 0 : (i < length - delay ? 1 : (length - i) / delay) * b[i - delay | 0] / 2 / volume) : s;
      if (filter) s = y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
    }
    f = (frequency += slide += deltaSlide) * cos(modulation * modOffset++);
    t += f + f * noise * sin(i ** 5);
    if (jump && ++jump > pitchJumpTime) { frequency += pitchJump; startFrequency += pitchJump; jump = 0; }
    if (repeatTime && !(++repeat % repeatTime)) { frequency = startFrequency; slide = startSlide; jump ||= 1; }
  }
  return b;
}

/** Mélange un son dans le tampon, à une position donnée en secondes. */
function mix(buffer, samples, atSeconds, gain) {
  const start = Math.round(atSeconds * SAMPLE_RATE);
  const n = Math.min(samples.length, buffer.length - start);
  for (let i = 0; i < n; i++) buffer[start + i] += samples[i] * gain;
}

/* ---------------- Lit musical ----------------
   Gamme pentatonique : n'importe quelle suite de notes sonne juste, donc la
   boucle ne fausse jamais quel que soit le découpage du clip. Volontairement
   discrète — elle porte le rythme, elle ne doit pas couvrir le jeu. */

const PENTA = [0, 3, 5, 7, 10];
const noteHz = (step) => 110 * Math.pow(2, (PENTA[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);

function addMusic(buffer, seconds, intensity) {
  const bpm = 96;
  const beat = 60 / bpm;
  const bassVoice = [0.5, , 55, 0.01, 0.18, 0.22, 1, 1.2, , , , , , , , , , 0.6, 0.05];
  const bells = [0.28, , 440, 0.01, 0.04, 0.16, , 1.6, , , , , , , , , , 0.5, 0.03];

  for (let i = 0, t = 0; t < seconds; i++, t += beat) {
    /* Basse sur les temps forts. */
    if (i % 2 === 0) {
      const step = [0, 0, 3, 2][(i / 2) % 4 | 0];
      mix(buffer, synth(...withFreq(bassVoice, noteHz(step))), t, 0.5);
    }
    /* Arpège : il se densifie quand la partie s'emballe. */
    const busy = intensity(t);
    if (i % 2 === 1 || busy > 0.5) {
      const step = 5 + ((i * 3) % 5);
      mix(buffer, synth(...withFreq(bells, noteHz(step) * 2)), t + beat / 2, 0.22 + busy * 0.16);
    }
  }
}

function withFreq(params, hz) {
  const p = params.slice();
  p[2] = hz;
  return p;
}

/* ---------------- Assemblage ---------------- */

/**
 * @param {Array<{f:number,p:Array,v:number,r:number}>} log événements sonores
 * @param {number} frames durée du clip en images
 * @param {number} fps
 * @param {boolean} music ajouter le lit musical
 * @returns {Buffer} fichier WAV mono 16 bits
 */
export function renderTrack(log, frames, fps = 60, music = true) {
  const seconds = frames / fps + 0.6;          // une queue pour ne pas couper la dernière note
  const buffer = new Float32Array(Math.ceil(seconds * SAMPLE_RATE));

  for (const e of log) {
    const params = e.p.slice();
    /* `play(volume, pitch)` de LittleJS module le volume et la fréquence. */
    params[0] = (params[0] ?? 1) * (e.v ?? 1);
    if (e.r && e.r !== 1) params[2] = (params[2] ?? 220) * e.r;
    mix(buffer, synth(...params), e.f / fps, 0.9);
  }

  if (music) {
    /* Densité des événements par seconde : la musique suit l'action. */
    const perSecond = new Float32Array(Math.ceil(seconds) + 1);
    for (const e of log) perSecond[Math.floor(e.f / fps)] += 1;
    const intensity = (t) => Math.min(1, (perSecond[Math.floor(t)] || 0) / 6);
    addMusic(buffer, seconds, intensity);
  }

  return toWav(limit(buffer));
}

/** Limiteur doux : la somme de dizaines de sons sature sinon en écrêtage dur. */
function limit(buffer) {
  let peak = 0;
  for (const v of buffer) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0.9 ? 0.9 / peak : 1;
  for (let i = 0; i < buffer.length; i++) buffer[i] = Math.tanh(buffer[i] * gain * 1.1) * 0.92;
  return buffer;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);           // PCM
  header.writeUInt16LE(1, 22);           // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
