import {
  createTeam,
  defenseSucceeds,
  rangeMatches,
  rollDice,
  validAssignments,
  clampDie,
} from "./rules";
import type {
  AttackKind,
  DefenseKind,
  GameState,
  PlayerId,
  RangeId,
} from "./types";
import { otherPlayer } from "./types";

export function createInitialState(): GameState {
  return {
    teams: { human: createTeam(), ai: createTeam() },
    attacker: "human",
    phase: "choose-attack",
    turnNumber: 1,
    log: ["Game start. Human attacks first."],
  };
}

/** Whose action the current phase is waiting on, or null once the game has ended. */
export function actorForPhase(state: GameState): PlayerId | null {
  switch (state.phase) {
    case "choose-attack":
    case "assign":
      return state.attacker;
    case "defend":
    case "defend-bounce":
    case "choose-elimination":
      return otherPlayer(state.attacker);
    case "game-over":
      return null;
  }
}

function log(state: GameState, message: string) {
  state.log = [...state.log, message];
}

export class GameEngine {
  state: GameState;

  constructor(state: GameState = createInitialState()) {
    this.state = state;
  }

  chooseAttackType(kind: AttackKind) {
    const s = this.state;
    if (s.phase !== "choose-attack") throw new Error("Not in choose-attack phase");
    const dice = rollDice(kind === "fast" ? 2 : 3);
    log(s, `${label(s.attacker)} ${verb(s.attacker, "launch")} a ${kind === "fast" ? "Fast (2d6)" : "Slow (3d6)"} attack: rolled ${dice.join(", ")}.`);

    s.current = { kind, attackDice: dice };
    s.phase = "assign";
  }

  /** Attacker spends one Bounce to shift an attack die by ±1 before assigning it. */
  adjustAttackDie(dieIndex: number, direction: 1 | -1) {
    const s = this.state;
    if (s.phase !== "assign" || !s.current) throw new Error("Not in assign phase");
    const team = s.teams[s.attacker];
    if (team.bounces <= 0) throw new Error("No Bounces to spend");
    team.bounces -= 1;
    const dice = s.current.attackDice.slice();
    dice[dieIndex] = clampDie(dice[dieIndex] + direction);
    s.current.attackDice = dice;
    log(s, `${label(s.attacker)} ${verb(s.attacker, "spend")} a Bounce, die ${dieIndex + 1} is now ${dice[dieIndex]}.`);
  }

  /** Attacker gives up on this attack after Bounces still leave no legal target; defender gains a Bounce. */
  passTurnNoTarget() {
    const s = this.state;
    if (s.phase !== "assign" || !s.current) throw new Error("Not in assign phase");
    const defenderId = otherPlayer(s.attacker);
    if (validAssignments(s.current.attackDice, s.teams[defenderId]).length > 0) {
      throw new Error("A legal target exists; assign a die instead");
    }
    const defenderTeam = s.teams[defenderId];
    defenderTeam.bounces = Math.min(3, defenderTeam.bounces + 1);
    log(s, `No die matches a surviving target on ${possessiveLower(defenderId)} team. ${label(defenderId)} ${verb(defenderId, "gain")} a Bounce.`);
    this.finalizeTurn();
  }

  assignDie(dieIndex: number, targetRange: RangeId) {
    const s = this.state;
    if (s.phase !== "assign" || !s.current) throw new Error("Not in assign phase");
    const defenderId = otherPlayer(s.attacker);
    const dieValue = s.current.attackDice[dieIndex];
    const target = s.teams[defenderId].members.find((m) => m.range === targetRange);
    if (!target || !target.alive) throw new Error("Invalid target");
    if (!rangeMatches(targetRange, dieValue)) throw new Error("Die does not match target range");

    s.current.assignedIndex = dieIndex;
    s.current.targetRange = targetRange;
    log(s, `${label(s.attacker)} ${verb(s.attacker, "assign")} die ${dieValue} to ${possessiveLower(defenderId)} ${targetRange}.`);
    s.phase = "defend";
  }

  chooseDefense(defense: DefenseKind) {
    const s = this.state;
    if (s.phase !== "defend" || !s.current) throw new Error("Not in defend phase");
    const defenderId = otherPlayer(s.attacker);
    s.current.defense = defense;
    const rerollCount = s.current.attackDice.length - 1;
    s.current.rerollDice = rollDice(rerollCount);
    log(s, `${label(defenderId)} ${verb(defenderId, "choose")} to ${defense === "dodge" ? "Dodge" : "Catch"}, rerolling: ${s.current.rerollDice.join(", ")}.`);
    s.phase = "defend-bounce";
  }

  /** Defender spends one Bounce to shift a reroll die by ±1. */
  adjustRerollDie(dieIndex: number, direction: 1 | -1) {
    const s = this.state;
    if (s.phase !== "defend-bounce" || !s.current?.rerollDice) throw new Error("Not in defend-bounce phase");
    const defenderId = otherPlayer(s.attacker);
    const team = s.teams[defenderId];
    if (team.bounces <= 0) throw new Error("No Bounces to spend");
    team.bounces -= 1;
    const dice = s.current.rerollDice.slice();
    dice[dieIndex] = clampDie(dice[dieIndex] + direction);
    s.current.rerollDice = dice;
    log(s, `${label(defenderId)} ${verb(defenderId, "spend")} a Bounce, reroll die ${dieIndex + 1} is now ${dice[dieIndex]}.`);
  }

  resolve() {
    const s = this.state;
    if (s.phase !== "defend-bounce" || !s.current?.rerollDice || !s.current.targetRange || !s.current.defense) {
      throw new Error("Not ready to resolve");
    }
    const defenderId = otherPlayer(s.attacker);
    const { defense, rerollDice, targetRange } = s.current;
    const success = defenseSucceeds(defense, rerollDice, targetRange);

    if (success && defense === "catch") {
      log(s, `${label(defenderId)} ${verb(defenderId, "catch")} it! ${label(defenderId)} may eliminate one of ${possessiveLower(s.attacker)} team members.`);
      s.phase = "choose-elimination";
      return;
    }

    if (success && defense === "dodge") {
      log(s, `${possessive(defenderId)} ${targetRange} dodges the attack and survives.`);
      this.finalizeTurn();
      return;
    }

    // Defense failed either way: the originally targeted member is eliminated.
    const member = s.teams[defenderId].members.find((m) => m.range === targetRange)!;
    member.alive = false;
    log(s, `${possessive(defenderId)} ${targetRange} is eliminated!`);
    this.finalizeTurn();
  }

  chooseElimination(targetRange: RangeId) {
    const s = this.state;
    if (s.phase !== "choose-elimination") throw new Error("Not in choose-elimination phase");
    const member = s.teams[s.attacker].members.find((m) => m.range === targetRange);
    if (!member || !member.alive) throw new Error("Invalid elimination target");
    member.alive = false;
    const eliminator = otherPlayer(s.attacker);
    log(s, `${label(eliminator)} ${verb(eliminator, "eliminate")} ${possessiveLower(s.attacker)} ${targetRange}!`);
    this.finalizeTurn();
  }

  private finalizeTurn() {
    const s = this.state;
    const humanDead = s.teams.human.members.every((m) => !m.alive);
    const aiDead = s.teams.ai.members.every((m) => !m.alive);

    if (humanDead || aiDead) {
      s.winner = humanDead ? "ai" : "human";
      s.phase = "game-over";
      s.current = undefined;
      log(s, `${label(s.winner)} ${verb(s.winner, "win")}!`);
      return;
    }

    s.attacker = otherPlayer(s.attacker);
    s.turnNumber += 1;
    s.current = undefined;
    s.phase = "choose-attack";
  }
}

function label(p: PlayerId): string {
  return p === "human" ? "You" : "The computer";
}

function possessive(p: PlayerId): string {
  return p === "human" ? "Your" : "The computer's";
}

function possessiveLower(p: PlayerId): string {
  return p === "human" ? "your" : "the computer's";
}

/** "You" takes the base verb form; "The computer" (third person) needs it conjugated. */
function verb(p: PlayerId, base: string): string {
  if (p === "human") return base;
  if (/(?:[sxz]|[cs]h)$/.test(base)) return `${base}es`;
  return `${base}s`;
}
