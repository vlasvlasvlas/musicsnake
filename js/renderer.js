/**
 * Nokia LCD renderer — colores y estética de playsnake.org
 * Board interior: #aacc66, body exterior: #9bba5a
 * Elementos: rgba(0,0,0,0.75) con border-radius
 */

const LCD_BOARD = '#aacc66';
const LCD_INK   = 'rgba(0,0,0,0.75)';
const LCD_MID   = 'rgba(0,0,0,0.4)';
// Feature B: a soft lime-lemon glow for voice column/row highlights —
// a warmer yellow-green in the same LCD hue family as the board. Reads
// as "the board glowing where a voice is singing" without stepping out
// of the Nokia palette.
const LCD_GLOW_RGB = '230, 230, 110';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ripples = [];
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  addRipple(x, y) {
    this.ripples.push({ x, y, r: 2, max: 28, a: 0.5 });
  }

  render(snake, foods, musicTheory, voices = [], playingVoiceIdxs = []) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    if (!w || !h) return;

    const cols = snake.gridCols;
    const rows = snake.gridRows;
    const cw = w / cols;
    const ch = h / rows;

    // Board background
    ctx.fillStyle = LCD_BOARD;
    ctx.fillRect(0, 0, w, h);

    // Feature B: monochrome voice highlights go BELOW the snake and food
    // so the interactive layer stays on top visually.
    this.drawVoiceHighlights(ctx, snake, voices, playingVoiceIdxs, cw, ch);

    this.drawFoods(ctx, foods, cw, ch);
    this.drawSnake(ctx, snake, cw, ch);
    this.drawRipples(ctx);
    this.drawHUD(ctx, snake, voices, w, h);
  }

  /**
   * Monochrome column/row highlights for the active Spiegel voices on
   * the Nokia LCD grid (spec §5.2 + §10). Each voice marks a column, a
   * row, or both; the board glows a lighter green there when the voice
   * is sounding and a fainter shadow when it is just active-but-silent.
   *
   * Overlapping cells are deduped (highest alpha wins) so crossings do
   * not stack into brighter-than-LCD cells.
   */
  drawVoiceHighlights(ctx, snake, activeVoices, playingVoiceIdxs, cw, ch) {
    if (!activeVoices || activeVoices.length === 0) return;
    const segs = snake.segments;
    if (!segs || segs.length === 0) return;

    const cols = snake.gridCols;
    const rows = snake.gridRows;
    const head = segs[0];
    const midSeg = segs[Math.floor(segs.length / 2)] ?? head;
    const tailSeg = segs[segs.length - 1] ?? head;

    // Per spec §5.2: voice→position mapping
    //   0 soprano = column of head.x
    //   1 alto    = row of head.y
    //   2 tenor   = column + row of midpoint
    //   3 bass    = column + row of tail
    const columns = [null, null, null, null];
    const rowsArr = [null, null, null, null];
    columns[0] = head.x;
    rowsArr[1] = head.y;
    columns[2] = midSeg.x;
    rowsArr[2]  = midSeg.y;
    columns[3] = tailSeg.x;
    rowsArr[3]  = tailSeg.y;

    // Dedup cells by (col,row) key, keeping highest alpha.
    const cellAlpha = new Map();
    const SOUNDING = 0.35;
    const GHOST = 0.08;

    const mark = (col, row, alpha) => {
      if (col == null || row == null) return;
      if (col < 0 || col >= cols || row < 0 || row >= rows) return;
      const key = row * cols + col;
      const prev = cellAlpha.get(key) ?? 0;
      if (alpha > prev) cellAlpha.set(key, alpha);
    };

    for (let i = 0; i < activeVoices.length && i < 4; i++) {
      const alpha = playingVoiceIdxs.includes(i) ? SOUNDING : GHOST;
      if (columns[i] != null) {
        for (let r = 0; r < rows; r++) mark(columns[i], r, alpha);
      }
      if (rowsArr[i] != null) {
        for (let c = 0; c < cols; c++) mark(c, rowsArr[i], alpha);
      }
    }

    for (const [key, alpha] of cellAlpha) {
      const col = key % cols;
      const row = Math.floor(key / cols);
      ctx.fillStyle = `rgba(${LCD_GLOW_RGB}, ${alpha})`;
      ctx.fillRect(col * cw, row * ch, cw, ch);
    }
  }

  drawSnake(ctx, snake, cw, ch) {
    const segs = snake.segments;
    if (!segs.length) return;

    const pad = Math.max(1, Math.round(Math.min(cw, ch) * 0.06));
    const thickness = Math.min(cw, ch) - 2 * pad;

    ctx.fillStyle = LCD_INK;
    ctx.strokeStyle = LCD_INK;

    // 1-segment víbora: punto redondo (pre-crecimiento, soprano sola).
    if (segs.length === 1) {
      const cx = segs[0].x * cw + cw / 2;
      const cy = segs[0].y * ch + ch / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, thickness / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Cuerpo como cinta continua: path por los centros con stroke redondo.
    // Los lineCap/lineJoin 'round' reemplazan los border-radius por caps
    // reales en la cabeza y la cola, y curvas suaves en cada giro.
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Si la víbora cruza un borde en modo wrap/bounce, el salto entre
    // segmentos es mayor a una celda — en ese caso cerramos el sub-path
    // y arrancamos uno nuevo para no dibujar una línea atravesando la
    // grilla entera.
    ctx.beginPath();
    for (let i = 0; i < segs.length; i++) {
      const cx = segs[i].x * cw + cw / 2;
      const cy = segs[i].y * ch + ch / 2;
      if (i === 0) {
        ctx.moveTo(cx, cy);
        continue;
      }
      const dx = Math.abs(segs[i].x - segs[i - 1].x);
      const dy = Math.abs(segs[i].y - segs[i - 1].y);
      if (dx > 1 || dy > 1) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();
  }

  drawFoods(ctx, foods, cw, ch) {
    const pad = Math.max(2, Math.round(Math.min(cw, ch) * 0.15));
    const r = Math.min(cw, ch) * 0.4;

    ctx.fillStyle = LCD_INK;

    foods.forEach(f => {
      const x = f.x * cw + pad;
      const y = f.y * ch + pad;
      const fw = cw - pad * 2;
      const fh = ch - pad * 2;

      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, fw, fh, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, fw, fh);
      }
    });
  }

  drawRipples(ctx) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.r += 1.5;
      rip.a -= 0.06;
      if (rip.a <= 0 || rip.r >= rip.max) { this.ripples.splice(i, 1); continue; }
      ctx.save();
      ctx.strokeStyle = LCD_INK;
      ctx.globalAlpha = rip.a;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawHUD(ctx, snake, voices, w, h) {
    ctx.fillStyle = LCD_INK;
    ctx.font = 'bold 13px monospace';
    ctx.textBaseline = 'bottom';

    ctx.textAlign = 'left';
    ctx.fillText(String(snake.score).padStart(4, '0'), 6, h - 5);

    ctx.textAlign = 'right';
    ctx.fillText(`L:${snake.segments.length}`, w - 6, h - 5);
  }
}
