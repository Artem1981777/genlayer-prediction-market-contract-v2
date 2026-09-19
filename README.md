# PredictionMarketResolver — contract-only GenLayer Intelligent Contract

`PredictionMarketResolver` is a standalone GenLayer Intelligent Contract for resolving a YES/NO prediction market from live web evidence and settling stakes through an on-chain lifecycle. This repository contains **only the contract and verification/deployment tooling**. It intentionally contains no user-facing `index.html`, frontend, or prediction-market application interface.

## Lifecycle correction

The resolver has two explicit protections required for safe lifecycle management:

1. `resolve()` is creator-guarded. Only the market creator can trigger a resolution attempt.
2. `UNRESOLVED` is retryable. When validators conclude that the event has not settled, sources are insufficient, or evidence conflicts, the contract keeps `status == "open"`. The creator can retry `resolve()` or call `void()` so stakers can recover their funds through `refund()`.

A definitive `YES` or `NO` result changes the status to `resolved`. The creator can then call `settle()`, after which winning stakers can call `claim()`.

```text
open --resolve(YES/NO)--> resolved --settle--> settled --claim--> paid
  |                             |
  |-- resolve(UNRESOLVED) ------|  retryable while open
  |-- void --------------------> voided --refund--> returned
```

The contract records the question and rules hashes, resolution history, source provenance through the consensus prompt, dispute rounds, positions, claims, and payout information. Web pages and dispute text are treated as untrusted data, never as instructions.

## Consensus design

`resolve()` fetches the configured sources through `gl.nondet.web.render` and constructs a neutral prompt containing the question, rules, and bounded evidence. The decision runs under `gl.eq_principle.prompt_comparative`. Validators must agree on the final outcome value: `YES`, `NO`, or `UNRESOLVED`. Failed source fetches are explicitly excluded from evidence, and prompt injection text is marked as untrusted.

The lifecycle guard is deterministic and executes before the nondeterministic resolver:

```python
caller = str(gl.message.sender_address)
assert caller == self.creator, "Only the market creator can resolve"
assert self.status == "open", "Market already resolved"
```

After consensus, only `YES` or `NO` closes the market. `UNRESOLVED` writes an audit-history entry but restores/keeps the market in `open`, making another resolution attempt possible.

## Contract API

Views include `get_state()`, `verify_question(q)`, and `verify_rules(r)`. Writes include `add_source(url)`, `stake(side)`, `resolve()`, `dispute(reason)`, `resolve_dispute()`, `settle()`, `void()`, `claim()`, and `refund()`.

## Verification

The repository uses Python 3.12+, Node.js 18+, `genvm-linter`, and GenLayerJS. Run:

```bash
npm install
npm run lint
npm run simulate
node --check deploy.mjs
```

`npm run lint` runs the official GenVM AST and semantic validation. `npm run simulate` exercises the contract lifecycle with deterministic mocks, including creator-only resolution, retryable `UNRESOLVED`, a second allowed resolution attempt, and the creator-only void escape.

The CI workflow runs lint, Python syntax checks, lifecycle simulation, and JavaScript syntax checks on every push and pull request. A manually triggered deployment job uses the repository secret `GENLAYER_PRIVATE_KEY`, deploys the exact checked-out `contracts/prediction_market.py`, verifies the final execution result, and uploads the contract address, transaction hash, source copy, and SHA-256 digest as one matching artifact.

## Deployment

Deployment targets GenLayer Testnet Bradbury, the persistent public testnet recommended for production-like validation. The official Bradbury configuration is:

- RPC: `https://rpc-bradbury.genlayer.com`
- Chain ID: `4221`
- Explorer: `https://explorer-bradbury.genlayer.com`

For local deployment:

```bash
cp .env.example .env
# set PRIVATE_KEY in .env; never commit .env
npm run deploy
```

For GitHub Actions, add `GENLAYER_PRIVATE_KEY` as a repository secret and run the workflow manually with `deploy=true`. Never put a private key in source, README, issues, or Evidence.

## Official documentation

This repository follows the official [GenLayer Development Setup](https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup), [Deploying Intelligent Contracts](https://docs.genlayer.com/developers/intelligent-contracts/deploying), and [Networks](https://docs.genlayer.com/developers/networks) documentation.

## Repository scope

This is a contract-only submission for the **Intelligent Contracts** category. A separate frontend or prediction-market interface is intentionally out of scope.
