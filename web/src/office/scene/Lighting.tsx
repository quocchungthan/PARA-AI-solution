import type { BotanicalPalette } from "./palette";
export function Lighting({ p }: { p: BotanicalPalette }) {
  return (
    <>
      <ambientLight intensity={p.ambient} />
      <hemisphereLight args={["#e0f1ed", "#63745b", 1]} />
      <directionalLight
        position={[-12, 22, 8]}
        intensity={p.key}
        color={p.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-23}
        shadow-camera-right={23}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-normalBias={0.06}
      />
      {[
        [-5, 3, -7],
        [11, 3, -7],
        [14, 3, 0],
      ].map((pos, i) => (
        <pointLight
          key={i}
          position={pos as [number, number, number]}
          color={p.taskColor}
          intensity={p.taskIntensity}
          distance={8}
          decay={2}
        />
      ))}
    </>
  );
}
