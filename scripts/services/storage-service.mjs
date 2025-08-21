// Storage Service - Handles database operations and public ledger storage
import { pHash3 } from '../utils.mjs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StorageService {
  /**
   * Get database connection
   * @returns {Object} - Database connection
   */
  static getDB() {
    const dbPath = path.join(__dirname, '../../data/tx_logs.sqlite');
    return new Database(dbPath);
  }

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
      // All metadata is stored in the proof_metadata JSON field
      proof_metadata: JSON.stringify(hasEmbeddedMetadata ? proof.metadata : (txLog.proofMetadata || {})),
      circuit_version: hasEmbeddedMetadata ? proof.metadata.circuit_version : (txLog.proofMetadata?.circuit_version || "unknown"),
      vkey_version: "vk-1"
    };
    
    // Save to database
    const db = this.getDB();
    const stmt = db.prepare(`
      INSERT INTO tx_logs (
        tx_id, token_id, token_type, sender_id, receiver_id, transfer_params,
        ts, root_before, root_after, proof_json, public_inputs, proof_metadata,
        circuit_version, vkey_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      txRecord.tx_id,
      txRecord.token_id,
      txRecord.token_type,
      txRecord.sender_id,
      txRecord.receiver_id,
      txRecord.transfer_params,
      txRecord.ts,
      txRecord.root_before,
      txRecord.root_after,
      txRecord.proof_json,
      txRecord.public_inputs,
      txRecord.proof_metadata,
      txRecord.circuit_version,
      txRecord.vkey_version
    );
    
    db.close();
    
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

  /**
   * Update transaction log with public ledger metadata (Step 7)
   * @param {string} txId - Transaction ID
   * @param {Object} ledgerRecord - Ledger record from saveProofInPublicLedger
   * @param {Object} ledgerMetadata - Additional ledger metadata
   * @returns {Object} - Updated transaction record
   */
  static updateTxLogWithLedgerMetadata(txId, ledgerRecord, ledgerMetadata = {}) {
    console.log(`▶ Updating transaction log with ledger metadata: ${txId}`);
    
    // Determine the ledger platform based on metadata or default to 'ethereum'
    const platform = ledgerMetadata.platform || 'ethereum';
    
    // Generate a simulated block ID for demo purposes
    // In a real implementation, this would come from the actual blockchain
    const blockId = ledgerMetadata.blockId || `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use the ledger timestamp or current timestamp
    const ledgerTimestamp = ledgerMetadata.ledgerTimestamp || Date.now();
    
    // Create the ledger metadata object
    const fullLedgerMetadata = {
      ...ledgerRecord,
      platform: platform,
      blockId: blockId,
      ledgerTimestamp: ledgerTimestamp,
      ...ledgerMetadata
    };
    
    // Update the database
    const db = this.getDB();
    const stmt = db.prepare(`
      UPDATE tx_logs 
      SET ledger_metadata = ?, ledger_platform = ?, block_id = ?, ledger_timestamp = ?
      WHERE tx_id = ?
    `);
    
    stmt.run(
      JSON.stringify(fullLedgerMetadata),
      platform,
      blockId,
      ledgerTimestamp,
      txId
    );
    
    db.close();
    
    console.log("✅ Transaction log updated with ledger metadata:", fullLedgerMetadata);
    return fullLedgerMetadata;
  }
}
