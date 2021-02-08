(() => {
'use strict';

// random int in [0, n)
const rand = (n) => Math.floor(Math.random() * n);

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = rand(i + 1);
    let temp = arr[j];
    arr[j] = arr[i];
    arr[i] = temp;
  }
  return arr;
};

const MASK = 2 ** 16 - 1;
const pair = (x, y) => (x << 16) + y;
const unpair = n => [n >> 16, n & MASK];

const createDiv = (...classNames) => {
  const div = document.createElement('div');
  div.classList.add(...classNames);
  return div;
};


// messages
const BOOM = createDiv('boom');
BOOM.innerText = 'BOOM';
const WINNER = createDiv('winner');
WINNER.innerText = 'WINNER';


// colors
const BLACK = '#000';
const GREY_HOVER = '#aaa';
const GREY = '#bbb';
const WHITE = '#fff';
const NUM_COLOR_MAP = {
  1: '#00d',
  2: '#0b0',
  3: '#d00',
  4: '#d0d',
  5: '#da0',
};


// drawing canvas
class Canvas {
  constructor(container) {
    this.root = document.createElement('canvas');
    this.root.width = this.width = container.offsetWidth;
    this.root.height = this.height = container.offsetHeight;
    this.ctx = this.root.getContext('2d');
    if (container.children[0] !== this.root) {
      [...container.children].forEach(child => child.remove());
      container.appendChild(this.root);
    }
  }
}


// hex grid
class HexGrid {
  constructor(width, height, container) {
    this.width = width;
    this.height = height;
    this.canvas_ = new Canvas(container);

    // dimensions of each hex, in pixels
    this.sizeX_ = Math.min(
        this.canvas_.width / (this.width + 0.5),
        this.canvas_.height * 6 / ((1 + 3 * this.height) * Math.sqrt(3)));
    this.sizeY_ = 2 * this.sizeX_ / Math.sqrt(3);

    // center board in window
    const visibleWidth = this.sizeX_ * (this.width + 0.5);
    this.canvas_.root.style.marginLeft =
        `${(container.offsetWidth - visibleWidth) / 2}px`;

    // center text
    this.canvas_.ctx.font = `${this.sizeY_ * 0.75}px 'Courier New'`;
    this.canvas_.ctx.textAlign = 'center';
    this.canvas_.ctx.textBaseline = 'middle';

    // offsets from the top vertex, going clockwise
    this.vertexOffsets_ = [
      [this.sizeX_ / 2, this.sizeY_ / 4],
      [this.sizeX_ / 2, 3 * this.sizeY_ / 4],
      [0, this.sizeY_],
      [-this.sizeX_ / 2, 3 * this.sizeY_ / 4],
      [-this.sizeX_ / 2, this.sizeY_ / 4],
      [0, 0],
    ];
  }

  drawCell(x, y, options = {color: WHITE, border: BLACK, text: undefined}) {
    if (x >= this.width || y >= this.height || x < 0 || y < 0) {
      return;
    }
    const topX = (x + (y & 1 ? 1 : 0.5)) * this.sizeX_;
    const topY = y * this.sizeY_ * 0.75;
    const ctx = this.canvas_.ctx;
    const traceHex = () => {
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      for (const [dx, dy] of this.vertexOffsets_) {
        ctx.lineTo(topX + dx, topY + dy);
      }
    };
    ctx.fillStyle = options.color;
    traceHex();
    ctx.fill();
    ctx.fillStyle = options.border;
    traceHex();
    ctx.stroke();
    if (options.text) {
      ctx.fillStyle = NUM_COLOR_MAP[options.text] || BLACK;
      ctx.fillText(options.text, topX, topY + this.sizeY_ * 0.5);
    }
  }

  drawAllBorders() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.drawCell(x, y, {color: GREY});
      }
    }
  }

  // yep, this is voodoo
  getCellCoords(layerX, layerY) {
    let quarterHeights = Math.floor(4 * layerY / this.sizeY_);
    // handle diagonals
    if (quarterHeights % 3 === 0) {
      const halfWidths = Math.floor(2 * layerX / this.sizeX_);
      const unitX = 2 * layerX / this.sizeX_ - halfWidths;
      const unitY = 4 * layerY / this.sizeY_ - quarterHeights;
      const hwEven = halfWidths % 2 === 0;
      const qm6even = quarterHeights % 6 === 0;
      if (hwEven === qm6even) {
        // diagonal up
        if (unitX + unitY > 1) {
          quarterHeights++;
        } else {
          quarterHeights--;
        }
      } else {
        // diagonal down
        if (unitY > unitX) {
          quarterHeights++;
        } else {
          quarterHeights--;
        }
      }
    }
    // now we're not in diagonal territory
    const cellY = Math.floor((quarterHeights - 1) / 3);
    if (cellY < 0 || cellY >= this.height) {
      return [NaN, NaN];
    }
    const cellX = cellY & 1 ? Math.floor(layerX / this.sizeX_ - 0.5) :
                              Math.floor(layerX / this.sizeX_);
    if (cellX < 0 || cellX >= this.width) {
      return [NaN, NaN];
    }
    return [cellX, cellY];
  }

  getNeighbors(x, y) {
    let arr;
    if (y % 2 === 0) {
      arr = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
        [x - 1, y + 1],
        [x - 1, y - 1],
      ];
    } else {
      arr = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
        [x + 1, y + 1],
        [x + 1, y - 1],
      ];
    }
    return arr.filter(
        ([x, y]) => 0 <= x && x < this.width && 0 <= y && y < this.height);
  }
}


class Tile {
  constructor() {
    this.adjacentMines = 0;
    this.hasMine = false;
    this.isFlagged = false;
    this.isRevealed = false;
  }
}


const DENSITY_INPUT = document.getElementById('density');
const FLAGS_EL = document.getElementById('numFlags');
const MINES_EL = document.getElementById('numMines');


// minesweeper logic
class Minesweeper {
  constructor(width, height) {
    this.root_ = document.getElementById('board');
    this.hexGrid_ = new HexGrid(width, height, this.root_);
    this.hexGrid_.drawAllBorders();
    this.tiles_ = new Array(height);
    for (let y = 0; y < height; y++) {
      this.tiles_[y] = new Array(width);
      for (let x = 0; x < width; x++) {
        this.tiles_[y][x] = new Tile();
      }
    }

    this.gameInProgress_ = true;
    this.isFirstMove_ = true;
    this.width_ = width;
    this.height_ = height;
    this.tilesLeftToReveal_ = null;
    this.numMines_ = 0;
    this.numFlags_ = 0;
    this.updateCounters();
    this.placeMines_(parseInt(DENSITY_INPUT.value) / 100);

    this.attachMouseHandlers_();
  }

  attachMouseHandlers_() {
    // disable context menu so we can handle right click
    this.hexGrid_.canvas_.root.addEventListener('contextmenu', event => {
      event.preventDefault();
      return false;
    });
    // thus, this handles all clicks
    this.hexGrid_.canvas_.root.addEventListener('mousedown', event => {
      if (!this.gameInProgress_) {
        return;
      }
      const [cellX, cellY] =
          this.hexGrid_.getCellCoords(event.layerX, event.layerY);
      if (isNaN(cellX)) {
        return;
      }
      if (event.button !== 0 || event.altKey || event.ctrlKey ||
          event.metaKey) {
        this.flag(cellX, cellY);
      } else {
        this.reveal(cellX, cellY);
      }
    });
  }

  updateCounters() {
    FLAGS_EL.innerText = this.numFlags_;
    MINES_EL.innerText = this.numMines_;
  }

  // Randomly places mines on the board
  placeMines_(density) {
    let numTiles = this.width_ * this.height_;
    this.numMines_ = Math.floor(density * numTiles);
    this.updateCounters();
    this.tilesLeftToReveal_ = numTiles - this.numMines_;
    // Shuffle 1D array to determine mine positions
    let minePositions = new Array(numTiles).fill(false);
    for (let i = 0; i < this.numMines_; i++) {
      minePositions[i] = true;
    }
    shuffle(minePositions);
    // Map onto 2D tile array
    for (let y = 0; y < this.height_; y++) {
      for (let x = 0; x < this.width_; x++) {
        this.tiles_[y][x].hasMine = minePositions[y * this.width_ + x];
      }
    }
    // Set tile labels
    this.labelTiles_();
  }

  // Calculates the number of adjacent mines for each tile
  labelTiles_() {
    for (let y = 0; y < this.height_; y++) {
      for (let x = 0; x < this.width_; x++) {
        let tile = this.tiles_[y][x];
        if (tile.hasMine) {
          this.forEachNeighbor_(x, y, (nbrX, nbrY) => {
            this.tiles_[nbrY][nbrX].adjacentMines++;
          });
        }
      }
    }
  }

  forEachNeighbor_(x, y, fn) {
    for (const [nbrX, nbrY] of this.hexGrid_.getNeighbors(x, y)) {
      fn(nbrX, nbrY);
    }
  }

  // Swaps the mine in the given tile with a randomly selected open tile and
  // updates the tile labels accordingly.
  swapMine_(originalX, originalY) {
    let numOpenTiles = (this.height_ * this.width_) - this.numMines_;
    let indexToSwap = rand(numOpenTiles);
    for (let y = 0; y < this.height_; y++) {
      for (let x = 0; x < this.width_; x++) {
        let tile = this.tiles_[y][x];
        if (!tile.hasMine) {
          indexToSwap--;
          if (indexToSwap < 0) {
            tile.hasMine = true;
            this.forEachNeighbor_(x, y, (nbrX, nbrY) => {
              this.tiles_[nbrY][nbrX].adjacentMines++;
            });
            this.tiles_[originalY][originalX].hasMine = false;
            this.forEachNeighbor_(originalX, originalY, (nbrX, nbrY) => {
              this.tiles_[nbrY][nbrX].adjacentMines--;
            });
            return;
          }
        }
      }
    }
  }

  // Reveals a tile
  reveal(x, y) {
    const tile = this.tiles_[y][x];
    if (tile.isRevealed || tile.isFlagged) {
      return;
    }
    if (tile.hasMine) {
      if (this.isFirstMove_) {
        // Don't allow player to lose on the first move
        this.swapMine_(x, y);
      } else {
        tile.isRevealed = true;
        this.renderTile(x, y);
        this.gameInProgress_ = false;
        this.root_.appendChild(BOOM);
        return;
      }
    }
    this.isFirstMove_ = false;
    const updatedLocations = this.aNewCavernHasBeenDiscovered_(x, y);
    for (const [x, y] of updatedLocations) {
      this.renderTile(x, y);
    }
    if (this.tilesLeftToReveal_ === 0) {
      this.gameInProgress_ = false;
      this.root_.appendChild(WINNER);
    }
  }

  // Toggle flag
  flag(x, y) {
    const tile = this.tiles_[y][x];
    if (!tile.isRevealed) {
      tile.isFlagged = !tile.isFlagged;
      this.renderTile(x, y);
      this.numFlags_ += tile.isFlagged ? 1 : -1;
      this.updateCounters();
    }
  }

  // Recursively descubrido
  aNewCavernHasBeenDiscovered_(x, y, updatedLocations = []) {
    const tile = this.tiles_[y][x];
    if (tile.isRevealed) {
      return;
    }
    if (tile.isFlagged) {
      tile.isFlagged = false;
      this.numFlags_--;
    }
    tile.isRevealed = true;
    this.tilesLeftToReveal_--;
    updatedLocations.push([x, y]);
    if (tile.adjacentMines === 0 && !tile.hasMine) {
      this.forEachNeighbor_(x, y, (nbrX, nbrY) => {
        this.aNewCavernHasBeenDiscovered_(nbrX, nbrY, updatedLocations);
      });
    }
    return updatedLocations;
  }

  renderTile(x, y) {
    const tile = this.tiles_[y][x];
    if (!tile.isRevealed) {
      this.hexGrid_.drawCell(
          x, y, {color: GREY, text: tile.isFlagged ? 'F' : ''});
    } else {
      const label = tile.hasMine ?
          '💣' :
          (tile.adjacentMines === 0 ? '' : tile.adjacentMines);
      this.hexGrid_.drawCell(x, y, {
        color: WHITE,
        text: label,
      });
    }
  }
}


// init
const WIDTH_INPUT = document.getElementById('width');
const HEIGHT_INPUT = document.getElementById('height');
const restart = () => {
  new Minesweeper(parseInt(WIDTH_INPUT.value), parseInt(HEIGHT_INPUT.value));
};
const handleInputKeypress = (event) => {
  if (event.key === 'Enter') {
    restart();
  }
};
document.getElementById('restart').addEventListener('click', restart);
DENSITY_INPUT.addEventListener('keypress', handleInputKeypress);
HEIGHT_INPUT.addEventListener('keypress', handleInputKeypress);
WIDTH_INPUT.addEventListener('keypress', handleInputKeypress);
window.addEventListener('keydown', event => {
  if (event.key === 'r') {
    restart();
  }
});
restart();
})();
