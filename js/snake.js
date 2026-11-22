/**
 * Snake Model & Steering Automata
 * Supports Manual Play, Generative / Autonomous Algorithms, and Spatial Kinematics.
 */

export class Snake {
  constructor(gridCols = 32, gridRows = 32) {
    this.gridCols = gridCols;
    this.gridRows = gridRows;
    this.reset();
  }

  reset() {
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    // Start at the growth-gated minimum: one segment = one voice (soprano).
    // The víbora earns alto/tenor/bass by growing (spec §5.1).
    this.segments = [
      { x: Math.floor(this.gridCols / 2), y: Math.floor(this.gridRows / 2) }
    ];
    this.growthQueue = 0;
    this.isDead = false;
    this.score = 0;
    this.wallMode = 'wrap'; // wrap, bounce, classic

    // Autonomous steering state
    this.autoBehavior = 'harmonicSeeker'; // harmonicSeeker, lissajous, brownian, mouseFollow
    this.lissajousPhase = 0;
    this.brownianDirChangeTimer = 0;
    this.mouseTarget = null;
  }

  setGridSize(cols, rows) {
    this.gridCols = cols;
    this.gridRows = rows;
  }

  setDirection(dx, dy) {
    // Prevent 180° reverse turns into own neck
    if (this.direction.x !== -dx || this.direction.y !== -dy || this.segments.length <= 1) {
      this.nextDirection = { x: dx, y: dy };
    }
  }

  getHead() {
    return this.segments[0];
  }

  getNormalizedHead() {
    const head = this.getHead();
    return {
      x: head.x / (this.gridCols - 1),
      y: head.y / (this.gridRows - 1)
    };
  }

  getNormalizedSegments() {
    return this.segments.map(s => ({
      x: s.x / (this.gridCols - 1),
      y: s.y / (this.gridRows - 1)
    }));
  }

  /**
   * Autonomous AI decision making before taking a step
   */
  updateAutonomousSteering(foods = []) {
    const head = this.getHead();

    switch (this.autoBehavior) {
      case 'lissajous': {
        this.lissajousPhase += 0.08;
        // Map Lissajous target coordinate
        const targetX = Math.floor((Math.sin(this.lissajousPhase * 1.5) * 0.45 + 0.5) * (this.gridCols - 1));
        const targetY = Math.floor((Math.cos(this.lissajousPhase * 2.1) * 0.45 + 0.5) * (this.gridRows - 1));
        this.steerTowards(head, { x: targetX, y: targetY });
        break;
      }

      case 'mouseFollow': {
        if (this.mouseTarget) {
          this.steerTowards(head, this.mouseTarget);
        } else {
          this.steerHarmonicSeeker(head, foods);
        }
        break;
      }

      case 'brownian': {
        this.brownianDirChangeTimer++;
        if (this.brownianDirChangeTimer > 4 || Math.random() < 0.25) {
          this.brownianDirChangeTimer = 0;
          const dirs = [
            { x: 1, y: 0 }, { x: -1, y: 0 },
            { x: 0, y: 1 }, { x: 0, y: -1 }
          ];
          // Filter out 180 turn
          const valid = dirs.filter(d => !(d.x === -this.direction.x && d.y === -this.direction.y));
          const pick = valid[Math.floor(Math.random() * valid.length)];
          this.setDirection(pick.x, pick.y);
        }
        break;
      }

      case 'harmonicSeeker':
      default: {
        this.steerHarmonicSeeker(head, foods);
        break;
      }
    }
  }

  steerHarmonicSeeker(head, foods) {
    if (!foods || foods.length === 0) {
      // Wander towards center
      this.steerTowards(head, { x: Math.floor(this.gridCols / 2), y: Math.floor(this.gridRows / 2) });
      return;
    }

    // Find nearest food by Manhattan distance
    let nearest = foods[0];
    let minDist = Infinity;
    for (const f of foods) {
      const dist = Math.abs(f.x - head.x) + Math.abs(f.y - head.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = f;
      }
    }

    this.steerTowards(head, nearest);
  }

  steerTowards(head, target) {
    const dx = target.x - head.x;
    const dy = target.y - head.y;

    const possibleDirs = [];
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) possibleDirs.push({ x: 1, y: 0 });
      if (dx < 0) possibleDirs.push({ x: -1, y: 0 });
      if (dy > 0) possibleDirs.push({ x: 0, y: 1 });
      if (dy < 0) possibleDirs.push({ x: 0, y: -1 });
    } else {
      if (dy > 0) possibleDirs.push({ x: 0, y: 1 });
      if (dy < 0) possibleDirs.push({ x: 0, y: -1 });
      if (dx > 0) possibleDirs.push({ x: 1, y: 0 });
      if (dx < 0) possibleDirs.push({ x: -1, y: 0 });
    }

    // Fallback directions
    possibleDirs.push({ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 });

    // Pick first safe direction that avoids instant collision with self
    for (const dir of possibleDirs) {
      if (dir.x === -this.direction.x && dir.y === -this.direction.y && this.segments.length > 1) {
        continue;
      }
      const nextX = (head.x + dir.x + this.gridCols) % this.gridCols;
      const nextY = (head.y + dir.y + this.gridRows) % this.gridRows;
      const collidesWithBody = this.segments.some((s, idx) => idx > 0 && s.x === nextX && s.y === nextY);
      if (!collidesWithBody) {
        this.setDirection(dir.x, dir.y);
        return;
      }
    }

    // Default to best effort
    if (possibleDirs.length > 0) {
      this.setDirection(possibleDirs[0].x, possibleDirs[0].y);
    }
  }

  /**
   * Advances the snake by one step
   */
  step() {
    this.direction = { ...this.nextDirection };
    const head = this.getHead();
    let newX = head.x + this.direction.x;
    let newY = head.y + this.direction.y;
    let hitBoundary = false;

    // Handle Wall Collision Mode
    if (this.wallMode === 'wrap') {
      newX = (newX + this.gridCols) % this.gridCols;
      newY = (newY + this.gridRows) % this.gridRows;
    } else if (this.wallMode === 'bounce') {
      if (newX < 0 || newX >= this.gridCols) {
        this.direction.x = -this.direction.x;
        this.nextDirection.x = this.direction.x;
        newX = head.x + this.direction.x;
        hitBoundary = true;
      }
      if (newY < 0 || newY >= this.gridRows) {
        this.direction.y = -this.direction.y;
        this.nextDirection.y = this.direction.y;
        newY = head.y + this.direction.y;
        hitBoundary = true;
      }
      newX = Math.max(0, Math.min(this.gridCols - 1, newX));
      newY = Math.max(0, Math.min(this.gridRows - 1, newY));
    } else {
      // Classic mode
      if (newX < 0 || newX >= this.gridCols || newY < 0 || newY >= this.gridRows) {
        this.isDead = true;
        return { hitBoundary: true, hitSelf: false };
      }
    }

    // Check self collision
    const hitSelf = this.segments.some((seg, index) => {
      // ignore tail if not growing
      if (index === this.segments.length - 1 && this.growthQueue === 0) return false;
      return seg.x === newX && seg.y === newY;
    });

    if (hitSelf && this.wallMode === 'classic') {
      this.isDead = true;
      return { hitBoundary, hitSelf: true };
    }

    // Move
    this.segments.unshift({ x: newX, y: newY });

    if (this.growthQueue > 0) {
      this.growthQueue--;
    } else {
      this.segments.pop();
    }

    return { hitBoundary, hitSelf: false };
  }

  grow(amount = 1) {
    this.growthQueue += amount;
    this.score += amount * 10;
  }
}
