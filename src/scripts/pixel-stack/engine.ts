import { PIXEL_CELLS, TETROMINO_SHAPES, type Cell, type PieceType } from "./tetrominoes";

const BACKGROUND = "#F7F7F5";
const INK = "10, 10, 10";

const MIN_COLUMNS = 32;
const MAX_COLUMNS = 80;
const TARGET_CELL_CSS_PX = 22;
const MAX_DPR = 2;

const SPAWN_INTERVAL_MS = 150;
const SPAWN_JITTER_MS = 90;
const TETROMINO_CHANCE = 0.2;
const BASE_FALL_MS_PER_CELL = 55;
const FLASH_DURATION_MS = 220;

interface PixelStackOptions {
  forceStatic?: boolean;
}

interface FallingPiece {
  cells: readonly Cell[];
  /** Per-column [minRow, maxRow] offsets within the footprint, keyed by column delta. */
  columnSpan: Map<number, { minRow: number; maxRow: number }>;
  col: number;
  baseRow: number;
  y: number;
  spawnY: number;
  lockY: number;
  speed: number;
  opacity: number;
  rotationTarget: number;
  rotationDeg: number;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Deterministic PRNG so the reduced-motion frame is stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class PixelStackAnimation {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly mediaQuery: MediaQueryList;

  private forceStatic: boolean;
  private staticMode = false;
  private destroyed = false;
  private rafId: number | null = null;
  private lastTime = 0;
  private spawnTimer = 0;
  private nextSpawnIn = SPAWN_INTERVAL_MS;

  private dpr = 1;
  private cellSize = 1;
  private columns = MIN_COLUMNS;
  private rows = 1;
  private stackRows = 1;

  /** grid[row][col]; row 0 = top of the stack band. Value is the locked cell's opacity. */
  private grid: (number | null)[][] = [];
  /** Topmost occupied row per column, including reservations for still-falling pieces. */
  private reservedSurfaceRow: number[] = [];
  private flashingRows = new Map<number, number>();
  private falling: FallingPiece[] = [];

  constructor(canvas: HTMLCanvasElement, options: PixelStackOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PixelStackAnimation: 2d canvas context unavailable");
    this.ctx = ctx;
    this.container = canvas.parentElement ?? canvas;
    this.forceStatic = options.forceStatic ?? false;

    this.mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.mediaQuery.addEventListener("change", this.handleMediaChange);
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
    document.addEventListener("visibilitychange", this.handleVisibility);

    this.handleResize();
  }

  setForceStatic(force: boolean): void {
    this.forceStatic = force;
    this.evaluateMode();
  }

  start(): void {
    if (this.staticMode || this.rafId !== null || this.destroyed) return;
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.resizeObserver.disconnect();
    this.mediaQuery.removeEventListener("change", this.handleMediaChange);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  };

  private handleMediaChange = (): void => {
    this.evaluateMode();
  };

  private handleResize = (): void => {
    const rect = this.container.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    const targetColumns = Math.round(cssWidth / TARGET_CELL_CSS_PX);
    this.columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, targetColumns));

    const deviceWidth = Math.round(cssWidth * this.dpr);
    const deviceHeight = Math.round(cssHeight * this.dpr);
    this.cellSize = Math.max(1, Math.floor(deviceWidth / this.columns));
    this.rows = Math.max(12, Math.floor(deviceHeight / this.cellSize));
    this.stackRows = Math.max(3, Math.round(this.rows / 3));

    this.canvas.width = this.columns * this.cellSize;
    this.canvas.height = this.rows * this.cellSize;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.imageSmoothingEnabled = false;

    this.evaluateMode();
  };

  private evaluateMode(): void {
    const shouldBeStatic = this.forceStatic || this.mediaQuery.matches;
    this.staticMode = shouldBeStatic;
    this.stop();
    if (shouldBeStatic) {
      this.seedStaticSkyline();
      this.renderFrame(0);
    } else {
      this.resetBoard();
      this.start();
    }
  }

  private resetBoard(): void {
    this.grid = Array.from({ length: this.stackRows }, () => new Array<number | null>(this.columns).fill(null));
    this.reservedSurfaceRow = new Array(this.columns).fill(this.stackRows);
    this.flashingRows.clear();
    this.falling = [];
  }

  private tick = (time: number): void => {
    if (this.destroyed || this.staticMode) return;
    if (this.lastTime === 0) this.lastTime = time;
    const dt = Math.min(64, time - this.lastTime);
    this.lastTime = time;

    this.update(dt, time);
    this.renderFrame(time);

    this.rafId = requestAnimationFrame(this.tick);
  };

  private update(dt: number, time: number): void {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnIn) {
      this.spawnTimer = 0;
      this.nextSpawnIn = SPAWN_INTERVAL_MS + Math.random() * SPAWN_JITTER_MS;
      this.spawnPiece();
    }

    const stillFalling: FallingPiece[] = [];
    for (const piece of this.falling) {
      piece.y += piece.speed * dt;
      if (piece.rotationTarget !== 0) {
        const totalDistance = piece.lockY - piece.spawnY;
        const progress = totalDistance > 0 ? Math.min(1, (piece.y - piece.spawnY) / totalDistance) : 1;
        piece.rotationDeg = easeInOutQuad(progress) * piece.rotationTarget;
      }
      if (piece.y >= piece.lockY) {
        this.lockPiece(piece, time);
      } else {
        stillFalling.push(piece);
      }
    }
    this.falling = stillFalling;

    for (const [row, until] of Array.from(this.flashingRows)) {
      if (time >= until) {
        this.flashingRows.delete(row);
        this.collapseRow(row);
      }
    }
  }

  private spawnPiece(): void {
    const isTetromino = Math.random() < TETROMINO_CHANCE;
    let cells: readonly Cell[];
    if (isTetromino) {
      const types: Exclude<PieceType, "pixel">[] = ["I", "T", "L", "S"];
      const type = types[Math.floor(Math.random() * types.length)]!;
      const rotations = TETROMINO_SHAPES[type];
      cells = rotations[Math.floor(Math.random() * rotations.length)]!;
    } else {
      cells = PIXEL_CELLS;
    }

    const width = Math.max(...cells.map(([col]) => col)) + 1;
    const height = Math.max(...cells.map(([, row]) => row)) + 1;

    const columnSpan = new Map<number, { minRow: number; maxRow: number }>();
    for (const [col, row] of cells) {
      const existing = columnSpan.get(col);
      if (existing) {
        existing.minRow = Math.min(existing.minRow, row);
        existing.maxRow = Math.max(existing.maxRow, row);
      } else {
        columnSpan.set(col, { minRow: row, maxRow: row });
      }
    }

    const startCol = this.pickColumn(width, columnSpan);

    let baseRow = this.stackRows;
    for (const [dx, span] of columnSpan) {
      const surface = this.reservedSurfaceRow[startCol + dx] ?? this.stackRows;
      baseRow = Math.min(baseRow, surface - 1 - span.maxRow);
    }
    if (baseRow + height <= 0) return; // this column is already full to the top — skip this drop

    for (const [dx, span] of columnSpan) {
      const col = startCol + dx;
      this.reservedSurfaceRow[col] = Math.min(this.reservedSurfaceRow[col] ?? this.stackRows, baseRow + span.minRow);
    }

    const stackBandTopY = (this.rows - this.stackRows) * this.cellSize;
    const lockY = stackBandTopY + baseRow * this.cellSize;
    const spawnY = -(height + 2) * this.cellSize - Math.random() * this.cellSize * 6;

    const depth = Math.random();
    const speed = (this.cellSize / BASE_FALL_MS_PER_CELL) * (0.65 + depth * 0.7);
    const opacity = 0.45 + depth * 0.5;
    const rotationSteps = isTetromino ? 1 + Math.floor(Math.random() * 3) : 0;

    this.falling.push({
      cells,
      columnSpan,
      col: startCol,
      baseRow,
      y: spawnY,
      spawnY,
      lockY,
      speed,
      opacity,
      rotationTarget: rotationSteps * 90,
      rotationDeg: 0,
    });
  }

  private pickColumn(width: number, columnSpan: Map<number, { minRow: number; maxRow: number }>): number {
    const maxStart = this.columns - width;
    if (maxStart <= 0) return 0;
    if (Math.random() < 0.3) {
      return Math.floor(Math.random() * (maxStart + 1));
    }
    let best = 0;
    let bestScore = -Infinity;
    for (let start = 0; start <= maxStart; start++) {
      let minSurface = this.stackRows;
      for (const [dx] of columnSpan) {
        minSurface = Math.min(minSurface, this.reservedSurfaceRow[start + dx] ?? this.stackRows);
      }
      const score = minSurface + Math.random() * 3;
      if (score > bestScore) {
        bestScore = score;
        best = start;
      }
    }
    return best;
  }

  private lockPiece(piece: FallingPiece, time: number): void {
    const touchedRows = new Set<number>();
    for (const [dx, dy] of piece.cells) {
      const row = piece.baseRow + dy;
      const col = piece.col + dx;
      if (row < 0 || row >= this.stackRows || col < 0 || col >= this.columns) continue;
      this.grid[row]![col] = piece.opacity;
      touchedRows.add(row);
    }

    for (const row of touchedRows) {
      if (this.grid[row]!.every((cell) => cell !== null)) {
        this.flashingRows.set(row, time + FLASH_DURATION_MS);
      }
    }
  }

  private collapseRow(row: number): void {
    this.grid.splice(row, 1);
    this.grid.unshift(new Array<number | null>(this.columns).fill(null));
    this.recomputeReservedSurface();
  }

  private recomputeReservedSurface(): void {
    const surface = Array.from({ length: this.columns }, (_, col) => this.surfaceRowForColumn(col));
    for (const piece of this.falling) {
      for (const [dx, span] of piece.columnSpan) {
        const col = piece.col + dx;
        surface[col] = Math.min(surface[col]!, piece.baseRow + span.minRow);
      }
    }
    this.reservedSurfaceRow = surface;
  }

  private surfaceRowForColumn(col: number): number {
    for (let row = 0; row < this.stackRows; row++) {
      if (this.grid[row]![col] !== null) return row;
    }
    return this.stackRows;
  }

  private seedStaticSkyline(): void {
    this.resetBoard();
    const rng = mulberry32(1337);
    for (let col = 0; col < this.columns; col++) {
      const height = Math.min(this.stackRows - 1, Math.round((0.15 + rng() * 0.5) * this.stackRows));
      for (let i = 0; i < height; i++) {
        this.grid[this.stackRows - 1 - i]![col] = 0.5 + rng() * 0.45;
      }
    }
    // Break up any accidental full rows so the fallback never looks mid-clear.
    for (let row = 0; row < this.stackRows; row++) {
      if (this.grid[row]!.every((cell) => cell !== null)) {
        this.grid[row]![Math.floor(rng() * this.columns)] = null;
      }
    }
    this.recomputeReservedSurface();
  }

  private renderFrame(time: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const stackBandTopY = (this.rows - this.stackRows) * this.cellSize;

    for (let row = 0; row < this.stackRows; row++) {
      const flashUntil = this.flashingRows.get(row);
      let flashBrightness = 0;
      if (flashUntil !== undefined) {
        const remaining = flashUntil - time;
        const progress = Math.min(1, Math.max(0, 1 - remaining / FLASH_DURATION_MS));
        flashBrightness = Math.sin(progress * Math.PI);
      }
      for (let col = 0; col < this.columns; col++) {
        const opacity = this.grid[row]![col];
        if (opacity === null) continue;
        const effective = opacity * (1 - flashBrightness);
        ctx.fillStyle = `rgba(${INK}, ${effective})`;
        ctx.fillRect(col * this.cellSize, stackBandTopY + row * this.cellSize, this.cellSize, this.cellSize);
      }
    }

    for (const piece of this.falling) {
      this.drawPiece(piece);
    }
  }

  private drawPiece(piece: FallingPiece): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(${INK}, ${piece.opacity})`;

    if (piece.rotationTarget === 0) {
      for (const [dx, dy] of piece.cells) {
        const x = Math.round((piece.col + dx) * this.cellSize);
        const y = Math.round(piece.y + dy * this.cellSize);
        ctx.fillRect(x, y, this.cellSize, this.cellSize);
      }
      return;
    }

    const width = (Math.max(...piece.cells.map(([col]) => col)) + 1) * this.cellSize;
    const height = (Math.max(...piece.cells.map(([, row]) => row)) + 1) * this.cellSize;
    const centerX = piece.col * this.cellSize + width / 2;
    const centerY = piece.y + height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((piece.rotationDeg * Math.PI) / 180);
    for (const [dx, dy] of piece.cells) {
      const x = Math.round(dx * this.cellSize - width / 2);
      const y = Math.round(dy * this.cellSize - height / 2);
      ctx.fillRect(x, y, this.cellSize, this.cellSize);
    }
    ctx.restore();
  }
}
