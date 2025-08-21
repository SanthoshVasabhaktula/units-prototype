pragma circom 2.1.5;

include "poseidon.circom";
include "bitify.circom";
include "comparators.circom";

// Simple Merkle root recomputation with Poseidon and explicit path bits
// siblings[d] are the sibling nodes from leaf to root
// pathBits[d] are 0 if leaf is left child at that level, 1 if right

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
        // left[i] = (1 - pathBits[i]) * cur[i] + pathBits[i] * siblings[i]
        aux1[i] <== (1 - pathBits[i]) * cur[i];
        aux2[i] <== pathBits[i] * siblings[i];
        left[i] <== aux1[i] + aux2[i];
        
        // right[i] = (1 - pathBits[i]) * siblings[i] + pathBits[i] * cur[i]
        aux3[i] <== (1 - pathBits[i]) * siblings[i];
        aux4[i] <== pathBits[i] * cur[i];
        right[i] <== aux3[i] + aux4[i];
        
        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[DEPTH];
}

// Proves: two accounts existed under root_before; balances updated by `amount` to produce root_after;
// binds to tx_log_id = Poseidon(sender_pub, receiver_pub, amount, tx_nonce, tx_timestamp)

template Transfer(DEPTH) {
    // Private inputs
    signal input sender_pub;
    signal input receiver_pub;
    signal input sender_before;
    signal input receiver_before;
    signal input sender_nonce;
    signal input receiver_nonce;

    // Public inputs (declared in main component)
    signal input sender_account;
    signal input receiver_account;
    signal input amount;
    signal input nonce;
    signal input root_before;
    signal input root_after;
    signal input tx_log_id;
    
    // After balances (provided by API, validated by circuit)
    signal input sender_after_provided;
    signal input receiver_after_provided;
    
    // Output commitment
    signal output commitment;

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

    // Compose leaves BEFORE
    component hS0 = Poseidon(3);
    hS0.inputs[0] <== sender_pub;
    hS0.inputs[1] <== sender_before;
    hS0.inputs[2] <== sender_nonce;

    component hR0 = Poseidon(3);
    hR0.inputs[0] <== receiver_pub;
    hR0.inputs[1] <== receiver_before;
    hR0.inputs[2] <== receiver_nonce;

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

    // Validate that public inputs match private inputs
    sender_account === sender_pub;
    receiver_account === receiver_pub;

    // Balance updates (calculated by circuit)
    signal sender_after;
    signal receiver_after;
    sender_after <== sender_before - amount;
    receiver_after <== receiver_before + amount;

    // Validate that provided after balances match calculated values
    sender_after === sender_after_provided;
    receiver_after === receiver_after_provided;

    // Generate state commitment (computed by circuit)
    component hCommitment = Poseidon(4);
    hCommitment.inputs[0] <== sender_after;
    hCommitment.inputs[1] <== receiver_after;
    hCommitment.inputs[2] <== sender_nonce;
    hCommitment.inputs[3] <== receiver_nonce;
    commitment <== hCommitment.out;

    // Range checks (64-bit) to avoid wraparound
    component sbits = Num2Bits(64);
    sbits.in <== sender_after;
    component rbits = Num2Bits(64);
    rbits.in <== receiver_after;
    component abits = Num2Bits(64);
    abits.in <== amount;

    // Ensure sender_before >= amount
    component ge = LessThan(64);
    ge.in[0] <== amount;         // amount < sender_before+1
    ge.in[1] <== sender_before;
    ge.out === 1;

    // Compose leaves AFTER
    component hS1 = Poseidon(3);
    hS1.inputs[0] <== sender_pub;
    hS1.inputs[1] <== sender_after;
    hS1.inputs[2] <== sender_nonce;

    component hR1 = Poseidon(3);
    hR1.inputs[0] <== receiver_pub;
    hR1.inputs[1] <== receiver_after;
    hR1.inputs[2] <== receiver_nonce;

    // Membership under root_after (using after paths)
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
    component hTx = Poseidon(5);
    hTx.inputs[0] <== sender_pub;
    hTx.inputs[1] <== receiver_pub;
    hTx.inputs[2] <== amount;
    hTx.inputs[3] <== tx_nonce;
    hTx.inputs[4] <== tx_timestamp;
    hTx.out === tx_log_id;
}

component main { public [sender_account, receiver_account, amount, nonce, root_before, root_after, tx_log_id] } = Transfer(4); // Depth=4 (16 leaves) for demo