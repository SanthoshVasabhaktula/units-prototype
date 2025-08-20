// Proof Metadata Service - Handles proof metadata generation and validation
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ProofMetadataService {
  /**
   * Generate proof metadata for a given circuit
   * @param {string} provingSystem - Proving system (circom, noir, etc.)
   * @param {string} circuitName - Circuit name
   * @param {string} circuitFile - Circuit file path
   * @param {string} provingKeyFile - Proving key file path
   * @param {string} verificationKeyFile - Verification key file path
   * @returns {Object} - Proof metadata
   */
  static generateProofMetadata(provingSystem, circuitName, circuitFile, provingKeyFile, verificationKeyFile) {
    const metadata = {
      proving_system: provingSystem,
      circuit_name: circuitName,
      circuit_version: this.getCircuitVersion(circuitFile),
      circuit_file: circuitFile,
      circuit_hash: this.calculateFileHash(circuitFile),
      proving_key_file: provingKeyFile,
      proving_key_hash: this.calculateFileHash(provingKeyFile),
      verification_key_file: verificationKeyFile,
      verification_key_hash: this.calculateFileHash(verificationKeyFile),
      tool_version: this.getToolVersion(provingSystem),
      generated_at: new Date().toISOString()
    };

    return metadata;
  }

  /**
   * Calculate SHA256 hash of a file
   * @param {string} filePath - Path to the file
   * @returns {string} - SHA256 hash
   */
  static calculateFileHash(filePath) {
    try {
      const fullPath = join(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        return null;
      }
      const fileBuffer = fs.readFileSync(fullPath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      return hashSum.digest('hex');
    } catch (error) {
      console.warn(`Could not calculate hash for ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Get circuit version from file or default
   * @param {string} circuitFile - Circuit file path
   * @returns {string} - Circuit version
   */
  static getCircuitVersion(circuitFile) {
    try {
      const fullPath = join(process.cwd(), circuitFile);
      if (!fs.existsSync(fullPath)) {
        return 'unknown';
      }
      
      // Try to extract version from circuit file content
      const content = fs.readFileSync(fullPath, 'utf8');
      const versionMatch = content.match(/pragma\s+circom\s+([\d.]+)/);
      if (versionMatch) {
        return versionMatch[1];
      }
      
      // Fallback to file modification time as version indicator
      const stats = fs.statSync(fullPath);
      return `v${Math.floor(stats.mtime.getTime() / 1000)}`;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get tool version for the proving system
   * @param {string} provingSystem - Proving system name
   * @returns {string} - Tool version
   */
  static getToolVersion(provingSystem) {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      switch (provingSystem.toLowerCase()) {
        case 'circom':
          return packageJson.devDependencies?.snarkjs || 'unknown';
        case 'noir':
          return packageJson.devDependencies?.noir || 'unknown';
        default:
          return 'unknown';
      }
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Validate proof metadata
   * @param {Object} metadata - Proof metadata
   * @returns {Object} - Validation result
   */
  static validateMetadata(metadata) {
    const errors = [];
    const warnings = [];

    // Required fields
    const requiredFields = ['proving_system', 'circuit_name', 'circuit_file'];
    for (const field of requiredFields) {
      if (!metadata[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate file hashes
    if (metadata.circuit_hash === null) {
      warnings.push(`Could not calculate hash for circuit file: ${metadata.circuit_file}`);
    }
    if (metadata.proving_key_hash === null) {
      warnings.push(`Could not calculate hash for proving key: ${metadata.proving_key_file}`);
    }
    if (metadata.verification_key_hash === null) {
      warnings.push(`Could not calculate hash for verification key: ${metadata.verification_key_file}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get available proving systems
   * @returns {Array} - List of available proving systems
   */
  static getAvailableProvingSystems() {
    return [
      {
        name: 'circom',
        description: 'Circom with SnarkJS',
        supported_circuits: ['transfer', 'generic_state_transfer', 'nft_transfer'],
        tool_version: this.getToolVersion('circom')
      }
      // Future: Add Noir and other proving systems
    ];
  }

  /**
   * Get circuit information
   * @param {string} circuitName - Circuit name
   * @returns {Object} - Circuit information
   */
  static getCircuitInfo(circuitName) {
    const circuitsDir = join(process.cwd(), 'circuits');
    const circuitFile = `${circuitName}.circom`;
    const circuitPath = join(circuitsDir, circuitFile);
    
    if (!fs.existsSync(circuitPath)) {
      return null;
    }

    return {
      name: circuitName,
      file: circuitFile,
      version: this.getCircuitVersion(circuitFile),
      hash: this.calculateFileHash(circuitFile),
      size: fs.statSync(circuitPath).size,
      last_modified: fs.statSync(circuitPath).mtime.toISOString()
    };
  }
}
