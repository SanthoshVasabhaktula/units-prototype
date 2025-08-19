## README.md
```md
# zk-transaction-proof — quickstart

### 1) Install
```bash
npm i
```

### 2) One-time powers of tau (ptau)
```bash
npm run setup
```
This fetches `pot14_final.ptau` (safe for demos). You can replace with your own PTAU.

### 3) Build circuit + keys
```bash
npm run build
```
Generates `build/transfer.r1cs`, `build/transfer_js/transfer.wasm`, `build/transfer.zkey`, `build/vkey.json`.

### 4) Run the end-to-end demo
```bash
npm run demo
```
- Creates a tiny account set (16 leaves),
- Executes a transfer (A→B), updates Merkle roots,
- Generates a Groth16 proof, verifies it,
- Persists to `data/tx_logs.sqlite`.

### 5) Re-verify a stored transaction by id
```bash
npm run verify:tx
```
(Reads the last tx_id from the DB; edit the script to pass a specific id.)

---

### Notes
- Tree depth is 4 for simplicity. To scale: bump `TREE_DEPTH` in `circuits/transfer.circom` and the JS constants; re-run build.
- Hash function: Poseidon. We use `circomlibjs` off-chain and the circuit’s Poseidon inside SNARK to match.
- Public inputs: `root_before`, `root_after`, `tx_log_id`. All else is private.
- Security: This is a demo. For production, do audited parameterization, robust range checks, key mgmt, and versioning.
```
