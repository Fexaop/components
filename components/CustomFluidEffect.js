// CustomFluidEffect.js
import { Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';

// This is a simplified version of the fluid distortion shader, with chromatic aberration added.
const fragmentShader = `
    uniform float intensity;
    uniform float radius;
    uniform float distortion;
    uniform vec2 mouse; // We'll need to pass the mouse position to this shader

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 p = uv;
        vec2 aspect = vec2(1.0, resolution.y / resolution.x);
        vec2 mouse_uv = mouse * aspect;
        vec2-uv_dist = (p - mouse_uv) * aspect;

        float len = length(uv_dist);
        float R = radius;
        float R2 = R * R;

        // Simple falloff based on distance from the mouse
        float falloff = 1.0 - smoothstep(0.0, R, len);

        // Simple distortion based on the falloff
        vec2 offset = normalize(uv_dist) * distortion * falloff;

        // Apply chromatic aberration by sampling the input texture with offsets
        float r = texture2D(inputBuffer, p + offset * 0.01).r;
        float g = texture2D(inputBuffer, p).g;
        float b = texture2D(inputBuffer, p - offset * 0.01).b;

        // Mix the effect with the original color based on the falloff
        outputColor = mix(inputColor, vec4(r, g, b, 1.0), falloff * intensity);
    }
`;


export default class CustomFluidEffect extends Effect {
    constructor({ intensity = 0.1, radius = 0.2, distortion = 0.05 } = {}) {
        super(
            'CustomFluidEffect',
            fragmentShader,
            {
                uniforms: new Map([
                    ['intensity', new Uniform(intensity)],
                    ['radius', new Uniform(radius)],
                    ['distortion', new Uniform(distortion)],
                    ['mouse', new Uniform(new Vector2())],
                ]),
            }
        );
    }

    update(renderer, inputBuffer, deltaTime) {
        // You can update uniforms here if needed, for example, for time-based animations
    }
}