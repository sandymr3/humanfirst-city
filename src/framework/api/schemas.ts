// Zod schemas for the backend wire contract (PRD §8.2, §11). Every response is
// parsed through one of these, so a shape drift is a runtime error at the boundary
// (and, via z.infer, a compile error in callers). Types are inferred from schemas
// — schemas are the single source of truth.
import { z } from "zod";

// ── Result kinds (submit payload — exactly ONE, discriminated by its key) ──────

export const ObjectiveResult = z.object({
  answers: z.array(z.object({ itemId: z.string(), choice: z.string() })),
});
export const OrderResult = z.object({ sequence: z.array(z.string()) });
// DECISION_TREE. `path` is the visited node path. The two followup fields are
// optional and carry the generated third beat: without them the submit scores on
// the authored terminal alone, which is what keeps every degraded path working.
export const TraceResult = z.object({
  path: z.array(z.string()),
  followupId: z.string().optional(),
  followupChoice: z.string().optional(),
});
export const MetricsResult = z.object({
  values: z.record(z.unknown()),
  decisionLog: z.array(z.unknown()).optional(),
});
export const SlotsResult = z.object({ picks: z.record(z.array(z.string())) });
export const TextResult = z.object({ content: z.string() });
export const TranscriptResult = z.object({
  turns: z.array(z.object({ role: z.enum(["user", "ai"]), text: z.string() })),
});

// One competency's evidence from a career journey (ADR-007 §8.2).
//
// Unit ids and the letter taken at each — never a tier and never a score, for
// the same reason TraceResult carries no tier. A two-beat CEO scene sends its
// composed path as the choice: "a.c". Typed questions are named, not scored; the
// server reads their marks from the attempt it wrote.
export const JourneyResult = z.object({
  buildingId: z.string(),
  runId: z.string(),
  units: z.array(z.object({ unitId: z.string(), choice: z.string() })),
  qa: z.array(z.object({ unitId: z.string() })).optional(),
});

// The submit "result" is an object carrying exactly one kind.
export const ResultPayload = z.union([
  z.object({ objective: ObjectiveResult }),
  z.object({ order: OrderResult }),
  z.object({ trace: TraceResult }),
  z.object({ metrics: MetricsResult }),
  z.object({ slots: SlotsResult }),
  z.object({ text: TextResult }),
  z.object({ transcript: TranscriptResult }),
  z.object({ journey: JourneyResult }),
]);
export type ResultPayload = z.infer<typeof ResultPayload>;
export type ResultKind =
  "objective" | "order" | "trace" | "metrics" | "slots" | "text" | "transcript" | "journey";

export const SubmitRequest = z.object({
  clientVersion: z.string(),
  durationSec: z.number().int().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  result: ResultPayload,
});
export type SubmitRequest = z.infer<typeof SubmitRequest>;

// ── Badges / modules / activities ─────────────────────────────────────────────

export const Badge = z.object({
  id: z.string(),
  kind: z.string().optional(),
  competencyCode: z.string().optional(),
  level: z.string().optional(),
  tier: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  iconAsset: z.string().optional(),
});
export type Badge = z.infer<typeof Badge>;

export const ModuleLevel = z.object({
  ageBand: z.string().optional(),
  total: z.number().int(),
  completed: z.number().int(),
});
export const Module = z.object({
  code: z.string(),
  name: z.string(),
  kidName: z.string().optional(),
  subtopics: z.array(z.string()).optional().default([]),
  levels: z.record(ModuleLevel),
  badgesEarned: z.array(Badge).optional().default([]),
});
export type Module = z.infer<typeof Module>;

export const RegistryModules = z.object({
  registryVersion: z.string(),
  modules: z.array(Module),
  metaBadges: z.array(Badge).optional().default([]),
});
export type RegistryModules = z.infer<typeof RegistryModules>;

// passCriteria is server-defined and opaque to the client.
export const ActivityPublic = z.object({
  id: z.string(),
  competencyCode: z.string(),
  level: z.string(),
  subtopic: z.string().optional(),
  orderIndex: z.number().int().optional(),
  activityType: z.string(),
  title: z.string(),
  estMinutes: z.number().int().optional(),
  passCriteria: z.unknown().optional(),
});
export type ActivityPublic = z.infer<typeof ActivityPublic>;

// GET /registry/{comp}/{level} — activity list with per-activity status.
export const LevelActivity = ActivityPublic.extend({
  status: z.string().default("NOT_STARTED"),
  bestProficiency: z.number().int().nullable().optional(),
});
export type LevelActivity = z.infer<typeof LevelActivity>;

export const LevelResponse = z.object({
  competency: z.string(),
  level: z.string(),
  activities: z.array(LevelActivity),
});
export type LevelResponse = z.infer<typeof LevelResponse>;

// ── Submit response ───────────────────────────────────────────────────────────

export const SubmitResponse = z.object({
  activityId: z.string().optional(),
  proficiency: z.number().int(),
  bestProficiency: z.number().int(),
  passed: z.boolean(),
  status: z.string(),
  feedback: z.string().optional().default(""),
  graded: z.enum(["server", "ai", "fallback"]).optional(),
  badgesAwarded: z.array(Badge).optional().default([]),
  // Economy fields — additive backend work (PRD §11.3 / §21 BE-1); optional today.
  coinsEarned: z.number().int().optional(),
  coinBalance: z.number().int().optional(),
});
export type SubmitResponse = z.infer<typeof SubmitResponse>;

// ── Trophy Hall (PRD §9.4) — both endpoints are LIVE on the backend ───────────

// GET /api/v1/badges → { badges: [ ...Badge, awardedAt ] }
export const EarnedBadge = Badge.extend({ awardedAt: z.string().optional().default("") });
export type EarnedBadge = z.infer<typeof EarnedBadge>;

export const BadgesResponse = z.object({ badges: z.array(EarnedBadge) });
export type BadgesResponse = z.infer<typeof BadgesResponse>;

// GET /api/v1/profile → { competencies: [...] }. category is "" when no data yet.
export const CompetencyProfile = z.object({
  code: z.string(),
  name: z.string(),
  completed: z.number().int(),
  totalSeeded: z.number().int(),
  avgProficiency: z.number(),
  category: z.string().optional().default(""),
});
export type CompetencyProfile = z.infer<typeof CompetencyProfile>;

export const ProfileResponse = z.object({ competencies: z.array(CompetencyProfile) });
export type ProfileResponse = z.infer<typeof ProfileResponse>;

// ── The generated transfer beat (ADR-006 §7.3) ────────────────────────────────

/** One choice on screen. Opaque id, text, and nothing else — by construction. */
export const FollowupOption = z.object({ id: z.string(), text: z.string() });

/**
 * What the server will say about a generated beat.
 *
 * No tier, no consequence, no rationale, and deliberately no flag saying whether
 * this was written by a model or served from the authored bank. A client that
 * knew could tell the player, and a player who could tell would know this beat
 * is the one that behaves differently.
 */
export const FollowupPublic = z.object({
  followupId: z.string(),
  speaker: z.object({ id: z.string(), name: z.string(), role: z.string() }),
  prompt: z.string(),
  options: z.array(FollowupOption).length(3),
});
export type FollowupPublic = z.infer<typeof FollowupPublic>;

/** Committing a choice is what releases its consequence — see ADR-006 §7.3. */
export const FollowupCommit = z.object({
  consequence: z.string(),
  world: z.record(z.string()).optional().default({}),
});
export type FollowupCommit = z.infer<typeof FollowupCommit>;

// ── The career journey (ADR-007) ──────────────────────────────────────────────

/**
 * What a stage close returns.
 *
 * No tier and no proficiency. `band` is a non-tier label by contract — the
 * report owns the words Developing, Strong and Advanced, and spending them at a
 * gate would teach the vocabulary a stage early. The 1–5 marks are raw scores a
 * learner may see; they never become a proficiency.
 *
 * `revenue` arrives here and nowhere else. A per-decision delta would be a
 * directional readout of the tier, and a continuous one, so the smallest thing
 * that can safely be shown is the total over a stage's four decisions.
 */
export const JourneyStageResult = z.object({
  runId: z.string(),
  stageId: z.string(),
  attemptNo: z.number().int().optional(),
  bestAttemptNo: z.number().int().optional(),
  rawScore: z.number().int().optional(),
  questionScores: z
    .array(z.object({ unitId: z.string(), score: z.number().int() }))
    .optional()
    .default([]),
  band: z.string().optional().default(""),
  feedback: z.string().optional().default(""),
  graded: z.string().optional().default(""),
  revenue: z.number().int(),
  revenueDelta: z.number().int(),
  roleReached: z.string(),
  coinsBanked: z.number().int().optional().default(0),
});
export type JourneyStageResult = z.infer<typeof JourneyStageResult>;

/**
 * What happened after a choice, and the world write it earns.
 *
 * Deliberately the same shape as FollowupCommit and deliberately carrying no
 * flag for whether it was written or served from the bank — a client that knew
 * could tell the player, and a player who could tell would treat those beats
 * differently.
 */
export const ConsequenceResult = z.object({
  consequence: z.string(),
  world: z.record(z.string()).optional().default({}),
});
export type ConsequenceResult = z.infer<typeof ConsequenceResult>;

// ── Session state (ADR-006 §11) ───────────────────────────────────────────────

/** `rev` is 0 and `blob` null when nothing has been written yet — not a 404. */
export const StateEnvelope = z.object({
  rev: z.number().int(),
  blob: z.unknown().nullable(),
  updatedAt: z.string().optional().default(""),
});
export type StateEnvelope = z.infer<typeof StateEnvelope>;

export const BuildingStateEnvelope = StateEnvelope.extend({
  buildingId: z.string().optional().default(""),
  track: z.enum(["SCA", "SCB"]).optional(),
});
export type BuildingStateEnvelope = z.infer<typeof BuildingStateEnvelope>;

export const StateAck = z.object({
  rev: z.number().int(),
  updatedAt: z.string().optional().default(""),
});
export type StateAck = z.infer<typeof StateAck>;

export const BeaconToken = z.object({
  beaconToken: z.string(),
  expiresAt: z.string().optional().default(""),
});
export type BeaconToken = z.infer<typeof BeaconToken>;

/**
 * A write either lands or loses a race. A 409 is not an error to show anybody —
 * it carries the server's current document so the caller can resolve in one
 * round trip (two tabs in the same building is the case it exists for).
 */
export type StateWriteResult =
  | { ok: true; rev: number; updatedAt: string }
  | { ok: false; rev: number; blob: unknown; updatedAt: string };

// ── The wallet (PRD §9) ───────────────────────────────────────────────────────

export const Wallet = z.object({
  coins: z.number().int(),
  lifetimeCoins: z.number().int().optional(),
});
export type Wallet = z.infer<typeof Wallet>;

/**
 * One line of the coin ledger. `reason` is a machine code (ACTIVITY_COMPLETE,
 * BADGE_AWARD, SHOP_PURCHASE, STARTER_GRANT); the Bank renders it in the city's
 * own words. Nothing here is a proficiency — the ledger is the most tempting
 * place in the product to leak the answer key and it must not.
 */
export const CoinTransaction = z.object({
  id: z.string().optional().default(""),
  amount: z.number().int(),
  reason: z.string().optional().default(""),
  refType: z.string().optional().default(""),
  refId: z.string().optional().default(""),
  balanceAfter: z.number().int().optional(),
  createdAt: z.string().optional().default(""),
});
export type CoinTransaction = z.infer<typeof CoinTransaction>;

export const WalletTransactions = z.object({
  transactions: z.array(CoinTransaction).optional().default([]),
});
export type WalletTransactions = z.infer<typeof WalletTransactions>;

// ── Bootstrap (GET /me) ───────────────────────────────────────────────────────

// The first authed call: identity, wallet, avatar. It also performs the starter
// grant, which is why the HUD can show a real balance from the first second.
export const Me = z.object({
  user: z
    .object({
      id: z.string().optional().default(""),
      displayName: z.string().optional().default(""),
      email: z.string().optional().default(""),
      role: z.string().optional().default("player"),
    })
    .optional(),
  wallet: Wallet.optional(),
  avatar: z.record(z.string()).optional().default({}),
  badgesEarned: z.number().int().optional().default(0),
});
export type Me = z.infer<typeof Me>;
