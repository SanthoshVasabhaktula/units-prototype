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
    
    // Check if this is a proof with embedded metadata
    const hasEmbeddedMetadata = proof.metadata && proof.verification_context;
    
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
      // Metadata fields (extracted from embedded proof metadata)
      proving_system: hasEmbeddedMetadata ? proof.metadata.proving_system : (txLog.proofMetadata?.proving_system || 'unknown'),
      circuit_name: hasEmbeddedMetadata ? proof.metadata.circuit_name : (txLog.proofMetadata?.circuit_name || 'unknown'),
      circuit_version: hasEmbeddedMetadata ? proof.metadata.circuit_version : (txLog.proofMetadata?.circuit_version || 'unknown'),
      circuit_file: hasEmbeddedMetadata ? proof.metadata.circuit_file : (txLog.proofMetadata?.circuit_file || 'unknown'),
      circuit_hash: hasEmbeddedMetadata ? proof.metadata.circuit_hash : (txLog.proofMetadata?.circuit_hash || 'unknown'),
      proving_key_file: hasEmbeddedMetadata ? proof.metadata.proving_key_file : (txLog.proofMetadata?.proving_key_file || 'unknown'),
      proving_key_hash: hasEmbeddedMetadata ? proof.metadata.proving_key_hash : (txLog.proofMetadata?.proving_key_hash || 'unknown'),
      verification_key_file: hasEmbeddedMetadata ? proof.metadata.verification_key_file : (txLog.proofMetadata?.verification_key_file || 'unknown'),
      verification_key_hash: hasEmbeddedMetadata ? proof.metadata.verification_key_hash : (txLog.proofMetadata?.verification_key_hash || 'unknown'),
      tool_version: hasEmbeddedMetadata ? proof.metadata.tool_version : (txLog.proofMetadata?.tool_version || 'unknown'),
      proof_metadata: JSON.stringify(hasEmbeddedMetadata ? proof.metadata : (txLog.proofMetadata || {})),
      circuit_version: hasEmbeddedMetadata ? proof.metadata.circuit_version : (txLog.proofMetadata?.circuit_version || "unknown"),
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
      status: 'committed',
      // Metadata
      provingSystem: txLog.proofMetadata?.proving_system || 'unknown',
      circuitName: txLog.proofMetadata?.circuit_name || 'unknown',
      circuitVersion: txLog.proofMetadata?.circuit_version || 'unknown',
      toolVersion: txLog.proofMetadata?.tool_version || 'unknown'
    };
    
    console.log("✅ Proof saved to public ledger:", ledgerRecord);
    return ledgerRecord;
  }
}
