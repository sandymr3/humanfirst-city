// The three postings, drawn.
//
// The client asked for a "levels graphic". What a player actually lacks is not
// decoration but ORIENTATION: the chip says which job you hold and the career
// never says how many there are, which is honest about pacing (ADR-006 §6.3 —
// you do not know how many jobs you will hold) but leaves someone two hours in
// with no picture of the shape they are moving through.
//
// So this draws the shape and nothing else. Three rungs, the one you are on
// marked, the ones behind you filled, the ones ahead outlined. What it must not
// become — and the reason this file has a comment this long — is a progress bar:
//
//   - **No percentage, no "2 of 3".** A career has no denominator. Reaching CEO
//     is one ending of three, and the two doors before it are not failures.
//   - **No quality anywhere.** Same shape, same weight, same color for every
//     rung. A filled rung means "you held this job", never "you did well at it".
//   - **Nothing about what is left.** The rung ahead is outlined because it
//     exists, not because it is owed.
//
// `candidate` is deliberately not a rung. You are not in the building yet.
import { ROLE_LABEL, type Role } from "./journey";

const LADDER: readonly Role[] = ["employee", "branch_manager", "ceo"];

export function Levels({ role }: { role: Role }) {
  // -1 for a candidate, which reads correctly through every comparison below:
  // nothing is reached and nothing is current.
  const here = LADDER.indexOf(role);

  return (
    <ol
      className="mt-2 flex items-center gap-1"
      aria-label={`Career: ${role === "candidate" ? "not yet hired" : ROLE_LABEL[role]}`}
    >
      {LADDER.map((r, i) => {
        const reached = i <= here;
        const current = i === here;
        return (
          <li key={r} className="flex items-center gap-1">
            <span
              title={ROLE_LABEL[r]}
              aria-current={current ? "step" : undefined}
              className={[
                "block h-1.5 rounded-full transition-all duration-500",
                // The current rung is wider, which is the one difference that
                // carries information a player wants: where am I now.
                current ? "w-7" : "w-4",
                reached ? "bg-gold" : "bg-line/60",
              ].join(" ")}
            />
            {i < LADDER.length - 1 && <span className="block h-px w-1.5 bg-line/40" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
