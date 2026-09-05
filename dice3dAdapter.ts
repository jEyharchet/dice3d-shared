// Motor de dados 3D (DiceBox/Three.js) compartido entre El Portal Bostezante
// y el VTT — movido acá desde portal-bostezante/src/lib/dice/dice3dAdapter.ts
// para que ambos proyectos lancen el mismo motor, no una copia que pueda
// divergir. Sin dependencias de framework (no usa Next.js/React) — sólo
// APIs de navegador (window/document/crypto), por eso es trivial de
// compartir entre dos apps Next.js distintas.
//
// El asset real de DiceBox (dice-box-threejs-jt-e0v5v.js, ~550KB, con
// modelos/materiales embebidos) vive en dice3d-shared/assets/ como copia
// maestra; cada app que lo consume necesita su propia copia física en
// `public/assets/` (Next.js sirve `public/` sólo desde la raíz de cada
// app, no puede apuntar a node_modules) — ver README de este paquete.

type DiceBoxModule = {
  default: DiceBoxConstructor;
};

type DiceBoxConstructor = new (selector: string, options?: Record<string, unknown>) => DiceBoxInstance;

type DiceBoxRoll = {
  value?: number;
  result?: number;
  label?: string;
  sides?: number;
  type?: string;
};

type DiceBoxRollSet = {
  sides?: number;
  type?: string;
  rolls?: DiceBoxRoll[];
};

type DiceBoxRollResult = {
  notation?: string;
  sets?: DiceBoxRollSet[];
  rolls?: DiceBoxRoll[];
  dice?: DiceBoxRoll[];
  total?: number;
};

type DiceBoxInstance = {
  initialize: () => Promise<void>;
  roll: (notation: string) => Promise<DiceBoxRollResult>;
  clearDice?: () => void;
  renderer?: {
    dispose?: () => void;
    domElement?: HTMLCanvasElement;
  };
};

// Colores del dado (cuerpo/números/borde). Coincide con `DiceColorset` de dicePresets.
export type Dice3DColorset = {
  foreground: string;
  background: string;
  outline: string;
  edge: string;
};

export type DiceRollRequest = {
  notation: string;
};

export type DiceRollResult = {
  notation: string;
  dice: Array<{
    sides: number;
    value: number;
  }>;
};

export type Dice3DController = {
  roll: (request: DiceRollRequest) => Promise<DiceRollResult>;
  clear: () => void;
  dispose: () => void;
};

type InitializeDice3DOptions = {
  moduleSrc?: string;
  assetPath?: string;
  rollTimeoutMs?: number;
  // Color de los dados; si se omite se usa el preset por defecto (negro y oro).
  colorset?: Dice3DColorset;
};

const defaultModuleSrc = "/assets/dice-box-threejs-jt-e0v5v.js";
const defaultRollTimeoutMs = 15_000;
const DEBUG_DICE_3D = true;

// Preset por defecto (negro y oro), igual al histórico hardcodeado.
const defaultColorset: Dice3DColorset = {
  foreground: "#e9bd58",
  background: "#120b06",
  outline: "#d9a441",
  edge: "#d9a441",
};

export async function initializeDice3D(
  container: HTMLElement,
  options: InitializeDice3DOptions = {},
): Promise<Dice3DController> {
  assertBrowserDiceRequirements(container);

  logDice3D("Inicializando DiceBox 3D", {
    moduleSrc: options.moduleSrc ?? defaultModuleSrc,
    assetPath: options.assetPath ?? "/assets/",
    container: {
      id: container.id,
      width: container.getBoundingClientRect().width,
      height: container.getBoundingClientRect().height,
    },
  });

  const DiceBox = await loadDiceBox(options.moduleSrc ?? defaultModuleSrc);
  const selector = ensureContainerSelector(container);
  const colorset = options.colorset ?? defaultColorset;
  const diceBox = new DiceBox(selector, {
    assetPath: options.assetPath ?? "/assets/",
    baseScale: 90,
    gravity_multiplier: 420,
    light_intensity: 0.82,
    shadows: true,
    // El audio de dados lo maneja cada roller (playSound), no el motor interno:
    // sus assets de sonido no están empaquetados y romperían la consola.
    sounds: false,
    strength: 1.12,
    theme_colorset: "black",
    theme_customColorset: {
      name: "El Portal Bostezante",
      category: "El Portal Bostezante",
      foreground: colorset.foreground,
      background: colorset.background,
      outline: colorset.outline,
      texture: "none",
      edge: colorset.edge,
    },
    theme_material: "wood",
    theme_surface: "green-felt",
    theme_texture: "none",
  });

  await diceBox.initialize();
  logDice3D("DiceBox inicializado correctamente");

  return {
    async roll(request) {
      logDice3D("Iniciando tirada 3D", request);
      const result = await withTimeout(
        diceBox.roll(request.notation),
        options.rollTimeoutMs ?? defaultRollTimeoutMs,
        `La tirada 3D ${request.notation} no finalizo dentro del timeout.`,
      );
      logDice3D("Resultado crudo DiceBox", result);
      return normalizeDiceBoxResult(request.notation, result);
    },
    clear() {
      diceBox.clearDice?.();
    },
    dispose() {
      diceBox.clearDice?.();
      diceBox.renderer?.dispose?.();
      container.replaceChildren();
    },
  };
}

// Se resuelve una sola vez por sesión: precalienta el caché de assets 3D de DiceBox.
let prewarmPromise: Promise<void> | null = null;

/**
 * Precarga los assets 3D de DiceBox (modelos, texturas y materiales) una sola vez,
 * usando un contenedor oculto fuera de pantalla y una tirada silenciosa que fuerza
 * la carga y subida a GPU. Los rollers de la ficha crean una instancia nueva por
 * tirada, pero DiceBox comparte el caché de assets entre instancias: sin este
 * prewarm, la PRIMERA tirada real ocurre antes de que terminen de cargar y el dado
 * no llega a dibujarse. Idempotente y silencioso: si falla, no rompe nada y la
 * primera tirada real vuelve a intentarlo.
 */
export function prewarmDice3D(options: InitializeDice3DOptions = {}): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (prewarmPromise) return prewarmPromise;

  prewarmPromise = (async () => {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    // Fuera de pantalla pero con dimensiones reales: WebGL necesita un rect válido
    // para inicializar y subir texturas a GPU aunque no se vea.
    container.style.cssText =
      "position:fixed;left:-10000px;top:0;width:220px;height:220px;pointer-events:none;opacity:0;z-index:-1;";
    document.body.appendChild(container);

    let controller: Dice3DController | null = null;
    try {
      controller = await initializeDice3D(container, options);
      // Tirada silenciosa: carga geometría/materiales del d20 y los deja en caché.
      await controller.roll({ notation: "1d20" });
      logDice3D("Prewarm de DiceBox completado");
    } catch (error) {
      logDice3D("Prewarm de DiceBox omitido", error);
      // Permite reintentar en un próximo montaje si esta pasada falló.
      prewarmPromise = null;
    } finally {
      controller?.dispose();
      container.remove();
    }
  })();

  return prewarmPromise;
}

async function loadDiceBox(moduleSrc: string): Promise<DiceBoxConstructor> {
  try {
    const diceBoxModule = (await import(/* webpackIgnore: true */ moduleSrc)) as DiceBoxModule;
    if (!diceBoxModule.default) {
      throw new Error("El modulo DiceBox no exporta default.");
    }

    return diceBoxModule.default;
  } catch (error) {
    throw new Error(`No se pudo cargar DiceBox desde ${moduleSrc}.`, { cause: error });
  }
}

function ensureContainerSelector(container: HTMLElement) {
  if (!container.id) {
    container.id = `character-dice-box-${crypto.randomUUID()}`;
  }

  return `#${CSS.escape(container.id)}`;
}

function normalizeDiceBoxResult(notation: string, result: DiceBoxRollResult): DiceRollResult {
  const dice = extractDiceValuesFromDiceBoxResult(result);

  if (dice.length === 0) {
    throw new Error(`DiceBox termino ${notation}, pero no devolvio dados interpretables.`);
  }

  return {
    notation: result.notation ?? notation,
    dice: dice.filter((die) => die.sides > 0),
  };
}

function extractDiceValuesFromDiceBoxResult(result: DiceBoxRollResult) {
  const fromSets =
    result.sets?.flatMap((set) =>
      (set.rolls ?? []).map((roll) => ({
        sides: normalizeSides(roll.sides ?? set.sides, roll.type ?? set.type),
        value: normalizeDieValue(roll),
      })),
    ) ?? [];

  const fromRolls = (result.rolls ?? []).map((roll) => ({
    sides: normalizeSides(roll.sides, roll.type),
    value: normalizeDieValue(roll),
  }));

  const fromDice = (result.dice ?? []).map((roll) => ({
    sides: normalizeSides(roll.sides, roll.type),
    value: normalizeDieValue(roll),
  }));

  return [...fromSets, ...fromRolls, ...fromDice].filter((die) => die.sides > 0 && die.value > 0);
}

function normalizeSides(sides: number | undefined, type: string | undefined) {
  return Math.trunc(Number(sides) || sidesFromType(type));
}

function normalizeDieValue(roll: DiceBoxRoll) {
  return Math.trunc(Number(roll.value ?? roll.result ?? roll.label) || 1);
}

function sidesFromType(type: string | undefined) {
  const match = type?.match(/d(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function assertBrowserDiceRequirements(container: HTMLElement) {
  if (typeof window === "undefined") {
    throw new Error("DiceBox 3D solo puede inicializarse en el navegador.");
  }

  const rect = container.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(`El contenedor de dados no tiene dimensiones validas (${rect.width}x${rect.height}).`);
  }

  const canvas = document.createElement("canvas");
  const webgl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
  if (!webgl) {
    throw new Error("WebGL no esta disponible en este navegador.");
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function logDice3D(message: string, payload?: unknown) {
  if (!DEBUG_DICE_3D) {
    return;
  }

  if (payload === undefined) {
    console.info(`[Dice3D] ${message}`);
    return;
  }

  console.info(`[Dice3D] ${message}`, payload);
}
