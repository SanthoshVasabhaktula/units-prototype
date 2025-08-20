// Sample Transactions Script - Populate database with enhanced proof metadata
import { transfer } from './token-api.mjs';
import { performGenericStateTransfer } from './api.mjs';

async function runSampleTransactions() {
  console.log('🚀 Running sample transactions to populate enhanced proof metadata...\n');

  try {
    // Sample 1: Basic transfer from alice to carol
    console.log('📝 Sample 1: Alice → Carol (Basic Transfer)');
    const result1 = await transfer('GOLD', 'alice', 'carol', { amount: 500 }, 'transfer');
    console.log(`✅ Transaction completed: ${result1.txId}`);
    console.log(`📋 Proof metadata: ${result1.proofMetadata.proving_system} ${result1.proofMetadata.circuit_name} v${result1.proofMetadata.circuit_version}\n`);

    // Sample 2: Transfer from bob to dan
    console.log('📝 Sample 2: Bob → Dan (Basic Transfer)');
    const result2 = await transfer('GOLD', 'bob', 'dan', { amount: 300 }, 'transfer');
    console.log(`✅ Transaction completed: ${result2.txId}`);
    console.log(`📋 Proof metadata: ${result2.proofMetadata.proving_system} ${result2.proofMetadata.circuit_name} v${result2.proofMetadata.circuit_version}\n`);

    // Sample 3: Generic state transfer from carol to alice
    console.log('📝 Sample 3: Carol → Alice (Generic State Transfer)');
    const result3 = await transfer('GOLD', 'carol', 'alice', { amount: 200 }, 'generic');
    console.log(`✅ Transaction completed: ${result3.txId}`);
    console.log(`📋 Proof metadata: ${result3.proofMetadata.proving_system} ${result3.proofMetadata.circuit_name} v${result3.proofMetadata.circuit_version}\n`);

    // Sample 4: Transfer from dan to bob
    console.log('📝 Sample 4: Dan → Bob (Basic Transfer)');
    const result4 = await transfer('GOLD', 'dan', 'bob', { amount: 150 }, 'transfer');
    console.log(`✅ Transaction completed: ${result4.txId}`);
    console.log(`📋 Proof metadata: ${result4.proofMetadata.proving_system} ${result4.proofMetadata.circuit_name} v${result4.proofMetadata.circuit_version}\n`);

    // Sample 5: Generic state transfer from alice to dan
    console.log('📝 Sample 5: Alice → Dan (Generic State Transfer)');
    const result5 = await transfer('GOLD', 'alice', 'dan', { amount: 100 }, 'generic');
    console.log(`✅ Transaction completed: ${result5.txId}`);
    console.log(`📋 Proof metadata: ${result5.proofMetadata.proving_system} ${result5.proofMetadata.circuit_name} v${result5.proofMetadata.circuit_version}\n`);

    console.log('🎉 All sample transactions completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- 5 transactions executed');
    console.log('- Enhanced proof metadata generated for all transactions');
    console.log('- Mixed basic and generic state transfers');
    console.log('- All 4 users (alice, bob, carol, dan) participated');

  } catch (error) {
    console.error('❌ Sample transactions failed:', error.message);
    throw error;
  }
}

// Run the sample transactions
if (import.meta.url === `file://${process.argv[1]}`) {
  runSampleTransactions().catch(console.error);
}

export { runSampleTransactions };
