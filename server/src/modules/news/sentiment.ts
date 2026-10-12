import type { Sentiment } from './news.types.js';

// "higher" and "lower" are deliberately absent: they take their meaning from their subject.
// "Sensex falls amid higher oil prices" is bearish, and a bare word list reads it as neutral.
const POSITIVE = [
  'surge', 'surges', 'jump', 'jumps', 'rally', 'rallies', 'gain', 'gains', 'beat', 'beats', 'profit',
  'upgrade', 'upgrades', 'record', 'growth', 'outperform', 'bullish', 'rise', 'rises', 'soar', 'soars',
  'wins', 'approval', 'expands', 'strong', 'boost', 'rebound', 'optimism', 'buyback',
];

const NEGATIVE = [
  'fall', 'falls', 'drop', 'drops', 'plunge', 'plunges', 'slump', 'slumps', 'loss', 'losses', 'miss',
  'misses', 'downgrade', 'downgrades', 'probe', 'fraud', 'decline', 'declines', 'bearish', 'cut', 'cuts',
  'weak', 'lawsuit', 'resign', 'resigns', 'crash', 'slide', 'slides', 'warns', 'warning',
  'selloff', 'concerns', 'penalty', 'fine', 'default', 'layoff', 'layoffs',
];

// Index moves are unambiguous when the direction is attached to the close.
const POSITIVE_PHRASES = ['ends higher', 'settles higher', 'closes higher', 'ends in the green'];
const NEGATIVE_PHRASES = ['ends lower', 'settles lower', 'closes lower', 'ends in the red', 'settles below'];

// "down 374 pts" or "ends 374 points lower" — a number attached to a direction is unambiguous.
const POSITIVE_MOVES = [/\bup\s+[\d.,]+\s*(pts|points|%)/i, /\bends?\s+[\d.,]+\s+points?\s+higher\b/i];
const NEGATIVE_MOVES = [/\bdown\s+[\d.,]+\s*(pts|points|%)/i, /\bends?\s+[\d.,]+\s+points?\s+lower\b/i];

function countPhrases(text: string, phrases: string[]): number {
  const value = text.toLowerCase();
  return phrases.reduce((total, phrase) => (value.includes(phrase) ? total + 1 : total), 0);
}

function countPatterns(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => (pattern.test(text) ? total + 1 : total), 0);
}

function countMatches(text: string, words: string[]): number {
  return words.reduce((total, word) => (new RegExp(`\\b${word}\\b`, 'i').test(text) ? total + 1 : total), 0);
}

const HEADLINE_WEIGHT = 2;

/**
 * Keyword scoring, not a language model. The headline carries double weight: a summary that
 * happens to mention "gains" elsewhere should not cancel out a headline that says "falls".
 * Deliberately conservative — no recognised signal reads neutral rather than guessing.
 */
export function scoreSentiment(headline: string, body = ''): { sentiment: Sentiment; score: number } {
  const positives =
    (countMatches(headline, POSITIVE) +
      countPhrases(headline, POSITIVE_PHRASES) +
      countPatterns(headline, POSITIVE_MOVES)) *
      HEADLINE_WEIGHT +
    countMatches(body, POSITIVE);
  const negatives =
    (countMatches(headline, NEGATIVE) +
      countPhrases(headline, NEGATIVE_PHRASES) +
      countPatterns(headline, NEGATIVE_MOVES)) *
      HEADLINE_WEIGHT +
    countMatches(body, NEGATIVE);
  const total = positives + negatives;

  if (total === 0) return { sentiment: 'neutral', score: 0 };

  const score = Math.round(((positives - negatives) / total) * 100) / 100;
  const sentiment: Sentiment = score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';

  return { sentiment, score };
}
