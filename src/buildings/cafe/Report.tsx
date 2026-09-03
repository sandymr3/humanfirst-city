// The door, and what you leave with.
//
// ADR-005 §13 makes this the one place tier vocabulary is allowed, and ADR-007
// §15 adds three things to it: what came out consistently across different
// stages, how far you moved from where you started, and where the business
// ended up.
//
// It cannot say all of that yet, and it says so rather than inventing it.
// Proficiency is computed server-side and there is no endpoint that hands a
// learner their own tiers back — the same gap `Offer.tsx` recorded before it.
// What this can report honestly is the shape of the career: how far you got,
// what you decided, and what the business did. That is the trail, and the trail
// is the thing a player actually wants.
//
// One rule that still binds here: **thin evidence must not be narrated as a
// pattern.** Three of the nine competencies rest on a single decision, and "you
// had one call to make on this and you made it well" is the honest register.
import { Modal } from "@/ui/Modal";
import { ROLE_LABEL, STAGES } from "./journey";
import { useJourneyStore } from "./journeyStore";

export function Report({ onClose }: { onClose: () => void }) {
  const role = useJourneyStore((s) => s.role);
  const revenue = useJourneyStore((s) => s.revenue);
  const decided = useJourneyStore((s) => s.decided);
  const qaDone = useJourneyStore((s) => s.qaDone);
  const unsent = useJourneyStore((s) => s.unsent);
  const outcome = useJourneyStore((s) => s.outcome);

  const banked = outcome?.stageId === "cafe.exit" ? outcome.coinsBanked : 0;

  return (
    <div className="pointer-events-auto">
      <Modal onClose={onClose} width="md">
        <h2 className="font-display text-xl font-semibold text-gold">The year at the corner</h2>

        <p className="mt-3 text-sm leading-relaxed text-text">
          You walked in as a candidate and left as {article(ROLE_LABEL[role])}.{" "}
          {revenue === 0
            ? "The books close roughly where you found them."
            : revenue > 0
              ? `The café is ${revenue.toLocaleString()} better off than the one you were hired into.`
              : `The café is ${Math.abs(revenue).toLocaleString()} down on the one you were hired into.`}
        </p>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          Nobody told you which choices were the good ones while you were making them. That is the
          point of asking this way.
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <Fact label="Got to" value={ROLE_LABEL[role]} />
          <Fact label="Decisions" value={String(decided.length)} />
          <Fact label="Questions answered" value={String(qaDone.length)} />
        </dl>

        {banked > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-text">
            {banked.toLocaleString()} coins banked on the way out.
          </p>
        )}

        <h3 className="mt-6 text-xs uppercase tracking-widest text-muted">Where you worked</h3>
        <ol className="mt-3 space-y-2.5">
          {postings(decided).map((p) => (
            <li key={p.stageId} className="text-sm leading-relaxed">
              <span className="text-text">{p.title}</span>
              <span className="mt-0.5 block pl-0 text-xs text-muted">
                {p.count === 1 ? "one decision" : `${p.count} decisions`}
              </span>
            </li>
          ))}
        </ol>

        {/*
          The honest gap. A learner reading this deserves to know that the part
          they most want — where they were strong, and how much they moved — is
          not being withheld, it is not built.
        */}
        <p className="mt-6 rounded-xl border border-line/70 bg-surface-2/50 p-4 text-xs leading-relaxed text-muted">
          Your competency read-out — what came out consistently, what is still emerging, and how far
          you moved from your first attempt — is scored but not yet shown. It needs an endpoint that
          hands a learner their own results back, and that does not exist.
        </p>

        {unsent.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            {unsent.length === 1 ? "One sitting" : `${unsent.length} sittings`} never reached the
            server. They will be sent the next time you come in.
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-6 rounded-lg bg-gold px-5 py-2 font-medium text-ink hover:brightness-110"
        >
          Out onto the street
        </button>
      </Modal>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/70 bg-surface-2/50 p-3">
      <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-1 font-display text-base text-text">{value}</dd>
    </div>
  );
}

/** Which postings the player actually worked, and how much they decided in each. */
function postings(decided: readonly { unitId: string }[]) {
  const out: { stageId: string; title: string; count: number }[] = [];
  for (const stage of STAGES) {
    if (stage.kind !== "scenarios" && stage.kind !== "succession") continue;
    const own = new Set<string>();
    for (const sc of stage.scenes ?? []) own.add(sc.unitId);
    for (const t of stage.trees ?? []) own.add(t.unitId);
    if (stage.pickUnitId) own.add(stage.pickUnitId);
    const count = decided.filter((d) => own.has(d.unitId)).length;
    if (count > 0) out.push({ stageId: stage.id, title: stage.title, count });
  }
  return out;
}

function article(role: string): string {
  return /^[AEIOU]/i.test(role) ? `an ${role}` : `a ${role}`;
}
