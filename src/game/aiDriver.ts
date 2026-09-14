import {
  aiAttackerBounceSpend,
  aiDefenderBounceSpend,
  chooseAssignment,
  chooseAttackKind,
  chooseDefense,
  chooseEliminationTarget,
} from "./ai";
import { actorForPhase, GameEngine } from "./engine";
import { validAssignments } from "./rules";
import { otherPlayer } from "./types";

/**
 * Performs exactly one AI action if it's currently the AI's turn to act.
 * Returns true if an action was taken (caller should schedule another tick after a short delay).
 */
export function stepAi(engine: GameEngine): boolean {
  const s = engine.state;
  if (actorForPhase(s) !== "ai") return false;

  switch (s.phase) {
    case "choose-attack": {
      const opponentAlive = s.teams.human.members.filter((m) => m.alive).length;
      engine.chooseAttackType(chooseAttackKind(s.teams.ai.bounces, opponentAlive));
      return true;
    }

    case "assign": {
      const current = s.current!;
      const opponent = s.teams[otherPlayer(s.attacker)];
      const bounces = s.teams.ai.bounces;
      if (bounces > 0) {
        const before = validAssignments(current.attackDice, opponent);
        const bestBefore = before.length ? Math.max(...before.map((o) => o.dieValue)) : -1;
        const spent = aiAttackerBounceSpend(current.attackDice, bounces, opponent);
        if (spent.some((v, i) => v !== current.attackDice[i])) {
          spent.forEach((v, i) => {
            let cur = current.attackDice[i];
            while (cur !== v) {
              engine.adjustAttackDie(i, cur < v ? 1 : -1);
              cur += cur < v ? 1 : -1;
            }
          });
        }
        void bestBefore;
      }
      const options = validAssignments(engine.state.current!.attackDice, opponent);
      if (options.length === 0) {
        engine.passTurnNoTarget();
        return true;
      }
      const pick = chooseAssignment(options);
      engine.assignDie(pick.dieIndex, pick.targetRange);
      return true;
    }

    case "defend": {
      const rerollCount = s.current!.attackDice.length - 1;
      engine.chooseDefense(chooseDefense(rerollCount, s.current!.targetRange!));
      return true;
    }

    case "defend-bounce": {
      const defenderId = otherPlayer(s.attacker);
      const bounces = s.teams[defenderId].bounces;
      const current = s.current!;
      if (bounces > 0 && current.rerollDice) {
        const spent = aiDefenderBounceSpend(current.rerollDice, bounces, current.defense!, current.targetRange!);
        if (spent.some((v, i) => v !== current.rerollDice![i])) {
          spent.forEach((v, i) => {
            let cur = current.rerollDice![i];
            while (cur !== v) {
              engine.adjustRerollDie(i, cur < v ? 1 : -1);
              cur += cur < v ? 1 : -1;
            }
          });
        }
      }
      engine.resolve();
      return true;
    }

    case "choose-elimination": {
      engine.chooseElimination(chooseEliminationTarget(s.teams[s.attacker]));
      return true;
    }

    case "game-over":
      return false;
  }
}
