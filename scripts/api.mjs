import fs from "node:fs";
import { execSync } from "node:child_process";
import { groth16 } from "snarkjs";
import { 
  pHash2, pHash3, pHash5, buildEmptyTree, updateLeaf, treeRoot, merklePath, 
  persistTx, getAllAccounts, getAccount, updateAccountBalance, 
  generateUniqueId, cleanupTempFiles, bin 
} from "./utils.mjs";

// Token Type Definitions
const TOKEN_TYPES = {
  FUNGIBLE: 0,      // Money-like tokens with balance
  NFT: 1,           // Non-fungible tokens with ownership
  ATTRIBUTE: 2,     // Tokens with multiple attributes
  ESCROW: 3         // Tokens with escrow functionality
};

// State Format Definitions
const STATE_FORMATS = {
  [TOKEN_TYPES.FUNGIBLE]: {
    description: "Fungible Token (Money)",
    format: ["balance", "reserved", "unused", "unused"],
    example: [1000, 0, 0, 0] // 1000 units balance
  },
  [TOKEN_TYPES.NFT]: {
    description: "Non-Fungible Token",
    format: ["ownership", "escrow_provider", "unused", "unused"],
    example: [1, 0, 0, 0] // Owned, no escrow
  },
  [TOKEN_TYPES.ATTRIBUTE]: {
    description: "Attribute Token (Gaming)",
    format: ["ownership", "level", "power", "rarity"],
    example: [1, 5, 100, 3] // Owned, level 5, power 100, rarity 3
  },
  [TOKEN_TYPES.ESCROW]: {
    description: "Escrow Token",
    format: ["ownership", "escrow_provider", "escrow_status", "escrow_amount"],
    example: [1, 123, 1, 500] // Owned, escrow provider 123, active escrow, amount 500
  }
};

const DEPTH = 4; // 16 leaves

// ---------- Legacy Transfer API (uses original transfer circuit) ----------
export async function performTransfer({ senderId, receiverId, amount, txNonce }) {
  // Generate unique file ID for cleanup
  const fileId = generateUniqueId();
  
  try {
    console.log(`▶ Starting legacy transfer: ${senderId} → ${receiverId}, amount: ${amount}`);
    
    // Get accounts from database
    const accounts = getAllAccounts();
    const sender = accounts.find(acc => acc.id === senderId);
    const receiver = accounts.find(acc => acc.id === receiverId);
    
    if (!sender) throw new Error(`Sender account '${senderId}' not found`);
    if (!receiver) throw new Error(`Receiver account '${receiverId}' not found`);
    
    const transferAmount = BigInt(amount);
    if (sender.bal < transferAmount) {
      throw new Error(`Insufficient funds. Available: ${sender.bal}, Required: ${transferAmount}`);
    }
    
    // Build current tree state
    const layers = buildEmptyTree(DEPTH);
    for (const acc of accounts) {
      const leaf = pHash3(acc.pub, acc.bal, acc.nonce);
      updateLeaf(layers, acc.idx, leaf);
    }
    const rootBefore = treeRoot(layers);
    
    // Get BEFORE paths
    const sBefore = merklePath(layers, sender.idx);
    const rBefore = merklePath(layers, receiver.idx);
    
    // Store original balances
    const senderOriginalBalance = sender.bal;
    const receiverOriginalBalance = receiver.bal;
    
    // Apply state update
    sender.bal -= transferAmount;
    receiver.bal += transferAmount;
    
    // Update tree with new leaves and derive AFTER root
    const sLeafAfter = pHash3(sender.pub, sender.bal, sender.nonce);
    const rLeafAfter = pHash3(receiver.pub, receiver.bal, receiver.nonce);
    updateLeaf(layers, sender.idx, sLeafAfter);
    updateLeaf(layers, receiver.idx, rLeafAfter);
    const rootAfter = treeRoot(layers);
    
    // AFTER paths
    const sAfter = merklePath(layers, sender.idx);
    const rAfter = merklePath(layers, receiver.idx);
    
    // Generate unique transaction ID
    const ts = BigInt(Math.floor(Date.now() / 1000));
    const txNonceBig = BigInt(txNonce || Date.now());
    const txId = pHash5(sender.pub, receiver.pub, transferAmount, txNonceBig, ts);
    
    // Prepare witness input JSON for the circuit
    const input = {
      root_before: String(rootBefore),
      root_after: String(rootAfter),
      tx_log_id: String(txId),
      
      sender_pub: String(sender.pub),
      receiver_pub: String(receiver.pub),
      sender_before: String(senderOriginalBalance),
      receiver_before: String(receiverOriginalBalance),
      amount: String(transferAmount),
      sender_nonce: String(sender.nonce),
      receiver_nonce: String(receiver.nonce),
      
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
      
      tx_nonce: String(txNonceBig),
      tx_timestamp: String(ts)
    };
    
    // Write unique input file
    const inputFile = `build/input_${fileId}.json`;
    const proofFile = `build/proof_${fileId}.json`;
    const publicFile = `build/public_${fileId}.json`;
    
    fs.writeFileSync(inputFile, JSON.stringify(input, null, 2));
    
    // Generate witness and prove using snarkjs
    console.log("▶ Generating witness and proving...");
    execSync(`${bin("snarkjs")} groth16 fullprove ${inputFile} build/transfer_js/transfer.wasm build/transfer.zkey ${proofFile} ${publicFile}`, { stdio: "inherit" });
    
    // Read generated proof and public inputs
    const proof = JSON.parse(fs.readFileSync(proofFile));
    const publicInputs = JSON.parse(fs.readFileSync(publicFile));
    
    // Verify proof
    console.log("▶ Verifying proof...");
    const vkey = JSON.parse(fs.readFileSync("build/vkey.json"));
    const verified = await groth16.verify(vkey, publicInputs, proof);
    
    if (!verified) {
      throw new Error("Proof verification failed");
    }
    
    // Update account balances in database
    updateAccountBalance(senderId, sender.bal);
    updateAccountBalance(receiverId, receiver.bal);
    
    // Persist transaction to database
    console.log("▶ Persisting transaction to database...");
    persistTx({
      tx_id: String(txId),
      sender_id: senderId,
      receiver_id: receiverId,
      amount: transferAmount,
      ts: Number(ts),
      root_before: rootBefore,
      root_after: rootAfter,
      proof_json: proof,
      public_inputs: publicInputs,
      circuit_version: "transfer-v1",
      vkey_version: "vk-1"
    });
    
    console.log("✔ Legacy transfer completed successfully");
    
    return {
      success: true,
      txId: String(txId),
      tokenType: TOKEN_TYPES.FUNGIBLE,
      tokenTypeName: STATE_FORMATS[TOKEN_TYPES.FUNGIBLE].description,
      proof,
      publicInputs,
      senderStateAfter: [Number(sender.bal), 0, 0, 0],
      receiverStateAfter: [Number(receiver.bal), 0, 0, 0],
      rootBefore: String(rootBefore),
      rootAfter: String(rootAfter),
      timestamp: Number(ts)
    };
    
  } catch (error) {
    console.error("❌ Legacy transfer failed:", error.message);
    throw error;
  } finally {
    // Always clean up temporary files, even if there was an error
    try {
      cleanupTempFiles(fileId);
    } catch (cleanupError) {
      console.log(`  ⚠️ Warning: Could not clean up files for ${fileId}: ${cleanupError.message}`);
    }
  }
}

export async function performGenericStateTransfer({ 
  senderId, 
  receiverId, 
  tokenId, 
  tokenType, 
  transferParams,
  txNonce 
}) {
  try {
    console.log(`▶ Starting ${STATE_FORMATS[tokenType].description} transfer: ${senderId} → ${receiverId}, token: ${tokenId}`);
    
    // Get accounts from database
    const accounts = getAllAccounts();
    const sender = accounts.find(acc => acc.id === senderId);
    const receiver = accounts.find(acc => acc.id === receiverId);
    
    if (!sender) throw new Error(`Sender account '${senderId}' not found`);
    if (!receiver) throw new Error(`Receiver account '${receiverId}' not found`);
    
    // Build current tree state
    const layers = buildEmptyTree(DEPTH);
    for (const acc of accounts) {
      const leaf = pHash3(acc.pub, acc.bal, acc.nonce);
      updateLeaf(layers, acc.idx, leaf);
    }
    const rootBefore = treeRoot(layers);
    
    // Get BEFORE paths
    const sBefore = merklePath(layers, sender.idx);
    const rBefore = merklePath(layers, receiver.idx);
    
    // Prepare state arrays based on token type
    const senderStateBefore = getTokenState(senderId, tokenId, tokenType);
    const receiverStateBefore = getTokenState(receiverId, tokenId, tokenType);
    
    // Apply state transfer based on token type
    const { senderStateAfter, receiverStateAfter } = applyStateTransfer(
      tokenType, 
      senderStateBefore, 
      receiverStateBefore, 
      transferParams
    );
    
    // Update tree with new state (use same structure as legacy for now)
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
    const txNonceBig = BigInt(txNonce || Date.now());
    const txId = pHash5(sender.pub, receiver.pub, BigInt(tokenId), BigInt(tokenType), txNonceBig);
    const fileId = generateUniqueId();
    
    // Prepare witness input JSON for the circuit
    const input = {
      root_before: String(rootBefore),
      root_after: String(rootAfter),
      tx_log_id: String(txId),
      token_id: String(tokenId),
      token_type: String(tokenType),
      
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
      
      tx_nonce: String(txNonceBig),
      tx_timestamp: String(ts)
    };
    
    // Write unique input file
    const inputFile = `build/input_${fileId}.json`;
    const proofFile = `build/proof_${fileId}.json`;
    const publicFile = `build/public_${fileId}.json`;
    
    fs.writeFileSync(inputFile, JSON.stringify(input, null, 2));
    
    // Generate witness and prove using snarkjs
    console.log("▶ Generating witness and proving...");
    execSync(`${bin("snarkjs")} groth16 fullprove ${inputFile} build/generic_state_transfer_js/generic_state_transfer.wasm build/generic_state_transfer.zkey ${proofFile} ${publicFile}`, { stdio: "inherit" });
    
    // Read generated proof and public inputs
    const proof = JSON.parse(fs.readFileSync(proofFile));
    const publicInputs = JSON.parse(fs.readFileSync(publicFile));
    
    // Verify proof
    console.log("▶ Verifying proof...");
    const vkey = JSON.parse(fs.readFileSync("build/generic_state_transfer_vkey.json"));
    const verified = await groth16.verify(vkey, publicInputs, proof);
    
    if (!verified) {
      throw new Error("Proof verification failed");
    }
    
    // Update token states in database
    updateTokenState(senderId, tokenId, tokenType, senderStateAfter);
    updateTokenState(receiverId, tokenId, tokenType, receiverStateAfter);
    
    // Persist transaction to database
    console.log("▶ Persisting transaction to database...");
    persistTx({
      tx_id: String(txId),
      sender_id: senderId,
      receiver_id: receiverId,
      amount: transferParams[0] || 0,
      ts: Number(ts),
      root_before: rootBefore,
      root_after: rootAfter,
      proof_json: proof,
      public_inputs: publicInputs,
      circuit_version: "generic-state-transfer-v1",
      vkey_version: "vk-1"
    });
    
    // Clean up temporary files
    console.log("▶ Cleaning up temporary files...");
    cleanupTempFiles(fileId);
    
    // Additional cleanup of snarkjs temporary files
    const tempFiles = [
      inputFile,
      proofFile,
      publicFile,
      `build/wtns_${fileId}.wtns`,  // Witness file
      `build/witness_${fileId}.json` // Witness JSON
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
    
    console.log("✔ Generic state transfer completed successfully");
    
    return {
      success: true,
      txId: String(txId),
      tokenType: tokenType,
      tokenTypeName: STATE_FORMATS[tokenType].description,
      proof,
      publicInputs,
      senderStateAfter,
      receiverStateAfter,
      rootBefore: String(rootBefore),
      rootAfter: String(rootAfter),
      timestamp: Number(ts)
    };
    
  } catch (error) {
    console.error("❌ Generic state transfer failed:", error.message);
    throw error;
  }
}

// ---------- Verify API ----------
export async function verifyProof({ txId, proof, publicInputs }) {
  try {
    console.log(`▶ Verifying proof for transaction: ${txId}`);
    
    // Load verification key
    const vkey = JSON.parse(fs.readFileSync("build/vkey.json"));
    
    // Verify the proof
    const verified = await groth16.verify(vkey, publicInputs, proof);
    
    return {
      success: true,
      verified,
      txId,
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
    throw error;
  }
}

// ---------- Helper Functions for State Management ----------

function getTokenState(accountId, tokenId, tokenType) {
  // In a real implementation, this would query the database
  // For demo purposes, return default states based on token type
  const defaults = STATE_FORMATS[tokenType].example;
  
  // Simulate different states for different tokens
  if (tokenType === TOKEN_TYPES.FUNGIBLE) {
    return [1000, 0, 0, 0]; // 1000 balance
  } else if (tokenType === TOKEN_TYPES.NFT) {
    return [1, 0, 0, 0]; // Owned
  } else if (tokenType === TOKEN_TYPES.ATTRIBUTE) {
    return [1, 5, 100, 3]; // Owned, level 5, power 100, rarity 3
  } else if (tokenType === TOKEN_TYPES.ESCROW) {
    return [1, 123, 1, 500]; // Owned, escrow provider 123, active, amount 500
  }
  
  return defaults;
}

function applyStateTransfer(tokenType, senderState, receiverState, transferParams) {
  const senderAfter = [...senderState];
  const receiverAfter = [...receiverState];
  
  switch (tokenType) {
    case TOKEN_TYPES.FUNGIBLE:
      // Fungible: subtract amount from sender, add to receiver
      const amount = transferParams[0] || 0;
      senderAfter[0] = senderState[0] - amount;
      receiverAfter[0] = receiverState[0] + amount;
      break;
      
    case TOKEN_TYPES.NFT:
      // NFT: transfer ownership (1 -> 0 for sender, 0 -> 1 for receiver)
      senderAfter[0] = 0; // Sender loses ownership
      receiverAfter[0] = 1; // Receiver gains ownership
      break;
      
    case TOKEN_TYPES.ATTRIBUTE:
      // Attribute: transfer all attributes
      for (let i = 0; i < 4; i++) {
        senderAfter[i] = 0; // Sender loses all attributes
        receiverAfter[i] = senderState[i]; // Receiver gains all attributes
      }
      break;
      
    case TOKEN_TYPES.ESCROW:
      // Escrow: transfer ownership and update escrow provider
      senderAfter[0] = 0; // Sender loses ownership
      receiverAfter[0] = 1; // Receiver gains ownership
      receiverAfter[1] = transferParams[1] || 0; // New escrow provider
      break;
  }
  
  return { senderStateAfter: senderAfter, receiverStateAfter: receiverAfter };
}

function createStateLeaf(pubKey, nonce, tokenId, state) {
  // Create a leaf hash that includes the state array
  // For now, use a simple hash of pub + nonce + tokenId to match the circuit
  return pHash3(pubKey, nonce, BigInt(tokenId));
}

function updateTokenState(accountId, tokenId, tokenType, newState) {
  // In a real implementation, this would update the database
  console.log(`  - Updated ${accountId}'s token ${tokenId} (${STATE_FORMATS[tokenType].description}) state:`, newState);
}

// ---------- Verification Examples ----------
export function getVerificationExamples() {
  return {
    examples: [
      {
        name: "Valid Generic State Transfer Proof",
        description: "Verify a proof that Alice transferred any type of token to Bob",
        what_is_verified: [
          "Alice had valid state before the transfer",
          "The state was correctly updated according to token type",
          "The Merkle tree root was updated correctly",
          "The transaction is bound to a specific transaction ID",
          "All computations were done correctly without revealing private data"
        ],
        privacy_preserved: [
          "Alice's private key is never revealed",
          "Bob's private key is never revealed",
          "The exact states before/after are hidden",
          "The Merkle tree paths are hidden",
          "Only the public transaction ID and root changes are visible"
        ]
      },
      {
        name: "Invalid Proof Detection",
        description: "The system will reject proofs that attempt to:",
        invalid_scenarios: [
          "Transfer more than the sender's balance (fungible)",
          "Transfer ownership without having it (NFT)",
          "Manipulate states incorrectly",
          "Use incorrect Merkle tree paths",
          "Reuse old proofs for new transactions"
        ]
      },
      {
        name: "Zero-Knowledge Properties",
        description: "What the verifier learns vs. what remains private",
        public_information: [
          "A valid transfer occurred",
          "The Merkle tree root changed from X to Y", 
          "The transaction is bound to a specific ID",
          "The proof was generated correctly"
        ],
        private_information: [
          "Who sent the token (sender identity)",
          "Who received the token (receiver identity)",
          "What type of token was transferred",
          "What the states were before/after",
          "The positions in the Merkle tree"
        ]
      }
    ],
    sample_verification_calls: [
      {
        description: "Verify a transaction from the database",
        endpoint: "POST /api/verify",
        sample_payload: "Get txId, proof, and publicInputs from /api/transactions endpoint"
      },
      {
        description: "Verify with custom proof data", 
        endpoint: "POST /api/verify",
        sample_payload: {
          txId: "123456789...",
          proof: {
            pi_a: ["...", "...", "1"],
            pi_b: [["...", "..."], ["...", "..."], ["1", "0"]],
            pi_c: ["...", "...", "1"],
            protocol: "groth16",
            curve: "bn128"
          },
          publicInputs: []
        }
      }
    ]
  };
}
