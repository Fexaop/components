/* SelectiveBlur.js */
import { Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';

/* GLSL shader code for the selective blur effect */
const fragmentShader = `
  uniform sampler2D cleanTexture;
  uniform float blurStrength;
  uniform vec2 mousePos;
  uniform float blurRadius;
  
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Calculate distance from mouse position
    float dist = distance(uv, mousePos);
    
    // Create a radial mask around the mouse position
    // Only apply blur near where the mouse is interacting
    float radialMask = 1.0 - smoothstep(0.0, blurRadius, dist);
    
    // Get the color of the original, undistorted scene
    vec4 originalColor = texture2D(cleanTexture, uv);
    vec4 distortedColor = texture2D(inputBuffer, uv);
    
    // Calculate the color difference (distortion indicator)
    float colorDiff = length(distortedColor.rgb - originalColor.rgb);
    
    // Create a mask based on color difference
    float distortionMask = smoothstep(0.02, 0.15, colorDiff);
    
    // Combine both masks: only blur where there's both distortion AND near mouse
    float finalMask = radialMask * distortionMask;
    
    // Clamp the mask
    finalMask = clamp(finalMask, 0.0, 0.85);
    
    // Only apply blur if mask is significant
    if (finalMask > 0.01) {
      vec4 blurredColor = vec4(0.0);
      
      // Gaussian blur sampling - 9-tap blur kernel
      float blurSize = 0.004 * finalMask * blurStrength;
      
      // Sample pattern for Gaussian blur
      blurredColor += texture2D(inputBuffer, uv + vec2(-blurSize, -blurSize)) * 0.0625;
      blurredColor += texture2D(inputBuffer, uv + vec2(0.0, -blurSize)) * 0.125;
      blurredColor += texture2D(inputBuffer, uv + vec2(blurSize, -blurSize)) * 0.0625;
      
      blurredColor += texture2D(inputBuffer, uv + vec2(-blurSize, 0.0)) * 0.125;
      blurredColor += texture2D(inputBuffer, uv) * 0.25;
      blurredColor += texture2D(inputBuffer, uv + vec2(blurSize, 0.0)) * 0.125;
      
      blurredColor += texture2D(inputBuffer, uv + vec2(-blurSize, blurSize)) * 0.0625;
      blurredColor += texture2D(inputBuffer, uv + vec2(0.0, blurSize)) * 0.125;
      blurredColor += texture2D(inputBuffer, uv + vec2(blurSize, blurSize)) * 0.0625;
      
      // Mix between the distorted color and the blurred version
      outputColor = mix(distortedColor, blurredColor, finalMask);
    } else {
      // If mask is too small, just use the distorted color as-is
      outputColor = distortedColor;
    }
  }
`;

/* Define the custom effect class */
export default class SelectiveBlurEffect extends Effect {
  constructor(cleanTexture, blurStrength = 2.0, blurRadius = 0.3) {
    super(
      'SelectiveBlurEffect',
      fragmentShader,
      {
        uniforms: new Map([
          ['cleanTexture', new Uniform(cleanTexture)],
          ['blurStrength', new Uniform(blurStrength)],
          ['mousePos', new Uniform(new Vector2(0.5, 0.5))],
          ['blurRadius', new Uniform(blurRadius)]
        ]),
      }
    );
  }
  
  // Method to update blur strength dynamically
  setBlurStrength(value) {
    this.uniforms.get('blurStrength').value = value;
  }
  
  // Method to update mouse position
  setMousePosition(x, y) {
    this.uniforms.get('mousePos').value.set(x, y);
  }
  
  // Method to update blur radius
  setBlurRadius(value) {
    this.uniforms.get('blurRadius').value = value;
  }
}