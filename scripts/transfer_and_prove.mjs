import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pHash2, pHash3, pHash5, buildEmptyTree, updateLeaf, treeRoot, merklePath, F, persistTx, bin } from "./utils.mjs";
import { ProofMetadataService } from './services/proof-metadata-service.mjs';
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

    // Create proof with embedded metadata
    console.log("▶ Creating proof with embedded metadata...");
    const proofWithMetadata = {
      // Standard Groth16 proof components
      pi_a: proof.pi_a,
      pi_b: proof.pi_b,
      pi_c: proof.pi_c,
      protocol: proof.protocol,
      curve: proof.curve,
      
      // Embedded metadata
      metadata: {
        proving_system: 'circom',
        circuit_name: 'transfer',
        circuit_version: '2.1.5',
        circuit_file: 'circuits/transfer.circom',
        circuit_hash: '7a0e0fc1844e7d45ab3e6c8a22f757deb8ab783a307c46ed12ace40cbb3b6e82',
        proving_key_file: 'build/transfer.zkey',
        proving_key_hash: 'bfaebc0e660fe682201e9281cdafa0b1a81206bb4054bcc379eb68bc127324be',
        verification_key_file: 'build/vkey.json',
        verification_key_hash: '420aee34ac3aca293d79435c3562af07eb0a66ecd372f90695aea5d999c88801',
        tool_version: '^0.7.3',
        generated_at: new Date().toISOString(),
        
        // Transaction-specific metadata
        tx_id: String(txId),
        tx_timestamp: Number(ts),
        sender_id: alice.id,
        receiver_id: bob.id,
        token_id: 'GOLD',
        amount: amount
      },
      
      // Public inputs with metadata context
      public_inputs: pub,
      
      // Verification context
      verification_context: {
        vkey_hash: '420aee34ac3aca293d79435c3562af07eb0a66ecd372f90695aea5d999c88801',
        circuit_hash: '7a0e0fc1844e7d45ab3e6c8a22f757deb8ab783a307c46ed12ace40cbb3b6e82',
        proving_system: 'circom'
      }
    };

    // Persist to SQLite
    console.log("▶ Persisting proof with metadata to SQLite...");
    try {
      persistTx({
        tx_id: String(txId),
        sender_id: alice.id,
        receiver_id: bob.id,
        amount: amount,
        ts: Number(ts),
        root_before: rootBefore,
        root_after: rootAfter,
        proof_json: proofWithMetadata,
        public_inputs: pub,
        circuit_version: "transfer-v1",
        vkey_version: "vk-1",
        proofMetadata: proofWithMetadata.metadata
      });
      console.log("✔ Proof with metadata persisted to SQLite successfully");
      console.log(`📋 Embedded metadata: ${proofWithMetadata.metadata.proving_system} ${proofWithMetadata.metadata.circuit_name} v${proofWithMetadata.metadata.circuit_version}`);
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