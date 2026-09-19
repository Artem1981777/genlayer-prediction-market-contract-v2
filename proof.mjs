import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const OTHER_PRIVATE_KEY = process.env.OTHER_PRIVATE_KEY; // optional, for revert proof
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY missing");

// Deliberately mismatched source so the loaded evidence contains nothing
// relevant to the question -> the contract's own rule forces UNRESOLVED.
const QUESTION = "According to the cited sources, did the Antarctic ozone hole close completely and permanently in 2026?";
const RULES = "Resolve YES only if the evidence clearly confirms permanent closure in 2026. Resolve NO only if the evidence clearly confirms it did not. Otherwise UNRESOLVED.";
const SOURCE1 = "https://example.com";
const SOURCE2 = "";
const SOURCE3 = "";
const MARKET_ID = "resolve-guard-proof-v1";

const account = createAccount(PRIVATE_KEY);
const client = createClient({ chain: testnetBradbury, account });

const source = readFileSync("contracts/prediction_market.py", "utf8");
const code = new TextEncoder().encode(source);

console.log("=== Deploying proof market ===");
const deployTx = await client.deployContract({ code, args: [QUESTION, RULES, SOURCE1, SOURCE2, SOURCE3, MARKET_ID] });
console.log("deploy tx:", deployTx);
await client.waitForTransactionReceipt({ hash: deployTx, status: TransactionStatus.ACCEPTED, retries: 300 });
const deployedTx = await client.getTransaction({ hash: deployTx });
const address = deployedTx?.txDataDecoded?.contractAddress ?? deployedTx?.recipient;
console.log("proof contract:", address);

async function getState() {
  return client.readContract({ address, functionName: "get_state", args: [] });
}

async function resolveAs(signer, label) {
  console.log(`\n=== ${label}: calling resolve() ===`);
  try {
    const hash = await client.writeContract({ account: signer, address, functionName: "resolve", args: [], value: 0 });
    console.log("tx:", hash);
    await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 300 });
    const tx = await client.getTransaction({ hash });
    console.log("execution result:", tx?.txExecutionResultName);
    return { hash, execution: tx?.txExecutionResultName };
  } catch (e) {
    console.log("REVERTED as expected:", e.message ?? e);
    return { reverted: true, error: String(e.message ?? e) };
  }
}

const results = {};

// 1) First resolve as creator -> expect UNRESOLVED, status stays "open"
results.resolve1 = await resolveAs(account, "resolve #1 (creator)");
console.log("state after resolve #1:", await getState());

// 2) Non-creator resolve, if a second key is provided -> expect revert
if (OTHER_PRIVATE_KEY) {
  const other = createAccount(OTHER_PRIVATE_KEY);
  results.nonCreatorResolve = await resolveAs(other, "resolve (non-creator, should revert)");
}

// 3) Retry resolve as creator -> still UNRESOLVED-capable, still "open"
results.resolve2 = await resolveAs(account, "resolve #2 (retry, creator)");
console.log("state after resolve #2:", await getState());

writeFileSync("proof-output.json", JSON.stringify({ address, deployTx, ...results }, null, 2));
console.log("\n=== Done. Saved proof-output.json ===");
