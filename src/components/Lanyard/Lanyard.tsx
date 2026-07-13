/* eslint-disable react/no-unknown-property */
"use client";

import { Environment, Lightformer, useGLTF, useTexture } from "@react-three/drei";
import { Canvas, extend, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
  type RigidBodyProps,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import "./Lanyard.css";

extend({ MeshLineGeometry, MeshLineMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    meshLineGeometry: any;
    meshLineMaterial: any;
  }
}

type LanyardProps = {
  position?: [number, number, number];
  gravity?: [number, number, number];
  onActivate?: () => void;
};

type LanyardBody = RapierRigidBody & { lerped?: THREE.Vector3 };

export default function Lanyard({ position = [0, 0, 24], gravity = [0, -40, 0], onActivate }: LanyardProps) {
  const [interacting, setInteracting] = useState(false);
  const eventSource = typeof document === "undefined" || interacting ? undefined : document.documentElement;

  return (
    <div className="lanyard-wrapper" data-interacting={interacting}>
      <Canvas
        aria-hidden="true"
        camera={{ position, fov: 20 }}
        dpr={[1, 1.5]}
        eventPrefix="client"
        eventSource={eventSource}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), 0)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={1 / 45}>
          <Band onActivate={onActivate} onInteractionChange={setInteracting} />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="#bfdbfe" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="#e9d5ff" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={8} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

function Band({ onActivate, onInteractionChange }: { onActivate?: () => void; onInteractionChange: (interacting: boolean) => void }) {
  const band = useRef<THREE.Mesh<InstanceType<typeof MeshLineGeometry>, InstanceType<typeof MeshLineMaterial>>>(null!);
  const fixed = useRef<RapierRigidBody>(null!);
  const jointOne = useRef<LanyardBody>(null!);
  const jointTwo = useRef<LanyardBody>(null!);
  const jointThree = useRef<RapierRigidBody>(null!);
  const card = useRef<RapierRigidBody>(null!);
  const movedWhileDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const hoveredRef = useRef(false);
  const vector = useMemo(() => new THREE.Vector3(), []);
  const angle = useMemo(() => new THREE.Vector3(), []);
  const rotation = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const [curve] = useState(() => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]));
  const [dragged, setDragged] = useState<false | THREE.Vector3>(false);
  const [hovered, setHovered] = useState(false);
  const viewportWidth = useThree((state) => state.viewport.width);
  const anchorX = Math.max(-2, viewportWidth / 2 - 4.5);

  const { nodes, materials } = useGLTF("/lanyard/card.glb") as any;
  const bandTexture = useTexture("/lanyard/lanyard.png");
  const frontTexture = useTexture("/lanyard/create-task-front.svg");

  const cardMap = useMemo(() => {
    const baseMap = materials.base.map as THREE.Texture;
    const baseImage = baseMap.image as CanvasImageSource & { width: number; height: number };
    const frontImage = frontTexture.image as CanvasImageSource & { width: number; height: number };
    if (!baseImage?.width || !frontImage?.width) return baseMap;
    const canvas = document.createElement("canvas");
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    const context = canvas.getContext("2d");
    if (!context) return baseMap;
    context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
    const target = { x: 0, y: 0, width: canvas.width * 0.5, height: canvas.height * 0.755 };
    const scale = Math.max(target.width / frontImage.width, target.height / frontImage.height);
    const width = frontImage.width * scale;
    const height = frontImage.height * scale;
    context.save();
    context.beginPath();
    context.rect(target.x, target.y, target.width, target.height);
    context.clip();
    context.drawImage(frontImage, target.x + (target.width - width) / 2, target.y + (target.height - height) / 2, width, height);
    context.restore();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = baseMap.flipY;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [frontTexture, materials.base.map]);

  const segmentProps: RigidBodyProps = {
    type: "dynamic",
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4,
  };

  const getLerped = (body: LanyardBody) => {
    if (!body.lerped) body.lerped = new THREE.Vector3().copy(body.translation());
    return body.lerped;
  };

  useRopeJoint(fixed, jointOne, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(jointOne, jointTwo, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(jointTwo, jointThree, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(jointThree, card, [[0, 0, 0], [0, 2.9, 0]]);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = dragged ? "grabbing" : "grab";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [dragged, hovered]);

  useEffect(() => () => onInteractionChange(false), [onInteractionChange]);

  useFrame((state, delta) => {
    if (dragged) {
      vector.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      direction.copy(vector).sub(state.camera.position).normalize();
      vector.add(direction.multiplyScalar(state.camera.position.length()));
      [card, jointOne, jointTwo, jointThree, fixed].forEach((body) => body.current?.wakeUp());
      card.current?.setNextKinematicTranslation({ x: vector.x - dragged.x, y: vector.y - dragged.y, z: vector.z - dragged.z });
    }
    if (!fixed.current) return;
    [jointOne, jointTwo].forEach((body) => {
      const lerped = getLerped(body.current);
      const distance = Math.max(0.1, Math.min(1, lerped.distanceTo(body.current.translation())));
      lerped.lerp(body.current.translation(), delta * distance * 50);
    });
    curve.points[0].copy(jointThree.current.translation());
    curve.points[1].copy(getLerped(jointTwo.current));
    curve.points[2].copy(getLerped(jointOne.current));
    curve.points[3].copy(fixed.current.translation());
    band.current.geometry.setPoints(curve.getPoints(24));
    angle.copy(card.current.angvel());
    rotation.copy(card.current.rotation());
    card.current.setAngvel({ x: angle.x, y: angle.y - rotation.y * 0.25, z: angle.z }, true);
  });

  curve.curveType = "chordal";
  bandTexture.wrapS = bandTexture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[anchorX, 3.7, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={jointOne} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1, 0, 0]} ref={jointTwo} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={jointThree} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? "kinematicPosition" : "dynamic"}>
          <CuboidCollider args={[1.6, 2.25, 0.02]} />
          <group
            scale={4.5}
            position={[0, -2.4, -0.05]}
            onPointerOver={(event) => {
              event.stopPropagation();
              hoveredRef.current = true;
              setHovered(true);
              onInteractionChange(true);
            }}
            onPointerOut={() => {
              hoveredRef.current = false;
              setHovered(false);
              if (!dragged) onInteractionChange(false);
            }}
            onPointerDown={(event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              movedWhileDragging.current = false;
              dragStart.current = { x: event.clientX, y: event.clientY };
              onInteractionChange(true);
              (event.target as Element).setPointerCapture(event.pointerId);
              setDragged(new THREE.Vector3().copy(event.point).sub(vector.copy(card.current.translation())));
            }}
            onPointerMove={(event: ThreeEvent<PointerEvent>) => {
              if (!dragged || movedWhileDragging.current) return;
              if (Math.hypot(event.clientX - dragStart.current.x, event.clientY - dragStart.current.y) > 5) {
                movedWhileDragging.current = true;
              }
            }}
            onPointerUp={(event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              (event.target as Element).releasePointerCapture(event.pointerId);
              setDragged(false);
              window.setTimeout(() => {
                if (!hoveredRef.current) onInteractionChange(false);
              }, 0);
            }}
            onPointerCancel={(event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              setDragged(false);
              onInteractionChange(false);
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (!movedWhileDragging.current) onActivate?.();
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial map={cardMap} map-anisotropy={8} clearcoat={0.8} clearcoatRoughness={0.15} roughness={0.9} metalness={0.65} />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial color="white" depthTest={false} resolution={[1000, 1000]} useMap={1} map={bandTexture} repeat={[-4, 1]} lineWidth={1} />
      </mesh>
    </>
  );
}

useGLTF.preload("/lanyard/card.glb");
