/**
 * Nokia LCD renderer — colores y estética de playsnake.org
 * Board interior: #aacc66, body exterior: #9bba5a
 * Elementos: rgba(0,0,0,0.75) con border-radius
 */

const LCD_BOARD = '#aacc66';
const LCD_INK   = 'rgba(0,0,0,0.75)';
const LCD_MID   = 'rgba(0,0,0,0.4)';

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

  render(snake, foods, musicTheory, voices = []) {
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

    this.drawFoods(ctx, foods, cw, ch);
    this.drawSnake(ctx, snake, cw, ch);
    this.drawRipples(ctx);
    this.drawHUD(ctx, snake, voices, w, h);
  }

  drawSnake(ctx, snake, cw, ch) {
    const segs = snake.segments;
    const pad = Math.max(1, Math.round(Math.min(cw, ch) * 0.06));
    const r = Math.min(cw, ch) * 0.28; // border-radius

    ctx.fillStyle = LCD_INK;

    segs.forEach(seg => {
      const x = seg.x * cw + pad;
      const y = seg.y * ch + pad;
      const sw = cw - pad * 2;
      const sh = ch - pad * 2;

      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, sw, sh, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, sw, sh);
      }
    });
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
