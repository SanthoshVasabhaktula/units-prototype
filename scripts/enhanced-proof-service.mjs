// Enhanced Proof Service - Embeds metadata directly in proof structure
import fs from "node:fs";
import { execSync } from "node:child_process";
import { groth16 } from "snarkjs";
import { 
  generateUniqueId, cleanupTempFiles, bin 
} from '../utils.mjs';
import { ProofMetadataService } from './proof-metadata-service.mjs';

export class EnhancedProofService {
  /**
   * Generate enhanced proof with embedded metadata
   * @param {Object} txLog - Transaction log
   * @param {string} transferCircuit - Circuit type to use
   * @returns {Object} - Enhanced proof with embedded metadata
   */
  static async generateEnhancedProof(txLog, transferCircuit = 'transfer') {
    console.log(`▶ Generating enhanced ZK proof with embedded metadata: ${txLog.id}`);
    
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
      const baseProof = JSON.parse(fs.readFileSync(proofFile));
      const publicInputs = JSON.parse(fs.readFileSync(publicFile));
      
      // Verify base proof
      console.log("▶ Verifying base proof...");
      const vkey = JSON.parse(fs.readFileSync(circuitVkey));
      const verified = await groth16.verify(vkey, publicInputs, baseProof);
      
      if (!verified) {
        throw new Error("Base proof verification failed");
      }
      
      // Generate proof metadata
      const proofMetadata = ProofMetadataService.generateProofMetadata(
        'circom',
        transferCircuit,
        `circuits/${transferCircuit}.circom`,
        circuitZkey,
        circuitVkey
      );
      
      // Create enhanced proof structure with embedded metadata
      const enhancedProof = {
        // Standard Groth16 proof components
        pi_a: baseProof.pi_a,
        pi_b: baseProof.pi_b,
        pi_c: baseProof.pi_c,
        protocol: baseProof.protocol,
        curve: baseProof.curve,
        
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
      
      // Validate enhanced proof
      const validation = this.validateEnhancedProof(enhancedProof);
      if (!validation.isValid) {
        console.warn("⚠️ Enhanced proof validation warnings:", validation.warnings);
      }
      
      console.log("✅ Enhanced ZK proof generated with embedded metadata");
      console.log(`📋 Embedded metadata: ${enhancedProof.metadata.proving_system} ${enhancedProof.metadata.circuit_name} v${enhancedProof.metadata.circuit_version}`);
      
      return { 
        proof: enhancedProof, 
        publicInputs, 
        verified, 
        metadata: proofMetadata,
        enhanced: true
      };
      
    } catch (error) {
      console.error("❌ Enhanced ZK proof generation failed:", error.message);
      throw error;
    } finally {
      // Always clean up temporary files
      try {
        cleanupTempFiles(fileId);
      } catch (cleanupError) {
        console.log(`  ⚠️ Warning: Could not clean up files for ${fileId}: ${cleanupError.message}`);
      }
    }
  }
  
  /**
   * Validate enhanced proof structure
   * @param {Object} enhancedProof - Enhanced proof with metadata
   * @returns {Object} - Validation result
   */
  static validateEnhancedProof(enhancedProof) {
    const errors = [];
    const warnings = [];
    
    // Check required proof components
    const requiredProofFields = ['pi_a', 'pi_b', 'pi_c', 'protocol', 'curve'];
    for (const field of requiredProofFields) {
      if (!enhancedProof[field]) {
        errors.push(`Missing required proof field: ${field}`);
      }
    }
    
    // Check required metadata fields
    const requiredMetadataFields = ['proving_system', 'circuit_name', 'circuit_version', 'tx_id'];
    for (const field of requiredMetadataFields) {
      if (!enhancedProof.metadata?.[field]) {
        errors.push(`Missing required metadata field: ${field}`);
      }
    }
    
    // Check verification context
    if (!enhancedProof.verification_context?.vkey_hash) {
      warnings.push("Missing verification key hash in verification context");
    }
    
    // Validate proof structure
    if (enhancedProof.protocol !== 'groth16') {
      warnings.push(`Unsupported protocol: ${enhancedProof.protocol}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Verify enhanced proof with embedded metadata
   * @param {Object} enhancedProof - Enhanced proof with metadata
   * @returns {Object} - Verification result
   */
  static async verifyEnhancedProof(enhancedProof) {
    try {
      console.log(`▶ Verifying enhanced proof for transaction: ${enhancedProof.metadata?.tx_id}`);
      
      // Extract base proof components
      const baseProof = {
        pi_a: enhancedProof.pi_a,
        pi_b: enhancedProof.pi_b,
        pi_c: enhancedProof.pi_c,
        protocol: enhancedProof.protocol,
        curve: enhancedProof.curve
      };
      
      // Load verification key
      const vkeyPath = enhancedProof.metadata?.verification_key_file || 'build/vkey.json';
      const vkey = JSON.parse(fs.readFileSync(vkeyPath));
      
      // Verify the base proof
      const verified = await groth16.verify(vkey, enhancedProof.public_inputs, baseProof);
      
      // Validate metadata integrity
      const metadataValidation = this.validateEnhancedProof(enhancedProof);
      
      return {
        success: true,
        verified,
        txId: enhancedProof.metadata?.tx_id,
        metadata: enhancedProof.metadata,
        validation: metadataValidation,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error("❌ Enhanced proof verification failed:", error.message);
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
    // This would be implemented based on the specific circuit requirements
    // For now, return a placeholder
    return {
      // Circuit-specific input preparation would go here
      tx_id: txLog.id,
      circuit_type: transferCircuit
    };
  }
}
