# Token-Based ZK Proof System

A modern, modular zero-knowledge proof system for token transfers with flexible state management and clean service architecture.

## 🚀 Features

- **Token-Based Architecture**: Flexible tokens with customizable state fields instead of simple account balances
- **Multiple Token Types**: Support for Fungible, NFT, Attribute, and Escrow tokens
- **Modular Transfer Flow**: Clean 6-step transfer process with service-based architecture
- **Real ZK Proofs**: Groth16 protocol using SnarkJS for actual zero-knowledge proof generation
- **Clean API**: 87.5% reduction in main API file size through service modularization
- **Production Ready**: Working fungible token transfers with proper error handling
- **Comprehensive APIs**: 15 REST endpoints + JavaScript service modules for all operations
- **Multi-Proving System Support**: Self-describing proofs with metadata and version tracking
- **Database Integration**: Real SQLite database with transaction logging and metadata storage

## 🏗️ Architecture

### Token Types
- **FUNGIBLE** (0): Money-like tokens with `state` representing balance
- **NFT** (1): Non-fungible tokens with `state` representing ownership
- **ATTRIBUTE** (2): Tokens with multiple attributes (`state`, `level`, `power`, `rarity`)
- **ESCROW** (3): Tokens with escrow functionality (`state`, `escrow_provider`, `escrow_status`, `escrow_amount`)

### Service Architecture
- **TokenService**: Token management, validation, and transfer logic
- **ZKProofService**: Zero-knowledge proof generation and circuit integration
- **StorageService**: Database operations and public ledger integration
- **Clean API**: Simple, readable interface for all operations

### Transfer Flow
1. `validate(token)` - Token and transfer validation
2. `initiateTransfer(token, from, to)` - Create transaction log
3. `generateZKProof(txLog, circuit)` - Generate ZK proof
4. `saveTxLog(txLog, proof)` - Save to database
5. `commitTransfer(token)` - Update token states
6. `saveProofInPublicLedger(proof, txLog)` - Save to blockchain
7. `updateTxLogWithLedgerMetadata(txId, ledgerRecord)` - Store ledger metadata

### Database & Storage
- **SQLite Database**: Persistent storage for transaction logs and metadata
- **Transaction Logs**: Complete audit trail with proof metadata and public inputs
- **Proof Metadata**: Embedded cryptographic metadata for verification
- **Public Ledger**: Simulated blockchain storage for proof records
- **Ledger Metadata**: Platform, block ID, and timestamp for complete audit trail
- **Schema**: Modern schema supporting token-based transfers with flexible state fields

## 📦 Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Powers of Tau (PTAU)
```bash
npm run setup
```
This fetches `pot14_final.ptau` (safe for demos). You can replace with your own PTAU file.

### 3. Build Circuits & Generate Keys
```bash
npm run build
```
This generates:
- `build/transfer.r1cs` - Circuit constraints
- `build/transfer_js/transfer.wasm` - Witness generator
- `build/transfer.zkey` - Proving key
- `build/vkey.json` - Verification key
- `build/generic_state_transfer_*` - Generic circuit files

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm test
```

This will test:
- Token management and creation
- Fungible token transfers with real ZK proofs
- Service architecture validation
- Transfer flow implementation
- State validation
- Database operations and transaction logging

## 🎯 Demo

Run the interactive demo:

```bash
npm run demo
```

This showcases:
- System overview and architecture
- Available token types
- Live fungible token transfer
- Token creation
- Service benefits
- Database integration and transaction logging

## 🔧 Development

### Available Scripts

- `npm install` - Install dependencies
- `npm run setup` - Setup powers of tau (PTAU file)
- `npm run build` - Build circuits and generate keys
- `npm test` - Run comprehensive test suite
- `npm run demo` - Run interactive demo
- `npm run server` - Start API server
- `npm run docs` - Serve OpenAPI documentation with Swagger UI
- `npm run cleanup` - Clean temporary files

### API Documentation

For comprehensive API documentation and testing, see the OpenAPI v3 specification:

- **OpenAPI Spec**: `openapi.yaml` - Complete API documentation
- **Interactive Docs**: Import into Swagger UI, Postman, or any OpenAPI-compatible tool
- **Code Generation**: Use for client SDK generation

The OpenAPI specification includes:
- All 15 API endpoints with detailed schemas
- Request/response examples with real data
- Authentication (none required)
- Error responses
- Complete data models
- Multi-proving system metadata schemas

### Interactive Documentation

Start the documentation server:
```bash
npm run docs
```

Then visit:
- **Swagger UI**: http://localhost:8080
- **OpenAPI Spec**: http://localhost:8080/api-docs

You can also import `openapi.yaml` into:
- **Postman**: Import → File → Select openapi.yaml
- **Insomnia**: Import/Export → Import Data → From File
- **Any OpenAPI-compatible tool**

### Project Structure

```
units-prototype/
├── circuits/                 # Circom circuit definitions
│   ├── transfer.circom      # Legacy fungible transfer circuit
│   ├── generic_state_transfer.circom  # Generic state transfer circuit
│   └── nft_transfer.circom  # NFT transfer circuit
├── scripts/
│   ├── services/            # Service modules
│   │   ├── token-service.mjs
│   │   ├── zk-proof-service.mjs
│   │   └── storage-service.mjs
│   ├── api.mjs              # Unified API interface
│   └── utils.mjs            # Utility functions
├── data/
│   └── tx_logs.sqlite       # SQLite database
├── test-system.mjs          # Consolidated test suite
├── demo-system.mjs          # Consolidated demo
└── package.json
```

## 💡 Usage

### Basic Token Transfer

```javascript
import { transfer } from './scripts/api.mjs';

const result = await transfer(
  'GOLD',           // tokenId
  'alice',          // from
  'bob',            // to
  { amount: 100 },  // transferParams
  'transfer'        // transferCircuit
);

console.log('Transfer completed:', result.txId);
```

### Token Creation

```javascript
import { createToken, TOKEN_TYPES } from './scripts/api.mjs';

const newToken = createToken(
  'MY_TOKEN',           // id
  TOKEN_TYPES.FUNGIBLE, // type
  'My Token',           // name
  { state: 1000 }       // initialState
);
```

## 🔌 API Reference

### REST API Endpoints

The system provides a comprehensive REST API for all operations:

#### 1. Transfer APIs

**Token Transfer (New Token-Based API)**
```http
POST /api/transfer
Content-Type: application/json

{
  "tokenId": "GOLD",
  "from": "alice",
  "to": "bob",
  "transferParams": {
    "amount": 100
  },
  "transferCircuit": "transfer"
}
```

**Generic Token Transfer**
```http
POST /api/transfer/generic
Content-Type: application/json

{
  "tokenId": "GOLD",
  "from": "alice",
  "to": "bob",
  "transferParams": {
    "amount": 100
  },
  "transferCircuit": "generic"
}
```

#### 2. Verification API

**Verify ZK Proof**
```http
POST /api/verify
Content-Type: application/json

{
  "txId": "123456789...",
  "proof": {
    "pi_a": ["...", "...", "1"],
    "pi_b": [["...", "..."], ["...", "..."], ["1", "0"]],
    "pi_c": ["...", "...", "1"],
    "protocol": "groth16",
    "curve": "bn128"
  },
  "publicInputs": []
}
```

#### 3. Token Management APIs

**Get All Tokens**
```http
GET /api/tokens
```

**Get Specific Token**
```http
GET /api/tokens/GOLD
```

**Create New Token**
```http
POST /api/tokens
Content-Type: application/json

{
  "id": "DIAMOND",
  "type": 0,
  "name": "Diamond Coins",
  "initialState": {
    "state": 5000
  }
}
```

#### 4. Account Management APIs (Legacy)

**Get All Accounts**
```http
GET /api/accounts
```

**Get Specific Account**
```http
GET /api/accounts/alice
```

#### 5. Transaction APIs

**Get Transaction History**
```http
GET /api/transactions
```

**Get Verification Examples**
```http
GET /api/verify/examples
```

#### 6. Proving System APIs

**Get Available Proving Systems**
```http
GET /api/proving-systems
```

**Get Circuit Information**
```http
GET /api/circuits/transfer
```

#### 7. System APIs

**Health Check**
```http
GET /api/health
```

### JavaScript API (Service Modules)

#### Token Management
```javascript
import { 
  getAllTokens, 
  getToken, 
  createToken, 
  TOKEN_TYPES, 
  STATE_FORMATS 
} from './scripts/api.mjs';

// Get all available tokens
const tokens = getAllTokens();

// Get specific token
const token = getToken('GOLD');

// Create new token
const newToken = createToken('MY_TOKEN', TOKEN_TYPES.FUNGIBLE, 'My Token', { state: 1000 });
```

#### Transfer Operations
```javascript
import { transfer } from './scripts/api.mjs';

// Complete transfer with ZK proof
const result = await transfer(tokenId, from, to, transferParams, circuitType);
```

#### Individual Transfer Steps
```javascript
import { 
  validate, 
  initiateTransfer, 
  generateZKProof, 
  saveTxLog, 
  commitTransfer, 
  saveProofInPublicLedger 
} from './scripts/api.mjs';

// Step 1: Validate
const isValid = validate(token, from, to, transferParams);

// Step 2: Initiate transfer
const txLog = initiateTransfer(token, from, to, transferParams);

// Step 3: Generate ZK proof
const proofResult = await generateZKProof(txLog, 'transfer');

// Step 4: Save transaction log
const savedTxLog = saveTxLog(txLog, proofResult.proof);

// Step 5: Commit transfer
const committedToken = commitTransfer(token, txLog);

// Step 6: Save to public ledger
const ledgerRecord = saveProofInPublicLedger(proofResult.proof, txLog);
```

#### Legacy Transfer API (Deprecated)
```javascript
import { performTransfer, performGenericStateTransfer } from './scripts/api.mjs';

// Legacy fungible transfer (deprecated - use new token API)
const result = await performTransfer({
  senderId: 'alice',
  receiverId: 'bob',
  amount: 100,
  txNonce: Date.now()
});

// Generic state transfer (deprecated - use new token API)
const result = await performGenericStateTransfer({
  senderId: 'alice',
  receiverId: 'bob',
  tokenId: 'GOLD',
  tokenType: 0,
  transferParams: [100, 0, 0, 0],
  txNonce: Date.now()
});
```

### API Response Formats

#### Successful Transfer Response
```json
{
  "success": true,
  "txId": "1755686083734_99h0yewjj",
  "tokenId": "GOLD",
  "tokenType": 0,
  "tokenTypeName": "Fungible Token (Money)",
  "proof": {
    "pi_a": ["17738108795599944046593961283591930027929796387105746714397158305012050376616","8070511102293263255749933291994539073925384635609417980892736373306909763928","1"],
    "pi_b": [["18279747743113295487159666871106001736988254966680293789880335432788879901523","18010585773768601020742372761969843809541216004823653806818821744222207561700"],["3943007578364494876604196204836385797710244629227728131417422591055363151739","20778638317794785080033001679532845730790221553500933810059676663458434966723"],["1","0"]],
    "pi_c": ["14743012890871484247745503170518214683190479954652727421175466190366412903041","7282501469593396103172532788251571914435945877251577187790720939664790233167","1"],
    "protocol": "groth16",
    "curve": "bn128"
  },
  "publicInputs": [],
  "senderStateAfter": {"state": 900},
  "receiverStateAfter": {"state": 1100},
  "rootBefore": "7488310991834394670752332778330065534675339978989929948727192543872523847697",
  "rootAfter": "14180920366909593961669370158428584119653372763201923487217337936705350790696",
  "timestamp": 1755686083734,
        "ledgerRecord": {
        "txId": "1755686083734_99h0yewjj",
        "tokenId": "GOLD",
        "tokenType": 0,
        "proofHash": "19074730123436768511748136068761853236467956668778457402345763466780377356999",
        "timestamp": 1755686083734,
        "status": "committed",
        "provingSystem": "circom",
        "circuitName": "transfer",
        "circuitVersion": "2.1.5",
        "toolVersion": "^0.7.3"
      },
      "proofMetadata": {
        "proving_system": "circom",
        "circuit_name": "transfer",
        "circuit_version": "2.1.5",
        "circuit_file": "circuits/transfer.circom",
        "circuit_hash": "7a0e0fc1844e7d45ab3e6c8a22f757deb8ab783a307c46ed12ace40cbb3b6e82",
        "proving_key_file": "build/transfer.zkey",
        "proving_key_hash": "bfaebc0e660fe682201e9281cdafa0b1a81206bb4054bcc379eb68bc127324be",
        "verification_key_file": "build/vkey.json",
        "verification_key_hash": "420aee34ac3aca293d79435c3562af07eb0a66ecd372f90695aea5d999c88801",
        "tool_version": "^0.7.3",
        "generated_at": "2025-08-20T10:51:14.193Z"
      }
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Token validation failed"
}
```

### Example API Usage

#### cURL Examples

**Token Transfer (Working!):**
```bash
curl -X POST http://localhost:3000/api/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "GOLD",
    "from": "alice",
    "to": "bob",
    "transferParams": {
      "amount": 100
    }
  }'
```

**Create New Token:**
```bash
curl -X POST http://localhost:3000/api/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "id": "DIAMOND",
    "type": 0,
    "name": "Diamond Coins",
    "initialState": {
      "state": 5000
    }
  }'
```

**View All Tokens:**
```bash
curl http://localhost:3000/api/tokens
```

**View Specific Token:**
```bash
curl http://localhost:3000/api/tokens/GOLD
```

**Get Available Proving Systems:**
```bash
curl http://localhost:3000/api/proving-systems
```

**Get Circuit Information:**
```bash
curl http://localhost:3000/api/circuits/transfer
```

**Verify Proof:**
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "txId": "1755686083734_99h0yewjj",
    "proof": {...},
    "publicInputs": []
  }'
```

#### JavaScript Examples

**Complete Transfer Flow (Working!):**
```javascript
import { transfer } from './scripts/api.mjs';

try {
  const result = await transfer(
    'GOLD',           // tokenId
    'alice',          // from
    'bob',            // to
    { amount: 100 },  // transferParams
    'transfer'        // transferCircuit
  );
  
  console.log('Transfer successful:', result.txId);
  console.log('ZK Proof generated:', !!result.proof);
  console.log('New balances:', {
    alice: result.senderStateAfter.state,
    bob: result.receiverStateAfter.state
  });
  console.log('Merkle roots:', {
    before: result.rootBefore,
    after: result.rootAfter
  });
  
} catch (error) {
  console.error('Transfer failed:', error.message);
}
```

**Token Management:**
```javascript
import { getAllTokens, createToken, TOKEN_TYPES } from './scripts/api.mjs';

// List all tokens
const tokens = getAllTokens();
console.log('Available tokens:', tokens.map(t => t.id));

// Create new fungible token
const newToken = createToken(
  'DIAMOND',
  TOKEN_TYPES.FUNGIBLE,
  'Diamond Coins',
  { state: 5000 }
);
console.log('Created token:', newToken);

// Get specific token
const goldToken = getToken('GOLD');
console.log('GOLD token state:', goldToken.state);
```

## 🔍 Key Improvements

### Before vs After
- **API Size**: 400+ lines → 50 lines (87.5% reduction)
- **Architecture**: Monolithic → Service-based modular design
- **Token System**: Account/balance → Flexible token/state system
- **Test Scripts**: 8 separate files → 2 consolidated files
- **Maintainability**: High complexity → Clean, readable code

### Technical Achievements
- ✅ Working fungible token transfers with real ZK proofs
- ✅ Modular service architecture
- ✅ Clean, testable code structure
- ✅ Comprehensive error handling
- ✅ Production-ready foundation
- ✅ Real database integration with SQLite
- ✅ Complete transaction logging and metadata storage

## 🚧 Current Status

- **✅ Complete**: Fungible token transfers with ZK proofs (Working!)
- **✅ Complete**: Service-based architecture (Working!)
- **✅ Complete**: Clean API and consolidated scripts (Working!)
- **✅ Complete**: REST API endpoints (All 15 endpoints working!)
- **✅ Complete**: File cleanup system (No more accumulating files!)
- **✅ Complete**: BigInt serialization fixes (All APIs working!)
- **✅ Complete**: Multi-proving system support with self-describing proofs
- **🔄 Pending**: NFT and attribute token transfers (requires circuit compilation)
- **✅ Complete**: Real database integration with SQLite (transaction logs and metadata storage)
- **🔄 Pending**: Blockchain integration for public ledger

## 📚 Dependencies

- **snarkjs**: ZK proof generation and verification
- **circomlib**: Cryptographic primitives
- **better-sqlite3**: Database operations
- **express**: API server (if needed)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
