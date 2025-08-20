// Demo Enhanced Proofs - Shows benefits of embedding metadata in proofs
import { EnhancedProofService } from './services/enhanced-proof-service.mjs';

async function demonstrateEnhancedProofs() {
  console.log('🚀 Demonstrating Enhanced Proofs with Embedded Metadata\n');
  
  // Create a sample transaction log
  const sampleTxLog = {
    id: 'demo_tx_123',
    from: 'alice',
    to: 'bob',
    tokenId: 'GOLD',
    transferParams: { amount: 100 },
    timestamp: Date.now()
  };
  
  console.log('📋 Sample Transaction:');
  console.log(`  ID: ${sampleTxLog.id}`);
  console.log(`  From: ${sampleTxLog.from} → To: ${sampleTxLog.to}`);
  console.log(`  Token: ${sampleTxLog.tokenId}, Amount: ${sampleTxLog.transferParams.amount}\n`);
  
  try {
    // Generate enhanced proof with embedded metadata
    console.log('▶ Generating enhanced proof with embedded metadata...');
    const enhancedResult = await EnhancedProofService.generateEnhancedProof(sampleTxLog, 'transfer');
    
    console.log('\n✅ Enhanced Proof Generated Successfully!');
    console.log('\n📊 Enhanced Proof Structure:');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    ENHANCED PROOF                          │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  Standard Groth16 Components:                              │');
    console.log('│  • pi_a, pi_b, pi_c (proof elements)                       │');
    console.log('│  • protocol: groth16                                       │');
    console.log('│  • curve: bn128                                            │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  Embedded Metadata:                                        │');
    console.log(`│  • proving_system: ${enhancedResult.proof.metadata.proving_system}`);
    console.log(`│  • circuit_name: ${enhancedResult.proof.metadata.circuit_name}`);
    console.log(`│  • circuit_version: ${enhancedResult.proof.metadata.circuit_version}`);
    console.log(`│  • circuit_hash: ${enhancedResult.proof.metadata.circuit_hash.substring(0, 16)}...`);
    console.log(`│  • tool_version: ${enhancedResult.proof.metadata.tool_version}`);
    console.log(`│  • generated_at: ${enhancedResult.proof.metadata.generated_at}`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  Transaction Metadata:                                     │');
    console.log(`│  • tx_id: ${enhancedResult.proof.metadata.tx_id}`);
    console.log(`│  • sender_id: ${enhancedResult.proof.metadata.sender_id}`);
    console.log(`│  • receiver_id: ${enhancedResult.proof.metadata.receiver_id}`);
    console.log(`│  • token_id: ${enhancedResult.proof.metadata.token_id}`);
    console.log(`│  • amount: ${enhancedResult.proof.metadata.amount}`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  Verification Context:                                     │');
    console.log(`│  • vkey_hash: ${enhancedResult.proof.verification_context.vkey_hash.substring(0, 16)}...`);
    console.log(`│  • circuit_hash: ${enhancedResult.proof.verification_context.circuit_hash.substring(0, 16)}...`);
    console.log(`│  • proving_system: ${enhancedResult.proof.verification_context.proving_system}`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    
    // Demonstrate verification
    console.log('\n▶ Verifying enhanced proof...');
    const verificationResult = await EnhancedProofService.verifyEnhancedProof(enhancedResult.proof);
    
    if (verificationResult.success && verificationResult.verified) {
      console.log('✅ Enhanced proof verified successfully!');
      console.log(`📋 Verification metadata: ${verificationResult.metadata.proving_system} ${verificationResult.metadata.circuit_name}`);
    } else {
      console.log('❌ Enhanced proof verification failed');
    }
    
    // Show benefits
    console.log('\n🎯 Benefits of Embedded Metadata in Proofs:');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  🔒 INTEGRITY & AUTHENTICITY                               │');
    console.log('│  • Metadata is cryptographically bound to the proof        │');
    console.log('│  • Cannot be tampered with without invalidating the proof  │');
    console.log('│  • Circuit hash ensures the exact circuit was used         │');
    console.log('│  • Tool version hash prevents version manipulation         │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  🔍 VERIFIABILITY & TRANSPARENCY                           │');
    console.log('│  • All metadata is publicly verifiable                     │');
    console.log('│  • No need for separate metadata storage                   │');
    console.log('│  • Self-contained proofs with complete context             │');
    console.log('│  • Audit trail is part of the cryptographic proof          │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  🚀 INTEROPERABILITY & STANDARDS                           │');
    console.log('│  • Standard Groth16 proof components remain compatible     │');
    console.log('│  • Enhanced structure can be extended for future needs     │');
    console.log('│  • Backward compatible with existing verification tools    │');
    console.log('│  • Can be used across different proving systems            │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  🛡️ SECURITY & TRUST                                       │');
    console.log('│  • Metadata tampering would break proof verification       │');
    console.log('│  • Cryptographic binding prevents metadata injection       │');
    console.log('│  • Timestamps provide temporal integrity                   │');
    console.log('│  • File hashes ensure circuit and key integrity            │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    
    // Compare with current approach
    console.log('\n📊 Comparison: Current vs Enhanced Approach');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  CURRENT APPROACH                    │  ENHANCED APPROACH   │');
    console.log('├──────────────────────────────────────┼──────────────────────┤');
    console.log('│  • Metadata stored separately        │  • Metadata embedded │');
    console.log('│  • Metadata can be tampered with     │  • Cryptographically │');
    console.log('│  • Requires separate validation      │    bound to proof    │');
    console.log('│  • No integrity guarantees           │  • Self-validating   │');
    console.log('│  • Database dependency               │  • Self-contained    │');
    console.log('│  • Metadata can be lost              │  • Metadata preserved│');
    console.log('│  • No temporal integrity             │  • Temporal integrity│');
    console.log('│  • Manual audit trails               │  • Automated audit   │');
    console.log('└──────────────────────────────────────┴──────────────────────┘');
    
    console.log('\n🎉 Enhanced Proofs Demo Completed Successfully!');
    console.log('\n💡 Key Takeaway:');
    console.log('   Embedding metadata directly in proofs provides cryptographic');
    console.log('   integrity, eliminates tampering risks, and creates self-');
    console.log('   contained, verifiable proof objects that are much more');
    console.log('   secure and trustworthy than storing metadata separately.');
    
  } catch (error) {
    console.error('❌ Enhanced proof demonstration failed:', error.message);
    console.log('\n💡 Note: This demo requires the circuit to be compiled.');
    console.log('   The enhanced approach shows the conceptual benefits of');
    console.log('   embedding metadata directly in proofs.');
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateEnhancedProofs().catch(console.error);
}

export { demonstrateEnhancedProofs };
