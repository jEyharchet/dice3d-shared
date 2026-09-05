# dice3d-shared

Motor de dados 3D (DiceBox/Three.js) compartido entre `portal-bostezante` y
`vtt-942`. No es un paquete publicado — se consume vía dependencia `file:`
desde cada proyecto hermano, y Next.js lo transpila desde el código fuente
(`transpilePackages` en `next.config.ts`), sin paso de build propio.

## Qué expone

- `dice3dAdapter` — `initializeDice3D` / `prewarmDice3D`, el wrapper puro
  sobre el motor DiceBox (sin dependencias de framework).
- `dicePresets` — los presets de color (`DICE_PRESETS`, `resolveDicePreset`),
  misma fuente que ya usaba el Portal.
- `forcedNotation` — `buildForcedNotation(dice, modifier)`: arma una
  notación con resultado forzado (`"1d20@15+5"`) a partir de dados ya
  resueltos en otro lado, para animar en 3D un resultado que no hay que
  re-tirar al azar (caso de uso: el VTT mostrando una tirada que ya se
  resolvió en el chat de campaña del Portal).
- `DiceRollOverlay` — componente React genérico (`"use client"`) que anima
  la tirada respetando las preferencias del usuario (color, sonido, modo de
  visualización, duración, reduced motion) y llama `onDone()` al terminar.

## Cómo consumirlo desde una app Next.js

1. En el `package.json` de la app: `"dice3d-shared": "file:../dice3d-shared"`
   y `npm install`.
2. En `next.config.ts`: agregar `transpilePackages: ["dice3d-shared"]`.
3. **Copiar los assets estáticos** de `assets/` a `public/assets/` de la
   app (Next.js sirve `public/` sólo desde la raíz de cada proyecto, no
   puede apuntar a `node_modules`):
   - `dice-box-threejs-jt-e0v5v.js` (el motor DiceBox, ~550KB)
   - `dice_roll.mp3` (sonido de tirada)

Si el motor DiceBox se actualiza alguna vez, la copia maestra vive acá —
hay que volver a copiarla a cada app que lo consume.

## Por qué existe

Antes de este paquete, el Portal tenía 4 componentes que envolvían
`dice3dAdapter` cada uno por su cuenta (`ActionRollerCanvas`,
`D20RollerCanvas`, `DiceRollerCanvas`, `DiceTable`). Este paquete no
reemplaza esos cuatro (siguen viviendo en el Portal, cubren casos
específicos de la ficha de personaje) — pero el motor de base
(`dice3dAdapter`/`dicePresets`) que todos usan ahora vive acá una sola vez,
y el VTT lo consume directamente para su propio overlay de tirada en vivo
(`DiceRollOverlay`) en vez de reimplementarlo.
