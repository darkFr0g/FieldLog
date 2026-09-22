# RESEARCH.md — findings from outside research (Perplexity, web search, docs)

This is where **researched, sourced findings** land so Claude and ChatGPT/Codex
(both of which read `AGENTS.md`/`CLAUDE.md`) can build against them without
re-researching. It's the handoff point in a three-tool workflow:

- **Perplexity** (or any web-search tool) — answers *current, sourced* questions
  (pricing, API docs, current best practice). It has no repo access; it can't
  commit code. Paste its answer here.
- **Claude / ChatGPT** — the builders. Before implementing anything that depends
  on external facts (an API's pricing, auth model, rate limits, current docs),
  check here first. If the question isn't answered yet, ask the user to run it
  through Perplexity and paste the result in, rather than guessing or building
  on stale training-data assumptions.

Keep entries short: the question, the answer (with links), the date, and a
status. Once a finding is acted on, mark it **Adopted** and note where (e.g. a
CLAUDE.md backlog line or a shipped feature) — don't delete it, it's a record
of why a decision was made.

---

## Open questions (need a Perplexity/web-search pass)

### Google Directions API — pricing & waypoint optimization setup
**Why it matters:** CLAUDE.md backlog **#1 priority** — replacing the free
`smartOrderMapStops` heuristic with real route optimization via
`waypoints=optimize:true`.
**Ask Perplexity:**
1. Current Google Maps Platform pricing for the Directions API (per-request
   cost, what the $200/mo free credit covers for ~1 optimized route/weekday).
2. Exact steps to create a *restricted* API key (HTTP referrer or app
   restriction) scoped to Directions API only, via Google Cloud Console —
   current UI, since Google reshuffles this periodically.
3. Current waypoint cap for `optimize:true` requests (was ~25 as of last
   training data — confirm it hasn't changed) and how it interacts with the
   separate ~9–10 waypoint cap on the `maps.google.com/dir` web URL used for
   handoff to the Maps app.
**Status:** Not yet researched.

### IBM Maximo / CworX API access
**Why it matters:** CLAUDE.md backlog — "distant maybe," scoping-only. Would
tell us if a real integration is even worth opening.
**Ask Perplexity:** What does Con Edison's IT department typically require to
grant REST/OSLC API access to Maximo Work Order Tracking for a personal tool
(this is likely unanswerable by web search — it's Con Ed-internal — but worth
one pass in case Maximo's *public* API docs clarify the auth model in general,
which tells us what to *ask IT for*).
**Status:** Not yet researched — likely needs an internal Con Ed contact, not
web search.

---

## Findings log

*(newest first — add entries above this line as they come in)*

**Template for a new entry:**
```
### <topic> — <date>
**Asked:** <the question given to Perplexity>
**Answer:** <summary, with source links Perplexity provided>
**Status:** Adopted (where) / Noted / Superseded
```
