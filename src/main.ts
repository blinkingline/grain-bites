import { stepAi } from "./game/aiDriver";
import { actorForPhase, createInitialState, GameEngine } from "./game/engine";
import { rangeWidth, validAssignments } from "./game/rules";
import { RANGE_IDS, type PlayerId } from "./game/types";
import "./style.css";

const appEl = document.getElementById("app")!;

let engine = new GameEngine(createInitialState());
let selectedDieIndex: number | null = null;
let aiTimerScheduled = false;

const PLAYER_LABEL: Record<PlayerId, string> = { human: "You", ai: "The Computer" };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render() {
  appEl.replaceChildren(buildHeader(), buildBoard(), buildLog());
  scheduleAiIfNeeded();
}

function buildHeader(): HTMLElement {
  const header = el("header", "header");
  header.appendChild(el("h1", "title", "Grain Bites"));

  const status = el("p", "status");
  const s = engine.state;
  if (s.phase === "game-over") {
    status.textContent = `${PLAYER_LABEL[s.winner!]} won the game!`;
    status.classList.add("status--winner");
  } else {
    status.textContent = `Turn ${s.turnNumber}: ${PLAYER_LABEL[s.attacker]} attacking.`;
  }
  header.appendChild(status);

  if (s.phase === "game-over") {
    const btn = el("button", "btn btn--primary", "New Game");
    btn.onclick = () => {
      engine = new GameEngine(createInitialState());
      selectedDieIndex = null;
      render();
    };
    header.appendChild(btn);
  }
  return header;
}

function buildBoard(): HTMLElement {
  const board = el("div", "board");
  board.appendChild(buildTeamPanel("ai", "panel--top", [2, 2, 3]));
  board.appendChild(buildCourt());
  board.appendChild(buildTeamPanel("human", "panel--bottom", [2, 3, 2]));
  return board;
}

function buildCourt(): HTMLElement {
  const court = el("div", "court");
  court.appendChild(courtMarkings());
  court.appendChild(buildCenter());
  return court;
}

/** A simplified basketball-court backdrop, echoing the postcard's shared court illustration. */
function courtMarkings(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "court-lines");
  svg.setAttribute("viewBox", "0 0 200 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.innerHTML = `
    <rect x="2" y="2" width="196" height="96" fill="none" stroke="currentColor" stroke-width="1.5" />
    <line x1="2" y1="50" x2="198" y2="50" stroke="currentColor" stroke-width="1.5" />
    <circle cx="100" cy="50" r="14" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M 70 2 L 70 22 A 30 30 0 0 0 130 22 L 130 2" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M 70 98 L 70 78 A 30 30 0 0 1 130 78 L 130 98" fill="none" stroke="currentColor" stroke-width="1.5" />
  `;
  return svg;
}

function buildTeamPanel(owner: PlayerId, positionClass: string, rowPattern: number[]): HTMLElement {
  const s = engine.state;
  const panel = el("section", `panel ${positionClass}`);
  if (s.attacker === owner && s.phase !== "game-over") panel.classList.add("panel--attacking");

  const heading = el("h2", "panel-title", owner === "human" ? "Your Team" : "The Computer's Team");
  panel.appendChild(heading);

  const body = el("div", "panel-body");
  const team = s.teams[owner];

  // Is this panel currently a legal click target for the human player?
  const canAssignHere =
    s.phase === "assign" &&
    s.attacker === "human" &&
    owner === "ai" &&
    selectedDieIndex !== null;

  const canEliminateHere =
    s.phase === "choose-elimination" && s.attacker === "ai" && owner === "ai";

  const dieValue = canAssignHere ? s.current!.attackDice[selectedDieIndex!] : null;

  const membersInOrder = RANGE_IDS.map((range) => team.members.find((m) => m.range === range)!);
  const grid = el("div", "chips-grid");
  let memberIndex = 0;
  for (const rowCount of rowPattern) {
    const rowEl = el("div", "chip-row");
    for (let i = 0; i < rowCount; i++) {
      const member = membersInOrder[memberIndex++];
      const range = member.range;
      const chip = el("button", "chip");
      chip.classList.add(member.alive ? "chip--alive" : "chip--dead");
      chip.disabled = !member.alive;

      const rangeLabel = el("span", "chip-range", range);
      const widthLabel = el("span", "chip-width", `×${rangeWidth(range)}`);
      chip.append(rangeLabel, widthLabel);

      if (member.alive && canAssignHere && dieValue !== null) {
        const legal = validAssignments([dieValue], team).some((a) => a.targetRange === range);
        if (legal) {
          chip.classList.add("chip--targetable");
          chip.onclick = () => {
            engine.assignDie(selectedDieIndex!, range);
            selectedDieIndex = null;
            render();
          };
        }
      } else if (member.alive && canEliminateHere) {
        chip.classList.add("chip--targetable");
        chip.onclick = () => {
          engine.chooseElimination(range);
          render();
        };
      }

      rowEl.appendChild(chip);
    }
    grid.appendChild(rowEl);
  }
  body.appendChild(grid);

  const bounceCol = el("div", "bounces");
  bounceCol.appendChild(el("span", "bounces-label", "Bounces"));
  const dotsWrap = el("div", "bounce-dots");
  for (let i = 0; i < 3; i++) {
    const dot = el("span", "bounce-dot");
    if (i < team.bounces) dot.classList.add("bounce-dot--filled");
    dotsWrap.appendChild(dot);
  }
  bounceCol.appendChild(dotsWrap);
  body.appendChild(bounceCol);

  panel.appendChild(body);

  return panel;
}

function buildCenter(): HTMLElement {
  const center = el("div", "center");
  const s = engine.state;
  const actor = actorForPhase(s);

  if (actor === "ai") {
    center.appendChild(el("p", "thinking", "The computer is thinking…"));
    return center;
  }

  switch (s.phase) {
    case "choose-attack": {
      center.appendChild(el("p", "prompt", "Choose your attack:"));
      const row = el("div", "action-row");
      row.appendChild(actionButton("Fast Attack (2d6)", () => engine.chooseAttackType("fast")));
      row.appendChild(actionButton("Slow Attack (3d6)", () => engine.chooseAttackType("slow")));
      center.appendChild(row);
      break;
    }

    case "assign": {
      center.appendChild(el("p", "prompt", "Pick a die, then click a highlighted target on the computer's team."));
      const diceRow = el("div", "dice-row");
      s.current!.attackDice.forEach((value, index) => {
        diceRow.appendChild(buildDie(value, index === selectedDieIndex, () => {
          selectedDieIndex = index;
          render();
        }));
        if (s.teams.human.bounces > 0) {
          diceRow.appendChild(bounceControls(value, (dir) => {
            engine.adjustAttackDie(index, dir);
            render();
          }));
        }
      });
      center.appendChild(diceRow);
      break;
    }

    case "defend": {
      const range = s.current!.targetRange!;
      center.appendChild(el("p", "prompt", `The computer targeted your ${range}. Dodge or Catch?`));
      const row = el("div", "action-row");
      row.appendChild(actionButton("Dodge", () => engine.chooseDefense("dodge")));
      row.appendChild(actionButton("Catch", () => engine.chooseDefense("catch")));
      center.appendChild(row);
      break;
    }

    case "defend-bounce": {
      center.appendChild(el("p", "prompt", `Rerolled dice (${s.current!.defense === "dodge" ? "Dodge" : "Catch"}):`));
      const diceRow = el("div", "dice-row");
      s.current!.rerollDice!.forEach((value, index) => {
        diceRow.appendChild(buildDie(value, false, undefined));
        if (s.teams.human.bounces > 0) {
          diceRow.appendChild(bounceControls(value, (dir) => {
            engine.adjustRerollDie(index, dir);
            render();
          }));
        }
      });
      center.appendChild(diceRow);
      center.appendChild(actionButton("Confirm", () => engine.resolve()));
      break;
    }

    case "choose-elimination":
      center.appendChild(el("p", "prompt", "You caught it! Click one of the computer's team members to eliminate."));
      break;

    case "game-over":
      break;
  }

  return center;
}

function buildDie(value: number, selected: boolean, onClick?: () => void): HTMLElement {
  const die = el("button", "die", String(value));
  if (selected) die.classList.add("die--selected");
  if (onClick) die.onclick = onClick;
  else die.disabled = true;
  return die;
}

function bounceControls(_value: number, onAdjust: (dir: 1 | -1) => void): HTMLElement {
  const wrap = el("div", "bounce-controls");
  const minus = el("button", "btn btn--tiny", "−1");
  minus.onclick = () => onAdjust(-1);
  const plus = el("button", "btn btn--tiny", "+1");
  plus.onclick = () => onAdjust(1);
  wrap.append(minus, plus);
  return wrap;
}

function actionButton(text: string, onClick: () => void): HTMLElement {
  const btn = el("button", "btn btn--primary", text);
  btn.onclick = () => {
    onClick();
    render();
  };
  return btn;
}

function buildLog(): HTMLElement {
  const log = el("div", "log");
  for (const line of engine.state.log) {
    log.appendChild(el("p", "log-line", line));
  }
  queueMicrotask(() => {
    log.scrollTop = log.scrollHeight;
  });
  return log;
}

function scheduleAiIfNeeded() {
  if (aiTimerScheduled) return;
  if (actorForPhase(engine.state) !== "ai") return;
  aiTimerScheduled = true;
  setTimeout(() => {
    aiTimerScheduled = false;
    stepAi(engine);
    render();
  }, 700);
}

render();
