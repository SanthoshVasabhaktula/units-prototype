// app.js
// Express-based server with zero-knowledge proof APIs:
// 1. Transfer API: perform balance transfer with ZK proof generation
// 2. Verify API: verify zkSNARK proofs
// 3. Accounts API: manage accounts
// 4. Transactions API: query transaction history

import express from 'express';
import cors from 'cors';
import { performTransfer, performGenericStateTransfer, verifyProof, getVerificationExamples } from './scripts/api.mjs';
import { getAllAccounts, getAccount, getLastTx } from './scripts/utils.mjs';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// --- API 1: Transfer with ZK Proof (Legacy) ---
app.post('/api/transfer', async (req, res) => {
  try {
    const { senderId, receiverId, amount, txNonce } = req.body;
    
    if (!senderId || !receiverId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: senderId, receiverId, amount'
      });
    }

    const result = await performTransfer({
      senderId,
      receiverId,
      amount: parseInt(amount),
      txNonce: txNonce || Date.now()
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 2: Generic State Transfer with ZK Proof ---
app.post('/api/transfer/generic', async (req, res) => {
  try {
    const { senderId, receiverId, tokenId, tokenType, transferParams, txNonce } = req.body;
    
    if (!senderId || !receiverId || !tokenId || tokenType === undefined || !transferParams) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: senderId, receiverId, tokenId, tokenType, transferParams'
      });
    }

    const result = await performGenericStateTransfer({
      senderId,
      receiverId,
      tokenId: parseInt(tokenId),
      tokenType: parseInt(tokenType),
      transferParams: transferParams.map(p => parseInt(p)),
      txNonce: txNonce || Date.now()
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 3: Verify ZK Proof ---
app.post('/api/verify', async (req, res) => {
  try {
    const { txId, proof, publicInputs } = req.body;
    
    if (!proof) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: proof'
      });
    }

    const result = await verifyProof({
      txId,
      proof,
      publicInputs: publicInputs || []
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 4: Get Accounts ---
app.get('/api/accounts', (req, res) => {
  try {
    const accounts = getAllAccounts();
    res.json({
      success: true,
      accounts: accounts.map(acc => ({
        id: acc.id,
        balance: acc.bal.toString(),
        publicKey: acc.pub.toString(),
        nonce: acc.nonce.toString(),
        treeIndex: acc.idx
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 5: Get Specific Account ---
app.get('/api/accounts/:accountId', (req, res) => {
  try {
    const account = getAccount(req.params.accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      account: {
        id: account.id,
        balance: account.bal.toString(),
        publicKey: account.pub.toString(),
        nonce: account.nonce.toString(),
        treeIndex: account.idx
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 6: Get Transaction History ---
app.get('/api/transactions', (req, res) => {
  try {
    const lastTx = getLastTx();
    res.json({
      success: true,
      lastTransaction: lastTx
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 7: Get Verification Examples ---
app.get('/api/verify/examples', (req, res) => {
  try {
    const examples = getVerificationExamples();
    res.json({
      success: true,
      ...examples
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 8: Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Zero-Knowledge Proof Server running on port ${PORT}`);
  console.log('\n📋 Available APIs:');
  console.log('  POST /api/transfer        - Transfer funds with ZK proof (Legacy)');
  console.log('  POST /api/transfer/generic - Generic state transfer with ZK proof');
  console.log('  POST /api/verify          - Verify ZK proof');
  console.log('  GET  /api/accounts        - View all accounts');
  console.log('  GET  /api/accounts/:id    - View specific account');
  console.log('  GET  /api/transactions    - View transaction history');
  console.log('  GET  /api/verify/examples - Get verification examples');
  console.log('  GET  /api/health          - Health check');
  console.log('\n📖 Example usage:');
  console.log('  # Legacy fungible transfer:');
  console.log('  curl -X POST http://localhost:3000/api/transfer \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"senderId":"alice","receiverId":"bob","amount":1000}\'');
  console.log('  # Generic NFT transfer:');
  console.log('  curl -X POST http://localhost:3000/api/transfer/generic \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"senderId":"alice","receiverId":"bob","tokenId":123,"tokenType":1,"transferParams":[0,0,0,0]}\'');
});