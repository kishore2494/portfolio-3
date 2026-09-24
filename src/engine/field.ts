/**
 * One persistent WebGL2 particle field. 65,536 particles, created once, never
 * reset — every chapter simply gives them somewhere else to be.
 *
 * Position is computed entirely in the vertex shader as a function of
 * (particle id, two target textures, morph factor, time). There is no
 * simulation state to ping-pong, which keeps this fast and completely
 * deterministic — and means a chapter change is just swapping a texture.
 */
import { COUNT, GRID, type TargetBuffer } from "./targets";

const VERT = `#version 300 es
precision highp float;

in float a_id;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_morph;      // 0..1 between the two target sets
uniform float u_time;
uniform vec2  u_resolution;
uniform vec2  u_mouse;      // NDC
uniform float u_mouseForce;
uniform float u_diffuse;    // chapter I: 0 = ordered corner, 1 = fully mixed
uniform float u_fromIsGas;  // 1 when the "from" set is the gas
uniform float u_toIsGas;

out float v_bright;
out float v_hue;

// Cheap hash — good enough for spatial jitter, and stable per particle.
float hash(float n) { return fract(sin(n) * 43758.5453123); }
vec2  hash2(float n) { return vec2(hash(n), hash(n + 91.7)); }

/** Chapter I: analytic diffusion from a corner. No stored state. */
vec2 gasPosition(float id, float t) {
  vec2 seed = hash2(id);
  vec2 corner = vec2(-0.86, 0.52) + (seed - 0.5) * 0.17;
  vec2 spread = (hash2(id + 17.0) - 0.5) * vec2(1.85, 1.15);

  // Ease so the mixing looks like diffusion rather than a linear slide.
  float m = 1.0 - pow(1.0 - clamp(u_diffuse, 0.0, 1.0), 2.2);
  vec2 p = mix(corner, spread, m);

  // Persistent thermal jitter; larger once mixed.
  float amp = 0.006 + 0.020 * m;
  p += vec2(
    sin(t * (0.5 + seed.x) + id * 0.013),
    cos(t * (0.4 + seed.y) + id * 0.017)
  ) * amp;
  return p;
}

void main() {
  float id = a_id;
  ivec2 texel = ivec2(int(mod(id, float(${GRID}))), int(id / float(${GRID})));

  vec4 a = texelFetch(u_from, texel, 0);
  vec4 b = texelFetch(u_to, texel, 0);

  vec2 pa = u_fromIsGas > 0.5 ? gasPosition(id, u_time) : a.xy;
  vec2 pb = u_toIsGas   > 0.5 ? gasPosition(id, u_time) : b.xy;

  // Stagger arrival per particle so the shape assembles rather than snapping.
  float lag = hash(id + 3.1) * 0.34;
  float m = clamp((u_morph - lag) / (1.0 - lag), 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);

  vec2 pos = mix(pa, pb, m);

  // Drift along the path so transitions feel like flow, not teleportation.
  float travel = m * (1.0 - m);
  pos += vec2(
    sin(u_time * 0.9 + id * 0.021),
    cos(u_time * 0.7 + id * 0.019)
  ) * travel * 0.075;

  // The cursor pushes the field around.
  vec2 d = pos - u_mouse;
  float dist = length(d);
  if (dist < 0.34 && u_mouseForce > 0.001) {
    pos += normalize(d + 1e-5) * (0.34 - dist) * 0.55 * u_mouseForce;
  }

  v_bright = mix(a.z, b.z, m);
  v_hue = mix(a.w, b.w, m);

  // Targets are authored directly in clip space, so HTML overlays (the word
  // labels in chapter III) can map positions with the same trivial formula.
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = mix(1.4, 2.6, v_bright) * (u_resolution.y / 900.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

in float v_bright;
in float v_hue;
out vec4 outColor;

void main() {
  // Round, soft points.
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float falloff = smoothstep(0.25, 0.0, d);

  vec3 cool = vec3(0.20, 0.83, 1.0);   // signal cyan
  vec3 warm = vec3(1.0, 0.54, 0.24);   // ember
  vec3 col = mix(cool, warm, clamp(v_hue, 0.0, 1.0));

  outColor = vec4(col * (0.35 + v_bright), 1.0) * falloff * 0.85;
}
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

export type FieldHandle = {
  /** Cross-fade to a new target set. Passing null means "the gas". */
  setTarget: (buffer: TargetBuffer | null, immediate?: boolean) => void;
  /** Replace the current target in place, without a cross-fade. */
  updateCurrent: (buffer: TargetBuffer) => void;
  setDiffuse: (v: number) => void;
  setMouse: (x: number, y: number, force: number) => void;
  destroy: () => void;
  particleCount: number;
};

export function createField(canvas: HTMLCanvasElement): FieldHandle | null {
  const ctx = canvas.getContext("webgl2", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
  if (!ctx) return null;
  // Bind to a non-nullable local so the closures below keep the narrowing.
  const gl: WebGL2RenderingContext = ctx;

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`link: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  // Particle ids.
  const ids = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) ids[i] = i;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, ids, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "a_id");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);

  function makeTexture() {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA32F, GRID, GRID, 0, gl.RGBA, gl.FLOAT,
      new Float32Array(COUNT * 4)
    );
    return tex;
  }

  const texFrom = makeTexture();
  const texTo = makeTexture();

  const u = {
    from: gl.getUniformLocation(program, "u_from"),
    to: gl.getUniformLocation(program, "u_to"),
    morph: gl.getUniformLocation(program, "u_morph"),
    time: gl.getUniformLocation(program, "u_time"),
    resolution: gl.getUniformLocation(program, "u_resolution"),
    mouse: gl.getUniformLocation(program, "u_mouse"),
    mouseForce: gl.getUniformLocation(program, "u_mouseForce"),
    diffuse: gl.getUniformLocation(program, "u_diffuse"),
    fromIsGas: gl.getUniformLocation(program, "u_fromIsGas"),
    toIsGas: gl.getUniformLocation(program, "u_toIsGas"),
  };
  gl.uniform1i(u.from, 0);
  gl.uniform1i(u.to, 1);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive: overlapping particles glow

  const state = {
    morph: 1,
    fromIsGas: 1,
    toIsGas: 1,
    diffuse: 0,
    mouse: [9, 9] as [number, number],
    mouseForce: 0,
    running: true,
  };

  function upload(tex: WebGLTexture, data: TargetBuffer) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID, GRID, gl.RGBA, gl.FLOAT, data);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  const start = performance.now();
  let raf = 0;

  function frame() {
    if (!state.running) return;
    resize();

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Ease the cross-fade toward completion.
    state.morph = Math.min(1, state.morph + 0.018);

    gl.uniform1f(u.morph, state.morph);
    gl.uniform1f(u.time, (performance.now() - start) / 1000);
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform2f(u.mouse, state.mouse[0], state.mouse[1]);
    gl.uniform1f(u.mouseForce, state.mouseForce);
    gl.uniform1f(u.diffuse, state.diffuse);
    gl.uniform1f(u.fromIsGas, state.fromIsGas);
    gl.uniform1f(u.toIsGas, state.toIsGas);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texFrom);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texTo);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, COUNT);

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  let currentIsGas = true;
  let currentBuffer: TargetBuffer | null = null;

  return {
    particleCount: COUNT,

    setTarget(buffer, immediate = false) {
      // Whatever we are showing now becomes the "from" side.
      if (currentBuffer) upload(texFrom, currentBuffer);
      state.fromIsGas = currentIsGas ? 1 : 0;

      if (buffer) {
        upload(texTo, buffer);
        state.toIsGas = 0;
        currentIsGas = false;
        currentBuffer = buffer;
      } else {
        state.toIsGas = 1;
        currentIsGas = true;
        currentBuffer = null;
      }
      state.morph = immediate ? 1 : 0;
    },

    updateCurrent(buffer) {
      upload(texTo, buffer);
      state.toIsGas = 0;
      currentIsGas = false;
      currentBuffer = buffer;
      state.morph = 1;
    },

    setDiffuse(v) {
      state.diffuse = v;
    },

    setMouse(x, y, force) {
      state.mouse = [x, y];
      state.mouseForce = force;
    },

    destroy() {
      state.running = false;
      cancelAnimationFrame(raf);
      gl.deleteProgram(program);
      gl.deleteTexture(texFrom);
      gl.deleteTexture(texTo);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    },
  };
}
