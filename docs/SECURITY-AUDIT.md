# Security Audit — PredictionMarketResolver contract-only

## Scope

This audit covers the standalone Intelligent Contract in `contracts/prediction_market.py`. The repository contains no frontend or user-facing `index.html`. The trust boundary includes untrusted web pages, creator-supplied question and rules, and arbitrary dispute text.

## Lifecycle findings

### F1 — Premature resolution

**Risk:** An arbitrary caller could resolve a market before the event had settled.

**Mitigation:** `resolve()` checks `str(gl.message.sender_address) == self.creator` before entering the web-grounded consensus flow. A non-creator transaction reverts. The same creator guard is applied to `settle()`, `resolve_dispute()`, and `void()`.

### F2 — Permanent closure on UNRESOLVED

**Risk:** An unresolved event could leave stakers unable to recover funds.

**Mitigation:** `resolve()` changes status to `resolved` only for `YES` or `NO`. For `UNRESOLVED`, it keeps `status == "open"`, appends an audit entry, and allows the creator to retry. The creator can call `void()` while the outcome is `UNRESOLVED`; stakers can then recover their recorded positions through `refund()`.

The same invariant is enforced after a dispute. If `resolve_dispute()` produces `UNRESOLVED`, status remains `disputed`, so the creator can retry the disputed resolution instead of being permanently forced into a terminal state.

### F3 — Prompt injection in web evidence

**Risk:** A cited page may contain text that attempts to override the resolver prompt.

**Mitigation:** Evidence is labelled untrusted, truncated to a bounded length, and the prompt explicitly states that embedded instructions are data rather than commands. The response is restricted to `YES`, `NO`, or `UNRESOLVED`.

### F4 — Prompt injection in dispute text

**Risk:** Anyone can submit a dispute string that is later supplied to the resolver.

**Mitigation:** Dispute text is enclosed in an explicitly untrusted context block and cannot override the question, rules, or evidence. Disputes are capped at two per market.

### F5 — Partial source failures and consensus stalls

**Risk:** Validators may receive different web results or different sets of available pages.

**Mitigation:** Failed fetches are represented as non-evidence. The resolver is instructed to decide from any loaded relevant source and to use `UNRESOLVED` only for insufficiency, contradiction, or an unsettled event. Comparative consensus checks only the compact outcome value, not wording or source-load details.

### F6 — Payout replay

**Risk:** A staker could attempt to claim or refund more than once.

**Mitigation:** `claims` records the caller's consumed position. Both `claim()` and `refund()` reject a caller with an existing claimed record.

### F7 — Duplicate source weighting

**Risk:** The creator could configure the same endpoint in multiple source slots, giving one endpoint disproportionate influence.

**Mitigation:** `add_source()` rejects a URL already present in any source slot. The constructor's three source arguments remain part of the immutable market record; callers should provide distinct URLs when deploying.

## Residual risks

The final outcome remains dependent on the creator's question, rules, and source selection. A poorly specified market can produce a poor but consensus-valid result. The contract does not implement an automatic wall-clock maturity deadline; the creator authorization guard is the objective resolution guard for this version. If the creator never retries an unresolved event or calls `void()`, availability depends on creator action.

## Verification plan

Run `npm run lint` for official GenVM lint and semantic validation. Run `npm run simulate` for deterministic checks covering non-creator rejection, duplicate-source rejection, creator resolution, retryable `UNRESOLVED`, retryable disputed `UNRESOLVED`, repeated resolution, non-creator void rejection, and creator void. The manual deployment workflow verifies a successful Bradbury execution result and uploads the exact deployed source, address, transaction hash, and SHA-256 digest together.
