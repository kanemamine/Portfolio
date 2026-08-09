/* Post-traitement « tape à l'œil », partagé par tous les prototypes.

   Un seul shader plein écran fait le gros du travail visuel : bloom néon,
   aberration chromatique, onde de choc, flash, vignette et scanlines. C'est lui
   qui donne à un prototype de 150 lignes une allure de jeu fini — donc de vidéo
   partageable.

   LittleJS n'expose que trois uniformes (iChannel0, iResolution, iTime) : pas
   moyen d'envoyer des paramètres depuis le jeu. On passe donc par une astuce
   classique : le shell peint un carré de contrôle de quelques pixels dans le
   coin bas-gauche de l'image, dont les canaux encodent l'intensité des effets.
   Le shader le lit, s'en sert, puis le recouvre. Voir CONTROL_PX ci-dessous. */

/** Taille (en pixels) du carré de contrôle peint par le shell. */
export const CONTROL_PX = 8;

export const shaderCode = `
#define CTRL ${CONTROL_PX}.0

// Canal de contrôle peint par le shell dans le coin bas-gauche :
//   r = aberration chromatique   g = surcharge de bloom   b = flash blanc
vec3 control() { return texture(iChannel0, vec2(CTRL * 0.5) / iResolution.xy).rgb; }

vec3 grab(vec2 uv) { return texture(iChannel0, clamp(uv, 0.0, 1.0)).rgb; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// Bloom en une passe : 20 échantillons répartis sur le disque par l'angle d'or.
// La rotation est décalée par pixel, sinon les échantillons se lisent comme des
// copies fantômes du texte au lieu d'un halo.
// Le rayon est exprimé en pixels d'une image 1920 de haut puis normalisé, pour
// que le rendu soit identique quelle que soit la résolution de capture.
vec3 bloom(vec2 uv, float radiusRef) {
  float radius = radiusRef * iResolution.y / 1920.0;
  float jitter = hash(gl_FragCoord.xy) * 6.2831853;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 20; i++) {
    float f = (float(i) + 0.5) / 20.0;
    float a = float(i) * 2.39996323 + jitter;   // angle d'or : couverture uniforme
    vec2 off = vec2(cos(a), sin(a)) * sqrt(f) * radius / iResolution.xy;
    vec3 s = grab(uv + off);
    float w = 1.0 - f * 0.7;
    // On ne fait briller que ce qui dépasse déjà : garde les noirs bien noirs.
    float lum = max(0.0, dot(s, vec3(0.299, 0.587, 0.114)) - 0.28);
    sum += s * lum * w;
    total += w;
  }
  return sum / total;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  vec2 res = iResolution.xy;
  vec2 uv  = fragCoord / res;
  vec3 ctrl = control();

  float aberration = ctrl.r;
  float bloomBoost = ctrl.g;
  float flash      = ctrl.b;

  vec2 fromCenter = uv - 0.5;
  float dist = length(fromCenter);

  // Aberration chromatique : nulle au centre, maximale sur les bords, pilotée
  // par le jeu (impacts, explosions).
  vec3 col;
  float ab = (0.0015 + aberration * 0.012) * dist;
  if (ab > 0.0016) {
    col.r = grab(uv + fromCenter * ab).r;
    col.g = grab(uv).g;
    col.b = grab(uv - fromCenter * ab).b;
  } else {
    col = grab(uv);
  }

  // La surcharge reste volontairement modérée : au-delà, une longue chaîne
  // blanchit l'image et le score devient illisible — l'inverse du but.
  col += bloom(uv, 26.0 + bloomBoost * 26.0) * (1.6 + bloomBoost * 1.3);

  // Vignette : concentre l'œil au centre, indispensable en format vertical.
  col *= 1.0 - smoothstep(0.35, 0.95, dist) * 0.55;

  // Scanlines discrètes + léger balayage : donne une texture « écran ».
  // Exprimées en fraction de hauteur, donc stables à toute résolution.
  col *= 1.0 - 0.045 * sin(uv.y * 1080.0);
  col *= 1.0 + 0.03 * sin(uv.y * 3.0 - iTime * 0.6);

  col = mix(col, vec3(1.0), flash);

  // Saturation légèrement poussée : les couleurs claquent au format miniature.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.18);

  // On recouvre le carré de contrôle en recopiant le voisinage.
  if (fragCoord.x < CTRL && fragCoord.y < CTRL)
    col = grab(uv + vec2(CTRL, CTRL) / res);

  fragColor = vec4(col, 1.0);
}
`;
