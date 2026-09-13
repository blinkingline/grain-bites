import type { RangeId, Team } from "./types";
import { RANGE_IDS } from "./types";

export function rangeMatches(range: RangeId, value: number): boolean {
  switch (range) {
    case "ODD":
      return value % 2 === 1;
    case "EVEN":
      return value % 2 === 0;
    case "1-2":
      return value <= 2;
    case "3-4":
      return value === 3 || value === 4;
    case "5-6":
      return value >= 5;
    case "1-3":
      return value <= 3;
    case "4-6":
      return value >= 4;
  }
}

/** Number of the six die faces a range covers. Wider ranges are safer to keep, more dangerous to leave alive. */
export function rangeWidth(range: RangeId): number {
  return range === "ODD" || range === "EVEN" || range === "1-3" || range === "4-6" ? 3 : 2;
}

export function createTeam(): Team {
  return {
    members: RANGE_IDS.map((range) => ({ range, alive: true })),
    bounces: 0,
  };
}

export function isTeamEliminated(team: Team): boolean {
  return team.members.every((m) => !m.alive);
}

export function aliveTargetsForValue(team: Team, value: number): RangeId[] {
  return team.members.filter((m) => m.alive && rangeMatches(m.range, value)).map((m) => m.range);
}

export interface Assignment {
  dieIndex: number;
  dieValue: number;
  targetRange: RangeId;
}

/** Every legal (die, target) pairing available from a set of rolled dice against a defending team. */
export function validAssignments(dice: number[], defendingTeam: Team): Assignment[] {
  const out: Assignment[] = [];
  dice.forEach((dieValue, dieIndex) => {
    for (const range of aliveTargetsForValue(defendingTeam, dieValue)) {
      out.push({ dieIndex, dieValue, targetRange: range });
    }
  });
  return out;
}

export function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
}

export function clampDie(value: number): number {
  return Math.min(6, Math.max(1, value));
}

/** Dodge succeeds iff no reroll die matches; Catch succeeds iff at least one does. */
export function defenseSucceeds(
  defense: "dodge" | "catch",
  rerollDice: number[],
  targetRange: RangeId,
): boolean {
  const anyMatch = rerollDice.some((d) => rangeMatches(targetRange, d));
  return defense === "dodge" ? !anyMatch : anyMatch;
}
