// Final neutral pass: gentle vignette, faint grain, lightning flash.
// No stylized grade — the night should look like a normal night.
export const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uDistort: { value: 0 },
    uCA: { value: 0 },
    uVignette: { value: 0.3 },
    uGrain: { value: 0.03 },
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uFlash;
    uniform float uDistort;
    uniform float uCA;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      // subtle barrel distortion (0 = off)
      vec2 cc = vUv - 0.5;
      float r2 = dot(cc, cc);
      vec2 uv = vUv + cc * r2 * uDistort;

      // edge fade for out-of-frame UVs
      float edge = smoothstep(0.5, 0.42, abs(uv.x - 0.5)) * smoothstep(0.5, 0.42, abs(uv.y - 0.5));
      vec2 cuv = clamp(uv, 0.001, 0.999);

      // chromatic aberration, radial (0 = off)
      vec2 dir = cc * (0.25 + r2 * 3.0);
      float r = texture2D(tDiffuse, cuv + dir * uCA * 2.0).r;
      float g = texture2D(tDiffuse, cuv).g;
      float b = texture2D(tDiffuse, cuv - dir * uCA * 2.0).b;
      vec3 col = vec3(r, g, b) * mix(0.25, 1.0, edge);

      // vignette
      col *= 1.0 - uVignette * smoothstep(0.15, 0.75, r2 * 2.2);

      // faint animated grain
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      float gr = hash(cuv * (800.0 + fract(uTime) * 200.0) + fract(uTime) * 43.7) - 0.5;
      col += gr * uGrain * (0.35 + 0.65 * (1.0 - luma));

      // lightning flash (neutral white)
      col += uFlash * vec3(0.75, 0.78, 0.85);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
