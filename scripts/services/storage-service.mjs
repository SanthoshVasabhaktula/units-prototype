// Storage Service - Handles database operations and public ledger storage
import { pHash3 } from '../utils.mjs';

export class StorageService {
  /**
   * Save transaction log to database
   * @param {Object} txLog - Transaction log
   * @param {Object} proof - Generated proof
   * @returns {Object} - Saved transaction record
   */
  static saveTxLog(txLog, proof) {
    console.log(`▶ Saving transaction log: ${txLog.id}`);
    
    // In a real implementation, this would save to a database
    // For now, we'll just log it
    const txRecord = {
      tx_id: txLog.id,
      token_id: txLog.tokenId,
      token_type: txLog.tokenType,
      sender_id: txLog.from,
      receiver_id: txLog.to,
      transfer_params: JSON.stringify(txLog.transferParams),
      ts: txLog.timestamp,
      root_before: txLog.merkleData?.rootBefore || '',
      root_after: txLog.merkleData?.rootAfter || '',
      proof_json: JSON.stringify(proof),
      public_inputs: JSON.stringify(txLog.publicInputs),
      circuit_version: "token-transfer-v1",
      vkey_version: "vk-1"
    };
    
    console.log("✅ Transaction log saved:", txRecord);
    return txRecord;
  }

  /**
   * Save proof to public ledger (blockchain)
   * @param {Object} proof - Generated proof
   * @param {Object} txLog - Transaction log
   * @returns {Object} - Ledger record
   */
  static saveProofInPublicLedger(proof, txLog) {
    console.log(`▶ Saving proof to public ledger: ${txLog.id}`);
    
    // In a real implementation, this would submit to a blockchain
    // For now, we'll just log it
    
    // Create a simple hash from the transaction ID string
    // Convert string to a numeric hash that can be used as BigInt
    let hash = 0;
    for (let i = 0; i < txLog.id.length; i++) {
      const char = txLog.id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const txIdHash = BigInt(Math.abs(hash));
    
    const proofHashBigInt = pHash3(txIdHash, BigInt(txLog.timestamp), BigInt(txLog.tokenType));
    const ledgerRecord = {
      txId: txLog.id,
      tokenId: txLog.tokenId,
      tokenType: txLog.tokenType,
      proofHash: String(proofHashBigInt),
      timestamp: txLog.timestamp,
      status: 'committed'
    };
    
    console.log("✅ Proof saved to public ledger:", ledgerRecord);
    return ledgerRecord;
  }
}
