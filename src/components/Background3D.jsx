import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

export function Background3D({ backgroundUrl }) {
  // Load background texture
  const bgTexture = useLoader(THREE.TextureLoader, backgroundUrl);
  bgTexture.colorSpace = THREE.SRGBColorSpace;

  return (
    <mesh position={[0, 1.5, -5]} scale={[16, 9, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={bgTexture} depthWrite={false} />
    </mesh>
  );
}

export function FloatingParticles({ count = 200 }) {
  const pointsRef = useRef();

  // Generate random positions
  const [positions, phases] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const phs = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;     // x
      pos[i * 3 + 1] = Math.random() * 5;          // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 5;  // z
      phs[i] = Math.random() * Math.PI * 2;
    }
    return [pos, phs];
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array;
    
    for (let i = 0; i < count; i++) {
      // Gently float upwards and drift
      positions[i * 3 + 1] += Math.sin(time * 0.5 + phases[i]) * 0.002 + 0.005;
      positions[i * 3] += Math.cos(time * 0.3 + phases[i]) * 0.001;
      
      // Loop around
      if (positions[i * 3 + 1] > 5) {
        positions[i * 3 + 1] = -1;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#a5b4fc"
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
