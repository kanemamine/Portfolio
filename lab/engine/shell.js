/* Le shell : tout ce qu'un prototype n'a pas à réécrire.

   Un prototype ne décrit que sa mécanique (reset / update / draw / bot). Le
   shell lui apporte le cadre vertical, la caméra, le HUD, les états de partie,
   le juice (shake, hitstop, ralenti, particules, popups), le post-traitement,
   le pilote automatique et le mode capture.

   Contrat d'un prototype — voir lab/games/_template/game.js :

     export default {
       meta:   { slug, title, hook, palette, ... },
       reset(run) {},          // (re)démarrage d'une partie
       update(run) {},         // logique, pas de temps fixe : run.dt
       draw(run) {},           // rendu monde (unités, y vers le haut)
       drawUI(run) {},         // rendu écran facultatif (pixels)
       bot(run) {},            // pilote auto : lit l'état, appelle run.hold()
     }
*/

import * as L from '../vendor/littlejs.esm.min.js';
import { shaderCode, CONTROL_PX } from './shader.js';
import { makeDirector } from './director.js';
import { FONT, textScreen, textWorld, dimScreen, fade, shade } from './draw.js';

export { L };
export { FONT, textScreen, textWorld, dimScreen, fade, shade };
export const vec2 = L.vec2;
export const rgb = L.rgb;
export const hsl = L.hsl;

/** Largeur du monde en unités. La hauteur en découle via le format d'image. */
export const WORLD_W = 20;

/** Formats disponibles — le vertical est le défaut, c'est là que ça se partage. */
const FORMATS = {
  '9x16': [1080, 1920],
  '1x1': [1080, 1080],
  '16x9': [1920, 1080],
};

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function boot(game) {
  const P = new URLSearchParams(location.search);
  const meta = game.meta;
  const cfg = {
    seed: P.has('seed') ? (+P.get('seed') >>> 0) : hashSeed(meta.slug),
    bot: P.get('bot') === '1',
    rec: P.get('rec') === '1',
    format: FORMATS[P.get('format')] ? P.get('format') : '9x16',
    /** En capture on réduit la résolution : le rendu logiciel headless est lent,
        ffmpeg ré-agrandit ensuite proprement. */
    scale: P.has('scale') ? +P.get('scale') : 1,
    maxTime: P.has('maxTime') ? +P.get('maxTime') : 0,
  };
  cfg.mute = P.get('mute') === '1' || cfg.rec;
  if (cfg.rec) cfg.bot = true;
  /* Mode sans rendu : sert au repérage de graines (tools/capture.mjs), où l'on
     veut simuler des milliers de frames sans jamais dessiner un pixel. */
  cfg.headless = P.get('headless') === '1';
  if (cfg.headless) cfg.bot = true;

  const [baseW, baseH] = FORMATS[cfg.format];
  const canvasW = Math.round(baseW * cfg.scale);
  const canvasH = Math.round(baseH * cfg.scale);

  const palette = Object.assign(
    { bg: rgb(0.04, 0.05, 0.10), ink: rgb(1, 1, 1), a: hsl(0.55, 1, 0.6), b: hsl(0.9, 1, 0.65), c: hsl(0.13, 1, 0.6) },
    meta.palette || {}
  );

  const run = {
    L, cfg, meta, palette,
    W: WORLD_W,
    H: (WORLD_W * canvasH) / canvasW,
    /** Bornes du monde, y vers le haut, origine au centre. */
    left: -WORLD_W / 2, right: WORLD_W / 2,
    get bottom() { return -this.H / 2; },
    get top() { return this.H / 2; },

    dt: 1 / 60,
    t: 0,
    frame: 0,
    /* Hasard de jeu. Il ne doit être consommé QUE par la logique du prototype :
       c'est ce qui garantit qu'une graine repérée sans rendu donne exactement la
       même partie une fois filmée. */
    rng: new L.RandomGenerator(cfg.seed),
    /* Hasard d'habillage (secousses, etc.), volontairement séparé : l'intro du
       clip anime la caméra avant que le jeu ne démarre, et ces tirages
       décaleraient tout le flux de jeu. */
    fxRng: new L.RandomGenerator(cfg.seed ^ 0x9e3779b9),

    state: 'play',      // 'play' | 'over'
    score: 0,
    best: 0,
    combo: 0,
    deaths: 0,

    down: false,        // bouton maintenu
    pressed: false,     // appuyé cette frame
    released: false,    // relâché cette frame

    data: {},           // bac à sable libre pour le prototype
  };

  /* ---------------- Juice ---------------- */

  let shakeAmt = 0, hitstop = 0, flash = 0, aberration = 0, bloomBoost = 0;
  let slowUntil = 0, slowScale = 1;
  const popups = [];

  Object.assign(run, {
    /** Secousse caméra. 0.3 = petit impact, 1.5 = explosion. */
    shake(a = 0.6) { shakeAmt = Math.min(3, shakeAmt + a); },
    /** Gel de l'image : c'est ce qui fait « claquer » un impact. */
    hitstop(s = 0.06) { hitstop = Math.max(hitstop, s); },
    /** Ralenti temporaire (scale < 1). */
    slowmo(scale = 0.35, dur = 0.5) { slowScale = scale; slowUntil = run.t + dur; },
    /** Flash blanc plein écran. */
    flash(a = 0.5) { flash = Math.min(1, flash + a); },
    /** Aberration chromatique ponctuelle. */
    aberrate(a = 0.6) { aberration = Math.min(1, aberration + a); },
    /** Surcharge de bloom (le monde « surchauffe »). */
    glow(a = 0.5) { bloomBoost = Math.min(1, bloomBoost + a); },

    /** Impact complet : le raccourci à appeler pour 90 % des événements. */
    impact(power = 1) {
      run.shake(0.5 * power);
      run.hitstop(0.04 * power);
      run.aberrate(0.4 * power);
      run.glow(0.3 * power);
    },

    /** Gerbe de particules additives. */
    burst(pos, color, count = 24, opts = {}) {
      const o = Object.assign({ speed: 8, size: 0.5, time: 0.5, cone: Math.PI, angle: 0, gravity: 0 }, opts);
      const end = new L.Color(color.r, color.g, color.b, 0);
      new L.ParticleEmitter(
        pos, o.angle, 0, 0.1, count / 0.1, o.cone,
        undefined,                       // pas de texture : carrés lumineux
        color, color, end, end,
        o.time, o.size, o.size * 0.1, o.speed, 0.06,
        0.95, 0.95, o.gravity, Math.PI, 0.1, 0.4,
        false, true                      // additive
      );
    },

    /** Texte flottant (gains, combos). */
    popup(pos, text, color = palette.ink, size = 1.5) {
      const p = pos.copy();
      /* Une chaîne rapide produit des gains au même endroit : on les décale pour
         qu'ils restent lisibles au lieu de se superposer en bouillie. */
      for (const q of popups) {
        if (Math.abs(q.pos.x - p.x) < 2.2 && Math.abs(q.pos.y - p.y) < 1.1) p.y = q.pos.y + 1.2;
      }
      popups.push({ pos: p, text: String(text), color, size, life: 0.9 });
      if (popups.length > 8) popups.shift();
    },

    addScore(n, pos = null) {
      run.score += n;
      if (pos) run.popup(pos, '+' + n, palette.c);
    },

    gameOver() {
      if (run.state !== 'play') return;
      run.state = 'over';
      run.deaths++;
      run.best = Math.max(run.best, run.score);
      try { localStorage.setItem('lab.best.' + meta.slug, String(run.best)); } catch (e) { /* ignore */ }
      run.shake(1.6); run.flash(0.45); run.aberrate(1); run.slowmo(0.3, 0.45);
      if (!cfg.mute) sfxFail.play();
      director.onGameOver(run);
    },

    /** Entrée virtuelle, utilisée par le bot. */
    hold(v) { botWant = !!v; },
    tap() { botWant = true; botTapFrames = 2; },
  });

  /* ---------------- Sons ---------------- */
  /* ZzFX : chaque son tient dans un tableau de nombres, zéro fichier. */
  const sfxTap = new L.Sound([, , 420, , 0.02, 0.06, 1, 1.8, , , 180, 0.02, , , , , , 0.6, 0.02]);
  const sfxScore = new L.Sound([, , 780, , 0.05, 0.14, , 1.6, , , 320, 0.05, , , , , , 0.7, 0.03]);
  const sfxFail = new L.Sound([2, , 180, 0.02, 0.2, 0.4, 4, 1.5, , , , , , 0.6, , 0.4, , 0.5, 0.15]);
  run.sfx = { tap: sfxTap, score: sfxScore, fail: sfxFail };

  /* ---------------- Pilote automatique ---------------- */

  let botWant = false, botTapFrames = 0;

  /* ---------------- Réalisateur (mode capture) ---------------- */

  const director = makeDirector(run);

  /* ---------------- Cycle LittleJS ---------------- */

  function gameInit() {
    if (L.headlessMode) { startRound(); window.__BOOTED = true; return; }
    L.setCanvasFixedSize(vec2(canvasW, canvasH));
    L.setCameraScale(canvasW / WORLD_W);
    L.setCameraPos(vec2(0, 0));
    L.setGravity(vec2(0, 0));
    L.setFontDefault(FONT);
    L.setSoundVolume(cfg.mute ? 0 : 0.4);
    new L.PostProcessPlugin(shaderCode, true);

    try { run.best = +(localStorage.getItem('lab.best.' + meta.slug) || 0); } catch (e) { /* ignore */ }

    startRound();
    window.__BOOTED = true;
  }

  function startRound() {
    run.state = 'play';
    run.score = 0;
    run.combo = 0;
    run.t = 0;
    run.rng = new L.RandomGenerator(cfg.seed + run.deaths * 7919);
    run.fxRng = new L.RandomGenerator((cfg.seed + run.deaths * 7919) ^ 0x9e3779b9);
    popups.length = 0;
    L.engineObjectsDestroy();
    game.reset(run);
  }
  run.restart = startRound;

  function gameUpdate() {
    /* Hitstop : on gèle la logique mais on continue à rendre. */
    if (hitstop > 0) { hitstop -= 1 / 60; run.pressed = run.released = false; return; }

    /* Pendant l'accroche du clip, la partie est gelée *entièrement* : ni temps de
       jeu, ni pilote, ni logique. Sans ce gel total, la partie filmée ne démarre
       pas dans le même état que celle repérée sans rendu — le bot jouerait dans
       le vide pendant 1,3 s et le premier appui tomberait ailleurs. Or c'est
       l'égalité stricte des deux runs qui donne son sens au repérage. */
    const frozen = director.phase === 'intro';

    L.setTimeScale(run.t < slowUntil ? slowScale : 1);
    if (!frozen) {
      run.dt = L.timeDelta;
      run.t += run.dt;
      run.frame++;
    }

    /* Entrées : le bot et l'humain passent par le même canal. */
    const prevDown = run.down;
    if (cfg.bot) {
      if (frozen) botWant = false;
      else if (run.state === 'play' && game.bot) game.bot(run);
      if (botTapFrames > 0 && --botTapFrames === 0) botWant = false;
      run.down = botWant;
    } else {
      run.down = !frozen && (L.mouseIsDown(0) || L.keyIsDown('Space') || L.keyIsDown('ArrowUp'));
    }
    run.pressed = run.down && !prevDown;
    run.released = !run.down && prevDown;

    if (!frozen) {
      director.checkCut(run);
      if (run.state === 'play') game.update(run);
      else if (run.pressed || (cfg.bot && director.wantsRestart())) startRound();
    }

    /* Décroissance des effets. */
    const k = Math.pow(0.001, run.dt);
    shakeAmt *= Math.pow(0.0005, run.dt);
    flash *= Math.pow(0.00002, run.dt);
    aberration *= k;
    bloomBoost *= Math.pow(0.02, run.dt);
    for (let i = popups.length; i--;) {
      const p = popups[i];
      p.life -= run.dt;
      p.pos = p.pos.add(vec2(0, run.dt * 2.4));
      if (p.life <= 0) popups.splice(i, 1);
    }

    /* Secousse : appliquée à la caméra, jamais au monde — et tirée du hasard
       d'habillage, pour ne pas perturber le déroulé de la partie. */
    const s = shakeAmt * 0.35;
    L.setCameraPos(vec2(run.fxRng.float(-s, s), run.fxRng.float(-s, s)));
  }

  function gameUpdatePost() {}

  function gameRender() {
    if (L.headlessMode) return;
    drawBackground(run);
    game.draw(run);
    for (const p of popups) {
      const a = Math.min(1, p.life / 0.35);
      textWorld(p.text, p.pos, p.size, new L.Color(p.color.r, p.color.g, p.color.b, a),
        0.16, new L.Color(0, 0, 0, a * 0.8));
    }
  }

  function gameRenderPost() {
    if (L.headlessMode) return;
    director.tick();
    drawHUD(run);
    if (game.drawUI) game.drawUI(run);
    director.draw(run);
    drawControlPixel();
  }

  /** Carré de contrôle lu par le shader (voir engine/shader.js). */
  function drawControlPixel() {
    const c = L.mainContext;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = `rgb(${Math.round(Math.min(1, aberration) * 255)},${Math.round(Math.min(1, bloomBoost) * 255)},${Math.round(Math.min(1, flash) * 255)})`;
    c.fillRect(0, L.mainCanvas.height - CONTROL_PX, CONTROL_PX, CONTROL_PX);
    c.restore();
  }

  /* ---------------- Décor et HUD communs ---------------- */

  function drawBackground(r) {
    L.drawRect(vec2(0, 0), vec2(r.W, r.H + 2), palette.bg);
    /* Grille en perspective légère : lisible, peu coûteuse, très « néon ». */
    const grid = new L.Color(palette.a.r, palette.a.g, palette.a.b, 0.07);
    const step = 2;
    const off = (r.t * (meta.scroll || 0)) % step;
    for (let x = r.left; x <= r.right; x += step) L.drawLine(vec2(x, r.bottom), vec2(x, r.top), 0.03, grid);
    for (let y = r.bottom - off; y <= r.top; y += step) L.drawLine(vec2(r.left, y), vec2(r.right, y), 0.03, grid);
  }

  function drawHUD(r) {
    const w = L.mainCanvas.width, h = L.mainCanvas.height;
    const px = w / 1080;                       // échelle du HUD
    if (director.hideHUD) return;

    textScreen(Math.floor(r.score), vec2(w / 2, h * 0.085), 150 * px,
      palette.ink, 12 * px, new L.Color(0, 0, 0, 0.7));

    if (r.combo > 1) {
      const pop = 1 + 0.25 * Math.exp(-(r.t % 1) * 8);
      textScreen('x' + r.combo, vec2(w / 2, h * 0.15), 66 * px * pop,
        palette.c, 9 * px, new L.Color(0, 0, 0, 0.6));
    }

    if (r.state === 'over' && !cfg.rec) {
      textScreen('TOUCHE POUR REJOUER', vec2(w / 2, h * 0.58), 52 * px,
        palette.ink, 9 * px, new L.Color(0, 0, 0, 0.7), 'center', w * 0.9);
      textScreen('record ' + r.best, vec2(w / 2, h * 0.635), 38 * px,
        palette.a, 7 * px, new L.Color(0, 0, 0, 0.7));
    }
  }

  /* ---------------- Pont de capture ---------------- */

  /* Pont exposé à tools/capture.mjs. Le post-traitement recompose glCanvas +
     mainCanvas puis écrit le résultat dans glCanvas : c'est donc lui, et lui
     seul, qui porte l'image finale. */
  window.LAB = {
    run, meta, cfg,
    get done() { return director.finished; },
    get phase() { return director.phase; },
    get canvas() { return L.glCanvas || L.mainCanvas; },
    /** À n'appeler que juste après le rendu d'une frame : le tampon WebGL n'est
        pas préservé d'une tâche à l'autre. */
    grab(quality = 0.94) { return this.canvas.toDataURL('image/jpeg', quality); },
    get stats() {
      return { score: run.score, best: run.best, t: run.t, deaths: run.deaths, state: run.state, frame: run.frame };
    },
  };

  L.setShowSplashScreen(false);
  if (cfg.headless) L.setHeadlessMode(true);
  L.engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
}
