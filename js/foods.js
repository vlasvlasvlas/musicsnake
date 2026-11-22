/**
 * Harmonic Orbs / Food Nodes
 * Eating these in game or auto mode triggers musical modulations and grows the snake.
 */

import { SCALES, TREATMENTS, NOTES } from './music.js';

export const FOOD_TYPES = [
  {
    type: 'tonic',
    label: 'TONIC',
    glyph: '♩',
    color: '#00ffcc',
    description: 'Extends snake trail, enhances harmonic memory'
  },
  {
    type: 'scale',
    label: 'SCALE',
    glyph: '§',
    color: '#ff0077',
    description: 'Modulates musical mode / scale'
  },
  {
    type: 'chord',
    label: 'VOICING',
    glyph: '∿',
    color: '#ffcc00',
    description: 'Mutates Laurie Spiegel counterpoint treatment'
  },
  {
    type: 'filter',
    label: 'FILTER',
    glyph: '◬',
    color: '#7700ff',
    description: 'Modulates analog filter sweep & resonance'
  },
  {
    type: 'tempo',
    label: 'TEMPO',
    glyph: '⏱',
    color: '#00ddff',
    description: 'Shifts arpeggiator clock pulse'
  },
  {
    type: 'echo',
    label: 'SPACE',
    glyph: '◌',
    color: '#ff8800',
    description: 'Lush stereo delay & ambient reverb swell'
  }
];

export class FoodManager {
  constructor(gridCols = 32, gridRows = 32) {
    this.gridCols = gridCols;
    this.gridRows = gridRows;
    this.foods = [];
    this.maxFoods = 4;
    this.spawnInitialFoods();
  }

  setGridSize(cols, rows) {
    this.gridCols = cols;
    this.gridRows = rows;
  }

  spawnInitialFoods(avoidCoords = []) {
    this.foods = [];
    for (let i = 0; i < this.maxFoods; i++) {
      this.spawnFood(avoidCoords);
    }
  }

  spawnFood(avoidCoords = []) {
    // Pick random food type (weighted towards tonic / scale / chord)
    const weights = ['tonic', 'tonic', 'scale', 'chord', 'filter', 'tempo', 'echo'];
    const selectedTypeKey = weights[Math.floor(Math.random() * weights.length)];
    const def = FOOD_TYPES.find(f => f.type === selectedTypeKey) || FOOD_TYPES[0];

    // Find random free position
    let x, y, collides;
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * this.gridCols);
      y = Math.floor(Math.random() * this.gridRows);
      collides = avoidCoords.some(c => c.x === x && c.y === y) ||
                 this.foods.some(f => f.x === x && f.y === y);
      attempts++;
    } while (collides && attempts < 50);

    const food = {
      id: Math.random().toString(36).substring(2, 9),
      x,
      y,
      type: def.type,
      label: def.label,
      glyph: def.glyph,
      color: def.color,
      description: def.description,
      phase: Math.random() * Math.PI * 2,
      born: Date.now()
    };

    this.foods.push(food);
    return food;
  }

  consumeAt(x, y, avoidCoords = []) {
    const idx = this.foods.findIndex(f => f.x === x && f.y === y);
    if (idx !== -1) {
      const consumed = this.foods.splice(idx, 1)[0];
      this.spawnFood(avoidCoords);
      return consumed;
    }
    return null;
  }
}
