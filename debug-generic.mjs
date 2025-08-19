#!/usr/bin/env node

// Debug script for generic state transfer circuit
import fs from "node:fs";
import { execSync } from "node:child_process";
import { groth16 } from "snarkjs";
import { 
  pHash2, pHash3, pHash5, buildEmptyTree, updateLeaf, treeRoot, merklePath, 
  getAllAccounts, bin 
} from "./scripts/utils.mjs";

const DEPTH = 4;

console.log('🐛 Debugging Generic State Transfer Circuit...\n');

try {
  // Get accounts
  const accounts = getAllAccounts();
  console.log('✅ Accounts loaded:', accounts.map(acc => `${acc.id}: ${acc.bal} units`).join(', '));
  
  // Build tree
  const layers = buildEmptyTree(DEPTH);
  for (const acc of accounts) {
    const leaf = pHash3(acc.pub, acc.bal, acc.nonce);
    updateLeaf(layers, acc.idx, leaf);
  }
  const rootBefore = treeRoot(layers);
  
  // Get paths
  const sender = accounts.find(acc => acc.id === 'alice');
  const receiver = accounts.find(acc => acc.id === 'bob');
  const sBefore = merklePath(layers, sender.idx);
  const rBefore = merklePath(layers, receiver.idx);
  
  // Simple state arrays for NFT transfer
  const senderStateBefore = [1, 0, 0, 0];  // Owned
  const receiverStateBefore = [0, 0, 0, 0]; // Not owned
  const senderStateAfter = [0, 0, 0, 0];    // Not owned
  const receiverStateAfter = [1, 0, 0, 0];  // Owned
  const transferParams = [0, 0, 0, 0];
  
  // Update tree with new state (use same structure as legacy)
  const sLeafAfter = pHash3(sender.pub, sender.bal, sender.nonce);
  const rLeafAfter = pHash3(receiver.pub, receiver.bal, receiver.nonce);
  updateLeaf(layers, sender.idx, sLeafAfter);
  updateLeaf(layers, receiver.idx, rLeafAfter);
  const rootAfter = treeRoot(layers);
  
  // AFTER paths
  const sAfter = merklePath(layers, sender.idx);
  const rAfter = merklePath(layers, receiver.idx);
  
  // Generate transaction ID
  const ts = BigInt(Math.floor(Date.now() / 1000));
  const txNonce = BigInt(Date.now());
  const txId = pHash5(sender.pub, receiver.pub, BigInt(123), BigInt(1), txNonce);
  
  // Prepare input
  const input = {
    root_before: String(rootBefore),
    root_after: String(rootAfter),
    tx_log_id: String(txId),
    token_id: "123",
    token_type: "1", // NFT
    
    sender_pub: String(sender.pub),
    receiver_pub: String(receiver.pub),
    sender_nonce: String(sender.nonce),
    receiver_nonce: String(receiver.nonce),
    
    sender_state_before: senderStateBefore.map(String),
    receiver_state_before: receiverStateBefore.map(String),
    sender_state_after: senderStateAfter.map(String),
    receiver_state_after: receiverStateAfter.map(String),
    
    transfer_params: transferParams.map(String),
    
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
  
  console.log('📝 Input prepared, writing to file...');
  console.log('Token type:', input.token_type);
  console.log('Sender state before:', input.sender_state_before);
  console.log('Receiver state before:', input.receiver_state_before);
  console.log('Sender state after:', input.sender_state_after);
  console.log('Receiver state after:', input.receiver_state_after);
  
  fs.writeFileSync('build/input_debug.json', JSON.stringify(input, null, 2));
  
  console.log('▶ Generating witness and proving...');
  execSync(`${bin("snarkjs")} groth16 fullprove build/input_debug.json build/generic_state_transfer_js/generic_state_transfer.wasm build/generic_state_transfer.zkey build/proof_debug.json build/public_debug.json`, { stdio: "inherit" });
  
  console.log('✅ Success!');
  
} catch (error) {
  console.error('❌ Debug failed:', error.message);
  process.exit(1);
}
