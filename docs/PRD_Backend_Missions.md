# PRD — Backend · Missions, session state and the AI transfer beat

_The City · Backend contract · v1.0 · 2026-08-04 · **Status: Draft for sign-off** · Owner: TBD (one backend dev — this document is single-owner by design)_

_Service: **`backend-academy`** (Go 1.22 · Echo v4 · GORM · MySQL/Cloud SQL · goose migrations)._
_Implements [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md). Inherits [ADR-005 v2.0](ADR-005_Interior_Framework.md) for the silent-tier contract and the scoring model. Consumed by [Café §19](PRD_Building_Cafe.md) · [MAISON §19](PRD_Building_MAISON.md) · [MERIDIAN §19](PRD_Building_MERIDIAN.md) · master [PRD_City_Frontend §21](PRD_City_Frontend.md)._

> **This document is the only place the endpoints are specified.** The three building PRDs carry their own concrete payloads with their own ids, and they are illustrations of what is written here. If a payload in a building PRD disagrees with this document, this document is right and the building PRD is a bug.

---

## 1. TL;DR

Six additive changes to `backend-academy`, none of which breaks an existing client:

|           | What                                                     | Why                                                                              |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **BE-13** | Two scenario levels, `SCA` (16–21) + `SCB` (35–50)       | The blueprints define two tracks; neither has a level, and `HARD` is full (§6.4) |
| **BE-14** | `coinsByProficiency → {1:5, 2:15, 3:25}`                 | `Playroom Scenarios.xlsx → Rules`                                                |
| **BE-15** | `PUT/GET /api/v1/city/state`                             | Track choice and FTUE flags need a home                                          |
| **BE-16** | `PUT/GET/POST /api/v1/city/buildings/{buildingId}/state` | The season survives leaving the building                                         |
| **BE-17** | `POST /api/v1/ai/followup`                               | The generated transfer beat                                                      |
| **BE-18** | Extended `trace` submit + `aiBeat` rubric block          | The transfer beat has to count                                                   |

Plus **BE-19** (mission telemetry, P3), **BE-20** (un-stale `api/openapi.yaml`, P1) and **BE-21** (let the registry validator accept a partially-populated level, **P0** — §6.5).

> **Both of the blockers that stood in front of this are cleared.** The validator now splits its rules by mode (§6.5, shipped), and the level namespace is resolved — scenarios live at `SCA`/`SCB` and `HARD` is untouched ([ADR-005 §10.6.1](ADR-005_Interior_Framework.md), Option C adopted 2026-08-07). The first scenario row is seeded and green.

Two new tables, two new migrations, one new service, one new content pack. `internal/scoring` gains roughly thirty lines and loses none.

**The load-bearing invariant:** a tier never appears in a response body. Not for the authored beats (they never did) and not for the generated one (its options ship as opaque ids and the tier is resolved from the database at submit time). If a future change would put a tier on the wire, it is wrong.

---

## 2. What already exists

Written down so nobody rebuilds it.

| Capability                                                                                                        | Where                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Firebase auth → auto-provisioned `AcademyUser`; `auth.UserID(c)` in every handler                                 | `internal/auth/middleware.go`                                                  |
| `ActivityRegistry` with a **server-only** `Rubric` and a `Public()` projection that omits it                      | `internal/models/academy.go`                                                   |
| Rubric kinds `objective · order · trace · metrics · slots · ai`, all evaluated server-side                        | `internal/scoring/scoring.go`                                                  |
| `evalTrace` — walks the path backwards for the last known terminal, maps through `scoreMap`                       | `internal/scoring/scoring.go:340`                                              |
| `scoring.Grader` interface + `services.GeminiGrader` (strict-JSON prompt, lenient parse, `ErrAIUnavailable`)      | `internal/services/grading_ai.go`                                              |
| **Mandatory fallback on AI failure** — `applyFallback(entry)` in the submit path                                  | `internal/services/progress_service.go:299`                                    |
| `POST /api/v1/progress/{activityId}/start` · `POST /api/v1/progress/{activityId}/submit` · `GET /api/v1/progress` | `cmd/server/main.go`, `internal/handlers/academy_handler.go`                   |
| `GET /api/v1/registry/{comp}/{level}` · `/registry/activity/{id}` · `/registry/modules`                           | `internal/handlers/academy_handler.go`                                         |
| `GameSession` (user × activity state blob) + `PUT/GET /api/v1/progress/{activityId}/state`                        | `internal/models/academy.go`, `cmd/server/main.go`                             |
| Coin award on first pass, idempotent, server-computed                                                             | `internal/services/wallet_service.go`, `internal/economy/content/economy.json` |
| Registry content packs + hot reload (`POST /api/v1/admin/registry/reload`)                                        | `internal/registry/loader.go`                                                  |
| `cmd/validate_registry` — 12 activities per competency-level, `orderIndex` 1..12, six subtopics × exactly 2       | `cmd/validate_registry/main.go`                                                |
| goose migrations (MySQL dialect, embedded FS) + GORM `AutoMigrate` for dev/tests + a CI drift check               | `internal/db/migrations.go`, `cmd/schemadrift`                                 |
| Structured error envelope                                                                                         | `internal/httpx/errors.go`                                                     |

**Nothing above changes shape.** Every item below either adds to it or composes on top of it.

---

## 3. Data model

### 3.1 New models

```go
// internal/models/city.go   (new file)

// CityState is one blob per user for city-wide facts: which track they chose
// (ADR-005 §10.7 — one choice for the whole city), FTUE flags, and where they
// were standing on the street. Opaque to the server: the client owns the shape.
type CityState struct {
    UserID    string          `gorm:"primaryKey;type:varchar(191)" json:"-"`
    Blob      json.RawMessage `gorm:"type:json" json:"blob"`
    Rev       int64           `gorm:"default:0" json:"rev"`
    UpdatedAt time.Time       `json:"updatedAt"`
}

// BuildingSession is one blob per user per building — the season. Mission index,
// objective index, partial decision path, the pending transfer question, the
// building's world state, where the player was standing. Also opaque.
//
// This is deliberately NOT GameSession: GameSession is keyed by activity and
// exists for long-running sims. A season spans nine activities and outlives all
// of them, and overloading the activity key would make "resume the building" a
// query rather than a read.
type BuildingSession struct {
    UserID     string          `gorm:"primaryKey;type:varchar(191)" json:"-"`
    BuildingID string          `gorm:"primaryKey;type:varchar(64)" json:"buildingId"`
    Track      string          `gorm:"type:varchar(16)" json:"track"`      // SCA | SCB — denormalised for analytics
    Blob       json.RawMessage `gorm:"type:json" json:"blob"`
    Rev        int64           `gorm:"default:0" json:"rev"`
    UpdatedAt  time.Time       `json:"updatedAt"`
}
```

```go
// internal/models/followup.go   (new file)

// AIFollowup is one generated (or fallback) transfer beat, issued to one user
// for one attempt at one activity.
//
// Options holds the TIER of each option and must NEVER be serialized to a
// client — same rule and same reason as ActivityRegistry.Rubric. Handlers
// expose only FollowupPublic.
type AIFollowup struct {
    ID           string          `gorm:"primaryKey;type:varchar(191)" json:"id"`
    UserID       string          `gorm:"index:idx_followup_user_activity,priority:1;type:varchar(191)" json:"-"`
    ActivityID   string          `gorm:"index:idx_followup_user_activity,priority:2;type:varchar(32)" json:"activityId"`
    BuildingID   string          `gorm:"type:varchar(64)" json:"buildingId"`
    Track        string          `gorm:"type:varchar(16)" json:"track"`
    SeedChoice   string          `gorm:"type:varchar(8)" json:"-"`
    FollowChoice string          `gorm:"type:varchar(8)" json:"-"`
    SpeakerID    string          `gorm:"type:varchar(64)" json:"-"`
    Prompt       string          `gorm:"type:text" json:"-"`
    Options      json.RawMessage `gorm:"type:json" json:"-"`   // server-only: [{id,text,tier,consequence,world}]
    Source       string          `gorm:"type:varchar(16)" json:"-"` // ai | fallback
    Model        string          `gorm:"type:varchar(64)" json:"-"`
    GateFailures json.RawMessage `gorm:"type:json" json:"-"`   // which gates fired, for prompt tuning
    CreatedAt    time.Time       `json:"-"`
    ConsumedAt   *time.Time      `json:"-"`
}
```

`FollowupPublic` is the client projection: `followupId`, `speaker`, `prompt`, and `options` reduced to `{ id, text }`. **`tier`, `consequence` tiers, `source`, `model` and `gateFailures` are never in it.** (`consequence` text _is_ returned — the player must see what happened — but it is returned as part of the chosen option's resolution at commit time, not up front, so the three consequences are not all readable before choosing.)

### 3.2 Migrations

Two files, goose, MySQL dialect, matching the conventions in `00003_economy.sql`.

**`internal/db/migrations/00004_city_and_building_state.sql`**

```sql
-- +goose Up
-- Session state: city-wide facts and one season blob per user per building.

CREATE TABLE IF NOT EXISTS `city_states` (
  `user_id`    varchar(191) NOT NULL,
  `blob`       json DEFAULT NULL,
  `rev`        bigint NOT NULL DEFAULT 0,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `building_sessions` (
  `user_id`     varchar(191) NOT NULL,
  `building_id` varchar(64)  NOT NULL,
  `track`       varchar(16)  DEFAULT NULL,
  `blob`        json DEFAULT NULL,
  `rev`         bigint NOT NULL DEFAULT 0,
  `updated_at`  datetime(3) DEFAULT NULL,
  PRIMARY KEY (`user_id`, `building_id`),
  KEY `idx_building_sessions_building` (`building_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS `building_sessions`;
DROP TABLE IF EXISTS `city_states`;
```

**`internal/db/migrations/00005_ai_followups.sql`**

```sql
-- +goose Up
-- One generated transfer beat per user per attempt. `options` carries the tier
-- of each option and is server-only, exactly like activity_registries.rubric.

CREATE TABLE IF NOT EXISTS `ai_followups` (
  `id`            varchar(191) NOT NULL,
  `user_id`       varchar(191) NOT NULL,
  `activity_id`   varchar(32)  NOT NULL,
  `building_id`   varchar(64)  DEFAULT NULL,
  `track`         varchar(16)  DEFAULT NULL,
  `seed_choice`   varchar(8)   DEFAULT NULL,
  `follow_choice` varchar(8)   DEFAULT NULL,
  `speaker_id`    varchar(64)  DEFAULT NULL,
  `prompt`        text,
  `options`       json DEFAULT NULL,
  `source`        varchar(16)  DEFAULT 'ai',
  `model`         varchar(64)  DEFAULT NULL,
  `gate_failures` json DEFAULT NULL,
  `created_at`    datetime(3) DEFAULT NULL,
  `consumed_at`   datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_followup_user_activity` (`user_id`, `activity_id`),
  KEY `idx_followup_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS `ai_followups`;
```

Both models are added to the `AutoMigrate` list used by dev and tests, and `cmd/schemadrift` keeps the SQL and the structs in lockstep — a drift here is a CI failure, not a production surprise.

### 3.3 Retention

`ai_followups` rows are **the only record of what a learner was actually asked**, which matters if anyone ever audits an assessment. Retain for the life of the account. `gate_failures` may be truncated after 90 days; it is prompt-tuning telemetry, not evidence.

---

## 4. Endpoints

All under the existing authed group in `cmd/server/main.go`:

```go
api := e.Group("/api/v1", auth.Middleware(cfg, dir), middleware.RateLimiter(...))
```

Errors use the existing envelope from `internal/httpx/errors.go`. All bodies are JSON unless stated.

### 4.1 BE-15 · City state

```
GET  /api/v1/city/state
PUT  /api/v1/city/state
```

**GET** → `200 { "rev": 7, "blob": { … }, "updatedAt": "…" }` · `200 { "rev": 0, "blob": null }` when unset (**not** 404 — an empty city state is a normal first session and a 404 makes every client special-case it).

**PUT** body `{ "rev": 7, "blob": { … } }` → `200 { "rev": 8, "updatedAt": "…" }`.

- `rev` is the revision the client last read. Server accepts if `body.rev >= stored.rev`, writes `stored.rev + 1`.
- Stale `rev` → `409` with `{ "error": { "code": "STALE_REVISION" }, "rev": 9, "blob": { … } }` — the current server document is in the response so the client can resolve without a second round trip.
- `blob` is opaque, size-bounded at **8 KB**. Over → `413` `PAYLOAD_TOO_LARGE`.

Recommended blob shape (client-owned, documented for reviewers, not enforced):

```jsonc
{
  "track": "SCA",
  "ftue": { "firstEntry": true, "trackAsked": true },
  "lastDistrict": "market",
  "lastTile": [24, 9],
}
```

### 4.2 BE-16 · Building session state

```
GET  /api/v1/city/buildings/{buildingId}/state
PUT  /api/v1/city/buildings/{buildingId}/state
POST /api/v1/city/buildings/{buildingId}/state      ← sendBeacon path only
```

`buildingId` is validated against a server-side allow-list (`cafe`, `fashion_brand`, `bank`, …) so the table cannot be used as arbitrary key-value storage. Unknown id → `400 UNKNOWN_BUILDING`.

**GET** → `200 { "buildingId": "cafe", "track": "SCA", "rev": 22, "blob": { … }, "updatedAt": "…" }`, or `{ "rev": 0, "blob": null }` when unset.

**PUT** body `{ "rev": 22, "track": "SCA", "blob": { … } }` → `200 { "rev": 23, "updatedAt": "…" }`. Same `rev` / `409` semantics as BE-15. Size bound **16 KB**.

Recommended blob shape — this is the season, per [ADR-006 §11.1](ADR-006_Missions_AI_Followups_and_Session_State.md):

```jsonc
{
  "missionOrder": 3,
  "objectiveIndex": 4,
  "partialPath": ["c"],
  "pendingFollowupId": null,
  "world": { "chalkboard": "oat_asked", "regulars": "thin", "till": "tight" },
  "playerCell": [4, 5],
  "trackerCollapsed": false,
}
```

#### 4.3 The beacon path

`navigator.sendBeacon` can only `POST`, sets `Content-Type: text/plain` for a string payload, and **cannot attach an `Authorization` header**. The exit flush is the one write that must never be dropped, so `POST` is specified explicitly for it:

- Accepts `Content-Type: text/plain` or `application/json`; the body is the JSON document either way.
- Body is `{ "rev", "track", "blob", "beaconToken" }`.
- `beaconToken` is a **short-lived (5 min), single-building, write-only** token minted by `GET /api/v1/city/beacon-token?buildingId=cafe` when the player enters the building. It authorises exactly one operation: write this user's session blob for this building. It cannot read, cannot submit, and cannot touch coins.
- `auth.Middleware` is bypassed for this one route and replaced by beacon-token verification. **This is the only unauthenticated-by-header route in the service and it must be reviewed as such**: HMAC over `(userID, buildingID, exp)` with the existing service secret, constant-time compare, single-use nonce cached in memory for the token's lifetime.
- Response is `204` with no body — `sendBeacon` discards it anyway, and returning nothing removes any temptation to make the beacon path do more than it does.
- If the token is absent but a valid `Authorization` header is present (the `fetch(..., { keepalive: true })` fallback), the normal path is used.

### 4.4 BE-17 · Generate the transfer beat

```
POST /api/v1/ai/followup
```

Request:

```jsonc
{
  "activityId": "C1-SCA-01",
  "track": "SCA",
  "buildingId": "cafe",
  "path": ["c", "b"],
  "speakerId": "nadia",
  "worldState": { "chalkboard": "oat_asked", "regulars": "thin", "till": "tight" },
}
```

| Field        | Validation                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activityId` | must exist, must be `activityType: "DECISION_TREE"`, must carry an `aiBeat` rubric block                                                                                                      |
| `track`      | `SCA` \| `SCB`, must match the activity's level                                                                                                                                               |
| `buildingId` | allow-listed; must own this activity's slot (ADR-005 §10.5)                                                                                                                                   |
| `path`       | exactly 2 elements, each a single letter that exists at its node in the authored tree                                                                                                         |
| `speakerId`  | must be a cast member of that building, or the literal `"room"`                                                                                                                               |
| `worldState` | keys must be in the building's declared world-state schema; values must be in that key's enum. **Anything else is dropped, not rejected** — a stale client must not be able to fail a mission |

Response `200`:

```jsonc
{
  "followupId": "fu_01J8ZQ0S8N4T1V6M",
  "speaker": { "id": "nadia", "name": "Nadia", "role": "the commuter" },
  "prompt": "Six weeks on, the 7:50 window is yours again — and the station café has started opening at seven. Nadia, on her way out: \"You going to keep doing this every time they move?\"",
  "options": [
    { "id": "o_7f2a91", "text": "…" },
    { "id": "o_c104de", "text": "…" },
    { "id": "o_39be07", "text": "…" },
  ],
}
```

**This endpoint never returns 5xx.** Every failure path — no API key, model error, timeout, both generations failing a gate, rate limit exceeded — resolves to a fallback row and returns `200`. `source` is recorded on the row and emitted as a metric; it is **not** in the response body, because a client that knows a beat was a fallback is a client that could tell the player.

The only non-200s are request validation: `400` for a malformed body, `404` for an unknown activity, `409` `NO_AI_BEAT` if the activity's rubric has no `aiBeat` block (a client bug, worth surfacing loudly).

Server-side behaviour:

1. Resolve the activity, its authored tree metadata, the building's followup content pack, and the persona card for `speakerId`.
2. Look for a warm cache entry on `(activityId, track, path, worldSignature)` — if the pool has ≥ 1 accepted variant, draw one at random and skip to 5.
3. Call the generator with a **4 s hard deadline** (`context.WithTimeout`). Run the §5.3 gates. One retry on failure with the failed gate named. Second failure or deadline → fallback.
4. Shuffle the three options, mint opaque ids (`o_` + 6 hex, per row, never derived from tier or position).
5. Insert an `ai_followups` row for this user with the full option set including tiers.
6. Return the public projection.

Rate limit: **40 generations per user per hour** (a nine-mission season plus replays and headroom), enforced separately from the global per-IP limiter. Over the limit → fallback, `200`, no error surfaced.

### 4.5 BE-18 · Extended submit

`POST /api/v1/progress/{activityId}/submit` — **unchanged path, unchanged response shape.** `result.trace` gains two optional fields:

```jsonc
{
  "clientVersion": "city@0.3.0",
  "durationSec": 412,
  "hintsUsed": 0,
  "result": {
    "trace": {
      "path": ["C1-SCA-01.seed", "C1-SCA-01.c", "C1-SCA-01.c.follow", "C1-SCA-01.c.b"],
      "followupId": "fu_01J8ZQ0S8N4T1V6M",
      "followupChoice": "o_c104de",
    },
  },
}
```

Response is exactly what it is today: `proficiency`, `bestProficiency`, `coinsEarned`, `coinBalance`, `badgesAwarded`, `feedback`, `graded`. **No new fields**, because every new field on a scored response is a new place for a tier to leak.

Scoring, in `evalTrace`:

```
authored   = terminals[last known terminal on path]           (unchanged)
if rubric.aiBeat == nil            → outcome = authored       (unchanged)
if followupId == ""                → outcome = authored       (degraded path, ADR-006 §10.3)
tier       = lookup(followupId → options[followupChoice].tier)
outcome    = round( (1 - aiBeat.weight) * authored + aiBeat.weight * aiBeat.tierValues[tier] )
proficiency = scoreMap(outcome)                               (unchanged)
```

Guards:

- `followupId` must belong to this user **and** this activity. Mismatch → treat as absent and score on the authored terminal. Do **not** 400: a client bug must not cost a learner their mission.
- `followupChoice` must be one of that row's option ids. Same treatment.
- Set `consumed_at` on first use. **Re-submitting the same pair returns the same score** — `consumed_at` is a timestamp, not a lock, so a retry after a dropped connection succeeds.
- The chosen option's `consequence` and `world` are returned **only** through the followup resolution call the client makes at commit time (§4.6), never from submit.

### 4.6 Committing a transfer choice

```
POST /api/v1/ai/followup/{followupId}/commit
```

Body `{ "optionId": "o_c104de" }` → `200 { "consequence": "…", "world": { "chalkboard": "direct" } }`.

This exists so the room can play the consequence and apply the world write **without** the three consequences having been shipped up front — where a curious player could read all three and infer the ranking. It is a one-line handler and it closes a real silent-tier hole.

Idempotent: committing the same option twice returns the same body. Committing a _different_ option after the first is `409 ALREADY_COMMITTED` with the original — a decision is a decision.

### 4.7 BE-19 · Mission telemetry (P3, non-blocking)

```
POST /api/v1/telemetry/mission
```

Body `{ "buildingId", "missionOrder", "objectiveId", "event": "started"|"completed", "elapsedMs" }` → `202`. Fire-and-forget, best-effort, **never affects scoring**, rate-limited hard, dropped silently under load. Useful for "which objective do players get stuck on", which is the only question this data answers.

### 4.8 BE-20 · `api/openapi.yaml`

The file is at v0.2.0 and behind the handler; the frontend generates types from it, so staleness is silent drift. It must document, before any of the above ships:

- `DECISION_TREE` as an `activityType` and `trace` as a result kind, including `followupId` / `followupChoice`
- the `SCA` and `SCB` levels in every level enum
- `/badges`, `/profile`, `/hub/summary` (already live, already missing)
- the structured error envelope
- every endpoint in §4

**Process, per master PRD §11.3: the openapi PR lands first, then the implementation.**

---

## 5. The generation service

### 5.1 Interface

```go
// internal/scoring/scoring.go — beside the existing Grader interface.

// FollowupGenerator writes one transfer beat. Implemented by
// services.ClaudeFollowupGenerator (and services.GeminiFollowupGenerator);
// tests inject fakes. Any error makes the caller serve the scripted fallback,
// exactly as Grader errors make it apply the activity's predefined fallback.
type FollowupGenerator interface {
    Generate(ctx context.Context, req FollowupRequest) (*FollowupDraft, error)
}

type FollowupDraft struct {
    Prompt  string
    Options []FollowupOption // exactly 3
}

type FollowupOption struct {
    Text        string
    Tier        string            // "developing" | "strong" | "advanced"
    Consequence string
    World       map[string]string // optional; must be a member of the request's candidates
}
```

`ErrAIUnavailable` (already defined) is reused for "no key, quota, outage".

### 5.2 Model and configuration

New config keys beside the existing `GEMINI_API_KEY` / `AI_MODEL`:

| Env                       | Default                     | Notes                                                                                                  |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `FOLLOWUP_PROVIDER`       | `anthropic`                 | `anthropic` \| `gemini` \| `off`                                                                       |
| `ANTHROPIC_API_KEY`       | _(empty)_                   | Empty ⇒ provider unavailable ⇒ fallback bank. The service is fully functional without it               |
| `FOLLOWUP_MODEL`          | `claude-haiku-4-5-20251001` | Latency is the binding constraint ([ADR-006 §7.4](ADR-006_Missions_AI_Followups_and_Session_State.md)) |
| `FOLLOWUP_TIMEOUT_MS`     | `4000`                      | Hard deadline; beyond it the fallback is served                                                        |
| `FOLLOWUP_RATE_PER_HOUR`  | `40`                        | Per user                                                                                               |
| `FOLLOWUP_CACHE_VARIANTS` | `4`                         | Accepted variants held per path signature                                                              |

The existing Gemini grader keeps `GEMINI_API_KEY` and continues to serve `ai`-rubric grading. The two are independent: grading and generation can run on different providers.

### 5.3 The validation gates

Implemented in `internal/services/followup_gates.go` as a list of named, pure, individually-tested functions. Order matters; the first failure short-circuits.

| #   | Gate                 | Rule                                                                                                                                                     | Failure mode observed in practice                                 |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `schema`             | Parses; exactly 3 options; all fields non-empty; prompt ≤ 60 words; option 13–33 words; consequence ≤ 45 words                                           | Model returns 4 options or a preamble                             |
| 2   | `tier_completeness`  | Exactly one of each tier                                                                                                                                 | Two "strong"s                                                     |
| 3   | `length_parity`      | max(words) − min(words) ≤ **8** across the three options                                                                                                 | **The most common failure.** The advanced option accretes clauses |
| 4   | `tier_vocabulary`    | No capitalised `Developing`/`Strong`/`Advanced`, no `n/3`, no proficiency digits, no pass/fail phrasing, anywhere                                        | Model helpfully labels its own options                            |
| 5   | `verdict_language`   | Blocklist in consequences: `unfortunately`, `you should have`, `the better move`, `the right call`, `correct`, `well done`, `mistake`, `wisely`, `sadly` | Model coaches                                                     |
| 6   | `self_justification` | Every option contains ≥ 1 connective from a small set (`because`, `since`, `so`, `and`, `while`, `—`)                                                    | The weak option is a bare imperative                              |
| 7   | `path_reference`     | ≥ 2 shared content tokens between the prompt and the chosen seed or follow-up text (stopwords removed)                                                   | Generic question, ignores the path                                |
| 8   | `world_legality`     | Any `World` map is a verbatim member of the request's `aiWorldCandidates`                                                                                | Model invents a key                                               |
| 9   | `building_gates`     | Registered per building. **MERIDIAN: no second-person guidance about real money** (`you should invest`, `pay off your`, `open an account`…)              | The bank building starts giving advice                            |

Every failure is recorded in `gate_failures` on the row. **Gate-failure rate by gate id is the single most useful signal for prompt iteration** and is the metric that decides whether ADR-006 §14's "revisit if" threshold is crossed.

### 5.4 The fallback bank

Content, not code: `internal/registry/content/followups/{buildingId}.json`, loaded by the existing registry loader and hot-reloadable through `POST /api/v1/admin/registry/reload`.

```jsonc
{
  "buildingId": "cafe",
  "personas": {
    "nadia": {
      "name": "Nadia",
      "role": "the commuter",
      "voice": "Friendly and compressed. Says the important thing on her way out the door.",
      "samples": ["You still don't do oat, do you?"],
      "never": ["long speeches", "business vocabulary"],
    },
  },
  "fallbacks": [
    {
      "activityId": "C1-SCA-01",
      "speakerId": "nadia",
      "prompt": "…",
      "options": [
        { "text": "…", "tier": "strong", "consequence": "…" },
        { "text": "…", "tier": "developing", "consequence": "…" },
        { "text": "…", "tier": "advanced", "consequence": "…" },
      ],
    },
    // … exactly 18 per building: 9 competencies × 2 tracks
  ],
}
```

`personas` is the same data the generator is given, so the fallback and the generated beat are written from one description of the character.

**`cmd/validate_registry` gains a check: every `DECISION_TREE` activity with an `aiBeat` rubric block must have a fallback entry.** A missing one is a build failure. This is what makes "no breaking at edge case" a property rather than an intention.

### 5.5 Prompt-injection posture

Small, because the surface is small: **the player never types anything.** The only player-influenced input is `worldState`, and every value is validated against a closed enum before it reaches the prompt (§4.4). The authored choice texts come from the server's own registry, not from the request. `speakerId` is validated against the building's cast. There is no free text anywhere in the path, and there must not be one added later without revisiting this section.

---

## 6. Registry changes

### 6.1 BE-13 · The scenario level(s)

> **Resolved by [ADR-005 §10.6.1](ADR-005_Interior_Framework.md), Option C.** v1.0 of this ticket added one level (`PRO`) on the assumption that Level A could reuse `HARD`. **It cannot** — `HARD` is occupied and has progress rows against it (§6.4). BE-13 therefore adds **two** levels.

`BEGINNER` (8–13) · `MEDIUM` (14–16) · `HARD` (17–21) gain **`SCA` (`ageBand: "16-21"`)** and **`SCB` (`ageBand: "35-50"`)**. Level A → `SCA`, Level B → `SCB` (ADR-005 §10.6). The existing three are untouched.

Touches:

| File                                            | Change                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `cmd/validate_registry/main.go`                 | level allow-list; `-strict` check 3 → 4 levels                                              |
| `internal/registry/content/c1.json` … `c9.json` | an `SCA` **and** an `SCB` level block per competency; `BADGE-C{n}-SCA` and `BADGE-C{n}-SCB` |
| `internal/registry/content/badges.json`         | **eighteen** level badges + **two** meta badges (names ADR-005 §20.3, KK to confirm)        |
| `internal/services/badge_service.go`            | fourth and fifth entries in the level map                                                   |
| `internal/models/academy.go`                    | the `Level` comment. `varchar(16)` already fits                                             |

### 6.2 BE-14 · Coin rescale

`internal/economy/content/economy.json`: `coinsByProficiency` `{1:10, 2:20, 3:35}` → **`{1:5, 2:15, 3:25}`** (`Playroom Scenarios.xlsx → Rules`). Content pack, no deploy — `POST /api/v1/admin/economy/reload`. Platform-wide rescale, including the existing `C4-BEGINNER` awards; that is intentional so two sessions are comparable.

### 6.3 The `aiBeat` rubric block

`internal/scoring/scoring.go`, `traceRubric`:

```go
type aiBeatRubric struct {
    Weight     float64        `json:"weight"`     // 0.3
    TierValues map[string]int `json:"tierValues"` // developing 15, strong 60, advanced 95
    Required   bool           `json:"required"`   // false — a submit without a followup still scores
}

type traceRubric struct {
    Terminals map[string]int  `json:"terminals"`
    ScoreMap  []scoreMapEntry `json:"scoreMap"`
    HintsCap  *hintsCap       `json:"hintsCap,omitempty"`
    AIBeat    *aiBeatRubric   `json:"aiBeat,omitempty"`   // ← new
}
```

`ValidateRubric` gains: if `AIBeat != nil`, `Weight` ∈ (0, 0.5] and `TierValues` has all three keys.

### 6.4 BE-12 · Seeding the 54 scenario rows — **blocked, twice**

Three launch buildings × 9 competencies × 2 levels = **54 `DECISION_TREE` rows**, slots 01 (Café) / 02 (MERIDIAN) / 03 (MAISON), with the terminals tables from each building PRD §10 and the new `aiBeat` block.

> ### ⚠ Correction (2026-08-07) — v1.0 of this section was wrong
>
> It said: _"until then the seed runs with `-strict=false` and the ledger tracks the gap."_ **`-strict=false` does not relax anything relevant.** Verified in [`cmd/validate_registry/main.go`](../../backend-academy/cmd/validate_registry/main.go):
>
> ```go
> if *strict && len(comp.Levels) != 3 { … }        // line 64 — strict-only
>
> for level, lv := range comp.Levels {
>     if len(lv.Activities) != 12 {                 // line 72 — UNCONDITIONAL
>         fail("%s/%s: expected 12 activities, found %d", …)
>     }
> ```
>
> `-strict` adds only the _"three levels per competency"_ rule. The **twelve-activities-per-level** rule sits inside the level loop and always runs. Seven competencies have **zero** levels today (only C4 has `BEGINNER`, only C9 has all three), so adding `C1-SCA-01` creates a level holding one activity and **fails the build, with no flag that relaxes it**.
>
> _Credit: found by the backend owner while checking whether the Café's rows could be seeded._

**Two blockers, both of which must clear before a single row is seeded:**

| #     | Blocker                                                                                                                | Owner   | Fix                                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| **1** | The validator rejects a partially-populated level                                                                      | backend | **BE-21** below                                                                                              |
| **2** | The scenario id scheme collides with seeded content — `C9-HARD-01/02/03` are taken and have progress rows against them | product | [ADR-005 §10.6.1](ADR-005_Interior_Framework.md), recommendation **Option C** (`SCA` / `SCB`). **Needs KK.** |

### 6.5 BE-21 · Let the validator accept a partially-populated level

**Status: shipped** (`6129f8b`). Was P0 and blocking BE-12.

The "exactly 12" invariant is a _launch_ gate that has been enforced as a _build_ gate. It is correct at full seed and wrong during rollout — it makes seeding the first building of twelve impossible.

**Change:** split the rule by mode.

| Mode      | Rule                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| default   | `len(lv.Activities) <= 12` · `orderIndex` unique and within 1..12 · no duplicate ids · every subtopic in the competency's list |
| `-strict` | additionally `== 12`, six subtopics × exactly 2, and three levels per competency                                               |

`-strict` is what CI runs at launch and what the phase gate in §9 P4 means. The default is what a developer and the seed job run while twelve buildings are being written one at a time.

**Acceptance:** with one scenario row seeded into an otherwise-empty level, the default run passes and `-strict` fails with a message naming the shortfall.

---

## 7. Observability

| Metric                                                               | Why                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `followup_generate_total{source=ai\|fallback}`                       | The headline. A fallback rate above ~10% means the feature is not really shipping |
| `followup_gate_failure_total{gate}`                                  | Drives prompt iteration; gate 3 will dominate at first                            |
| `followup_latency_ms` p50/p95/p99                                    | ADR-006 §7.4's budget is 2.5 s p95, 4 s hard                                      |
| `followup_timeout_total`                                             | Distinguishes "slow" from "broken"                                                |
| `session_write_total{building,trigger}` and `session_conflict_total` | Debounce tuning; conflicts mean two tabs                                          |
| `beacon_write_total{ok,bad_token}`                                   | The exit flush is the write that must not be lost                                 |
| `submit_total{hasFollowup}`                                          | How many missions actually completed all three beats                              |

Structured logs never include the prompt body, the option tiers, or the API key. A generated prompt is logged only on gate failure, and only behind a debug flag.

---

## 8. Testing

**Unit**

- `evalTrace` with and without `aiBeat`; all 27 cells of [ADR-006 §10.2](ADR-006_Missions_AI_Followups_and_Session_State.md) asserted as a table test — this is the single most important test in the change.
- `followupId` mismatched to user / activity / option → falls back to the authored terminal, never errors.
- Re-submit idempotency: same pair, same score, twice.
- Each gate in §5.3, independently, with a crafted failing draft and a passing one.
- `rev` conflict: stale → 409 with the current document; equal → accepted; ahead → accepted.
- Beacon token: valid, expired, wrong building, wrong user, replayed.
- Blob size bounds.

**Integration**

- Full mission: `start` → `PUT state` ×3 → `POST /ai/followup` (fake generator) → `commit` → `submit` → assert proficiency and coins → `GET state` returns the season.
- Generator returns garbage → fallback served, `200`, response indistinguishable from the AI path apart from the DB row.
- Generator times out → fallback within the deadline.
- No API key configured → every request served from the fallback bank, whole flow green.
- Resume: session with `pendingFollowupId` → the stored question is re-served verbatim, not regenerated.

**Contract**

- `cmd/schemadrift` green (SQL vs GORM).
- `cmd/validate_registry` green, including the new fallback-completeness check.
- A generated `openapi.yaml` client compiles against the live handlers (BE-20).

**Security**

- No response body anywhere in the service contains the string `"tier"`, `"developing"`, `"strong"` or `"advanced"` — asserted by a test that walks every handler's response type.
- `ai_followups.options` and `activity_registries.rubric` are absent from every projection.

---

## 9. Phases

| Phase                | Deliverable                                                                                                | Gate                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **P-1 — Unblock**    | **BE-21** (validator modes) + the [ADR-005 §10.6.1](ADR-005_Interior_Framework.md) level decision          | One scenario row seeds into an empty level and the default validator run passes                          |
| **P0 — Foundations** | BE-13 (the scenario level(s)), BE-14 (coins), BE-20 (openapi), migrations 00004/00005, models, drift check | Default `validate_registry` green with a scenario level present; drift check green                       |
| **P1 — Session**     | BE-15, BE-16 including the beacon path and token                                                           | A season written from one tab, read from another; a killed tab loses nothing after the beacon fires      |
| **P2 — Generation**  | BE-17 + `FollowupGenerator` + Claude Haiku 4.5 client + all nine gates + the fallback loader + `/commit`   | With the API key removed, a full mission plays on fallbacks and nothing in the response distinguishes it |
| **P3 — Scoring**     | BE-18, the `aiBeat` rubric block, the 27-cell table test                                                   | Every cell of ADR-006 §10.2 reproduced exactly                                                           |
| **P4 — Content**     | BE-12 seed of the 54 rows; the three fallback banks (18 each)                                              | `validate_registry` green including fallback completeness                                                |
| **P5 — Telemetry**   | BE-19, the §7 metrics                                                                                      | A dashboard showing fallback rate and gate failures by gate                                              |

P0–P3 are the critical path for the Café's mission work. P4 blocks every building from being playable against the live registry. P5 is post-launch.

---

## 10. Open decisions

- **The two meta badge names** for `SCA` and `SCB` (`BADGE-META-OPERATOR` was proposed when there was one) — KK. Not blocking.
- **Beacon-token lifetime.** 5 minutes covers a normal visit; a long session would need a refresh on mission close. Alternative: mint it per mission rather than per entry. Recommendation: per entry with a silent refresh at mission close.
- **Whether `/ai/followup` should be pre-warmed** by firing speculatively for all three follow-up branches during beat 1's consequence (ADR-006 §16). 3× cost, latency becomes a non-issue. Decide after P2's p95 is measured.
- **Provider for the fallback-bank authoring job** and whether it lives in this service as an admin command or outside it entirely. Recommendation: outside — it is an authoring tool, not a runtime concern.
- **Whether `building_sessions` should carry a `completed_at`** so "who finished the Café" is a query rather than a blob scan. Cheap to add now, annoying later. Recommendation: add it in P1.
