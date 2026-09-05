# dice3d-shared

Motor de dados 3D (DiceBox/Three.js) compartido entre `portal-bostezante` y
`vtt-942`. No es un paquete de npm ni vive en un monorepo con workspaces —
es una carpeta hermana (`D:\Programacion\Desarrollo\dice3d-shared`) que cada
proyecto importa directamente vía un path alias de TypeScript, sin pasar
por `node_modules`.

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

## Cómo consumirlo desde una app Next.js (sin `file:`, sin workspaces)

Se probaron dos enfoques más "estándar" (dependencia `file:../dice3d-shared`
+ `transpilePackages`, y esa misma dependencia con `package.json#exports`)
y **ninguno resolvió con Turbopack** (Next 16): Turbopack sandboxea la
resolución de módulos a la raíz del proyecto, y no sigue una dependencia
`file:` hacia una carpeta hermana aunque `node_modules` tenga la junction
correcta. Lo que sí funciona:

1. En `tsconfig.json` de la app, agregar el path alias:
   ```json
   "paths": {
     "@/*": ["./src/*"],
     "dice3d-shared/*": ["../dice3d-shared/*"]
   }
   ```
2. En `next.config.ts`, subir la raíz que Turbopack puede resolver al
   directorio padre común (el que contiene ambos proyectos):
   ```ts
   import path from "node:path";
   const nextConfig: NextConfig = {
     turbopack: { root: path.join(__dirname, "..") },
   };
   ```
   Sin esto, Turbopack tira `Module not found: Can't resolve 'dice3d-shared/...'`
   aunque el alias de tsconfig esté bien puesto — `root` es el límite real.
3. **Copiar los assets estáticos** de `assets/` a `public/assets/` de la
   app (Next.js sirve `public/` sólo desde la raíz de cada proyecto, no
   puede apuntar fuera de él):
   - `dice-box-threejs-jt-e0v5v.js` (el motor DiceBox, ~550KB)
   - `dice_roll.mp3` (sonido de tirada)

No hace falta ninguna entrada en `package.json` de la app consumidora — no
es una dependencia de npm, es código fuente que cada app compila directo
como si fuera propio (gracias al alias). Si el motor DiceBox se actualiza
alguna vez, la copia maestra vive acá — hay que volver a copiar el asset
estático a cada app que lo consume (el código TS/TSX no necesita copiarse,
se importa en vivo).

### `react`/`react-dom`: por qué este paquete SÍ tiene su propio `node_modules`

`DiceRollOverlay.tsx` importa `react`. Como este paquete vive fuera de
cualquier proyecto Next.js, `tsc` no encuentra tipos para `react` al
resolver ese archivo (camina hacia arriba desde acá, no hacia las apps que
lo consumen) — por eso este paquete corrió su propio `npm install` con
`react`/`@types/react` como devDependency, sólo para que el type-check
funcione. **Ojo con esto en runtime**: si una app consumidora no fuerza
explícitamente su propia copia de `react`, Turbopack podría resolver la
copia de ESTE paquete al empaquetar `DiceRollOverlay`, dando dos instancias
de React (`Invalid hook call`). Por eso cada `next.config.ts` consumidor
tiene que declarar:

```ts
turbopack: {
  root: path.join(__dirname, ".."),
  resolveAlias: {
    react: "./node_modules/react",
    "react-dom": "./node_modules/react-dom",
  },
},
```

(Rutas absolutas de Windows en `resolveAlias` no funcionan todavía en
Turbopack — "windows imports are not implemented yet" — por eso son rutas
relativas `./node_modules/...`, no `path.join(__dirname, ...)`.)

## Por qué existe

Antes de este paquete, el Portal tenía 4 componentes que envolvían
`dice3dAdapter` cada uno por su cuenta (`ActionRollerCanvas`,
`D20RollerCanvas`, `DiceRollerCanvas`, `DiceTable`). Este paquete no
reemplaza esos cuatro (siguen viviendo en el Portal, cubren casos
específicos de la ficha de personaje) — pero el motor de base
(`dice3dAdapter`/`dicePresets`) que todos usan ahora vive acá una sola vez:
`portal-bostezante/src/lib/dice/dice3dAdapter.ts` y `dicePresets.ts` son
hoy un `export *` de una línea hacia acá (mismo comportamiento, cero
duplicación real), y el VTT lo consume directamente para su propio overlay
de tirada en vivo (`DiceRollOverlay`) en vez de reimplementarlo.
