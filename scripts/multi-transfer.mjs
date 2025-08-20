// Multi-Transfer Script - Run multiple transfers with proof metadata
import { execSync } from "node:child_process";
import { pHash2, pHash3, pHash5, buildEmptyTree, updateLeaf, treeRoot, merklePath, F, persistTx, bin } from "./utils.mjs";
import { ProofMetadataService } from './services/proof-metadata-service.mjs';
import { groth16 } from "snarkjs";
import fs from "node:fs";

async function runTransfer(from, to, amount) {
  console.log(`📝 Transfer: ${from} → ${to} (${amount})`);
  
  // Get accounts from database
  const { getAllAccounts, updateAccountBalance } = await import('./utils.mjs');
  const accounts = getAllAccounts();
  const sender = accounts.find(acc => acc.id === from);
  const receiver = accounts.find(acc => acc.id === to);
  
  if (!sender || !receiver) {
    throw new Error(`Account not found: ${from} or ${to}`);
  }
  
  // Build current tree state
  const layers = buildEmptyTree(4);
  for (const acc of accounts) {
    const leaf = pHash3(acc.pub, acc.bal, acc.nonce);
    updateLeaf(layers, acc.idx, leaf);
  }
  const rootBefore = treeRoot(layers);
  
  // Get BEFORE paths
  const sBefore = merklePath(layers, sender.idx);
  const rBefore = merklePath(layers, receiver.idx);
  
  // Apply transfer
  const senderOriginalBalance = sender.bal;
  const receiverOriginalBalance = receiver.bal;
  sender.bal -= BigInt(amount);
  receiver.bal += BigInt(amount);
  
  // Update tree with new leaves
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
  const txId = pHash5(sender.pub, receiver.pub, BigInt(amount), txNonce, ts);
  
  // Prepare input
  const input = {
    root_before: String(rootBefore),
    root_after: String(rootAfter),
    tx_log_id: String(txId),
    sender_pub: String(sender.pub),
    receiver_pub: String(receiver.pub),
    sender_before: String(senderOriginalBalance),
    receiver_before: String(receiverOriginalBalance),
    amount: String(amount),
    sender_nonce: String(sender.nonce),
    receiver_nonce: String(receiver.nonce),
    s_siblings_before: sBefore.siblings.map(String),
    s_pathBits_before: sBefore.pathBits.map(String),
    r_siblings_before: rBefore.siblings.map(String),
    r_pathBits_before: rBefore.pathBits.map(String),
    s_siblings_after: sAfter.siblings.map(String),
    s_pathBits_after: sAfter.pathBits.map(String),
    r_siblings_after: rAfter.siblings.map(String),
    r_pathBits_after: rAfter.pathBits.map(String),
    tx_nonce: String(txNonce),
    tx_timestamp: String(ts)
  };
  
  // Generate unique file ID
  const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const inputFile = `build/input_${fileId}.json`;
  const proofFile = `build/proof_${fileId}.json`;
  const publicFile = `build/public_${fileId}.json`;
  
  fs.writeFileSync(inputFile, JSON.stringify(input, null, 2));
  
  // Generate proof
  execSync(`${bin("snarkjs")} groth16 fullprove ${inputFile} build/transfer_js/transfer.wasm build/transfer.zkey ${proofFile} ${publicFile}`, { stdio: "inherit" });
  
  // Verify proof
  const vkey = JSON.parse(fs.readFileSync("build/vkey.json"));
  const proof = JSON.parse(fs.readFileSync(proofFile));
  const pub = JSON.parse(fs.readFileSync(publicFile));
  const verified = await groth16.verify(vkey, pub, proof);
  
  if (!verified) {
    throw new Error("Proof verification failed");
  }
  
  // Create proof with embedded metadata
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
      sender_id: from,
      receiver_id: to,
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
  
  // Update account balances
  updateAccountBalance(from, sender.bal);
  updateAccountBalance(to, receiver.bal);
  
  // Persist transaction with metadata
  persistTx({
    tx_id: String(txId),
    sender_id: from,
    receiver_id: to,
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
  
  // Clean up
  const tempFiles = [inputFile, proofFile, publicFile];
  for (const file of tempFiles) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  console.log(`✅ Transaction with metadata completed: ${txId}`);
  console.log(`📋 Embedded metadata: ${proofWithMetadata.metadata.proving_system} ${proofWithMetadata.metadata.circuit_name} v${proofWithMetadata.metadata.circuit_version}\n`);
  
  return txId;
}

async function runMultipleTransfers() {
  console.log('🚀 Running multiple transfers to populate proof metadata...\n');
  
  try {
    // Transfer 1: alice to carol
    await runTransfer('alice', 'carol', 500);
    
    // Transfer 2: bob to dan
    await runTransfer('bob', 'dan', 300);
    
    // Transfer 3: carol to alice
    await runTransfer('carol', 'alice', 200);
    
    // Transfer 4: dan to bob
    await runTransfer('dan', 'bob', 150);
    
    console.log('🎉 All transfers completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- 4 transactions executed');
    console.log('- Proof metadata generated for all transactions');
    console.log('- All 4 users (alice, bob, carol, dan) participated');
    process.exit(0);
  } catch (error) {
    console.error('❌ Transfers failed:', error.message);
    process.exit(1);
  }
}

// Run the transfers
if (import.meta.url === `file://${process.argv[1]}`) {
  runMultipleTransfers().catch(console.error);
}

export { runMultipleTransfers };
