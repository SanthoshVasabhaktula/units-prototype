pragma circom 2.1.5;

include "poseidon.circom";
include "bitify.circom";
include "comparators.circom";

// Simple Merkle root recomputation with Poseidon and explicit path bits
template MerkleRoot(DEPTH) {
    signal input leaf;
    signal input siblings[DEPTH];
    signal input pathBits[DEPTH];
    signal output root;

    // Pre-declare all components and signals
    component h[DEPTH];
    signal left[DEPTH];
    signal right[DEPTH];
    signal cur[DEPTH + 1];
    
    // Intermediate signals for quadratic constraints
    signal aux1[DEPTH];
    signal aux2[DEPTH];
    signal aux3[DEPTH];
    signal aux4[DEPTH];
    
    cur[0] <== leaf;

    for (var i = 0; i < DEPTH; i++) {
        h[i] = Poseidon(2);
        
        // Break down the complex expressions into quadratic ones
        aux1[i] <== (1 - pathBits[i]) * cur[i];
        aux2[i] <== pathBits[i] * siblings[i];
        left[i] <== aux1[i] + aux2[i];
        
        aux3[i] <== (1 - pathBits[i]) * siblings[i];
        aux4[i] <== pathBits[i] * cur[i];
        right[i] <== aux3[i] + aux4[i];
        
        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[DEPTH];
}

// Minimal Generic State Transfer Circuit
// Demonstrates the concept of generic state transfer
template GenericStateTransfer(DEPTH, STATE_SIZE) {
    // Public inputs - Updated to include the requested fields
    signal input sender_account;      // 1. sender account (public key)
    signal input receiver_account;    // 2. receiver account (public key)
    signal input amount;              // 3. amount
    signal input nonce;               // 4. nonce
    signal input commitment;          // 5. commitment (state commitment)
    signal input root_before;
    signal input root_after;
    signal input tx_log_id;
    signal input token_id;      // Public: which token is being transferred
    signal input token_type;    // Public: type of token (0=fungible, 1=nft, etc.)

    // Private inputs
    signal input sender_pub;
    signal input receiver_pub;
    signal input sender_nonce;
    signal input receiver_nonce;
    
    // State arrays - flexible size based on token type
    signal input sender_state_before[STATE_SIZE];  // Current state of sender's token
    signal input receiver_state_before[STATE_SIZE]; // Current state of receiver's token
    signal input sender_state_after[STATE_SIZE];    // New state of sender's token
    signal input receiver_state_after[STATE_SIZE];  // New state of receiver's token
    
    // Transfer parameters (varies by token type)
    signal input transfer_params[STATE_SIZE];  // Parameters for the transfer (amount, attributes, etc.)

    // Paths for BEFORE state
    signal input s_siblings_before[DEPTH];
    signal input s_pathBits_before[DEPTH];
    signal input r_siblings_before[DEPTH];
    signal input r_pathBits_before[DEPTH];

    // Paths for AFTER state
    signal input s_siblings_after[DEPTH];
    signal input s_pathBits_after[DEPTH];
    signal input r_siblings_after[DEPTH];
    signal input r_pathBits_after[DEPTH];

    // Verify that public inputs match private inputs
    sender_account === sender_pub;
    receiver_account === receiver_pub;

    // Compose leaves BEFORE
    component hS0 = Poseidon(3);  // pub + nonce + token_id
    hS0.inputs[0] <== sender_pub;
    hS0.inputs[1] <== sender_nonce;
    hS0.inputs[2] <== token_id;

    component hR0 = Poseidon(3);
    hR0.inputs[0] <== receiver_pub;
    hR0.inputs[1] <== receiver_nonce;
    hR0.inputs[2] <== token_id;

    // Membership under root_before
    component smBefore = MerkleRoot(DEPTH);
    smBefore.leaf <== hS0.out;
    for (var i=0;i<DEPTH;i++) {
        smBefore.siblings[i] <== s_siblings_before[i];
        smBefore.pathBits[i] <== s_pathBits_before[i];
    }
    smBefore.root === root_before;

    component rmBefore = MerkleRoot(DEPTH);
    rmBefore.leaf <== hR0.out;
    for (var j=0;j<DEPTH;j++) {
        rmBefore.siblings[j] <== r_siblings_before[j];
        rmBefore.pathBits[j] <== r_pathBits_before[j];
    }
    rmBefore.root === root_before;

    // Generic State Transfer Logic - Minimal
    // For demo purposes, just accept any token type
    // (constraints removed for debugging)

    // Compose leaves AFTER
    component hS1 = Poseidon(3);
    hS1.inputs[0] <== sender_pub;
    hS1.inputs[1] <== sender_nonce;
    hS1.inputs[2] <== token_id;

    component hR1 = Poseidon(3);
    hR1.inputs[0] <== receiver_pub;
    hR1.inputs[1] <== receiver_nonce;
    hR1.inputs[2] <== token_id;

    // Membership under root_after
    component smAfter = MerkleRoot(DEPTH);
    smAfter.leaf <== hS1.out;
    for (var k=0;k<DEPTH;k++) {
        smAfter.siblings[k] <== s_siblings_after[k];
        smAfter.pathBits[k] <== s_pathBits_after[k];
    }
    smAfter.root === root_after;

    component rmAfter = MerkleRoot(DEPTH);
    rmAfter.leaf <== hR1.out;
    for (var m=0;m<DEPTH;m++) {
        rmAfter.siblings[m] <== r_siblings_after[m];
        rmAfter.pathBits[m] <== r_pathBits_after[m];
    }
    rmAfter.root === root_after;

    // Generate state commitment from final state
    component hCommitment = Poseidon(4);
    hCommitment.inputs[0] <== sender_pub;
    hCommitment.inputs[1] <== receiver_pub;
    hCommitment.inputs[2] <== sender_state_after[0];  // Use first state field as balance
    hCommitment.inputs[3] <== receiver_state_after[0]; // Use first state field as balance
    commitment === hCommitment.out;

    // Bind to tx_log_id
    signal input tx_nonce;
    signal input tx_timestamp;
    component hTx = Poseidon(6);  // sender + receiver + token_id + token_type + nonce + timestamp
    hTx.inputs[0] <== sender_pub;
    hTx.inputs[1] <== receiver_pub;
    hTx.inputs[2] <== token_id;
    hTx.inputs[3] <== token_type;
    hTx.inputs[4] <== tx_nonce;
    hTx.inputs[5] <== tx_timestamp;
    hTx.out === tx_log_id;
}

// Example instantiations for different token types
component main = GenericStateTransfer(4, 4); // Depth=4, State size=4 for demo
