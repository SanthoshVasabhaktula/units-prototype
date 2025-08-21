// Unified API - Combines token-api.mjs and legacy api.mjs with 6-step transfer process
import { 
  getAllTokens, 
  getToken, 
  createToken, 
  TOKEN_TYPES, 
  STATE_FORMATS,
  TokenValidationService,
  TransferService 
} from './services/token-service.mjs';
import { ZKProofService } from './services/zk-proof-service.mjs';
import { StorageService } from './services/storage-service.mjs';
import { ProofMetadataService } from './services/proof-metadata-service.mjs';
import { 
  pHash2, pHash3, pHash4, pHash5, buildEmptyTree, updateLeaf, treeRoot, merklePath, 
  persistTx, getAllAccounts, getAccount, updateAccountBalance, 
  generateUniqueId, cleanupTempFiles, bin 
} from "./utils.mjs";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { groth16 } from "snarkjs";

const DEPTH = 4; // 16 leaves

/**
 * Main transfer function implementing the 7-step transfer flow
 * @param {string} tokenId - Token ID to transfer
 * @param {string} from - Sender account ID
 * @param {string} to - Receiver account ID
 * @param {Object} transferParams - Transfer parameters
 * @param {string} transferCircuit - Circuit type to use ('transfer' or 'generic')
 * @param {Object} ledgerMetadata - Optional ledger metadata (platform, blockId, etc.)
 * @returns {Object} - Transfer result
 */
export async function transfer(tokenId, from, to, transferParams = {}, transferCircuit = 'transfer', ledgerMetadata = {}) {
  console.log(`🚀 Starting token transfer: ${tokenId} from ${from} to ${to}`);
  
  try {
    // Step 1: Validate token
    const token = getToken(tokenId);
    if (!token) {
      throw new Error(`Token '${tokenId}' not found`);
    }
    
    const isValid = TokenValidationService.validate(token, from, to, transferParams);
    if (!isValid) {
      throw new Error("Token validation failed");
    }
    
    // Step 2: Initiate transfer
    const txLog = TransferService.initiateTransfer(token, from, to, transferParams);
    
    // Step 3: Generate ZK proof with embedded metadata
    const proofResult = await ZKProofService.generateZKProof(txLog, transferCircuit);
    
    // Step 4: Save transaction log with proof metadata
    const savedTxLog = StorageService.saveTxLog(txLog, proofResult.proof);
    
    // Step 5: Commit transfer
    const committedToken = TransferService.commitTransfer(token, txLog);
    
    // Step 6: Save proof to public ledger
    const ledgerRecord = StorageService.saveProofInPublicLedger(proofResult.proof, txLog);
    
    // Step 7: Update transaction log with public ledger metadata
    const ledgerMetadataRecord = StorageService.updateTxLogWithLedgerMetadata(txLog.id, ledgerRecord, ledgerMetadata);
    
    console.log("🎉 Transfer completed successfully!");
    
    return {
      success: true,
      txId: txLog.id,
      tokenId: token.id,
      tokenType: token.type,
      tokenTypeName: STATE_FORMATS[token.type].description,
      proof: proofResult.proof,
      publicInputs: proofResult.publicInputs,
      senderStateAfter: txLog.stateAfter.sender,
      receiverStateAfter: txLog.stateAfter.receiver,
      rootBefore: txLog.merkleData?.rootBefore,
      rootAfter: txLog.merkleData?.rootAfter,
      timestamp: txLog.timestamp,
      ledgerRecord,
      ledgerMetadata: ledgerMetadataRecord,
      // Proof with embedded metadata
      embeddedMetadata: proofResult.proof.metadata
    };
    
  } catch (error) {
    console.error("❌ Transfer failed:", error.message);
    throw error;
  }
}

/**
 * Legacy transfer function for backward compatibility
 * @param {Object} params - Transfer parameters
 * @param {string} params.senderId - Sender account ID
 * @param {string} params.receiverId - Receiver account ID
 * @param {number} params.amount - Transfer amount
 * @param {number} params.txNonce - Transaction nonce
 * @returns {Object} - Transfer result
 */
export async function performTransfer({ senderId, receiverId, amount, txNonce }) {
  // Use the 6-step transfer process for legacy API compatibility
  return await transfer('GOLD', senderId, receiverId, { amount }, 'transfer');
}

/**
 * Generic state transfer function for complex token types
 * @param {Object} params - Transfer parameters
 * @param {string} params.senderId - Sender account ID
 * @param {string} params.receiverId - Receiver account ID
 * @param {string} params.tokenId - Token ID
 * @param {number} params.tokenType - Token type
 * @param {Array} params.transferParams - Transfer parameters array
 * @param {number} params.txNonce - Transaction nonce
 * @returns {Object} - Transfer result
 */
export async function performGenericStateTransfer({ 
  senderId, 
  receiverId, 
  tokenId, 
  tokenType, 
  transferParams,
  txNonce 
}) {
  // Use the 6-step transfer process for generic transfers
  const token = getToken(tokenId) || createToken(tokenId, tokenType, `Token ${tokenId}`, { state: transferParams[0] || 1000 });
  const params = { amount: transferParams[0] || 0 };
  
  return await transfer(tokenId, senderId, receiverId, params, 'generic');
}

/**
 * Verify a ZK proof
 * @param {Object} params - Verification parameters
 * @param {string} params.txId - Transaction ID
 * @param {Object} params.proof - ZK proof
 * @param {Array} params.publicInputs - Public inputs
 * @returns {Object} - Verification result
 */
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

// Export individual step functions for modular usage
export const validate = TokenValidationService.validate;
export const initiateTransfer = TransferService.initiateTransfer;
export const generateZKProof = ZKProofService.generateZKProof;
export const saveTxLog = StorageService.saveTxLog;
export const commitTransfer = TransferService.commitTransfer;
export const saveProofInPublicLedger = StorageService.saveProofInPublicLedger;

// Export token management functions
export { getAllTokens, getToken, createToken, TOKEN_TYPES, STATE_FORMATS };

// Export verification examples for documentation
export function getVerificationExamples() {
  return {
    examples: [
      {
        name: "Valid Transfer Proof with Enhanced Public Inputs",
        description: "Verify a proof that Alice transferred tokens to Bob with enhanced public inputs",
        what_is_verified: [
          "Alice (sender_account) sent money to Bob (receiver_account)",
          "The exact transfer amount is publicly verifiable",
          "The transaction happened at a specific time (nonce)",
          "The state commitment ensures integrity",
          "The Merkle tree root was updated correctly (root_before → root_after)",
          "All computations were done correctly with after balance validation"
        ],
        privacy_preserved: [
          "Alice's private key is never revealed",
          "Bob's private key is never revealed", 
          "The exact account balances are hidden",
          "The Merkle tree paths are hidden",
          "Internal state calculations remain private"
        ],
        public_inputs: [
          "commitment: State commitment computed by circuit",
          "sender_account: Alice's public key",
          "receiver_account: Bob's public key", 
          "amount: Transfer amount",
          "nonce: Transaction timestamp",
          "root_before: Merkle root before transfer",
          "root_after: Merkle root after transfer",
          "tx_log_id: Transaction identifier"
        ]
      },
      {
        name: "6-Step Transfer Process",
        description: "The unified API implements a clean 6-step transfer process",
        steps: [
          "1. validate(token, from, to, transferParams) - Token and transfer validation",
          "2. initiateTransfer(token, from, to, transferParams) - Create transaction log",
          "3. generateZKProof(txLog, circuit) - Generate ZK proof with enhanced public inputs",
          "4. saveTxLog(txLog, proof) - Save transaction log with proof metadata",
          "5. commitTransfer(token, txLog) - Update token states in database",
          "6. saveProofInPublicLedger(proof, txLog) - Save proof to public ledger"
        ]
      }
    ],
    sample_api_calls: [
      {
        description: "Main transfer function with enhanced public inputs",
        function: "transfer(tokenId, from, to, transferParams, transferCircuit)",
        example: "await transfer('GOLD', 'alice', 'bob', { amount: 100 }, 'transfer')"
      },
      {
        description: "Legacy transfer for backward compatibility",
        function: "performTransfer({ senderId, receiverId, amount, txNonce })",
        example: "await performTransfer({ senderId: 'alice', receiverId: 'bob', amount: 100, txNonce: Date.now() })"
      },
      {
        description: "Verify any transfer proof",
        function: "verifyProof({ txId, proof, publicInputs })",
        example: "await verifyProof({ txId: '123...', proof: {...}, publicInputs: [...] })"
      }
    ]
  };
}