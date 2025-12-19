import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WORD_LIST } from '../src/lib/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRID_SIZE = 50; // Use a large grid to ensure fit, trim later

function generateLayout() {
    let bestGrid = null;
    let bestWordCount = 0;

    // Try 1000 times to get the best fit
    for (let attempt = 0; attempt < 1000; attempt++) {
        const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
        const placedWords = [];
        const shuffledWords = [...WORD_LIST].sort(() => 0.5 - Math.random());

        // Always start with the longest word in the middle for stability
        shuffledWords.sort((a, b) => b.word.length - a.word.length);
        const firstWord = shuffledWords[0];

        // Place first word horizontally in center
        const startRow = Math.floor(GRID_SIZE / 2);
        const startCol = Math.floor(GRID_SIZE / 2) - Math.floor(firstWord.word.length / 2);
        placeWord(grid, placedWords, firstWord, startRow, startCol, 'across');

        const remaining = shuffledWords.slice(1);

        // Try to place remaining words
        let progress = true;
        while (progress) {
            progress = false;
            // Try to place each unplaced word
            for (let i = 0; i < remaining.length; i++) {
                const wordObj = remaining[i];
                if (placedWords.find(pw => pw.word === wordObj.word)) continue;

                const placement = findPlacement(grid, wordObj.word);
                if (placement) {
                    placeWord(grid, placedWords, wordObj, placement.row, placement.col, placement.direction);
                    progress = true;
                }
            }
        }

        if (placedWords.length > bestWordCount) {
            bestWordCount = placedWords.length;
            bestGrid = { grid, placedWords };
            if (bestWordCount === WORD_LIST.length) break; // Found full solution
        }
    }

    return bestGrid;
}

function findPlacement(grid, word) {
    // Try every cell that matches a letter
    const possiblePlacements = [];

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c]) {
                // Find which letter of the new word matches grid[r][c]
                for (let i = 0; i < word.length; i++) {
                    if (word[i] === grid[r][c]) {
                        // Found a common letter at index i of new word
                        // Try placing 'across' and 'down' centered at this intersection

                        // If grid char was placed by an 'across' word, we must place 'down', and vice versa.
                        // But actually we just check if the perpendicular spot is free.

                        // Try ACROSS
                        if (canPlace(grid, word, r, c - i, 'across')) {
                            possiblePlacements.push({ row: r, col: c - i, direction: 'across' });
                        }
                        // Try DOWN
                        if (canPlace(grid, word, r - i, c, 'down')) {
                            possiblePlacements.push({ row: r - i, col: c, direction: 'down' });
                        }
                    }
                }
            }
        }
    }

    if (possiblePlacements.length > 0) {
        return possiblePlacements[Math.floor(Math.random() * possiblePlacements.length)];
    }
    return null;
}

function canPlace(grid, word, row, col, direction) {
    if (row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE) return false;

    // Bounds check end
    if (direction === 'across') {
        if (col + word.length > GRID_SIZE) return false;
        // Check neighbors and conflicts
        for (let i = 0; i < word.length; i++) {
            const r = row;
            const c = col + i;
            const cell = grid[r][c];

            // Conflict check
            if (cell !== null && cell !== word[i]) return false;

            // If cell is empty, check neighbors to ensure no accidental adjacency
            // If cell is occupied (by crossing word), neighbors are allowed perpendicular
            if (cell === null) {
                // Check top/bottom for across placement
                if (grid[r - 1] && grid[r - 1][c] !== null) return false;
                if (grid[r + 1] && grid[r + 1][c] !== null) return false;
                // Check immediate left/right of the WHOLE word (start-1 and end+1)
            }
        }
        // Check ends
        if (col > 0 && grid[row][col - 1] !== null) return false;
        if (col + word.length < GRID_SIZE && grid[row][col + word.length] !== null) return false;

    } else { // down
        if (row + word.length > GRID_SIZE) return false;
        for (let i = 0; i < word.length; i++) {
            const r = row + i;
            const c = col;
            const cell = grid[r][c];

            if (cell !== null && cell !== word[i]) return false;

            if (cell === null) {
                // Check left/right for down placement
                if (grid[r][c - 1] !== null) return false;
                if (grid[r][c + 1] !== null) return false;
            }
        }
        if (row > 0 && grid[row - 1][col] !== null) return false;
        if (row + word.length < GRID_SIZE && grid[row + word.length][col] !== null) return false;
    }

    return true;
}

function placeWord(grid, placedWords, wordObj, row, col, direction) {
    for (let i = 0; i < wordObj.word.length; i++) {
        if (direction === 'across') {
            grid[row][col + i] = wordObj.word[i];
        } else {
            grid[row + i][col] = wordObj.word[i];
        }
    }
    placedWords.push({
        ...wordObj,
        row,
        col,
        direction,
        id: placedWords.length + 1,
        answer: wordObj.word
    });
}

const result = generateLayout();

if (result) {
    console.log(`Generated layout with ${result.placedWords.length}/${WORD_LIST.length} words.`);

    // Normalize coordinates to 0,0
    const minRow = Math.min(...result.placedWords.map(w => w.row));
    const minCol = Math.min(...result.placedWords.map(w => w.col));
    const maxRow = Math.max(...result.placedWords.map(w => w.direction === 'down' ? w.row + w.word.length : w.row));
    const maxCol = Math.max(...result.placedWords.map(w => w.direction === 'across' ? w.col + w.word.length : w.col));

    const width = maxCol - minCol;
    const height = maxRow - minRow;

    const normalized = result.placedWords.map(w => ({
        ...w,
        row: w.row - minRow,
        col: w.col - minCol
    }));

    const output = {
        width,
        height,
        words: normalized
    };

    const outputPath = path.resolve(__dirname, '../src/lib/layout.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log('Layout saved to src/lib/layout.json');
} else {
    console.error('Failed to generate layout.');
}
