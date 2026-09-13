import { describe, expect, it } from "vitest";
import {
  aiAttackerBounceSpend,
  bestBounceSpend,
  chooseAssignment,
  chooseDefense,
  chooseEliminationTarget,
} from "./ai";
import { createTeam, validAssignments } from "./rules";

describe("bestBounceSpend", () => {
  it("spends bounces to reach the best-scoring reachable dice combination", () => {
    // Scoring die value 6 as best; die starts at 4, two bounces available.
    const result = bestBounceSpend([4], 2, (dice) => (dice[0] === 6 ? 10 : 0));
    expect(result).toEqual([6]);
  });

  it("does not spend bounces when the current dice already score best", () => {
    const result = bestBounceSpend([6], 3, (dice) => (dice[0] === 6 ? 10 : 0));
    expect(result).toEqual([6]);
  });

  it("never shifts a die outside 1-6", () => {
    const result = bestBounceSpend([1], 5, (dice) => -dice[0]); // "prefers" going below 1
    expect(result[0]).toBeGreaterThanOrEqual(1);
  });
});

describe("aiAttackerBounceSpend", () => {
  it("adjusts a die to create a valid assignment when none currently exists", () => {
    const opponent = createTeam();
    opponent.members.forEach((m) => {
      m.alive = m.range === "4-6"; // only 4-6 survives
    });
    // A rolled 1 matches nothing alive; with 3 bounces it can reach 4.
    const spent = aiAttackerBounceSpend([1], 3, opponent);
    expect(validAssignments(spent, opponent).length).toBeGreaterThan(0);
  });
});

describe("chooseAssignment", () => {
  it("prefers the widest surviving range when a die matches multiple targets", () => {
    const team = createTeam();
    const options = validAssignments([5], team); // matches ODD, 4-6, 5-6
    const pick = chooseAssignment(options);
    expect(["ODD", "4-6"]).toContain(pick.targetRange); // both width 3, wider than 5-6
  });
});

describe("chooseEliminationTarget", () => {
  it("targets the widest alive range", () => {
    const team = createTeam();
    team.members.find((m) => m.range === "ODD")!.alive = false;
    team.members.find((m) => m.range === "EVEN")!.alive = false;
    const pick = chooseEliminationTarget(team);
    expect(["1-3", "4-6"]).toContain(pick);
  });
});

describe("chooseDefense", () => {
  it("chooses catch when the match probability is at least 50%", () => {
    // width 3 range, 2 reroll dice: 1-(1-0.5)^2 = 0.75 >= 0.5
    expect(chooseDefense(2, "ODD")).toBe("catch");
  });

  it("chooses dodge when the match probability is under 50%", () => {
    // width 2 range, 1 reroll die: 2/6 = 0.33 < 0.5
    expect(chooseDefense(1, "1-2")).toBe("dodge");
  });
});
