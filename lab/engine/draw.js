/* Helpers de dessin partagés par le shell, le réalisateur et les prototypes.

   Module à part pour éviter un cycle d'import entre shell.js et director.js. */

import * as L from '../vendor/littlejs.esm.min.js';

/* LittleJS compose la fonte ainsi : `fontStyle + ' ' + size + 'px ' + font`.
   Le poids doit donc rester hors de la famille, sinon la chaîne CSS est
   invalide et le canvas retombe silencieusement sur du 10px sans-serif. */
export const FONT = '"Arial Black","Arial Bold",Impact,Haettenschweiler,system-ui,sans-serif';

/** Texte en pixels écran, toujours gras : c'est ce qui reste lisible en miniature. */
export function textScreen(str, pos, size, color, lineWidth = 0, lineColor, align = 'center', maxWidth) {
  L.drawTextScreen(str, pos, size, color, lineWidth, lineColor, align, FONT, '900', maxWidth);
}

/** Texte en unités monde. */
export function textWorld(str, pos, size, color, lineWidth = 0, lineColor, align = 'center') {
  L.drawText(str, pos, size, color, lineWidth, lineColor, align, FONT, '900');
}

/** Voile plein écran, peint en 2D pour être garanti au-dessus du monde. */
export function dimScreen(alpha) {
  const c = L.mainContext;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = `rgba(0,0,0,${alpha})`;
  c.fillRect(0, 0, L.mainCanvas.width, L.mainCanvas.height);
  c.restore();
}

/** Même couleur, autre opacité. */
export const fade = (col, alpha) => new L.Color(col.r, col.g, col.b, alpha);

/** Noir translucide, pour les contours de texte. */
export const shade = (alpha) => new L.Color(0, 0, 0, alpha);
