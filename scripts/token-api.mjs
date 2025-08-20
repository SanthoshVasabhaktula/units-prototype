// Token API - Clean and readable API using service modules
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

/**
 * Main transfer function implementing the specified flow
 * @param {string} tokenId - Token ID to transfer
 * @param {string} from - Sender account ID
 * @param {string} to - Receiver account ID
 * @param {Object} transferParams - Transfer parameters
 * @param {string} transferCircuit - Circuit type to use
 * @returns {Object} - Transfer result
 */
export async function transfer(tokenId, from, to, transferParams = {}, transferCircuit = 'transfer') {
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
    
    // Step 3: Generate ZK proof
    const proofResult = await ZKProofService.generateZKProof(txLog, transferCircuit);
    
    // Step 4: Save transaction log
    const savedTxLog = StorageService.saveTxLog(txLog, proofResult.proof);
    
    // Step 5: Commit transfer
    const committedToken = TransferService.commitTransfer(token, txLog);
    
    // Step 6: Save proof to public ledger
    const ledgerRecord = StorageService.saveProofInPublicLedger(proofResult.proof, txLog);
    
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
      // Enhanced proof metadata
      proofMetadata: proofResult.metadata
    };
    
  } catch (error) {
    console.error("❌ Transfer failed:", error.message);
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
