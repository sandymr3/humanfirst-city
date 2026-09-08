// The evaluation report (ADR-007 §15): what you arrived good at, what you are
// visibly learning, and the evidence for both.
//
// Two things this deliberately does NOT do.
//
// It does not say which sentences a model wrote. `judged` is on the wire for
// operations, and rendering it would tell a learner their report was machine-
// written, which changes how it reads without changing what it says.
//
// It does not narrate thin evidence as a pattern. A competency resting on one
// decision is drawn and labelled as one decision, because "you had a single call
// to make here and you made it well" is the honest register and "you are strong
// at this" is not.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/framework/api";
import type { CompetencyTrack, Judgement } from "@/framework/api/schemas";

export function Evaluation() {
  const q = useQuery({
    queryKey: ["evaluation-report"],
    queryFn: () => api.getReport(),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return <p className="text-sm text-muted">Reading back what you did…</p>;
  }
  if (q.isError || !q.data) {
    return (
      <p className="text-sm text-muted">
        Your report is not available right now. Nothing has been lost — it is read back from what
        you already did, so it will be here next time.
      </p>
    );
  }
  const report = q.data;

  if (report.empty) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Nothing to report yet. Walk into a business, take a job, and this fills itself in from what
        you decide.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {report.revenueBadge && (
        <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/5 px-4 py-3">
          <span aria-hidden className="text-2xl">
            🏆
          </span>
          <div>
            <p className="text-sm font-semibold text-gold">
              Best business: {titleOf(report.revenueBadge.buildingId)}
            </p>
            <p className="text-xs text-muted">
              {report.revenueBadge.revenue.toLocaleString()} in revenue — more than anywhere else
              you have worked.
            </p>
          </div>
        </div>
      )}

      {report.buildings.map((b) => (
        <section key={b.buildingId} className="space-y-4">
          <header>
            <h3 className="font-display text-xl font-semibold text-text">
              {titleOf(b.buildingId)}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Reached {b.roleReached.replace(/_/g, " ")} · {b.revenue.toLocaleString()} revenue ·{" "}
              {b.stages.length} graded {b.stages.length === 1 ? "sitting" : "sittings"}
            </p>
          </header>

          <p className="text-sm leading-relaxed text-text">{b.summary}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Strengths
              title="What you arrived with"
              hint="Strong from the first moment it was tested, and it stayed there."
              items={b.naturalStrengths}
              empty="Nothing stood out from the very start — which is not the same as nothing standing out."
              tone="gold"
            />
            <Strengths
              title="What you are learning"
              hint="Started lower and climbed while you were here."
              items={b.emergingSkills}
              empty="No clear climb yet. It takes more than one sitting to see one."
              tone="accent"
            />
          </div>

          {b.competencies.length > 0 && <TrackTable tracks={b.competencies} />}
        </section>
      ))}

      {report.cumulative.length > 0 && report.buildings.length > 1 && (
        <section className="space-y-3 border-t border-line pt-6">
          <h3 className="font-display text-xl font-semibold text-text">Across everything</h3>
          <p className="text-xs text-muted">
            Every business you have worked in, pooled. This is the one that answers “am I getting
            better”, rather than “was I good that day”.
          </p>
          <TrackTable tracks={report.cumulative} />
        </section>
      )}
    </div>
  );
}

function Strengths({
  title,
  hint,
  items,
  empty,
  tone,
}: {
  title: string;
  hint: string;
  items: Judgement[];
  empty: string;
  tone: "gold" | "accent";
}) {
  const ring = tone === "gold" ? "border-gold/30" : "border-accent/30";
  const dot = tone === "gold" ? "bg-gold" : "bg-accent";
  return (
    <div className={`rounded-xl border ${ring} bg-surface-2/40 p-4`}>
      <h4 className="text-sm font-semibold text-text">{title}</h4>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((j) => (
            <li key={j.competency} className="flex gap-2.5">
              <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <div>
                <p className="text-sm font-medium text-text">{j.name || j.competency}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{j.why}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The graph, as a table of small charts.
 *
 * A row per competency: where it started, every scored moment since, and where
 * it is now. A bar chart rather than a line because the samples are discrete
 * events, not a continuous measurement, and a line between two decisions implies
 * a reading in between that was never taken.
 */
function TrackTable({ tracks }: { tracks: CompetencyTrack[] }) {
  return (
    <ul className="space-y-2.5">
      {tracks.map((t) => (
        <li
          key={t.code}
          className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-lg border border-line/60 bg-surface-2/30 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{t.name || t.code}</p>
            <p className="text-[11px] text-muted">
              {t.samples === 1
                ? "one decision so far"
                : `${t.samples} moments · started ${pct(t.baseline)}, now ${pct(t.latest)}`}
            </p>
          </div>
          <Sparkline series={t.series} />
          <ClassChip klass={t.class} samples={t.samples} />
        </li>
      ))}
    </ul>
  );
}

function Sparkline({ series }: { series: number[] }) {
  return (
    <div
      className="col-span-2 flex h-8 items-end gap-[3px] sm:col-span-1"
      role="img"
      aria-label={`${series.length} scored moments, from ${pct(series[0])} to ${pct(series[series.length - 1])}`}
    >
      {series.map((v, i) => (
        <span
          key={i}
          // A floor of 3px so a zero is a visible "this was scored and it was
          // low", not an absence. An empty column reads as missing data.
          style={{ height: `${Math.max(3, v * 32)}px` }}
          className={`w-1.5 rounded-sm ${v >= 0.7 ? "bg-gold" : v >= 0.4 ? "bg-accent/70" : "bg-line"}`}
        />
      ))}
    </div>
  );
}

const CLASS_LABEL: Record<CompetencyTrack["class"], string> = {
  natural: "Came naturally",
  emerging: "Climbing",
  developing: "Room to grow",
  insufficient: "Too early to say",
};

function ClassChip({ klass, samples }: { klass: CompetencyTrack["class"]; samples: number }) {
  // One decision is not a pattern, whatever the arithmetic says about it.
  const label = samples < 2 && klass !== "insufficient" ? "One decision" : CLASS_LABEL[klass];
  const tone =
    klass === "natural"
      ? "border-gold/40 text-gold"
      : klass === "emerging"
        ? "border-accent/40 text-accent"
        : "border-line text-muted";
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] ${tone}`}>
      {label}
    </span>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

const TITLES: Record<string, string> = {
  cafe: "The Café",
  fashion_brand: "MAISON",
};
const titleOf = (id: string) => TITLES[id] ?? id.replace(/_/g, " ");
