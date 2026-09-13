export const RANGE_IDS = [
  "ODD",
  "EVEN",
  "1-2",
  "3-4",
  "5-6",
  "1-3",
  "4-6",
] as const;

export type RangeId = (typeof RANGE_IDS)[number];

export type PlayerId = "human" | "ai";

export type AttackKind = "fast" | "slow";

export type DefenseKind = "dodge" | "catch";

export interface TeamMember {
  range: RangeId;
  alive: boolean;
}

export interface Team {
  members: TeamMember[]; // one per RangeId, fixed order
  bounces: number; // 0..3
}

export type Phase =
  | "choose-attack" // attacker picks fast/slow
  | "assign" // attacker adjusts dice with bounces, then assigns a die to a target
  | "defend" // defender picks dodge/catch
  | "defend-bounce" // defender may adjust reroll dice with bounces, then resolve
  | "choose-elimination" // defender caught: pick which attacker member to eliminate
  | "game-over";

export interface AttackContext {
  kind: AttackKind;
  attackDice: number[];
  assignedIndex?: number;
  targetRange?: RangeId;
  defense?: DefenseKind;
  rerollDice?: number[];
}

export interface GameState {
  teams: Record<PlayerId, Team>;
  attacker: PlayerId;
  phase: Phase;
  turnNumber: number;
  log: string[];
  current?: AttackContext;
  winner?: PlayerId;
}

export function otherPlayer(p: PlayerId): PlayerId {
  return p === "human" ? "ai" : "human";
}
