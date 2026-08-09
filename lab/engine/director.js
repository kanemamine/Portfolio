/* Le réalisateur : transforme une partie en clip.

   Hors capture il ne fait rien (phase 'play' immédiate) — on veut jouer, pas
   regarder un générique. En capture (?rec=1) il découpe le clip en trois temps,
   calibrés pour le format court vertical :

     intro  ~1.3 s  le hook. C'est lui qui décide si on scrolle ou pas.
     play          la partie, jouée par le bot.
     outro  ~2.4 s  le score, le titre, l'appel à l'action.

   Il expose `finished` : c'est le signal d'arrêt de tools/capture.mjs. */

import * as L from '../vendor/littlejs.esm.min.js';
import { textScreen, dimScreen, fade, shade } from './draw.js';

const INTRO = 1.3;
const OUTRO = 2.4;

const ease = (x) => 1 - Math.pow(1 - x, 3);

export function makeDirector(run) {
  const rec = run.cfg.rec;
  const meta = run.meta;

  const d = {
    phase: rec ? 'intro' : 'play',
    finished: false,
    hideHUD: false,
    tp: 0,
  };

  /* Le montage se compte en frames rendues, donc en secondes réelles de vidéo.
     Attention : dans LittleJS `timeDelta` est constant et `setTimeScale` joue sur
     le *nombre* d'updates par frame — un ralenti étirerait l'intro et le
     générique si on cadençait le réalisateur depuis la boucle de logique. */
  d.tick = () => {
    d.tp += 1 / 60;
    d.hideHUD = d.phase !== 'play';
    if (d.phase === 'intro' && d.tp >= INTRO) { d.phase = 'play'; d.tp = 0; }
    else if (d.phase === 'outro' && d.tp >= OUTRO) d.finished = true;
  };

  /* Coupure de sécurité, comptée en secondes de vidéo (d.tp) et non en temps de
     jeu : un prototype bourré de gels d'image et de ralentis étire fortement le
     second par rapport au premier, et c'est la durée vue qui décide si le clip
     est regardé jusqu'au bout. */
  d.checkCut = (r) => {
    if (rec && d.phase === 'play' && r.cfg.maxTime && d.tp > r.cfg.maxTime && r.state === 'play') r.gameOver();
  };

  d.onGameOver = () => {
    d.tp = 0;                       // sert aussi de délai avant relance en autoplay
    if (rec) d.phase = 'outro';
  };

  /** En autoplay hors capture, on relance tout seul pour la démo du hub. */
  d.wantsRestart = () => !rec && run.state === 'over' && d.tp > 1.2;

  d.draw = (r) => {
    if (L.headlessMode || (d.phase !== 'intro' && d.phase !== 'outro')) return;
    const w = L.mainCanvas.width, h = L.mainCanvas.height;
    const px = w / 1080;
    const { ink, a: accent, c: highlight } = r.palette;

    if (d.phase === 'intro') {
      const inP = Math.min(1, d.tp / 0.45);
      const outP = Math.max(0, (d.tp - (INTRO - 0.3)) / 0.3);
      const a = ease(inP) * (1 - outP);

      dimScreen(0.66 * a);

      const y = h * 0.42 - (1 - ease(inP)) * h * 0.05;
      textScreen(meta.title.toUpperCase(), vec(w / 2, y), 132 * px,
        fade(ink, a), 16 * px, shade(0.85 * a), 'center', w * 0.88);

      if (meta.hook) {
        textScreen(meta.hook.toUpperCase(), vec(w / 2, y + 118 * px), 58 * px,
          fade(highlight, a), 11 * px, shade(0.8 * a), 'center', w * 0.88);
      }
      return;
    }

    /* Générique de fin : le score d'abord, énorme, puis le titre et l'appel. */
    const a = ease(Math.min(1, d.tp / 0.35));
    dimScreen(0.76 * a);

    const pop = 1 + 0.14 * Math.exp(-d.tp * 5) * Math.cos(d.tp * 26);
    textScreen(meta.scoreLabel || 'SCORE', vec(w / 2, h * 0.35), 54 * px,
      fade(accent, a), 9 * px, shade(0.8 * a), 'center', w * 0.86);
    textScreen(Math.floor(r.score) + (meta.scoreSuffix || ''), vec(w / 2, h * 0.45), 230 * px * pop,
      fade(ink, a), 18 * px, shade(0.85 * a), 'center', w * 0.92);

    textScreen(meta.title.toUpperCase(), vec(w / 2, h * 0.60), 88 * px,
      fade(ink, a), 12 * px, shade(0.85 * a), 'center', w * 0.88);

    const cta = meta.cta || 'JOUE GRATUITEMENT · LIEN EN BIO';
    const blink = 0.7 + 0.3 * Math.sin(d.tp * 7);
    textScreen(cta, vec(w / 2, h * 0.675), 46 * px,
      fade(highlight, a * blink), 8 * px, shade(0.8 * a), 'center', w * 0.88);
  };

  return d;
}

const vec = (x, y) => L.vec2(x, y);
