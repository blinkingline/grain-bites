import { describe, expect, it } from "vitest";
import {
  createTeam,
  defenseSucceeds,
  isTeamEliminated,
  rangeMatches,
  rangeWidth,
  validAssignments,
} from "./rules";

describe("rangeMatches", () => {
  it("matches the documented example: a rolled 5 matches ODD, 4-6, and 5-6", () => {
    expect(rangeMatches("ODD", 5)).toBe(true);
    expect(rangeMatches("4-6", 5)).toBe(true);
    expect(rangeMatches("5-6", 5)).toBe(true);
    expect(rangeMatches("EVEN", 5)).toBe(false);
    expect(rangeMatches("1-2", 5)).toBe(false);
    expect(rangeMatches("3-4", 5)).toBe(false);
    expect(rangeMatches("1-3", 5)).toBe(false);
  });

  it("covers every face 1-6 for both ODD and EVEN", () => {
    for (let v = 1; v <= 6; v++) {
      expect(rangeMatches("ODD", v)).toBe(v % 2 === 1);
      expect(rangeMatches("EVEN", v)).toBe(v % 2 === 0);
    }
  });
});

describe("rangeWidth", () => {
  it("gives the three-wide ranges a width of 3 and the two-wide ranges a width of 2", () => {
    expect(rangeWidth("ODD")).toBe(3);
    expect(rangeWidth("EVEN")).toBe(3);
    expect(rangeWidth("1-3")).toBe(3);
    expect(rangeWidth("4-6")).toBe(3);
    expect(rangeWidth("1-2")).toBe(2);
    expect(rangeWidth("3-4")).toBe(2);
    expect(rangeWidth("5-6")).toBe(2);
  });
});

describe("createTeam / isTeamEliminated", () => {
  it("starts with all seven members alive and no bounces", () => {
    const team = createTeam();
    expect(team.members).toHaveLength(7);
    expect(team.members.every((m) => m.alive)).toBe(true);
    expect(team.bounces).toBe(0);
    expect(isTeamEliminated(team)).toBe(false);
  });

  it("is eliminated only once every member is dead", () => {
    const team = createTeam();
    team.members.slice(0, 6).forEach((m) => (m.alive = false));
    expect(isTeamEliminated(team)).toBe(false);
    team.members[6].alive = false;
    expect(isTeamEliminated(team)).toBe(true);
  });
});

describe("validAssignments", () => {
  it("finds every legal (die, target) pairing, skipping dead members", () => {
    const team = createTeam();
    const dead = team.members.find((m) => m.range === "5-6")!;
    dead.alive = false;
    const options = validAssignments([5], team);
    const ranges = options.map((o) => o.targetRange).sort();
    expect(ranges).toEqual(["4-6", "ODD"].sort());
  });

  it("returns an empty array when no die matches any surviving member", () => {
    const team = createTeam();
    team.members.forEach((m) => (m.alive = false));
    expect(validAssignments([1, 2, 3], team)).toEqual([]);
  });
});

describe("defenseSucceeds", () => {
  it("dodge succeeds only when no reroll die matches the target range", () => {
    expect(defenseSucceeds("dodge", [1, 3], "5-6")).toBe(true);
    expect(defenseSucceeds("dodge", [1, 5], "5-6")).toBe(false);
  });

  it("catch succeeds when at least one reroll die matches the target range", () => {
    expect(defenseSucceeds("catch", [1, 5], "5-6")).toBe(true);
    expect(defenseSucceeds("catch", [1, 3], "5-6")).toBe(false);
  });
});
