import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

const FluidMaterial = shaderMaterial(
  {
    u_texture: new THREE.Texture(), // The "pong" texture from the last frame
    u_mouse_pos: new THREE.Vector2(0, 0),
    u_mouse_vel: new THREE.Vector2(0, 0),
    u_resolution: new THREE.Vector2(0, 0),
    u_dissipation: 0.98, // How quickly the fluid fades
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader (The Core Logic)
  `
    varying vec2 vUv;
    uniform sampler2D u_texture;
    uniform vec2 u_mouse_pos;
    uniform vec2 u_mouse_vel;
    uniform vec2 u_resolution;
    uniform float u_dissipation;

    void main() {
      // 1. Get the velocity from the previous frame and apply dissipation
      vec2 old_velocity = texture2D(u_texture, vUv).xy;
      old_velocity *= u_dissipation;

      // 2. Add mouse input "splat" using a distance field
      float dist = distance(gl_FragCoord.xy / u_resolution.xy, u_mouse_pos);
      // Create a soft circle (splat) around the mouse
      float splat = 1.0 - smoothstep(0.0, 0.01, dist);
      
      // Add the mouse velocity to this splat
      vec2 mouse_force = u_mouse_vel * splat * 5.0; // The '5.0' is a strength multiplier

      // 3. Simple blur/diffusion pass (averaging neighbors)
      vec2 px = 1.0 / u_resolution;
      float avg_vel_x = (
        texture2D(u_texture, vUv + vec2(-px.x, 0.0)).x +
        texture2D(u_texture, vUv + vec2(px.x, 0.0)).x +
        texture2D(u_texture, vUv + vec2(0.0, -px.y)).x +
        texture2D(u_texture, vUv + vec2(0.0, px.y)).x
      ) * 0.25;

      float avg_vel_y = (
        texture2D(u_texture, vUv + vec2(-px.x, 0.0)).y +
        texture2D(u_texture, vUv + vec2(px.x, 0.0)).y +
        texture2D(u_texture, vUv + vec2(0.0, -px.y)).y +
        texture2D(u_texture, vUv + vec2(0.0, px.y)).y
      ) * 0.25;

      // Mix the old velocity with the blurred average
      vec2 blurred_vel = mix(old_velocity, vec2(avg_vel_x, avg_vel_y), 0.5);

      // 4. Combine blurred old velocity with the new mouse force
      vec2 final_velocity = blurred_vel + mouse_force;
      
      gl_FragColor = vec4(final_velocity, 0.0, 1.0);
    }
  `
);

export { FluidMaterial };