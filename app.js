// app.js
// Express-based server with zero-knowledge proof APIs:
// 1. Transfer API: perform balance transfer with ZK proof generation
// 2. Verify API: verify zkSNARK proofs
// 3. Accounts API: manage accounts
// 4. Transactions API: query transaction history

import express from 'express';
import cors from 'cors';
import { transfer, getAllTokens, getToken, createToken, TOKEN_TYPES } from './scripts/token-api.mjs';
import { verifyProof, getVerificationExamples } from './scripts/api.mjs';
import { getAllAccounts, getAccount, getLastTx } from './scripts/utils.mjs';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// --- API 1: Token Transfer with ZK Proof (New Token-Based API) ---
app.post('/api/transfer', async (req, res) => {
  try {
    const { tokenId, from, to, transferParams, transferCircuit } = req.body;
    
    if (!tokenId || !from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenId, from, to'
      });
    }

    // Default to fungible transfer if no transferParams provided
    const params = transferParams || { amount: 100 };
    const circuit = transferCircuit || 'transfer';

    const result = await transfer(
      tokenId,
      from,
      to,
      params,
      circuit
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 2: Generic Token Transfer with ZK Proof ---
app.post('/api/transfer/generic', async (req, res) => {
  try {
    const { tokenId, from, to, transferParams, transferCircuit } = req.body;
    
    if (!tokenId || !from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenId, from, to'
      });
    }

    // Default to generic circuit if not specified
    const circuit = transferCircuit || 'generic';
    const params = transferParams || {};

    const result = await transfer(
      tokenId,
      from,
      to,
      params,
      circuit
    );

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

// --- API 4: Get All Tokens ---
app.get('/api/tokens', (req, res) => {
  try {
    const tokens = getAllTokens();
    res.json({
      success: true,
      tokens: tokens
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 5: Get Specific Token ---
app.get('/api/tokens/:tokenId', (req, res) => {
  try {
    const token = getToken(req.params.tokenId);
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      token: token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 6: Create Token ---
app.post('/api/tokens', (req, res) => {
  try {
    const { id, type, name, initialState } = req.body;
    
    if (!id || type === undefined || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: id, type, name'
      });
    }

    const token = createToken(id, type, name, initialState || {});
    res.json({
      success: true,
      token: token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// --- API 7: Get Accounts (Legacy) ---
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

// --- API 8: Get Specific Account (Legacy) ---
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

// --- API 9: Get Transaction History ---
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

// --- API 10: Get Verification Examples ---
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

// --- API 11: Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Token-Based ZK Proof Server running on port ${PORT}`);
  console.log('\n📋 Available APIs:');
  console.log('  POST /api/transfer        - Token transfer with ZK proof (New)');
  console.log('  POST /api/transfer/generic - Generic token transfer with ZK proof');
  console.log('  POST /api/tokens          - Create new token');
  console.log('  GET  /api/tokens          - View all tokens');
  console.log('  GET  /api/tokens/:id      - View specific token');
  console.log('  POST /api/verify          - Verify ZK proof');
  console.log('  GET  /api/accounts        - View all accounts (Legacy)');
  console.log('  GET  /api/accounts/:id    - View specific account (Legacy)');
  console.log('  GET  /api/transactions    - View transaction history');
  console.log('  GET  /api/verify/examples - Get verification examples');
  console.log('  GET  /api/health          - Health check');
  console.log('\n📖 Example usage:');
  console.log('  # Token transfer (GOLD from alice to bob):');
  console.log('  curl -X POST http://localhost:3000/api/transfer \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"tokenId":"GOLD","from":"alice","to":"bob","transferParams":{"amount":100}}\'');
  console.log('  # Create new token:');
  console.log('  curl -X POST http://localhost:3000/api/tokens \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"id":"DIAMOND","type":0,"name":"Diamond Coins","initialState":{"state":5000}}\'');
  console.log('  # View all tokens:');
  console.log('  curl http://localhost:3000/api/tokens');
});