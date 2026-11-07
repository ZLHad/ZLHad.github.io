import { VERT, FRAG } from './glsl';
import { DECK_KM, type CameraState } from './camera';

export class Sky {
  private gl: WebGL2RenderingContext;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private scale: number;
  private w = 0;
  private h = 0;
  private prog!: WebGLProgram;
  private parallel: unknown = null;
  private linked = false;
  private createdAt = 0;

  static create(canvas: HTMLCanvasElement, scale: number): Sky | null {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    if (!gl) return null;
    try {
      return new Sky(canvas, gl, scale);
    } catch (err) {
      console.warn('[sky] shader failed, falling back to CSS backgrounds', err);
      return null;
    }
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    scale: number,
  ) {
    this.gl = gl;
    this.scale = scale;
    // With KHR_parallel_shader_compile the driver compiles off the main thread, so a
    // slow compile (common on Windows) doesn't freeze the page. See isReady().
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    this.prog = prog;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.flush(); // without a flush the driver may never start the off-thread compile
    this.createdAt = performance.now();

    this.resize();
  }

  /** True once the program is linked. Throws if it failed, so the page keeps its CSS backgrounds. */
  isReady(): boolean {
    if (this.linked) return true;
    const { gl, prog } = this;
    const COMPLETION_STATUS_KHR = 0x91b1;
    // Poll for a while, then ask outright: LINK_STATUS blocks until the answer is known.
    const waited = performance.now() - this.createdAt;
    if (this.parallel && waited < 4000 && !gl.getProgramParameter(prog, COMPLETION_STATUS_KHR)) return false;
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of ['uRes', 'uH', 'uPitch', 'uTanFov', 'uSun', 'uT', 'uFog', 'uFogCol', 'uDeck', 'uCover', 'uExposure']) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
    gl.uniform3f(this.uniforms.uFogCol, 7 / 255, 9 / 255, 13 / 255); // --bg: below the clouds the sky gives way to the page
    gl.uniform1f(this.uniforms.uDeck, DECK_KM);
    gl.uniform2f(this.uniforms.uRes, this.w, this.h);
    this.linked = true;
    return true;
  }

  setScale(scale: number) {
    this.scale = scale;
    this.resize();
  }

  resize() {
    const w = Math.max(2, Math.round(this.canvas.clientWidth * this.scale));
    const h = Math.max(2, Math.round(this.canvas.clientHeight * this.scale));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    if (this.linked) this.gl.uniform2f(this.uniforms.uRes, w, h);
  }

  render(cam: CameraState, t: number) {
    const { gl, uniforms: u } = this;
    gl.uniform1f(u.uH, cam.h);
    gl.uniform1f(u.uPitch, cam.pitch);
    gl.uniform1f(u.uTanFov, cam.tanFov);
    gl.uniform3f(u.uSun, cam.sun[0], cam.sun[1], cam.sun[2]);
    gl.uniform1f(u.uT, t);
    gl.uniform1f(u.uFog, cam.fog);
    gl.uniform1f(u.uCover, cam.cover);
    gl.uniform1f(u.uExposure, cam.exposure);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
