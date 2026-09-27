export type PieceType = "pixel" | "I" | "T" | "L" | "S";

export type Cell = readonly [col: number, row: number];

/**
 * Four rotation states per tetromino, cell offsets normalized so each
 * state's bounding box starts at [0, 0]. The engine picks a rotation state
 * once at spawn time (the piece's landing orientation) and only tweens the
 * *visual* rotation as it falls.
 */
export const TETROMINO_SHAPES: Record<Exclude<PieceType, "pixel">, readonly Cell[][]> = {
  I: [
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [1, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [0, 1]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
};

export const PIXEL_CELLS: readonly Cell[] = [[0, 0]];
