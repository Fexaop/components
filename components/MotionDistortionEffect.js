"use client"
import * as THREE from 'three';
import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree, createPortal } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import { a } from '@react-spring/three';

// Vertex shader for drawing the velocity
const paintVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader for drawing the mouse velocity and propagating the old velocity
const paintFragmentShader = `
  uniform sampler2D uPreviousLowResTexture;
  uniform vec2 uMousePos;
  uniform vec2 uVelocity;
  uniform float uRadius;

  varying vec2 vUv;

  void main() {
    // Previous frame's blurred velocity
    vec2 oldVelocity = texture2D(uPreviousLowResTexture, vUv).xy;

    // Calculate distance from the mouse and draw a circle
    float dist = distance(vUv, uMousePos);
    float strength = smoothstep(uRadius, 0.0, dist);

    // Mix the old velocity with the new mouse velocity
    vec2 finalVelocity = mix(oldVelocity, uVelocity, strength);

    gl_FragColor = vec4(finalVelocity, 0.0, 1.0);
  }
`;

// Simple blur shader
const blurFragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  varying vec2 vUv;

  void main() {
    vec2 pixelSize = 1.0 / uResolution;
    vec4 color = vec4(0.0);

    // Simple 9-tap blur
    color += texture2D(uTexture, vUv + vec2(-1.0, -1.0) * pixelSize) * 0.0625;
    color += texture2D(uTexture, vUv + vec2(0.0, -1.0) * pixelSize) * 0.125;
    color += texture2D(uTexture, vUv + vec2(1.0, -1.0) * pixelSize) * 0.0625;
    color += texture2D(uTexture, vUv + vec2(-1.0, 0.0) * pixelSize) * 0.125;
    color += texture2D(uTexture, vUv) * 0.25;
    color += texture2D(uTexture, vUv + vec2(1.0, 0.0) * pixelSize) * 0.125;
    color += texture2D(uTexture, vUv + vec2(-1.0, 1.0) * pixelSize) * 0.0625;
    color += texture2D(uTexture, vUv + vec2(0.0, 1.0) * pixelSize) * 0.125;
    color += texture2D(uTexture, vUv + vec2(1.0, 1.0) * pixelSize) * 0.0625;

    gl_FragColor = color;
  }
`;

// The final distortion shader
const distortionFragmentShader = `
  uniform sampler2D uSceneTexture;
  uniform sampler2D uMotionVectorMap;
  uniform float uDistortionStrength;

  varying vec2 vUv;

  void main() {
    vec2 motion = texture2D(uMotionVectorMap, vUv).xy * uDistortionStrength;

    // Add some chromatic aberration based on velocity
    vec4 red = texture2D(uSceneTexture, vUv + motion * 0.5);
    vec4 green = texture2D(uSceneTexture, vUv);
    vec4 blue = texture2D(uSceneTexture, vUv - motion * 0.5);

    gl_FragColor = vec4(red.r, green.g, blue.b, 1.0);
  }
`;


export function MotionDistortionEffect({ children, distortionStrength = 0.05, radius = 0.1 }) {
    const { size, gl, scene, camera } = useThree();

    // Mouse tracking
    const mousePos = useRef(new THREE.Vector2());
    const lastMousePos = useRef(new THREE.Vector2());
    const velocity = useRef(new THREE.Vector2());

    // Render targets for motion vectors
    const quarterRes = { width: size.width / 4, height: size.height / 4 };
    const eighthRes = { width: size.width / 8, height: size.height / 8 };

    // Ping-pong FBOs
    const fboPaintA = useFBO(quarterRes.width, quarterRes.height);
    const fboPaintB = useFBO(quarterRes.width, quarterRes.height);
    const fboBlur = useFBO(eighthRes.width, eighthRes.height);

    // This scene will be used to render the motion vector map
    const [motionScene, motionCamera] = useMemo(() => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        return [scene, camera];
    }, []);

    // The main scene will be rendered to this FBO
    const sceneFbo = useFBO(size.width, size.height);

    const paintMaterial = useMemo(() => new THREE.ShaderMaterial({
        vertexShader: paintVertexShader,
        fragmentShader: paintFragmentShader,
        uniforms: {
            uPreviousLowResTexture: { value: null },
            uMousePos: { value: new THREE.Vector2(0, 0) },
            uVelocity: { value: new THREE.Vector2(0, 0) },
            uRadius: { value: radius },
        }
    }), [radius]);

    const blurMaterial = useMemo(() => new THREE.ShaderMaterial({
        vertexShader: paintVertexShader, // can reuse
        fragmentShader: blurFragmentShader,
        uniforms: {
            uTexture: { value: null },
            uResolution: { value: new THREE.Vector2(eighthRes.width, eighthRes.height) },
        }
    }), [eighthRes.width, eighthRes.height]);

    const distortionMaterial = useMemo(() => new THREE.ShaderMaterial({
        vertexShader: paintVertexShader, // can reuse
        fragmentShader: distortionFragmentShader,
        uniforms: {
            uSceneTexture: { value: null },
            uMotionVectorMap: { value: null },
            uDistortionStrength: { value: distortionStrength },
        }
    }), [distortionStrength]);

    const planeGeo = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
    const paintMesh = useMemo(() => new THREE.Mesh(planeGeo, paintMaterial), [planeGeo, paintMaterial]);
    const blurMesh = useMemo(() => new THREE.Mesh(planeGeo, blurMaterial), [planeGeo, blurMaterial]);

    useFrame((state, delta) => {
        // 1. Update mouse velocity
        mousePos.current.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5);
        velocity.current.subVectors(mousePos.current, lastMousePos.current);
        lastMousePos.current.copy(mousePos.current);

        // --- MOTION VECTOR PASSES ---

        gl.setRenderTarget(fboPaintA);
        // 2. Render mouse input + previous velocity
        paintMaterial.uniforms.uMousePos.value = mousePos.current;
        paintMaterial.uniforms.uVelocity.value = velocity.current;
        paintMaterial.uniforms.uPreviousLowResTexture.value = fboBlur.texture;
        gl.render(motionScene, motionCamera);

        gl.setRenderTarget(fboBlur);
        // 3. Blur the result to the lower res FBO
        blurMaterial.uniforms.uTexture.value = fboPaintA.texture;
        gl.render(motionScene, motionCamera);

        // --- MAIN SCENE RENDER ---
        gl.setRenderTarget(sceneFbo);
        gl.render(scene, camera);

        // --- FINAL DISTORTION PASS ---
        gl.setRenderTarget(null);
        gl.clear();
        distortionMaterial.uniforms.uSceneTexture.value = sceneFbo.texture;
        distortionMaterial.uniforms.uMotionVectorMap.value = fboPaintA.texture;
        gl.render(new THREE.Scene().add(new THREE.Mesh(planeGeo, distortionMaterial)), motionCamera);


        // Ping-pong swap
        const temp = fboPaintA;
        // fboPaintA = fboPaintB; // This would require state, simpler to just render to A for now
        // fboPaintB = temp;
    });

    // Add meshes for rendering passes to the motion scene
    motionScene.add(paintMesh);
    // Note: We are re-using the same geometry and swapping materials/render targets.
    // In a more complex setup you might have two meshes.

    return <>{createPortal(children, scene)}</>;
}