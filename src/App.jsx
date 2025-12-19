import React, { useState, useEffect, useRef } from 'react';
import layout from './lib/layout.json';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Check, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

const CELL_SIZE = 36; // px

export default function App() {
  // Game State
  const [gridState, setGridState] = useState({}); // { "row-col": "LETTER" }
  const [focus, setFocus] = useState({ row: layout.words[0].row, col: layout.words[0].col, wordId: layout.words[0].id });
  const [solvedWords, setSolvedWords] = useState(new Set());
  const [gameWon, setGameWon] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);

  // Derived Grid Data
  // Create a map of cells to words: cellKey -> { wordId, indexInWord, direction }[]
  // Also map wordId -> word object
  const cellMap = useRef({});
  const wordMap = useRef({});
  const gridCells = useRef([]); // List of all valid cells for rendering

  if (Object.keys(cellMap.current).length === 0) {
    layout.words.forEach(w => {
      wordMap.current[w.id] = w;
      for (let i = 0; i < w.answer.length; i++) {
        const r = w.direction === 'across' ? w.row : w.row + i;
        const c = w.direction === 'across' ? w.col + i : w.col;
        const key = `${r}-${c}`;

        if (!cellMap.current[key]) {
          cellMap.current[key] = [];
          gridCells.current.push({ row: r, col: c, key });
        }
        cellMap.current[key].push({ id: w.id, index: i, direction: w.direction });
      }
    });
  }

  // Check for win
  useEffect(() => {
    if (solvedWords.size === layout.words.length && !gameWon) {
      setGameWon(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff4d6d', '#eebbcc', '#ffffff']
      });
    }
  }, [solvedWords]);

  // Helpers
  const getActiveWord = () => wordMap.current[focus.wordId];

  const handleCellChange = (r, c, val) => {
    if (gameWon) return;
    const char = val.slice(-1).toUpperCase();
    if (!/^[A-Z]$/.test(char) && char !== '') return;

    setGridState(prev => ({ ...prev, [`${r}-${c}`]: char }));

    // Auto-advance
    if (char) {
      const activeWord = getActiveWord();
      if (!activeWord) return;

      const currentIdx = activeWord.direction === 'across' ? c - activeWord.col : r - activeWord.row;
      if (currentIdx < activeWord.answer.length - 1) {
        // Move to next cell in current word
        const nextR = activeWord.direction === 'across' ? r : r + 1;
        const nextC = activeWord.direction === 'across' ? c + 1 : c;
        setFocus(prev => ({ ...prev, row: nextR, col: nextC }));
      }

      // Check if word is complete
      checkWordCompletion(activeWord.id, { ...gridState, [`${r}-${c}`]: char });
    }
  };

  const checkWordCompletion = (wid, currentGrid) => {
    const w = wordMap.current[wid];
    let isCorrect = true;
    for (let i = 0; i < w.answer.length; i++) {
      const r = w.direction === 'across' ? w.row : w.row + i;
      const c = w.direction === 'across' ? w.col + i : w.col;
      if (currentGrid[`${r}-${c}`] !== w.answer[i]) {
        isCorrect = false;
        break;
      }
    }
    if (isCorrect) {
      setSolvedWords(prev => {
        const newSet = new Set(prev);
        newSet.add(wid);
        return newSet;
      });
    }
  };

  const handleKeyDown = (e, r, c) => {
    if (gameWon) return;

    if (e.key === 'Backspace') {
      setGridState(prev => ({ ...prev, [`${r}-${c}`]: '' }));
      // Move back
      const activeWord = getActiveWord();
      const currentIdx = activeWord.direction === 'across' ? c - activeWord.col : r - activeWord.row;
      if (currentIdx > 0) {
        const nextR = activeWord.direction === 'across' ? r : r - 1;
        const nextC = activeWord.direction === 'across' ? c - 1 : c;
        setFocus(prev => ({ ...prev, row: nextR, col: nextC }));
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Navigate Grid Logic (Simplified: just move visually)
      e.preventDefault();
      // Logic to switch focus based on geometry (omitted for brevity, can rely on user click or strict word nav)
    }
  };

  const handleCellClick = (r, c) => {
    // Find words at this cell
    const wordsAtCell = cellMap.current[`${r}-${c}`];
    if (!wordsAtCell) return;

    // Toggle direction if already focused on this cell
    if (focus.row === r && focus.col === c) {
      // Find other word at this cell
      const other = wordsAtCell.find(w => w.id !== focus.wordId);
      if (other) {
        setFocus({ row: r, col: c, wordId: other.id });
      }
    } else {
      // Prefer word that matches current direction if possible, else first
      const currentWord = wordMap.current[focus.wordId];
      const sameDir = wordsAtCell.find(w => w.direction === currentWord?.direction);
      setFocus({ row: r, col: c, wordId: (sameDir || wordsAtCell[0]).id });
    }
  };

  const revealCell = () => {
    if (gameWon) return;
    const { row, col } = focus;
    const key = `${row}-${col}`;
    // Find correct char from layout
    const wordObj = cellMap.current[key]?.find(w => w.id === focus.wordId); // Use current focused word
    // Actually we can just find ANY word at this cell
    // But we need the correct character.
    // We can look it up in the word map using the wordId.
    let correctChar = '';
    // iterate all words to find what should be at row/col
    const wId = cellMap.current[key]?.[0]?.id; // Pick first word at this cell
    if (wId) {
      const w = wordMap.current[wId];
      // find index
      const idx = w.direction === 'across' ? col - w.col : row - w.row;
      correctChar = w.answer[idx];
    }

    if (correctChar) {
      setGridState(prev => {
        const next = { ...prev, [key]: correctChar };
        // Check completion for all words passing through this cell
        cellMap.current[key].forEach(m => checkWordCompletion(m.id, next));
        return next;
      });
    }
  };

  const revealWord = () => {
    if (gameWon) return;
    const w = wordMap.current[focus.wordId];
    if (!w) return;

    setGridState(prev => {
      const next = { ...prev };
      for (let i = 0; i < w.answer.length; i++) {
        const r = w.direction === 'across' ? w.row : w.row + i;
        const c = w.direction === 'across' ? w.col + i : w.col;
        next[`${r}-${c}`] = w.answer[i];
      }
      checkWordCompletion(w.id, next); // Check this word
      // Also check crossing words? Yes, ideally.
      // Simplified: checkWordCompletion handles updating solvedWords. 
      // But we need to trigger it for crossing words too if we want them to turn green immediately.
      // Iterate all cells in this word
      for (let i = 0; i < w.answer.length; i++) {
        const r = w.direction === 'across' ? w.row : w.row + i;
        const c = w.direction === 'across' ? w.col + i : c;
        const key = `${r}-${c}`;
        cellMap.current[key]?.forEach(m => {
          if (m.id !== w.id) checkWordCompletion(m.id, next);
        });
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-brand-pink selection:text-white overflow-hidden">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center z-10">
        <h1 className="text-4xl md:text-6xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-pink to-brand-accent tracking-tighter">
          All's fair in Love & Crosswords
        </h1>
        <p className="text-gray-400 mt-2 font-light">Solved: {solvedWords.size} / {layout.words.length}</p>
      </motion.div>

      {/* Game Container */}
      <div className="flex flex-col lg:flex-row gap-12 w-full max-w-6xl items-start justify-center">

        {/* The Grid - Scaled to fit */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative bg-gray-800/50 p-4 rounded-xl shadow-2xl backdrop-blur-sm border border-white/10 overflow-auto"
          style={{ maxHeight: '70vh', maxWidth: '100%' }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${layout.width + 1}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${layout.height + 1}, ${CELL_SIZE}px)`,
            gap: '2px'
          }}>
            {gridCells.current.map(({ row, col, key }) => {
              const isFocused = focus.row === row && focus.col === col;
              const isActiveWord = cellMap.current[key].some(m => m.id === focus.wordId);
              const val = gridState[key] || '';
              const isSolvedCell = cellMap.current[key].some(m => solvedWords.has(m.id));

              // Clue number
              let clueNum = null;
              layout.words.forEach(w => {
                if (w.row === row && w.col === col) clueNum = w.id;
              });

              return (
                <div
                  key={key}
                  style={{ gridColumn: col + 1, gridRow: row + 1 }}
                  className={`
                                relative flex items-center justify-center text-lg font-bold uppercase transition-all duration-200 cursor-pointer
                                rounded-sm select-none
                                ${isFocused ? 'bg-brand-accent text-white scale-110 z-10 shadow-lg ring-2 ring-brand-pink' :
                      isActiveWord ? 'bg-brand-pink/20 text-brand-pink' : 'bg-gray-700 text-white hover:bg-gray-600'}
                                ${isSolvedCell && !isFocused ? 'bg-green-500/20 text-green-400' : ''}
                            `}
                  onClick={() => handleCellClick(row, col)}
                >
                  <span className="absolute top-0.5 left-0.5 text-[8px] font-normal text-gray-400 leading-none">
                    {clueNum}
                  </span>
                  {/* We use a hidden input for mobile keyboard support on the focused cell */}
                  {isFocused && (
                    <input
                      autoFocus
                      className="absolute inset-0 opacity-0 cursor-text"
                      value={val}
                      onChange={(e) => handleCellChange(row, col, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, col)}
                    />
                  )}
                  {val}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Clues Panel */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full lg:w-96 flex flex-col gap-6 h-[600px]"
        >
          <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10 flex-1 flex flex-col backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 text-brand-pink">
              <HelpCircle size={20} />
              <h2 className="text-xl font-bold">Current Clue</h2>
            </div>
            <div className="bg-brand-pink/10 p-4 rounded-lg border border-brand-pink/20 mb-6">
              <span className="font-bold text-brand-pink mr-2">{focus.wordId}.</span>
              <span className="text-lg italic">{getActiveWord()?.clue}</span>
              <div className="mt-2 text-xs text-gray-400 uppercase tracking-widest font-semibold">
                {getActiveWord()?.direction} • {getActiveWord()?.answer.length} Letters
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={revealCell}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                Reveal Letter
              </button>
              <button
                onClick={revealWord}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                Reveal Word
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2 mt-4">
              <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2 sticky top-0 bg-gray-800/95 py-2">All Clues</h3>
              {layout.words.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setFocus({ row: w.row, col: w.col, wordId: w.id })}
                  className={`p-3 rounded-lg cursor-pointer transition-colors text-sm flex gap-3 ${focus.wordId === w.id ? 'bg-brand-pink text-brand-dark font-medium shadow-lg' :
                    solvedWords.has(w.id) ? 'opacity-50 line-through text-gray-500' : 'hover:bg-gray-700/50 text-gray-300'
                    }`}
                >
                  <span className="font-bold min-w-[1.5rem]">{w.id}.</span>
                  <span>{w.clue}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Win Modal */}
      <AnimatePresence>
        {gameWon && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }}
              className="bg-gray-900 border border-brand-pink p-8 rounded-2xl max-w-md text-center shadow-[0_0_50px_rgba(255,77,109,0.3)]"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-brand-pink to-brand-accent rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Check className="text-white" size={32} strokeWidth={3} />
              </div>
              <h2 className="text-3xl font-serif font-bold text-white mb-2">You Did It! ❤️</h2>
              <p className="text-gray-300 mb-8">
                You know me (and us) so well. I'm proud of you!
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-brand-pink hover:bg-brand-accent text-brand-dark font-bold rounded-full transition-all transform hover:scale-105"
              >
                Play Again?
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-8 text-gray-600 text-sm">
        Made with ❤️ by Saif
      </footer>

    </div>
  );
}
