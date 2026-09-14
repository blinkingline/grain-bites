import { afterEach, describe, expect, it, vi } from "vitest";
import { actorForPhase, createInitialState, GameEngine } from "./engine";

/** Makes rollDice() return exactly `values` in order, one call to Math.random per die. */
function mockDice(values: number[]) {
  let i = 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    const v = values[i % values.length];
    i += 1;
    // Math.random() * 6 must floor to v-1.
    return (v - 1) / 6 + 0.001;
  });
}

describe("GameEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays a full attack where the defender's dodge fails and the target is eliminated", () => {
    mockDice([5, 5]); // fast attack: two 5s rolled
    const engine = new GameEngine(createInitialState());
    engine.chooseAttackType("fast");
    expect(engine.state.phase).toBe("assign");
    expect(engine.state.current!.attackDice).toEqual([5, 5]);

    engine.assignDie(0, "ODD");
    expect(engine.state.phase).toBe("defend");
    expect(actorForPhase(engine.state)).toBe("ai");

    mockDice([1]); // reroll die does not match ODD's complement... it does match ODD actually
    engine.chooseDefense("dodge");
    // reroll of [1] against target "ODD": 1 is odd -> match -> dodge fails
    expect(engine.state.phase).toBe("defend-bounce");
    engine.resolve();
    expect(engine.state.teams.ai.members.find((m) => m.range === "ODD")!.alive).toBe(false);
    expect(engine.state.attacker).toBe("ai"); // turn passed
  });

  it("dodge succeeds when the reroll misses the target range entirely", () => {
    mockDice([5, 5]);
    const engine = new GameEngine(createInitialState());
    engine.chooseAttackType("fast");
    engine.assignDie(0, "5-6");

    mockDice([2]); // 2 does not match 5-6
    engine.chooseDefense("dodge");
    engine.resolve();
    expect(engine.state.teams.ai.members.find((m) => m.range === "5-6")!.alive).toBe(true);
    expect(engine.state.attacker).toBe("ai");
  });

  it("a successful catch lets the defender eliminate an attacker member of their choice", () => {
    mockDice([5, 5]);
    const engine = new GameEngine(createInitialState());
    engine.chooseAttackType("fast");
    engine.assignDie(0, "5-6");

    mockDice([6]); // 6 matches 5-6 -> catch succeeds
    engine.chooseDefense("catch");
    engine.resolve();
    expect(engine.state.phase).toBe("choose-elimination");
    expect(engine.state.teams.ai.members.find((m) => m.range === "5-6")!.alive).toBe(true);

    engine.chooseElimination("ODD");
    expect(engine.state.teams.human.members.find((m) => m.range === "ODD")!.alive).toBe(false);
    expect(engine.state.attacker).toBe("ai");
  });

  it("lets the attacker try Bounces before giving up when no die can be assigned", () => {
    const engine = new GameEngine(createInitialState());
    engine.state.teams.ai.members.forEach((m) => {
      m.alive = m.range === "5-6";
    });
    mockDice([1, 2]); // neither matches the only surviving range, 5-6
    engine.chooseAttackType("fast");
    expect(engine.state.phase).toBe("assign"); // not auto-finalized; attacker gets a shot with Bounces
    expect(engine.state.teams.ai.bounces).toBe(0);
  });

  it("grants the defender a Bounce and passes the turn once the attacker gives up with no legal target", () => {
    const engine = new GameEngine(createInitialState());
    engine.state.teams.ai.members.forEach((m) => {
      m.alive = m.range === "5-6";
    });
    mockDice([1, 2]); // neither matches the only surviving range, 5-6
    engine.chooseAttackType("fast");
    engine.passTurnNoTarget();
    expect(engine.state.teams.ai.bounces).toBe(1);
    expect(engine.state.attacker).toBe("ai");
    expect(engine.state.phase).toBe("choose-attack");
  });

  it("lets the attacker spend Bounces to rescue an attack that started with no legal target", () => {
    mockDice([1, 2]); // neither matches the only surviving range, 5-6
    const engine = new GameEngine(createInitialState());
    engine.state.teams.human.bounces = 3; // max
    engine.state.teams.ai.members.forEach((m) => {
      m.alive = m.range === "5-6";
    });
    engine.chooseAttackType("fast");
    engine.adjustAttackDie(1, 1); // 2 -> 3
    engine.adjustAttackDie(1, 1); // 3 -> 4
    engine.adjustAttackDie(1, 1); // 4 -> 5, now matches 5-6
    expect(engine.state.current!.attackDice[1]).toBe(5);
    expect(engine.state.teams.human.bounces).toBe(0);
    expect(() => engine.passTurnNoTarget()).toThrow(); // a legal target exists now
    engine.assignDie(1, "5-6");
    expect(engine.state.phase).toBe("defend");
  });

  it("lets the attacker spend a Bounce to shift an attack die before assigning", () => {
    mockDice([4, 4]);
    const engine = new GameEngine(createInitialState());
    engine.state.teams.human.bounces = 1;
    engine.chooseAttackType("fast");
    engine.adjustAttackDie(0, 1);
    expect(engine.state.current!.attackDice[0]).toBe(5);
    expect(engine.state.teams.human.bounces).toBe(0);
  });

  it("declares a winner once a team's last member is eliminated", () => {
    const engine = new GameEngine(createInitialState());
    engine.state.teams.ai.members.forEach((m, i) => {
      m.alive = i === 0; // only the first member (ODD) survives
    });
    mockDice([5, 5]);
    engine.chooseAttackType("fast");
    engine.assignDie(0, "ODD");
    mockDice([1]);
    engine.chooseDefense("dodge");
    engine.resolve();
    expect(engine.state.phase).toBe("game-over");
    expect(engine.state.winner).toBe("human");
  });
});
