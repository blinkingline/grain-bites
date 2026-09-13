import type { AttackKind, DefenseKind, RangeId, Team } from "./types";
import { clampDie, defenseSucceeds, rangeWidth, validAssignments, type Assignment } from "./rules";

/**
 * Brute-forces every way to spend up to `bounces` shifting the given dice (±1 per bounce,
 * stackable), and returns whichever combination scores highest under `evaluate`. Small search
 * space (<=3 dice, shift bounded by bounces) so exhaustive search is cheap and exact.
 */
export function bestBounceSpend(
  dice: number[],
  bounces: number,
  evaluate: (dice: number[]) => number,
): number[] {
  if (bounces <= 0) return dice;
  const maxShift = bounces; // a team never holds more than 3 Bounces anyway
  const deltas: number[] = [];
  for (let d = -maxShift; d <= maxShift; d++) deltas.push(d);

  let best = dice.slice();
  let bestScore = evaluate(dice);

  const combos: number[][] = [[]];
  for (let i = 0; i < dice.length; i++) {
    const next: number[][] = [];
    for (const combo of combos) {
      for (const d of deltas) next.push([...combo, d]);
    }
    combos.length = 0;
    combos.push(...next);
  }

  for (const combo of combos) {
    const cost = combo.reduce((a, b) => a + Math.abs(b), 0);
    if (cost > bounces) continue;
    const candidate = dice.map((v, i) => clampDie(v + combo[i]));
    const score = evaluate(candidate) - cost * 0.01; // conserve bounces on ties
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** Attacker's pre-assignment bounce spend: maximize the width of the best reachable target. */
export function aiAttackerBounceSpend(dice: number[], bounces: number, opponent: Team): number[] {
  return bestBounceSpend(dice, bounces, (candidate) => {
    const options = validAssignments(candidate, opponent);
    if (options.length === 0) return -1000;
    return Math.max(...options.map((o) => rangeWidth(o.targetRange)));
  });
}

/** Defender's reroll bounce spend: push the outcome toward whichever defense was chosen. */
export function aiDefenderBounceSpend(
  rerollDice: number[],
  bounces: number,
  defense: DefenseKind,
  targetRange: RangeId,
): number[] {
  return bestBounceSpend(rerollDice, bounces, (candidate) =>
    defenseSucceeds(defense, candidate, targetRange) ? 1 : 0,
  );
}

/** Prefer eliminating the widest surviving range: it's statistically the easiest to hit again. */
export function chooseAssignment(options: Assignment[]): Assignment {
  return options.reduce((best, o) => (rangeWidth(o.targetRange) > rangeWidth(best.targetRange) ? o : best));
}

export function chooseEliminationTarget(team: Team): RangeId {
  const alive = team.members.filter((m) => m.alive);
  const best = alive.reduce((a, b) => (rangeWidth(b.range) > rangeWidth(a.range) ? b : a));
  return best.range;
}

/** Dodge and Catch are complementary: pick whichever has the lower chance of losing the member. */
export function chooseDefense(rerollDiceCount: number, targetRange: RangeId): DefenseKind {
  const p = rangeWidth(targetRange) / 6;
  const matchProbability = 1 - (1 - p) ** rerollDiceCount;
  return matchProbability >= 0.5 ? "catch" : "dodge";
}

export function chooseAttackKind(ownBounces: number, opponentAliveCount: number): AttackKind {
  if (opponentAliveCount <= 2) return "slow"; // maximize targeting flexibility to close it out
  if (ownBounces >= 2) return "slow"; // more dice to leverage stacked bounces on
  return Math.random() < 0.55 ? "fast" : "slow";
}
