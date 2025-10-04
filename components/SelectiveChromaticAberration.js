// SelectiveChromaticAberration.js
import { Effect } from 'postprocessing';
import { Uniform } from 'three';

// GLSL shader code for the effect
const fragmentShader = `
    uniform sampler2D cleanTexture;

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        // Get the color of the original, undistorted scene
        vec4 originalColor = texture2D(cleanTexture, uv);

        // Calculate the visual difference between the fluid scene (inputBuffer) and the original scene
        // The 'length' function gives us a scalar magnitude of the difference
        float difference = length(inputColor.rgb - originalColor.rgb);

        // Use smoothstep to create a mask with a smooth falloff.
        // This will be 0 where there's no difference, and 1 where the difference is significant.
        float mask = smoothstep(0.01, 0.5, difference);

        // Define the chromatic aberration offset, multiplied by our mask.
        // If the mask is 0, the offset is 0, and no effect is applied.
        vec2 offset = vec2(0.005, 0.005) * mask;

        // Sample the red, green, and blue channels of the distorted scene with the calculated offsets
        float r = texture2D(inputBuffer, uv + offset).r;
        float g = texture2D(inputBuffer, uv).g;
        float b = texture2D(inputBuffer, uv - offset).b;

        // Combine the channels for the final output color
        outputColor = vec4(r, g, b, inputColor.a);
    }
`;

// Define the custom effect class
export default class SelectiveChromaticAberrationEffect extends Effect {
    constructor(cleanTexture) {
        super(
            'SelectiveChromaticAberrationEffect',
            fragmentShader,
            {
                uniforms: new Map([
                    ['cleanTexture', new Uniform(cleanTexture)]
                ]),
            }
        );
    }
}