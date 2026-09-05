# dice3d-shared

Motor de dados 3D (DiceBox/Three.js) compartido entre `portal-bostezante` y
`vtt-942`. Es su propio repo git (`https://github.com/jEyharchet/dice3d-shared`,
privado), consumido por ambos proyectos como **dependencia git de npm**
(`node_modules/dice3d-shared`) — no un paquete publicado en el registro de
npm, ni una carpeta hermana fuera del repo (ver "Historia" más abajo para
el enfoque anterior y por qué se abandonó).

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

1. En `package.json` de la app, agregar la dependencia git (el repo es
   privado — hace falta que `npm install`/Vercel tengan acceso, ver
   "Acceso privado" más abajo):
   ```json
   "dependencies": {
     "dice3d-shared": "github:jEyharchet/dice3d-shared#master"
   }
   ```
2. En `next.config.ts`, agregar `transpilePackages` — el paquete se
   distribuye como fuente TS/TSX sin compilar, y Next por default no corre
   sus loaders sobre `node_modules/`:
   ```ts
   const nextConfig: NextConfig = {
     transpilePackages: ["dice3d-shared"],
   };
   ```
3. **Copiar los assets estáticos** de `assets/` a `public/assets/` de la
   app (Next.js sirve `public/` sólo desde la raíz de cada proyecto, no
   puede apuntar a `node_modules/`):
   - `dice-box-threejs-jt-e0v5v.js` (el motor DiceBox, ~550KB)
   - `dice_roll.mp3` (sonido de tirada)

Los imports no cambian (`import ... from "dice3d-shared/dicePresets"` sigue
funcionando igual — antes resolvía vía path alias a la carpeta hermana,
ahora resuelve a `node_modules/dice3d-shared/` como cualquier paquete
normal). Si el motor DiceBox se actualiza, hay que volver a copiar el
asset estático a cada app que lo consume después de actualizar la versión
fijada (el código TS/TSX se trae solo con `npm install`).

### Acceso privado (Vercel / CI)

Como el repo es privado, `npm install` necesita un token con permiso
`repo` para clonarlo — en Vercel, configurar un `.npmrc` con el token vía
env var de build (`NPM_TOKEN` o similar) en **cada proyecto consumidor**
(`portal-bostezante` y `vtt-942`).

### `react`/`react-dom`: por qué este paquete tiene su propio `node_modules` local

`DiceRollOverlay.tsx` importa `react`. Este repo tiene su propio
`node_modules` con `react`/`@types/react` como devDependency, sólo para que
`tsc` resuelva tipos al desarrollar acá mismo — **no se publica** (está en
`.gitignore`), así que no llega a las apps consumidoras: cuando `npm
install` clona este repo como dependencia git, sólo trae lo que está en
git (sin ese `node_modules`), por lo que no hay riesgo de una segunda copia
de React resolviéndose en runtime. Esto reemplaza el hack anterior de
`turbopack.resolveAlias` que cada consumidor necesitaba cuando el paquete
vivía como carpeta hermana fuera del repo (ver "Historia").

## Historia — el enfoque de carpeta hermana (abandonado)

Antes de convertir esto en su propio repo git, `dice3d-shared` vivía como
carpeta hermana fuera de ambos repos (`D:\Programacion\Desarrollo\dice3d-shared`),
consumida vía un path alias de TypeScript (`"dice3d-shared/*": ["../dice3d-shared/*"]`)
más `turbopack.root` apuntando al directorio padre común. Funcionaba en
desarrollo local, pero **rompía el build en Vercel**: Vercel sólo clona el
repo que se pushea, nunca carpetas hermanas en el disco del que desarrolla,
así que `dice3d-shared/*` no resolvía a nada en el build remoto. Se probó
antes, sin éxito, una dependencia `file:../dice3d-shared` + `transpilePackages`
(Turbopack no sigue un `file:` hacia una carpeta hermana aunque la junction
de `node_modules` esté bien armada) — la solución real fue sacar el paquete
de "carpeta hermana" del todo y darle un repo propio.

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
