import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY missing. Set it in .env or pass it through the environment.");

const QUESTION = "According to the cited sources, has Ethereum completed The Merge and now runs on Proof-of-Stake?";
const RULES = "Resolve YES if the evidence clearly states Ethereum completed The Merge and uses Proof-of-Stake. Resolve NO if the evidence clearly states it has not. Otherwise UNRESOLVED.";
const SOURCE1 = "https://en.wikipedia.org/wiki/The_Merge";
const SOURCE2 = "https://en.wikipedia.org/wiki/Ethereum";
const SOURCE3 = "";
const MARKET_ID = "contract-only-v1";

const source = readFileSync("contracts/prediction_market.py", "utf8");
const code = new TextEncoder().encode(source);
const sourceSha256 = createHash("sha256").update(Buffer.from(code)).digest("hex");
const account = createAccount(PRIVATE_KEY);
const client = createClient({ chain: testnetBradbury, account });

console.log("Deploying contract-only PredictionMarketResolver to Bradbury...");
console.log("source bytes:", code.length);
console.log("source sha256:", sourceSha256);
const txHash = await client.deployContract({ code, args: [QUESTION, RULES, SOURCE1, SOURCE2, SOURCE3, MARKET_ID] });
console.log("deploy tx:", txHash);
await client.waitForTransactionReceipt({ hash: txHash, status: TransactionStatus.ACCEPTED, retries: 300 });
const tx = await client.getTransaction({ hash: txHash });
const address = tx?.txDataDecoded?.contractAddress ?? tx?.recipient;
const execution = tx?.txExecutionResultName;
if (execution !== "FINISHED" && execution !== "FINISHED_WITH_RETURN") throw new Error(`Deployment finalized with unsuccessful execution result: ${execution}`);
if (!address) throw new Error("Deployment finalized without a contract address");
writeFileSync("contract.txt", String(address) + "\n");
writeFileSync("deploy-tx.txt", String(txHash) + "\n");
writeFileSync("deployment-proof.txt", [
  "PredictionMarketResolver contract-only deployment",
  "network: GenLayer Testnet Bradbury",
  `contract: ${address}`,
  `deploy tx: ${txHash}`,
  `execution result: ${execution}`,
  "source file: contracts/prediction_market.py",
  `source bytes: ${code.length} UTF-8`,
  `source sha256: ${sourceSha256}`,
  `explorer: https://explorer-bradbury.genlayer.com/address/${address}`,
  `transaction explorer: https://explorer-bradbury.genlayer.com/tx/${txHash}`,
].join("\n") + "\n");
console.log("contract:", address);
console.log("execution result:", execution);
console.log("Explorer: https://explorer-bradbury.genlayer.com/address/" + address);
