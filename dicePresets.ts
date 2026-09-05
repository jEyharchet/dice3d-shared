// ---------------------------------------------------------------------------
// Presets de color de los dados 3D (DiceBox).
// Fuente única de verdad para el colorset que consume `dice3dAdapter` — este
// archivo vive acá (dice3d-shared) y tanto El Portal Bostezante como el VTT
// lo consumen sin duplicarlo. Cada preset define el cuerpo (background), los
// números (foreground) y el borde/outline. Se eligen combinaciones siempre
// legibles.
// ---------------------------------------------------------------------------

export type DiceColorset = {
  foreground: string; // color de los números
  background: string; // cuerpo del dado
  outline: string; // contorno de los números
  edge: string; // aristas del dado
};

export type DicePreset = {
  id: string;
  label: string;
  colorset: DiceColorset;
};

export const DICE_PRESETS = {
  obsidian_gold: {
    id: "obsidian_gold",
    label: "Negro y oro",
    colorset: { foreground: "#e9bd58", background: "#120b06", outline: "#d9a441", edge: "#d9a441" },
  },
  ruby: {
    id: "ruby",
    label: "Rojo rubí",
    colorset: { foreground: "#f6d68a", background: "#4a0d10", outline: "#c0303f", edge: "#c0303f" },
  },
  arcane: {
    id: "arcane",
    label: "Azul arcano",
    colorset: { foreground: "#bfe0ff", background: "#0d1b3a", outline: "#4f7fd0", edge: "#4f7fd0" },
  },
  forest: {
    id: "forest",
    label: "Verde bosque",
    colorset: { foreground: "#e0f4c8", background: "#0f2a17", outline: "#4f9d5a", edge: "#4f9d5a" },
  },
  bone: {
    id: "bone",
    label: "Hueso",
    colorset: { foreground: "#3a2a18", background: "#e9ddc4", outline: "#b89f78", edge: "#b89f78" },
  },
} as const satisfies Record<string, DicePreset>;

export type DicePresetId = keyof typeof DICE_PRESETS;

export const DEFAULT_DICE_PRESET: DicePresetId = "obsidian_gold";

export const DICE_PRESET_LIST: DicePreset[] = Object.values(DICE_PRESETS);

export const DICE_PRESET_IDS = Object.keys(DICE_PRESETS) as DicePresetId[];

export function isDicePresetId(value: string | null | undefined): value is DicePresetId {
  return typeof value === "string" && value in DICE_PRESETS;
}

// Devuelve el preset pedido o el default si el id es desconocido.
export function resolveDicePreset(id: string | null | undefined): DicePreset {
  return isDicePresetId(id) ? DICE_PRESETS[id] : DICE_PRESETS[DEFAULT_DICE_PRESET];
}
