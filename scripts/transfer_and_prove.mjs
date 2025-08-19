import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pHash2, pHash3, pHash5, buildEmptyTree, updateLeaf, treeRoot, merklePath, F, persistTx, bin } from "./utils.mjs";
import { groth16 } from "snarkjs";
import { exit } from "node:process";

const DEPTH = 4; // 16 leaves

// Demo accounts (you can load these from a DB in real life)
const accounts = [
  { id: "alice",   pub: 11n, bal: 500000n, nonce: 7n, idx: 3 },
  { id: "bob",     pub: 22n, bal: 120000n, nonce: 42n, idx: 9 },
  { id: "carol",   pub: 33n, bal:  70000n, nonce: 1n, idx: 0 },
  { id: "dan",     pub: 44n, bal:  90000n, nonce: 2n, idx: 15 },
];

// Build initial tree
const layers = buildEmptyTree(DEPTH);
for (const a of accounts) {
  const leaf = pHash3(a.pub, a.bal, a.nonce);
  updateLeaf(layers, a.idx, leaf);
}
const rootBefore = treeRoot(layers);

// Pick a transfer: Alice -> Bob, amount 7500
const amount = 7500n;
const ts = BigInt(Math.floor(Date.now()/1000));
const txNonce = 88291344n;

const alice = accounts[0];
const bob   = accounts[1];

if (alice.bal < amount) throw new Error("Insufficient funds");

// Get BEFORE paths
const sBefore = merklePath(layers, alice.idx);
const rBefore = merklePath(layers, bob.idx);

// Apply state update (off-chain)
alice.bal -= amount;
bob.bal   += amount;

// Update tree with new leaves and derive AFTER root
const sLeafAfter = pHash3(alice.pub, alice.bal, alice.nonce);
const rLeafAfter = pHash3(bob.pub, bob.bal, bob.nonce);
updateLeaf(layers, alice.idx, sLeafAfter);
updateLeaf(layers, bob.idx,   rLeafAfter);
const rootAfter = treeRoot(layers);

// AFTER paths (recomputed paths against updated tree)
const sAfter = merklePath(layers, alice.idx);
const rAfter = merklePath(layers, bob.idx);

// tx_log_id binding
const txId = pHash5(alice.pub, bob.pub, amount, txNonce, ts);

// Prepare witness input JSON for the circuit
const input = {
    root_before: String(rootBefore),
    root_after:  String(rootAfter),
    tx_log_id:   String(txId),
  
    sender_pub: String(alice.pub),
    receiver_pub: String(bob.pub),
    sender_before: String(500000n), // original
    receiver_before: String(120000n),
    amount: String(amount),
    sender_nonce: String(alice.nonce),
    receiver_nonce: String(bob.nonce),
  
    // paths BEFORE
    s_siblings_before: sBefore.siblings.map(String),
    s_pathBits_before: sBefore.pathBits.map(String),
    r_siblings_before: rBefore.siblings.map(String),
    r_pathBits_before: rBefore.pathBits.map(String),
  
    // paths AFTER
    s_siblings_after: sAfter.siblings.map(String),
    s_pathBits_after: sAfter.pathBits.map(String),
    r_siblings_after: rAfter.siblings.map(String),
    r_pathBits_after: rAfter.pathBits.map(String),
  
    tx_nonce: String(txNonce),
    tx_timestamp: String(ts)
  };
  
  fs.writeFileSync("build/input.json", JSON.stringify(input, null, 2));
  
// Generate witness and prove using snarkjs
console.log("▶ Generating witness and proving...");
execSync(`${bin("snarkjs")} groth16 fullprove build/input.json build/transfer_js/transfer.wasm build/transfer.zkey build/proof.json build/public.json`, { stdio: "inherit" });

// Verify (JS)
console.log("▶ Verifying (snarkjs API)...");
const vkey = JSON.parse(fs.readFileSync("build/vkey.json"));
const proof = JSON.parse(fs.readFileSync("build/proof.json"));
const pub = JSON.parse(fs.readFileSync("build/public.json"));
const verified = await groth16.verify(vkey, pub, proof);
console.log("Verification result:", verified);
if (!verified) throw new Error("Proof verification failed");

// Persist to SQLite
console.log("▶ Persisting tx to SQLite...");
try {
  persistTx({
    tx_id: String(txId),
    sender_id: alice.id,
    receiver_id: bob.id,
    amount: amount,
    ts: Number(ts),
    root_before: rootBefore,
    root_after: rootAfter,
    proof_json: proof,
    public_inputs: pub,
    circuit_version: "transfer-v1",
    vkey_version: "vk-1"
  });
  console.log("✔ Transaction persisted to SQLite successfully");
} catch (error) {
  console.error("❌ Failed to persist to SQLite:", error);
  throw error;
}

// Clean up temporary files
console.log("▶ Cleaning up temporary files...");
const tempFiles = [
  'build/input.json',
  'build/proof.json',
  'build/public.json',
  'build/wtns.wtns',  // Witness file
  'build/witness.json' // Witness JSON
];

for (const file of tempFiles) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`  - Cleaned up: ${file}`);
    }
  } catch (error) {
    console.log(`  - Warning: Could not clean up ${file}: ${error.message}`);
  }
}

console.log("▶ Tx persisted...");
exit(0);