/* Post-traitement, réglable par prototype.

   Version précédente : un néon unique et très appuyé, appliqué aux neuf jeux.
   Deux dégâts. Le catalogue se lisait comme un seul objet au lieu de neuf jeux,
   et le bloom écrasait tout ce qui n'était pas une forme lumineuse sur fond noir
   — donc rendait tout sprite laiteux et délavé.

   Le prototype règle donc sa propre dose via `meta.fx`. Les valeurs sont
   injectées comme constantes dans le source GLSL au moment de la compilation :
   LittleJS n'expose que trois uniformes (iChannel0, iResolution, iTime), et ils
   servent déjà à autre chose.

   Reste dynamique, piloté par le jeu image par image : l'aberration, la
   surcharge de bloom et le flash. Le shell les transmet en peignant un carré de
   contrôle de quelques pixels dans le coin bas-gauche, que le shader lit puis
   recouvre. */

/** Taille (en pixels) du carré de contrôle peint par le shell. */
export const CONTROL_PX = 8;

/** Dosage par défaut : sobre. Un prototype à sprites ne veut presque pas de
    bloom, un prototype vectoriel néon en veut beaucoup — à lui de le dire. */
export const DEFAULT_FX = {
  bloom: 0.35,        // intensité du halo sur les zones claires
  bloomRadius: 22,    // en pixels d'une image de 1920 de haut
  aberration: 0.4,    // multiplicateur de l'aberration chromatique dynamique
  scanlines: 0,       // 0 = aucune. 0.04 suffit à donner un grain d'écran
  vignette: 0.35,     // assombrissement des bords
  saturation: 1.06,   // 1 = neutre
};

const glsl = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export function buildShader(fx = {}) {
  const f = { ...DEFAULT_FX, ...fx };

  return `
#define CTRL ${glsl(CONTROL_PX)}
#define BLOOM ${glsl(f.bloom)}
#define BLOOM_RADIUS ${glsl(f.bloomRadius)}
#define ABERRATION ${glsl(f.aberration)}
#define SCANLINES ${glsl(f.scanlines)}
#define VIGNETTE ${glsl(f.vignette)}
#define SATURATION ${glsl(f.saturation)}

// Canal de contrôle peint par le shell dans le coin bas-gauche :
//   r = aberration chromatique   g = surcharge de bloom   b = flash blanc
vec3 control() { return texture(iChannel0, vec2(CTRL * 0.5) / iResolution.xy).rgb; }

vec3 grab(vec2 uv) { return texture(iChannel0, clamp(uv, 0.0, 1.0)).rgb; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// Bloom en une passe : 20 échantillons répartis sur le disque par l'angle d'or.
// La rotation est décalée par pixel, sinon les échantillons se lisent comme des
// copies fantômes du texte au lieu d'un halo.
// Le rayon est donné pour une image de 1920 de haut puis normalisé, pour que le
// rendu soit identique quelle que soit la résolution de capture.
vec3 bloom(vec2 uv, float radiusRef) {
  float radius = radiusRef * iResolution.y / 1920.0;
  float jitter = hash(gl_FragCoord.xy) * 6.2831853;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 20; i++) {
    float f = (float(i) + 0.5) / 20.0;
    float a = float(i) * 2.39996323 + jitter;
    vec2 off = vec2(cos(a), sin(a)) * sqrt(f) * radius / iResolution.xy;
    vec3 s = grab(uv + off);
    float w = 1.0 - f * 0.7;
    // On ne fait briller que ce qui dépasse déjà : garde les noirs bien noirs.
    float lum = max(0.0, dot(s, vec3(0.299, 0.587, 0.114)) - 0.5);
    sum += s * lum * w;
    total += w;
  }
  return sum / total;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  vec2 res = iResolution.xy;
  vec2 uv  = fragCoord / res;
  vec3 ctrl = control();

  float aberration = ctrl.r * ABERRATION;
  float bloomBoost = ctrl.g;
  float flash      = ctrl.b;

  vec2 fromCenter = uv - 0.5;
  float dist = length(fromCenter);

  // Aberration chromatique : nulle au centre, maximale sur les bords, et pilotée
  // par le jeu (impacts, explosions) plutôt que constante.
  vec3 col;
  float ab = aberration * 0.014 * dist;
  if (ab > 0.0004) {
    col.r = grab(uv + fromCenter * ab).r;
    col.g = grab(uv).g;
    col.b = grab(uv - fromCenter * ab).b;
  } else {
    col = grab(uv);
  }

  if (BLOOM > 0.001)
    col += bloom(uv, BLOOM_RADIUS * (1.0 + bloomBoost)) * (BLOOM + bloomBoost * BLOOM * 2.0);

  col *= 1.0 - smoothstep(0.35, 0.95, dist) * VIGNETTE;

  if (SCANLINES > 0.001)
    col *= 1.0 - SCANLINES * sin(uv.y * 1080.0);

  col = mix(col, vec3(1.0), flash);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, SATURATION);

  // On recouvre le carré de contrôle en recopiant le voisinage.
  if (fragCoord.x < CTRL && fragCoord.y < CTRL)
    col = grab(uv + vec2(CTRL, CTRL) / res);

  fragColor = vec4(col, 1.0);
}
`;
}
