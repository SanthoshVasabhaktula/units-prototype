// ZK Proof Service - Handles zero-knowledge proof generation and verification
import fs from "node:fs";
import { execSync } from "node:child_process";
import { groth16 } from "snarkjs";
import { 
  pHash2, pHash3, pHash5, buildEmptyTree, updateLeaf, treeRoot, merklePath, 
  generateUniqueId, cleanupTempFiles, bin 
} from '../utils.mjs';
import { ProofMetadataService } from './proof-metadata-service.mjs';

const DEPTH = 4; // 16 leaves

export class ZKProofService {
  /**
   * Generate ZK proof for the transfer
   * @param {Object} txLog - Transaction log
   * @param {string} transferCircuit - Circuit type to use
   * @returns {Object} - Generated proof and public inputs
   */
  static async generateZKProof(txLog, transferCircuit = 'transfer') {
    console.log(`▶ Generating ZK proof for transaction: ${txLog.id}`);
    
    // Generate unique file IDs
    const fileId = generateUniqueId();
    
    try {
      // Prepare circuit input data
      const circuitInput = this.prepareCircuitInput(txLog, transferCircuit);
      
      const inputFile = `build/input_${fileId}.json`;
      const proofFile = `build/proof_${fileId}.json`;
      const publicFile = `build/public_${fileId}.json`;
      
      // Write input file
      fs.writeFileSync(inputFile, JSON.stringify(circuitInput, null, 2));
      
      // Determine circuit files based on type
      let circuitWasm, circuitZkey, circuitVkey;
      if (transferCircuit === 'generic') {
        circuitWasm = 'build/generic_state_transfer_js/generic_state_transfer.wasm';
        circuitZkey = 'build/generic_state_transfer.zkey';
        circuitVkey = 'build/generic_state_transfer_vkey.json';
      } else {
        circuitWasm = 'build/transfer_js/transfer.wasm';
        circuitZkey = 'build/transfer.zkey';
        circuitVkey = 'build/vkey.json';
      }
      
      // Generate witness and prove using snarkjs
      console.log("▶ Generating witness and proving...");
      execSync(`${bin("snarkjs")} groth16 fullprove ${inputFile} ${circuitWasm} ${circuitZkey} ${proofFile} ${publicFile}`, { stdio: "inherit" });
      
      // Read generated proof and public inputs
      const proof = JSON.parse(fs.readFileSync(proofFile));
      const publicInputs = JSON.parse(fs.readFileSync(publicFile));
      
      // Verify proof
      console.log("▶ Verifying proof...");
      const vkey = JSON.parse(fs.readFileSync(circuitVkey));
      const verified = await groth16.verify(vkey, publicInputs, proof);
      
      if (!verified) {
        throw new Error("Proof verification failed");
      }
      
      // Generate proof metadata
      const proofMetadata = ProofMetadataService.generateProofMetadata(
        'circom',
        transferCircuit,
        `circuits/${transferCircuit}.circom`,
        circuitZkey,
        circuitVkey
      );

      // Validate metadata
      const metadataValidation = ProofMetadataService.validateMetadata(proofMetadata);
      if (!metadataValidation.isValid) {
        console.warn("⚠️ Proof metadata validation warnings:", metadataValidation.warnings);
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
          proving_system: proofMetadata.proving_system,
          circuit_name: proofMetadata.circuit_name,
          circuit_version: proofMetadata.circuit_version,
          circuit_file: proofMetadata.circuit_file,
          circuit_hash: proofMetadata.circuit_hash,
          proving_key_file: proofMetadata.proving_key_file,
          proving_key_hash: proofMetadata.proving_key_hash,
          verification_key_file: proofMetadata.verification_key_file,
          verification_key_hash: proofMetadata.verification_key_hash,
          tool_version: proofMetadata.tool_version,
          generated_at: proofMetadata.generated_at,
          
          // Transaction-specific metadata
          tx_id: txLog.id,
          tx_timestamp: txLog.timestamp,
          sender_id: txLog.from,
          receiver_id: txLog.to,
          token_id: txLog.tokenId,
          amount: txLog.transferParams?.amount || 0
        },
        
        // Public inputs with metadata context
        public_inputs: publicInputs,
        
        // Verification context
        verification_context: {
          vkey_hash: proofMetadata.verification_key_hash,
          circuit_hash: proofMetadata.circuit_hash,
          proving_system: proofMetadata.proving_system
        }
      };

      // Update transaction log with proof data and metadata
      txLog.proof = proofWithMetadata;
      txLog.publicInputs = publicInputs;
      txLog.proofMetadata = proofMetadata;
      txLog.merkleData = {
        rootBefore: circuitInput.root_before,
        rootAfter: circuitInput.root_after
      };
      txLog.status = 'proven';
      
      console.log("✅ ZK proof with embedded metadata generated and verified successfully");
      console.log(`📋 Embedded metadata: ${proofMetadata.proving_system} ${proofMetadata.circuit_name} v${proofMetadata.circuit_version}`);
      
      return { proof: proofWithMetadata, publicInputs, verified, metadata: proofMetadata };
      
    } catch (error) {
      console.error("❌ ZK proof generation failed:", error.message);
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

  /**
   * Verify proof with embedded metadata
   * @param {Object} proofWithMetadata - Proof with embedded metadata
   * @returns {Object} - Verification result
   */
  static async verifyProofWithMetadata(proofWithMetadata) {
    try {
      console.log(`▶ Verifying proof with embedded metadata for transaction: ${proofWithMetadata.metadata?.tx_id}`);
      
      // Extract base proof components
      const baseProof = {
        pi_a: proofWithMetadata.pi_a,
        pi_b: proofWithMetadata.pi_b,
        pi_c: proofWithMetadata.pi_c,
        protocol: proofWithMetadata.protocol,
        curve: proofWithMetadata.curve
      };
      
      // Load verification key
      const vkeyPath = proofWithMetadata.metadata?.verification_key_file || 'build/vkey.json';
      const vkey = JSON.parse(fs.readFileSync(vkeyPath));
      
      // Verify the base proof
      const verified = await groth16.verify(vkey, proofWithMetadata.public_inputs, baseProof);
      
      // Validate metadata integrity
      const metadataValidation = ProofMetadataService.validateMetadata(proofWithMetadata.metadata);
      
      return {
        success: true,
        verified,
        txId: proofWithMetadata.metadata?.tx_id,
        metadata: proofWithMetadata.metadata,
        validation: metadataValidation,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error("❌ Proof verification failed:", error.message);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Prepare circuit input data
   * @param {Object} txLog - Transaction log
   * @param {string} transferCircuit - Circuit type
   * @returns {Object} - Circuit input data
   */
  static prepareCircuitInput(txLog, transferCircuit) {
    const ts = BigInt(Math.floor(Date.now() / 1000));
    const txNonce = BigInt(txLog.timestamp);
    
    // For legacy transfer circuit, generate transaction ID the same way as the working system
    let txLogId;
    if (transferCircuit === 'transfer') {
      const transferAmount = BigInt(txLog.transferParams.amount || 0);
      txLogId = String(pHash5(BigInt(11), BigInt(22), transferAmount, txNonce, ts));
    } else {
      // For generic circuit, use a hash of the transaction ID
      let txIdHash = 0;
      for (let i = 0; i < txLog.id.length; i++) {
        const char = txLog.id.charCodeAt(i);
        txIdHash = ((txIdHash << 5) - txIdHash) + char;
        txIdHash = txIdHash & txIdHash; // Convert to 32-bit integer
      }
      txLogId = String(Math.abs(txIdHash));
    }
    
    if (transferCircuit === 'generic') {
      // Convert string token ID to numeric hash for circuit compatibility
      let tokenIdHash = 0;
      for (let i = 0; i < txLog.tokenId.length; i++) {
        const char = txLog.tokenId.charCodeAt(i);
        tokenIdHash = ((tokenIdHash << 5) - tokenIdHash) + char;
        tokenIdHash = tokenIdHash & tokenIdHash; // Convert to 32-bit integer
      }
      
      return {
        root_before: "0", // Placeholder
        root_after: "0",  // Placeholder
        tx_log_id: txLogId,
        token_id: String(Math.abs(tokenIdHash)),
        token_type: String(txLog.tokenType),
        
        sender_pub: "11", // Placeholder
        receiver_pub: "22", // Placeholder
        sender_nonce: "1", // Placeholder
        receiver_nonce: "1", // Placeholder
        
        sender_state_before: this.padArray(Object.values(txLog.stateBefore.sender), 4).map(String),
        receiver_state_before: this.padArray(Object.values(txLog.stateBefore.receiver), 4).map(String),
        sender_state_after: this.padArray(Object.values(txLog.stateAfter.sender), 4).map(String),
        receiver_state_after: this.padArray(Object.values(txLog.stateAfter.receiver), 4).map(String),
        
        transfer_params: this.padArray(Object.values(txLog.transferParams), 4).map(String),
        
        // Placeholder paths
        s_siblings_before: Array(4).fill("0"),
        s_pathBits_before: Array(4).fill("0"),
        r_siblings_before: Array(4).fill("0"),
        r_pathBits_before: Array(4).fill("0"),
        
        s_siblings_after: Array(4).fill("0"),
        s_pathBits_after: Array(4).fill("0"),
        r_siblings_after: Array(4).fill("0"),
        r_pathBits_after: Array(4).fill("0"),
        
        tx_nonce: String(txNonce),
        tx_timestamp: String(ts)
      };
    } else {
      // For legacy transfer circuit, build a proper Merkle tree
      // This mimics the working system from api.mjs
      
      // Create demo accounts for the Merkle tree
      const accounts = [
        { id: 'alice', pub: BigInt(11), bal: BigInt(txLog.stateBefore.sender.state || 0), nonce: BigInt(7), idx: 3 },
        { id: 'bob', pub: BigInt(22), bal: BigInt(txLog.stateBefore.receiver.state || 0), nonce: BigInt(42), idx: 9 },
        { id: 'carol', pub: BigInt(33), bal: BigInt(70000), nonce: BigInt(1), idx: 0 },
        { id: 'dan', pub: BigInt(44), bal: BigInt(90000), nonce: BigInt(2), idx: 15 }
      ];
      
      // Build current tree state
      const layers = buildEmptyTree(DEPTH);
      for (const acc of accounts) {
        const leaf = pHash3(acc.pub, acc.bal, acc.nonce);
        updateLeaf(layers, acc.idx, leaf);
      }
      const rootBefore = treeRoot(layers);
      
      // Get BEFORE paths for sender and receiver
      const sender = accounts.find(acc => acc.id === txLog.from) || accounts[0];
      const receiver = accounts.find(acc => acc.id === txLog.to) || accounts[1];
      const sBefore = merklePath(layers, sender.idx);
      const rBefore = merklePath(layers, receiver.idx);
      
      // Store original balances
      const senderOriginalBalance = sender.bal;
      const receiverOriginalBalance = receiver.bal;
      
      // Apply state update
      const transferAmount = BigInt(txLog.transferParams.amount || 0);
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
      
      return {
        root_before: String(rootBefore),
        root_after: String(rootAfter),
        tx_log_id: txLogId,
        
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
        
        tx_nonce: String(txNonce),
        tx_timestamp: String(ts)
      };
    }
  }

  /**
   * Pad array to specified size
   * @param {Array} arr - Array to pad
   * @param {number} size - Target size
   * @returns {Array} - Padded array
   */
  static padArray(arr, size) {
    const padded = [...arr];
    while (padded.length < size) {
      padded.push(0);
    }
    return padded;
  }
}
