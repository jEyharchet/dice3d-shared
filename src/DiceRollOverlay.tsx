"use client";

import { useEffect, useRef, useState } from "react";
import { initializeDice3D, type Dice3DColorset } from "./dice3dAdapter";

export type DiceRollOverlayPreferences = {
  colorset: Dice3DColorset;
  // "overlay" = animación 3D, "result" = sólo el número (sin 3D), "hidden" = nada.
  diceDisplayMode: "overlay" | "result" | "hidden";
  diceSoundEnabled: boolean;
  reducedMotion: boolean;
  // Segundos que el resultado queda en pantalla antes de onDone().
  rollResultDuration: number;
};

export type DiceRollOverlayProps = {
  active: boolean;
  // Notación ya resuelta (ver forcedNotation.ts) — este componente no tira
  // dados al azar, anima un resultado que ya fue decidido en otro lado.
  notation: string;
  label: string;
  total: number;
  preferences: DiceRollOverlayPreferences;
  soundSrc?: string;
  onDone: () => void;
};

/**
 * Overlay genérico de tirada 3D, compartido entre El Portal Bostezante y el
 * VTT: respeta las preferencias del usuario que lo está viendo (mismo
 * criterio que ActionRollerCanvas/D20RollerCanvas del Portal — reducedMotion
 * y diceDisplayMode deciden si hay animación 3D, diceSoundEnabled si suena,
 * rollResultDuration cuánto queda el resultado en pantalla) y usa la MISMA
 * notación con resultado forzado para que los dados terminen mostrando el
 * valor ya decidido, no uno nuevo.
 */
export function DiceRollOverlay({ active, notation, label, total, preferences, soundSrc = "/assets/dice_roll.mp3", onDone }: DiceRollOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [statusText, setStatusText] = useState("");
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    const skip3D = preferences.reducedMotion || preferences.diceDisplayMode !== "overlay";
    const showResult = preferences.diceDisplayMode !== "hidden";
    const holdMs = showResult ? Math.max(400, preferences.rollResultDuration * 1000) : 0;

    let cancelled = false;
    let controller: Awaited<ReturnType<typeof initializeDice3D>> | null = null;

    const playSound = () => {
      if (!preferences.diceSoundEnabled) return;
      try {
        const audio = new Audio(soundSrc);
        audio.volume = 0.46;
        void audio.play().catch((error: unknown) => {
          console.warn("[DiceRollOverlay] No se pudo reproducir el audio de dados.", error);
        });
      } catch (error) {
        console.warn("[DiceRollOverlay] No se pudo preparar el audio de dados.", error);
      }
    };

    const finish = async () => {
      if (showResult) setStatusText(`${label}: ${total}`);
      await wait(holdMs);
      if (!cancelled) onDoneRef.current();
    };

    const runSequence = async () => {
      if (skip3D || !container) {
        await finish();
        return;
      }

      try {
        setStatusText("Preparando dado…");
        controller = await initializeDice3D(container, { colorset: preferences.colorset });
        if (cancelled) {
          controller.dispose();
          return;
        }

        setStatusText(label);
        playSound();
        await controller.roll({ notation });
        if (cancelled) return;
        await finish();
      } catch (error) {
        console.error("[DiceRollOverlay] La animación 3D falló, se muestra sólo el resultado.", error);
        if (!cancelled) await finish();
      }
    };

    void runSequence();

    return () => {
      cancelled = true;
      controller?.dispose();
    };
  }, [active, notation, label, total, preferences, soundSrc]);

  if (!active || preferences.diceDisplayMode === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        background: "rgba(0,0,0,0.55)",
        pointerEvents: "none",
      }}
    >
      <div ref={containerRef} style={{ width: 260, height: 260, position: "relative" }} />
      <div style={{ color: "#fde68a", fontSize: "1.25rem", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
        {statusText}
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
