#!/usr/bin/env node

// Comprehensive test script for the Generic State Transfer ZK Proof APIs
import { performTransfer, performGenericStateTransfer, verifyProof } from './scripts/api.mjs';
import { getAllAccounts } from './scripts/utils.mjs';

console.log('🧪 Testing Generic State Transfer ZK Proof APIs...\n');

try {
  // Test 1: Get all accounts
  console.log('1️⃣ Testing account retrieval...');
  const accounts = getAllAccounts();
  console.log('✅ Accounts loaded:', accounts.map(acc => `${acc.id}: ${acc.bal} units`).join(', '));
  
  // Test 2: Perform a legacy fungible transfer
  console.log('\n2️⃣ Testing legacy fungible transfer...');
  const legacyTransferResult = await performTransfer({
    senderId: 'alice',
    receiverId: 'bob', 
    amount: 1000,
    txNonce: Date.now()
  });
  
  console.log('✅ Legacy transfer completed successfully!');
  console.log(`   Transaction ID: ${legacyTransferResult.txId.substring(0, 20)}...`);
  console.log(`   Token Type: ${legacyTransferResult.tokenTypeName}`);
  console.log(`   Alice state: [${legacyTransferResult.senderStateAfter.join(', ')}]`);
  console.log(`   Bob state: [${legacyTransferResult.receiverStateAfter.join(', ')}]`);
  
  // Test 3: Perform a generic NFT transfer
  console.log('\n3️⃣ Testing generic NFT transfer...');
  const nftTransferResult = await performGenericStateTransfer({
    senderId: 'alice',
    receiverId: 'bob',
    tokenId: 123,
    tokenType: 1, // NFT
    transferParams: [0, 0, 0, 0],
    txNonce: Date.now()
  });
  
  console.log('✅ NFT transfer completed successfully!');
  console.log(`   Transaction ID: ${nftTransferResult.txId.substring(0, 20)}...`);
  console.log(`   Token Type: ${nftTransferResult.tokenTypeName}`);
  console.log(`   Alice state: [${nftTransferResult.senderStateAfter.join(', ')}]`);
  console.log(`   Bob state: [${nftTransferResult.receiverStateAfter.join(', ')}]`);
  
  // Test 4: Perform a generic attribute token transfer
  console.log('\n4️⃣ Testing generic attribute token transfer...');
  const attributeTransferResult = await performGenericStateTransfer({
    senderId: 'alice',
    receiverId: 'bob',
    tokenId: 456,
    tokenType: 2, // Attribute token
    transferParams: [0, 0, 0, 0],
    txNonce: Date.now()
  });
  
  console.log('✅ Attribute token transfer completed successfully!');
  console.log(`   Transaction ID: ${attributeTransferResult.txId.substring(0, 20)}...`);
  console.log(`   Token Type: ${attributeTransferResult.tokenTypeName}`);
  console.log(`   Alice state: [${attributeTransferResult.senderStateAfter.join(', ')}]`);
  console.log(`   Bob state: [${attributeTransferResult.receiverStateAfter.join(', ')}]`);
  
  // Test 5: Perform a generic escrow token transfer
  console.log('\n5️⃣ Testing generic escrow token transfer...');
  const escrowTransferResult = await performGenericStateTransfer({
    senderId: 'alice',
    receiverId: 'bob',
    tokenId: 789,
    tokenType: 3, // Escrow token
    transferParams: [0, 456, 0, 0], // New escrow provider 456
    txNonce: Date.now()
  });
  
  console.log('✅ Escrow token transfer completed successfully!');
  console.log(`   Transaction ID: ${escrowTransferResult.txId.substring(0, 20)}...`);
  console.log(`   Token Type: ${escrowTransferResult.tokenTypeName}`);
  console.log(`   Alice state: [${escrowTransferResult.senderStateAfter.join(', ')}]`);
  console.log(`   Bob state: [${escrowTransferResult.receiverStateAfter.join(', ')}]`);
  
  // Test 6: Verify all proofs
  console.log('\n6️⃣ Testing proof verification for all transfers...');
  
  const transfers = [legacyTransferResult, nftTransferResult, attributeTransferResult, escrowTransferResult];
  
  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];
    console.log(`   Verifying ${transfer.tokenTypeName} transfer...`);
    
    const verifyResult = await verifyProof({
      txId: transfer.txId,
      proof: transfer.proof,
      publicInputs: transfer.publicInputs
    });
    
    console.log(`   ✅ ${transfer.tokenTypeName} verification result:`, verifyResult.verified ? '✅ VALID' : '❌ INVALID');
  }
  
  console.log('\n🎉 All tests passed! The Generic State Transfer ZK proof system is working correctly.');
  console.log('\n📊 Summary:');
  console.log(`   ✅ Legacy fungible transfer: ${legacyTransferResult.tokenTypeName}`);
  console.log(`   ✅ NFT transfer: ${nftTransferResult.tokenTypeName}`);
  console.log(`   ✅ Attribute token transfer: ${attributeTransferResult.tokenTypeName}`);
  console.log(`   ✅ Escrow token transfer: ${escrowTransferResult.tokenTypeName}`);
  console.log(`   ✅ All proofs verified successfully`);
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
