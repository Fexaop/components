"use client"
import * as THREE from 'three';
import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
    useScroll,
    Image,
    Text,
    ScrollControls,
    Scroll,
    Preload,
} from '@react-three/drei';


// Custom types to inform TypeScript about the 'zoom' property on the material
interface ZoomableImageMaterial extends THREE.ShaderMaterial {
    zoom: number;
}

interface ZoomableMesh extends THREE.Mesh {
    material: ZoomableImageMaterial;
}

// Type for the group ref to ensure its children are treated as ZoomableMesh
interface ZoomGroup extends THREE.Group {
    children: ZoomableMesh[];
}


function Images() {
    // Note: This group ref is now correctly typed
    const group = useRef<ZoomGroup>(null!);
    const data = useScroll(); // This will now receive data from <ScrollControls>
    const { height } = useThree(s => s.viewport);

    useFrame(() => {
        // The check for data is good practice but the error was due to context missing
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
            {/* The Image component from drei uses a material that has a 'zoom' uniform */}
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
        <Canvas camera={{ position: [0, 0, 20], fov: 15 }} gl={{ alpha: true }}>
            {/* 
              FIX: Added <ScrollControls> which provides the context for the useScroll() hook.
              The `pages` prop defines the scrollable area's length in viewport heights.
            */}
            <ScrollControls damping={0.2} pages={3} distance={0.4}>
                {/* 
                  FIX: Added <Scroll> which is the container for the scrollable R3F content.
                */}
                <Scroll>
                    <Typography />
                    <Images />
                </Scroll>

                {/* Optional: if you need a scrollable HTML overlay */}
                <Scroll html />

                {/* Good practice to preload assets */}
                <Preload />
            </ScrollControls>
        </Canvas>
    )
}