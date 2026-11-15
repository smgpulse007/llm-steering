export type Vector2 = readonly [number, number];
export const toyHiddenState: Vector2 = [1, 1];
export const toyDirection: Vector2 = [0.5, 1];

export function intervene2D(
  hidden: Vector2,
  direction: Vector2,
  coefficient: number,
): Vector2 {
  if (![...hidden, ...direction, coefficient].every(Number.isFinite))
    throw new Error("Vector illustration requires finite values.");
  return [
    hidden[0] + coefficient * direction[0],
    hidden[1] + coefficient * direction[1],
  ];
}
