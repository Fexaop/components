/* SelectiveBlur.js */
import { Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';

/* GLSL shader code for the selective blur effect */
const fragmentShader = `
  uniform sampler2D cleanTexture;
  uniform float blurStrength;
  uniform vec2 mousePos;
  uniform float blurRadius;

  // A more robust random function for noise
  float random(vec2 p) {
      return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Calculate distance from mouse position
    float dist = distance(uv, mousePos);
    
    // Create a radial mask around the mouse position
    float radialMask = 1.0 - smoothstep(0.0, blurRadius, dist);
    
    // Get the original and distorted scene colors
    vec4 originalColor = texture2D(cleanTexture, uv);
    vec4 distortedColor = texture2D(inputBuffer, uv);
    
    // Calculate the color difference to determine where distortion is happening
    float colorDiff = length(distortedColor.rgb - originalColor.rgb);
    
    // Create a mask based on color difference
    float distortionMask = smoothstep(0.01, 0.1, colorDiff);
    
    // Combine masks: blur where there is distortion AND it's near the mouse
    float finalMask = radialMask * distortionMask;
    finalMask = clamp(finalMask, 0.0, 1.0);
    
    if (finalMask > 0.01) {
      // --- High-Quality Rotational Blur ---
      vec4 blurredColor = vec4(0.0);
      
      // Use blurStrength and the mask to control the blur radius
      // A larger magic number (e.g., 0.01) makes the blur stronger
      float blurAmount = blurStrength * finalMask * 0.008; 
      
      const int samples = 16; // Increase samples for higher quality

      // Sample in a spiral/rotational pattern for a smooth blur
      for (int i = 0; i < samples; i++) {
          float angle = float(i) / float(samples) * 2.0 * 3.1415926535;
          float radius = float(i) / float(samples) * blurAmount;
          vec2 offset = vec2(cos(angle), sin(angle)) * radius;
          blurredColor += texture2D(inputBuffer, uv + offset);
      }
      
      // Average the samples
      blurredColor /= float(samples);
      
      // Add subtle noise for a frosted glass effect
      float noise = (random(uv) - 0.5) * 0.03;
      blurredColor.rgb += noise;
      
      // Mix between the distorted color and the heavily blurred version
      outputColor = mix(distortedColor, blurredColor, finalMask);

    } else {
      // If no blur is needed, output the distorted color
      outputColor = distortedColor;
    }
  }
`;

/* Define the custom effect class */
export default class SelectiveBlurEffect extends Effect {
  constructor(cleanTexture, blurStrength = 10.0, blurRadius = 0.3) {
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