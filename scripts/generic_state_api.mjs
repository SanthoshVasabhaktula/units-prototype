import fs from "node:fs";
import { execSync } from "node:child_process";
import { groth16 } from "snarkjs";
import { 
  pHash2, pHash3, pHash5, buildEmptyTree, updateLeaf, treeRoot, merklePath, 
  persistTx, getAllAccounts, getAccount, updateAccountBalance, 
  generateUniqueId, cleanupTempFiles, bin 
} from "./utils.mjs";

const DEPTH = 4; // 16 leaves
const STATE_SIZE = 4; // Maximum state attributes

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

// ---------- Generic State Transfer Function ----------
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
    
    // Update tree with new state
    const sLeafAfter = createStateLeaf(sender.pub, sender.nonce, tokenId, senderStateAfter);
    const rLeafAfter = createStateLeaf(receiver.pub, receiver.nonce, tokenId, receiverStateAfter);
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

// ---------- Helper Functions ----------

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
      for (let i = 0; i < STATE_SIZE; i++) {
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
  const inputs = [pubKey, nonce, BigInt(tokenId), ...state];
  return pHash3(inputs[0], inputs[1], inputs[2]); // Simplified for demo
}

function updateTokenState(accountId, tokenId, tokenType, newState) {
  // In a real implementation, this would update the database
  console.log(`  - Updated ${accountId}'s token ${tokenId} (${STATE_FORMATS[tokenType].description}) state:`, newState);
}

// ---------- Example Usage Functions ----------

export function getTokenTypeExamples() {
  return {
    tokenTypes: STATE_FORMATS,
    examples: [
      {
        name: "Fungible Token Transfer",
        description: "Transfer money-like tokens with balance",
        tokenType: TOKEN_TYPES.FUNGIBLE,
        transferParams: [100], // Transfer 100 units
        expectedStateChange: "sender_balance -= 100, receiver_balance += 100"
      },
      {
        name: "NFT Transfer",
        description: "Transfer ownership of unique token",
        tokenType: TOKEN_TYPES.NFT,
        transferParams: [0, 0, 0, 0], // No additional params needed
        expectedStateChange: "sender_ownership = 0, receiver_ownership = 1"
      },
      {
        name: "Attribute Token Transfer",
        description: "Transfer gaming token with level, power, rarity",
        tokenType: TOKEN_TYPES.ATTRIBUTE,
        transferParams: [0, 0, 0, 0], // All attributes transfer
        expectedStateChange: "All attributes transfer from sender to receiver"
      },
      {
        name: "Escrow Token Transfer",
        description: "Transfer token with escrow functionality",
        tokenType: TOKEN_TYPES.ESCROW,
        transferParams: [0, 456, 0, 0], // New escrow provider 456
        expectedStateChange: "Ownership transfers, escrow provider updated to 456"
      }
    ]
  };
}

// ---------- Test Functions ----------

export async function testAllTokenTypes() {
  console.log('🧪 Testing all token types with generic state transfer...\n');
  
  const examples = getTokenTypeExamples();
  
  for (const example of examples.examples) {
    try {
      console.log(`\n${example.name}:`);
      console.log(`  Description: ${example.description}`);
      console.log(`  Expected: ${example.expectedStateChange}`);
      
      const result = await performGenericStateTransfer({
        senderId: 'alice',
        receiverId: 'bob',
        tokenId: Math.floor(Math.random() * 1000),
        tokenType: example.tokenType,
        transferParams: example.transferParams,
        txNonce: Date.now()
      });
      
      console.log(`  ✅ Success! TX ID: ${result.txId.substring(0, 20)}...`);
      console.log(`  Final states - Sender: [${result.senderStateAfter.join(', ')}], Receiver: [${result.receiverStateAfter.join(', ')}]`);
      
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }
}
