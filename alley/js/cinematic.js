// Final film-grade pass: lens distortion, chromatic aberration,
// teal-orange grade, vignette, animated grain, lightning flash.
export const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uDistort: { value: 0.16 },
    uCA: { value: 0.0035 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.055 },
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
      // subtle barrel distortion
      vec2 cc = vUv - 0.5;
      float r2 = dot(cc, cc);
      vec2 uv = vUv + cc * r2 * uDistort;

      // edge fade for out-of-frame UVs
      float edge = smoothstep(0.5, 0.42, abs(uv.x - 0.5)) * smoothstep(0.5, 0.42, abs(uv.y - 0.5));
      vec2 cuv = clamp(uv, 0.001, 0.999);

      // chromatic aberration (radial)
      vec2 dir = cc * (0.25 + r2 * 3.0);
      float r = texture2D(tDiffuse, cuv + dir * uCA * 2.0).r;
      float g = texture2D(tDiffuse, cuv).g;
      float b = texture2D(tDiffuse, cuv - dir * uCA * 2.0).b;
      vec3 col = vec3(r, g, b) * mix(0.25, 1.0, edge);

      // teal shadows / warm highlights
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(0.9, 1.02, 1.12), (1.0 - smoothstep(0.0, 0.45, luma)) * 0.55);
      col += vec3(0.05, 0.025, 0.0) * luma * luma;

      // vignette
      col *= 1.0 - uVignette * smoothstep(0.15, 0.75, r2 * 2.2);

      // animated grain
      float gr = hash(cuv * (800.0 + fract(uTime) * 200.0) + fract(uTime) * 43.7) - 0.5;
      col += gr * uGrain * (0.35 + 0.65 * (1.0 - luma));

      // lightning flash
      col += uFlash * vec3(0.45, 0.55, 0.85);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
