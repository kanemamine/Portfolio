/* Visite 360° : viewer équirectangulaire en WebGL, sans dépendance.

   Le rendu se fait par lancer de rayon dans un fragment shader sur un simple
   quad plein écran : pour chaque pixel on calcule la direction de visée puis on
   échantillonne la panorama. Pas de géométrie de sphère, pas de bibliothèque. */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uYaw, uPitch, uFov, uAspect;
const float PI = 3.14159265359;

void main() {
  // direction de visée dans le repère caméra
  float t = tan(uFov * 0.5);
  vec3 dir = normalize(vec3((vUv.x * 2.0 - 1.0) * t * uAspect,
                            (vUv.y * 2.0 - 1.0) * t,
                            -1.0));
  // rotation : tangage puis lacet
  float cp = cos(uPitch), sp = sin(uPitch);
  dir = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  dir = vec3(dir.x * cy + dir.z * sy, dir.y, -dir.x * sy + dir.z * cy);

  // projection équirectangulaire
  float u = atan(dir.x, -dir.z) / (2.0 * PI) + 0.5;
  float v = acos(clamp(dir.y, -1.0, 1.0)) / PI;
  gl_FragColor = texture2D(uTex, vec2(u, v));
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('shader', gl.getShaderInfoLog(sh));
  }
  return sh;
}

/** Crée le contexte de rendu ; renvoie null si WebGL est indisponible. */
function setup(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE,
    new Uint8Array([20, 28, 48]));

  return {
    gl,
    u: {
      yaw: gl.getUniformLocation(prog, 'uYaw'),
      pitch: gl.getUniformLocation(prog, 'uPitch'),
      fov: gl.getUniformLocation(prog, 'uFov'),
      aspect: gl.getUniformLocation(prog, 'uAspect'),
    },
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Ouvre la visite en plein écran.
 * @param {{src:string,label:string}[]} nodes points de vue
 * @param {string} title titre affiché
 */
export function openPano(nodes, title = '') {
  const root = document.createElement('div');
  root.className = 'pano';
  root.innerHTML = `
    <canvas class="pano-canvas"></canvas>
    <div class="pano-top">
      <span class="pano-title">${title}</span>
      <button class="pano-close" aria-label="Fermer">✕</button>
    </div>
    <div class="pano-hint">Glissez pour regarder autour de vous</div>
    <div class="pano-nodes">
      ${nodes.map((n, i) => `<button class="pano-node ${i === 0 ? 'on' : ''}" data-i="${i}">${n.label}</button>`).join('')}
    </div>
    <div class="pano-load">Chargement…</div>`;
  document.body.appendChild(root);
  document.body.classList.add('pano-open');

  const canvas = root.querySelector('.pano-canvas');
  const ctx = setup(canvas);
  if (!ctx) {
    root.querySelector('.pano-load').textContent = 'WebGL indisponible sur cet appareil.';
    root.querySelector('.pano-close').onclick = close;
    return;
  }
  const { gl, u } = ctx;

  let yaw = 0, pitch = 0, fov = 1.45;      // radians
  let drag = null, idle = 0, alive = true;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function loadNode(i) {
    root.querySelector('.pano-load').style.display = 'block';
    for (const b of root.querySelectorAll('.pano-node')) b.classList.toggle('on', +b.dataset.i === i);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, gl.getParameter(gl.TEXTURE_BINDING_2D));
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      root.querySelector('.pano-load').style.display = 'none';
    };
    img.onerror = () => { root.querySelector('.pano-load').textContent = 'Panorama indisponible'; };
    img.src = nodes[i].src;
  }

  /* --- interaction --- */
  const pt = (e) => (e.touches ? e.touches[0] : e);
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
    canvas.setPointerCapture(e.pointerId);
    idle = -1e9;
    root.querySelector('.pano-hint').style.opacity = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = fov / canvas.clientHeight * 1.1;
    yaw = drag.yaw - (e.clientX - drag.x) * k;
    pitch = clamp(drag.pitch + (e.clientY - drag.y) * k, -1.45, 1.45);
  });
  const end = () => { drag = null; idle = 0; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    fov = clamp(fov + e.deltaY * 0.0015, 0.5, 1.9);
  }, { passive: false });

  // pincement à deux doigts
  let pinch = 0;
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                         e.touches[0].clientY - e.touches[1].clientY);
    if (pinch) fov = clamp(fov * (pinch / d), 0.5, 1.9);
    pinch = d;
  }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch = 0; });

  root.querySelector('.pano-nodes').addEventListener('click', (e) => {
    const b = e.target.closest('.pano-node');
    if (b) loadNode(+b.dataset.i);
  });

  function close() {
    alive = false;
    root.remove();
    document.body.classList.remove('pano-open');
    window.removeEventListener('resize', resize);
  }
  root.querySelector('.pano-close').onclick = close;

  function frame() {
    if (!alive) return;
    if (canvas.width !== Math.floor(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2))) resize();
    // rotation lente quand l'utilisateur ne touche pas l'écran
    idle += 1;
    if (idle > 180) yaw += 0.0009;
    gl.uniform1f(u.yaw, yaw);
    gl.uniform1f(u.pitch, pitch);
    gl.uniform1f(u.fov, fov);
    gl.uniform1f(u.aspect, canvas.width / canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  resize();
  loadNode(0);
  requestAnimationFrame(frame);
  return close;
}
