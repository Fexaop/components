"use client"
import * as THREE from 'three';
import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
    useScroll,
    Image,
    Text,
    ScrollControls,
    Scroll,
    Preload,
} from '@react-three/drei';
interface ZoomableImageMaterial extends THREE.ShaderMaterial {
    zoom: number;
}

interface ZoomableMesh extends THREE.Mesh {
    material: ZoomableImageMaterial;
}

interface ZoomGroup extends THREE.Group {
    children: ZoomableMesh[];
}

// Motion distortion shaders
const motionPaintVert = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const motionPaintFrag = `
uniform vec2 uMouse;
uniform vec2 uPrevMouse;
uniform vec2 uResolution;
uniform sampler2D uPrevMotion;
uniform float uTime;

varying vec2 vUv;

void main() {
    vec2 motion = vec2(0.0);
    
    // Calculate mouse velocity
    vec2 mouseVel = uMouse - uPrevMouse;
    
    // Distance field from mouse with larger radius
    vec2 toMouse = vUv - uMouse;
    float dist = length(toMouse * uResolution / min(uResolution.x, uResolution.y));
    float influence = smoothstep(0.25, 0.0, dist);
    
    // Add mouse velocity to motion with stronger influence
    motion = mouseVel * influence * 1.2;
    
    // Sample and blend previous low-res motion
    vec4 prevMotion = texture2D(uPrevMotion, vUv);
    motion += prevMotion.xy * 0.97; // Decay factor - higher = longer trails
    
    gl_FragColor = vec4(motion, 0.0, 1.0);
}
`;

const blurVert = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const blurFrag = `
uniform sampler2D uTexture;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 sum = vec4(0.0);
    
    // Simple 3x3 box blur
    for(float x = -1.0; x <= 1.0; x++) {
        for(float y = -1.0; y <= 1.0; y++) {
            sum += texture2D(uTexture, vUv + vec2(x, y) * texel);
        }
    }
    
    gl_FragColor = sum / 9.0;
}
`;

const distortionVert = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const distortionFrag = `
uniform sampler2D uScene;
uniform sampler2D uMotion;
uniform sampler2D uBlueNoise;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uVelo;

varying vec2 vUv;

// Blue noise jittering for smoother sampling
vec2 blueNoiseJitter(vec2 uv, float seed) {
    vec2 noise = texture2D(uBlueNoise, uv * 5.0 + seed).xy;
    return (noise - 0.5) * 0.002;
}

void main() {
    // The motion vector is still calculated from mouse movement
    vec2 motion = texture2D(uMotion, vUv).xy;
    float motionMag = length(motion);
    
    // The random displacement (particle effect) has been removed.
    // We now sample directly from the original UV coordinates.
    vec3 color = texture2D(uScene, vUv).rgb;
    
    // Layer in the motion blur effect when there's motion
    if(motionMag > 0.001) {
        vec3 motionColor = vec3(0.0);
        float totalWeight = 0.0;
        
        // Motion blur sampling loop (increased for smoothness)
        for(int i = 0; i < 16; i++) {
            float t = float(i) / 15.0;
            vec2 jitter = blueNoiseJitter(vUv, float(i) * 0.1 + uTime);
            // The offset is now only based on motion, not random displacement
            vec2 offset = motion * t * 0.12 + jitter; 
            
            float weight = 1.0 - t * 0.5;
            // The randomOffset is removed from the texture lookup
            motionColor += texture2D(uScene, vUv - offset).rgb * weight;
            totalWeight += weight;
        }
        
        motionColor /= totalWeight;
        
        // Blend the motion blur color with the scene color
        color = mix(color, motionColor, motionMag * 8.0);
        
        // Chromatic aberration with reduced intensity
        float aberration = motionMag * 0.01; 
        // The randomOffset is removed from these lookups as well
        color.r = mix(color.r, texture2D(uScene, vUv - motion * 0.025 - vec2(aberration, 0.0)).r, motionMag * 2.5);
        color.g = mix(color.g, texture2D(uScene, vUv - motion * 0.025).g, motionMag * 2.5);
        color.b = mix(color.b, texture2D(uScene, vUv - motion * 0.025 + vec2(aberration, 0.0)).b, motionMag * 2.5);
    }
    
    gl_FragColor = vec4(color, 1.0);
}
`;
// Motion distortion effect component
function MotionDistortion({ children }: { children: React.ReactNode }) {
    const { gl, scene, camera, size } = useThree();
    
    const [targets] = useState(() => ({
        motionA: new THREE.WebGLRenderTarget(size.width / 4, size.height / 4, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
        }),
        motionB: new THREE.WebGLRenderTarget(size.width / 4, size.height / 4, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
        }),
        lowRes: new THREE.WebGLRenderTarget(size.width / 8, size.height / 8, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
        }),
        scene: new THREE.WebGLRenderTarget(size.width, size.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        }),
    }));

    const blueNoiseTexture = useMemo(() => {
        const size = 64;
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size * 4; i += 4) {
            const val = Math.random() * 255;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
            data[i + 3] = 255;
        }
        const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        tex.needsUpdate = true;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }, []);

    const materials = useMemo(() => ({
        motionPaint: new THREE.ShaderMaterial({
            vertexShader: motionPaintVert,
            fragmentShader: motionPaintFrag,
            uniforms: {
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uPrevMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uResolution: { value: new THREE.Vector2(size.width / 4, size.height / 4) },
                uPrevMotion: { value: targets.lowRes.texture },
                uTime: { value: 0 },
            },
        }),
        blur: new THREE.ShaderMaterial({
            vertexShader: blurVert,
            fragmentShader: blurFrag,
            uniforms: {
                uTexture: { value: null },
                uResolution: { value: new THREE.Vector2(size.width / 4, size.height / 4) },
            },
        }),
        distortion: new THREE.ShaderMaterial({
            vertexShader: distortionVert,
            fragmentShader: distortionFrag,
            uniforms: {
                uScene: { value: targets.scene.texture },
                uMotion: { value: targets.motionA.texture },
                uBlueNoise: { value: blueNoiseTexture },
                uResolution: { value: new THREE.Vector2(1.0, size.height / size.width) },
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uVelo: { value: 0 },
            },
        }),
    }), [size, targets, blueNoiseTexture]);

    const quadScene = useMemo(() => new THREE.Scene(), []);
    const quadCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
    const quad = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), []);

    useEffect(() => {
        quadScene.add(quad);
    }, [quadScene, quad]);

    const mousePos = useRef(new THREE.Vector2(0.5, 0.5));
    const prevMousePos = useRef(new THREE.Vector2(0.5, 0.5));
    const velocity = useRef(0);
    const targetVelocity = useRef(0);
    const ping = useRef(true);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            prevMousePos.current.copy(mousePos.current);
            mousePos.current.set(e.clientX / size.width, 1 - e.clientY / size.height);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [size]);

    useFrame((state) => {
        // Calculate velocity (speed) from mouse movement
        const dx = prevMousePos.current.x - mousePos.current.x;
        const dy = prevMousePos.current.y - mousePos.current.y;
        const speed = Math.sqrt(dx * dx + dy * dy);
        
        // Smooth velocity using exponential decay (matching scene.js behavior)
        targetVelocity.current -= 0.1 * (targetVelocity.current - speed);
        velocity.current = targetVelocity.current;
        targetVelocity.current *= 0.999;

        // Render original scene
        gl.setRenderTarget(targets.scene);
        gl.render(scene, camera);

        // Paint motion
        const currentTarget = ping.current ? targets.motionA : targets.motionB;

        materials.motionPaint.uniforms.uMouse.value.copy(mousePos.current);
        materials.motionPaint.uniforms.uPrevMouse.value.copy(prevMousePos.current);
        materials.motionPaint.uniforms.uTime.value = state.clock.elapsedTime;
        quad.material = materials.motionPaint;

        gl.setRenderTarget(currentTarget);
        gl.render(quadScene, quadCamera);

        // Blur to low res
        materials.blur.uniforms.uTexture.value = currentTarget.texture;
        quad.material = materials.blur;

        gl.setRenderTarget(targets.lowRes);
        gl.render(quadScene, quadCamera);

        // Update for next frame
        materials.motionPaint.uniforms.uPrevMotion.value = targets.lowRes.texture;

        // Apply distortion with random effect
        materials.distortion.uniforms.uMotion.value = currentTarget.texture;
        materials.distortion.uniforms.uTime.value = state.clock.elapsedTime;
        materials.distortion.uniforms.uMouse.value.copy(mousePos.current);
        materials.distortion.uniforms.uVelo.value = velocity.current;
        quad.material = materials.distortion;

        gl.setRenderTarget(null);
        gl.render(quadScene, quadCamera);

        ping.current = !ping.current;
    }, 1);

    return <>{children}</>;
}

function Images() {
    const group = useRef<ZoomGroup>(null!);
    const data = useScroll();
    const { height } = useThree(s => s.viewport);

    useFrame(() => {
        if (data && group.current && group.current.children.length > 0) {
            group.current.children[0].material.zoom = 1 + data.range(0, 1 / 3) / 3;
            group.current.children[1].material.zoom = 1 + data.range(0, 1 / 3) / 3;
            group.current.children[2].material.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
            group.current.children[3].material.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
            group.current.children[4].material.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
        }
    });

    return (
        <group ref={group}>
            <Image position={[-2, 0, 0]} scale={[3, height / 1.1]} url="/assets/demo/cs1.webp" />
            <Image position={[2, 0, 3]} scale={3} url="/assets/demo/cs2.webp" />
            <Image position={[-2.05, -height, 6]} scale={[1, 3]} url="/assets/demo/cs3.webp" />
            <Image position={[-0.6, -height, 9]} scale={[1, 2]} url="/assets/demo/cs1.webp" />
            <Image position={[0.75, -height, 10.5]} scale={1.5} url="/assets/demo/cs2.webp" />
        </group>
    );
}

function Typography() {
    const DEVICE = {
        mobile: { fontSize: 0.2 },
        tablet: { fontSize: 0.4 },
        desktop: { fontSize: 0.6 }
    };
    const getDevice = () => {
        const w = window.innerWidth;
        return w <= 639 ? 'mobile' : w <= 1023 ? 'tablet' : 'desktop';
    };

    const [device, setDevice] = useState<keyof typeof DEVICE>(getDevice());

    useEffect(() => {
        const onResize = () => setDevice(getDevice());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const { fontSize } = DEVICE[device];

    return (
        <Text
            position={[0, 0, 12]}
            fontSize={fontSize}
            letterSpacing={-0.05}
            outlineWidth={0}
            outlineBlur="20%"
            outlineColor="#000"
            outlineOpacity={0.5}
            color="white"
            anchorX="center"
            anchorY="middle"
        >
            React Bits
        </Text>
    );
}

export default function ReactCanvas() {
    return (
        <Canvas camera={{ position: [0, 0, 20], fov: 15 }} gl={{ alpha: false }}>
            <ScrollControls damping={0.2} pages={3} distance={0.4}>
                <MotionDistortion>
                    <Scroll>
                        <Typography />
                        <Images />
                    </Scroll>
                    <Scroll html />
                </MotionDistortion>
                <Preload />
            </ScrollControls>
        </Canvas>
    );
}