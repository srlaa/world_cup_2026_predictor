import assert from 'node:assert/strict';

function score({ odds, multiplier = 1, boost = false, outcome = false, exact = false, winnerBonus = 0 }) {
  const baseOutcomePoints = Math.ceil(outcome ? odds * 10 * multiplier : 0);
  return baseOutcomePoints * (boost ? 2 : 1)
    + (exact ? 50 : 0)
    + winnerBonus;
}

assert.equal(score({ odds: 1.8, outcome: true }), 18, 'group outcome');
assert.equal(score({ odds: 1.8, outcome: true, boost: true }), 36, 'Fireball doubles outcome');
assert.equal(score({ odds: 1.04, outcome: true, boost: true }), 22, 'Fireball doubles rounded integer points');
assert.equal(score({ odds: 1.8, outcome: true, boost: true, exact: true }), 86, 'exact bonus is not doubled');
assert.equal(score({ odds: 1.9, outcome: true, multiplier: 1.5 }), 29, 'quarter-final points round up');
assert.equal(score({ odds: 3.2, outcome: true, winnerBonus: 20 }), 52, 'draw plus correct knockout winner');
assert.equal(score({ odds: 2.15, outcome: false, winnerBonus: 8 }), 8, '1/2 consolation when selected team advances after a draw');
assert.equal(score({ odds: 3.2, outcome: true, boost: true, winnerBonus: 20 }), 84, 'Fireball does not double winner bonus');
assert.equal(score({ odds: 3, outcome: false }), 0, 'miss');
assert.equal(Math.max(0, 100 - Math.abs(14 - 11) * 2), 94, 'round-goal scoring');

console.log('Scoring checks passed.');
