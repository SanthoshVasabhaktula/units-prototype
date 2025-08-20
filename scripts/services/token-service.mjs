// Token Service - Handles token management and business logic
import { generateUniqueId } from '../utils.mjs';

// Token Type Definitions
export const TOKEN_TYPES = {
  FUNGIBLE: 0,      // Money-like tokens with balance
  NFT: 1,           // Non-fungible tokens with ownership
  ATTRIBUTE: 2,     // Tokens with multiple attributes
  ESCROW: 3         // Tokens with escrow functionality
};

// State Format Definitions
export const STATE_FORMATS = {
  [TOKEN_TYPES.FUNGIBLE]: {
    description: "Fungible Token (Money)",
    format: ["state", "reserved", "unused", "unused"],
    example: [1000, 0, 0, 0] // 1000 units state
  },
  [TOKEN_TYPES.NFT]: {
    description: "Non-fungible Token",
    format: ["state", "escrow_provider", "unused", "unused"],
    example: [1, 0, 0, 0] // Owned (state=1), no escrow
  },
  [TOKEN_TYPES.ATTRIBUTE]: {
    description: "Attribute Token (Gaming)",
    format: ["state", "level", "power", "rarity"],
    example: [1, 5, 100, 3] // Owned (state=1), level 5, power 100, rarity 3
  },
  [TOKEN_TYPES.ESCROW]: {
    description: "Escrow Token",
    format: ["state", "escrow_provider", "escrow_status", "escrow_amount"],
    example: [1, 123, 1, 500] // Owned (state=1), escrow provider 123, active escrow, amount 500
  }
};

// Token Manager Class
class TokenManager {
  constructor() {
    this.tokens = new Map();
    this.initializeDemoTokens();
  }

  initializeDemoTokens() {
    // Initialize demo tokens
    this.createToken("GOLD", TOKEN_TYPES.FUNGIBLE, "Gold Coins", { state: 1000 });
    this.createToken("SILVER", TOKEN_TYPES.FUNGIBLE, "Silver Coins", { state: 500 });
    this.createToken("SWORD", TOKEN_TYPES.NFT, "Magic Sword", { state: 1 });
    this.createToken("SHIELD", TOKEN_TYPES.NFT, "Dragon Shield", { state: 1 });
    this.createToken("HERO", TOKEN_TYPES.ATTRIBUTE, "Hero Character", { state: 1, level: 5, power: 100, rarity: 3 });
    this.createToken("ESCROW_GOLD", TOKEN_TYPES.ESCROW, "Escrow Gold", { state: 1, escrow_provider: 123, escrow_status: 1, escrow_amount: 500 });
  }

  createToken(id, type, name, initialState) {
    const token = {
      id,
      type,
      name,
      metadata: {
        description: STATE_FORMATS[type].description,
        format: STATE_FORMATS[type].format,
        created_at: Date.now()
      },
      state: initialState
    };
    this.tokens.set(id, token);
    return token;
  }

  getToken(tokenId) {
    return this.tokens.get(tokenId);
  }

  getAllTokens() {
    return Array.from(this.tokens.values());
  }

  updateTokenState(tokenId, newState) {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token '${tokenId}' not found`);
    }
    token.state = { ...token.state, ...newState };
    return token;
  }
}

// Global token manager instance
const tokenManager = new TokenManager();

// Token Validation Service
export class TokenValidationService {
  static validate(token, from, to, transferParams = {}) {
    console.log(`▶ Validating transfer: ${from} → ${to}, token: ${token.id}`);
    
    // Basic validation
    if (!token) {
      throw new Error("Token is required");
    }
    if (!from || !to) {
      throw new Error("Sender and receiver are required");
    }
    if (from === to) {
      throw new Error("Sender and receiver cannot be the same");
    }

    // Token-specific validation
    switch (token.type) {
      case TOKEN_TYPES.FUNGIBLE:
        const amount = transferParams.amount || 0;
        if (amount <= 0) {
          throw new Error("Transfer amount must be positive");
        }
        if (token.state.state < amount) {
          throw new Error(`Insufficient balance. Available: ${token.state.state}, Required: ${amount}`);
        }
        break;

      case TOKEN_TYPES.NFT:
        if (token.state.state !== 1) {
          throw new Error("NFT must be owned (state=1) to transfer");
        }
        break;

      case TOKEN_TYPES.ATTRIBUTE:
        if (token.state.state !== 1) {
          throw new Error("Attribute token must be owned (state=1) to transfer");
        }
        break;

      case TOKEN_TYPES.ESCROW:
        if (token.state.state !== 1) {
          throw new Error("Escrow token must be owned (state=1) to transfer");
        }
        if (token.state.escrow_status === 1) {
          throw new Error("Cannot transfer token while in active escrow");
        }
        break;

      default:
        throw new Error(`Unknown token type: ${token.type}`);
    }

    console.log("✅ Token validation passed");
    return true;
  }
}

// Transfer Service
export class TransferService {
  static initiateTransfer(token, from, to, transferParams = {}) {
    console.log(`▶ Initiating transfer: ${from} → ${to}, token: ${token.id}`);
    
    // Create transaction log
    const txLog = {
      id: generateUniqueId(),
      tokenId: token.id,
      tokenType: token.type,
      from,
      to,
      transferParams,
      timestamp: Date.now(),
      status: 'initiated',
      stateBefore: {
        sender: { ...token.state },
        receiver: { ...token.state } // Will be updated based on transfer type
      },
      stateAfter: null, // Will be calculated during transfer
      merkleData: null, // Will be populated during ZK proof generation
      proof: null // Will be populated after ZK proof generation
    };

    // Calculate state changes based on token type
    const { senderStateAfter, receiverStateAfter } = this.calculateStateChanges(
      token.type, 
      txLog.stateBefore.sender, 
      txLog.stateBefore.receiver, 
      transferParams
    );

    txLog.stateAfter = {
      sender: senderStateAfter,
      receiver: receiverStateAfter
    };

    console.log("✅ Transfer initiated, transaction log created");
    return txLog;
  }

  static calculateStateChanges(tokenType, senderState, receiverState, transferParams) {
    const senderAfter = { ...senderState };
    const receiverAfter = { ...receiverState };
    
    switch (tokenType) {
      case TOKEN_TYPES.FUNGIBLE:
        const amount = transferParams.amount || 0;
        senderAfter.state = senderState.state - amount;
        receiverAfter.state = receiverState.state + amount;
        break;
        
      case TOKEN_TYPES.NFT:
        senderAfter.state = 0; // Sender loses ownership
        receiverAfter.state = 1; // Receiver gains ownership
        break;
        
      case TOKEN_TYPES.ATTRIBUTE:
        // Transfer all attributes
        senderAfter.state = 0;
        senderAfter.level = 0;
        senderAfter.power = 0;
        senderAfter.rarity = 0;
        
        receiverAfter.state = 1;
        receiverAfter.level = senderState.level;
        receiverAfter.power = senderState.power;
        receiverAfter.rarity = senderState.rarity;
        break;
        
      case TOKEN_TYPES.ESCROW:
        senderAfter.state = 0; // Sender loses ownership
        receiverAfter.state = 1; // Receiver gains ownership
        receiverAfter.escrow_provider = transferParams.escrow_provider || 0;
        break;
    }
    
    return { senderStateAfter: senderAfter, receiverStateAfter: receiverAfter };
  }

  static commitTransfer(token, txLog) {
    console.log(`▶ Committing transfer: ${txLog.from} → ${txLog.to}, token: ${token.id}`);
    
    // Update token states based on transaction log
    const updatedToken = tokenManager.updateTokenState(token.id, txLog.stateAfter.sender);
    
    // In a real implementation, you would also update the receiver's token state
    // For now, we'll just update the sender's state
    
    console.log("✅ Transfer committed to database");
    return updatedToken;
  }
}

// Public API
export function getAllTokens() {
  return tokenManager.getAllTokens();
}

export function getToken(tokenId) {
  return tokenManager.getToken(tokenId);
}

export function createToken(id, type, name, initialState) {
  return tokenManager.createToken(id, type, name, initialState);
}

export { tokenManager };
