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

// NFT Transfer Circuit
// Proves: NFT ownership transfer from sender to receiver
// Constraints: Only current owner can transfer, NFT can only be owned by one person at a time
template NFTTransfer(DEPTH) {
    // Public inputs
    signal input root_before;
    signal input root_after;
    signal input tx_log_id;
    signal input nft_id;  // Public: which NFT is being transferred

    // Private inputs
    signal input sender_pub;
    signal input receiver_pub;
    signal input sender_owns_nft_before;  // 1 if sender owns, 0 if not
    signal input receiver_owns_nft_before; // 1 if receiver owns, 0 if not
    signal input sender_nonce;
    signal input receiver_nonce;

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

    // Compose leaves BEFORE (NFT ownership state)
    component hS0 = Poseidon(4);  // pub + owns_nft + nonce + nft_id
    hS0.inputs[0] <== sender_pub;
    hS0.inputs[1] <== sender_owns_nft_before;
    hS0.inputs[2] <== sender_nonce;
    hS0.inputs[3] <== nft_id;

    component hR0 = Poseidon(4);
    hR0.inputs[0] <== receiver_pub;
    hR0.inputs[1] <== receiver_owns_nft_before;
    hR0.inputs[2] <== receiver_nonce;
    hR0.inputs[3] <== nft_id;

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

    // NFT Transfer Logic (Binary ownership)
    signal sender_owns_nft_after;
    signal receiver_owns_nft_after;
    
    // Sender loses ownership (becomes 0)
    sender_owns_nft_after <== sender_owns_nft_before * 0;
    
    // Receiver gains ownership (becomes 1)
    receiver_owns_nft_after <== receiver_owns_nft_before + 1;
    
    // Critical constraints for NFT transfer
    // 1. Only current owner can transfer
    sender_owns_nft_before === 1;
    
    // 2. Receiver didn't own it before
    receiver_owns_nft_before === 0;
    
    // 3. After transfer: sender doesn't own, receiver does own
    sender_owns_nft_after === 0;
    receiver_owns_nft_after === 1;
    
    // 4. Binary constraint: ownership can only be 0 or 1
    component sBitBefore = Num2Bits(1);
    sBitBefore.in <== sender_owns_nft_before;
    component rBitBefore = Num2Bits(1);
    rBitBefore.in <== receiver_owns_nft_before;
    component sBitAfter = Num2Bits(1);
    sBitAfter.in <== sender_owns_nft_after;
    component rBitAfter = Num2Bits(1);
    rBitAfter.in <== receiver_owns_nft_after;

    // Compose leaves AFTER
    component hS1 = Poseidon(4);
    hS1.inputs[0] <== sender_pub;
    hS1.inputs[1] <== sender_owns_nft_after;
    hS1.inputs[2] <== sender_nonce;
    hS1.inputs[3] <== nft_id;

    component hR1 = Poseidon(4);
    hR1.inputs[0] <== receiver_pub;
    hR1.inputs[1] <== receiver_owns_nft_after;
    hR1.inputs[2] <== receiver_nonce;
    hR1.inputs[3] <== nft_id;

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

    // Bind to tx_log_id
    signal input tx_nonce;
    signal input tx_timestamp;
    component hTx = Poseidon(6);  // sender + receiver + nft_id + nonce + timestamp
    hTx.inputs[0] <== sender_pub;
    hTx.inputs[1] <== receiver_pub;
    hTx.inputs[2] <== nft_id;
    hTx.inputs[3] <== tx_nonce;
    hTx.inputs[4] <== tx_timestamp;
    hTx.out === tx_log_id;
}

component main = NFTTransfer(4); // Depth=4 (16 leaves) for demo
