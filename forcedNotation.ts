// El motor DiceBox de este bundle soporta forzar el valor final de cada dado
// vía la sintaxis "NdSIDES@v1,v2,..." (confirmado leyendo el parser de
// notación embebido en dice-box-threejs-jt-e0v5v.js: separa la notación por
// "@" y guarda los valores forzados como "vectors"). Esto es lo que permite
// que el VTT anime en 3D una tirada que YA fue resuelta en otro lugar
// (el chat de campaña o la ficha de personaje del Portal) y que los dados
// terminen mostrando exactamente esos valores, no un resultado nuevo.

export type RolledDie = { sides: number; value: number };

/**
 * Arma una notación DiceBox con resultado forzado a partir de los dados ya
 * resueltos (agrupados por cantidad de caras, en el orden en que llegaron) y
 * un modificador plano. Ej.: dice=[{sides:20,value:15}], modifier=5 ->
 * "1d20@15+5".
 */
export function buildForcedNotation(dice: RolledDie[], modifier = 0): string {
  const groups = new Map<number, number[]>();
  for (const die of dice) {
    const values = groups.get(die.sides) ?? [];
    values.push(die.value);
    groups.set(die.sides, values);
  }

  const parts = [...groups.entries()].map(([sides, values]) => `${values.length}d${sides}@${values.join(",")}`);

  if (modifier !== 0) {
    parts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
  }

  return parts.join("+").replace(/\+\+/g, "+").replace(/\+-/g, "-");
}
