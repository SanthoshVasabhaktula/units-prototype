import fs from "node:fs";
import path from "node:path";
import sqlite from "better-sqlite3";
import pkg from 'circomlibjs';

const { poseidon } = pkg;

// ---------- Poseidon helpers ----------
export const F = (x) => BigInt(x);
export const pHash2 = (a,b) => poseidon([a,b]);
export const pHash3 = (a,b,c) => poseidon([a,b,c]);
export const pHash5 = (a,b,c,d,e) => poseidon([a,b,c,d,e]);

// ---------- Merkle (fixed-depth, Poseidon) ----------
export function buildEmptyTree(depth) {
  const layers = [];
  // layer 0: leaves, start empty
  layers[0] = Array(1 << depth).fill(0n);
  // precompute upper layers from zeros
  for (let d = 1; d <= depth; d++) {
    const prev = layers[d-1];
    const cur = [];
    for (let i=0;i<prev.length;i+=2) cur.push(pHash2(prev[i], prev[i+1]));
    layers[d] = cur;
  }
  return layers; // layers[depth][0] is root
}

export function treeRoot(layers) {
  return layers[layers.length-1][0];
}

export function updateLeaf(layers, index, leaf) {
    layers[0][index] = leaf;
    let idx = index;
    for (let d = 1; d < layers.length; d++) {
      const parentIdx = Math.floor(idx/2);
      const left = layers[d-1][parentIdx*2];
      const right = layers[d-1][parentIdx*2+1];
      layers[d][parentIdx] = pHash2(left, right);
      idx = parentIdx;
    }
  }
  
  export function merklePath(layers, index) {
    const depth = layers.length-1;
    const siblings = [];
    const pathBits = [];
    let idx = index;
    for (let d=0; d<depth; d++) {
      const isRight = idx % 2;
      const sibIdx = isRight ? idx - 1 : idx + 1;
      siblings.push(layers[d][sibIdx]);
      pathBits.push(BigInt(isRight));
      idx = Math.floor(idx/2);
    }
    return { siblings, pathBits };
  }

  // ---------- SQLite ----------
export function getDb() {
    fs.mkdirSync("data", { recursive: true });
    const db = sqlite("data/tx_logs.sqlite");
    
    // Create tables
    db.exec(`CREATE TABLE IF NOT EXISTS tx_logs (
      tx_id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      amount TEXT NOT NULL,
      ts INTEGER NOT NULL,
      root_before TEXT NOT NULL,
      root_after TEXT NOT NULL,
      proof_json TEXT NOT NULL,
      public_inputs TEXT NOT NULL,
      circuit_version TEXT NOT NULL,
      vkey_version TEXT NOT NULL)
    `);
    
    db.exec(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      pub_key TEXT NOT NULL,
      balance TEXT NOT NULL,
      nonce TEXT NOT NULL,
      tree_index INTEGER NOT NULL)
    `);
    
    // Initialize demo accounts if they don't exist
    const count = db.prepare("SELECT COUNT(*) as count FROM accounts").get();
    if (count.count === 0) {
      const stmt = db.prepare("INSERT INTO accounts (id, pub_key, balance, nonce, tree_index) VALUES (?, ?, ?, ?, ?)");
      stmt.run("alice", "11", "500000", "7", 3);
      stmt.run("bob", "22", "120000", "42", 9);
      stmt.run("carol", "33", "70000", "1", 0);
      stmt.run("dan", "44", "90000", "2", 15);
    }
    
    return db;
}

export function persistTx({tx_id, sender_id, receiver_id, amount, ts, root_before, root_after, proof_json, public_inputs, circuit_version, vkey_version}) {
  const db = getDb();
  const stmt = db.prepare(`INSERT OR REPLACE INTO tx_logs
    (tx_id, sender_id, receiver_id, amount, ts, root_before, root_after, proof_json, public_inputs, circuit_version, vkey_version)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  stmt.run(tx_id, sender_id, receiver_id, String(amount), ts, String(root_before), String(root_after), JSON.stringify(proof_json), JSON.stringify(public_inputs), circuit_version, vkey_version);
  db.close();
}

export function getLastTx() {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM tx_logs ORDER BY ts DESC LIMIT 1`).get();
  db.close();
  return row;
}

// ---------- Account Management ----------
export function getAllAccounts() {
  const db = getDb();
  const accounts = db.prepare("SELECT * FROM accounts").all();
  db.close();
  return accounts.map(acc => ({
    id: acc.id,
    pub: BigInt(acc.pub_key),
    bal: BigInt(acc.balance),
    nonce: BigInt(acc.nonce),
    idx: acc.tree_index
  }));
}

export function getAccount(accountId) {
  const db = getDb();
  const acc = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId);
  db.close();
  if (!acc) return null;
  return {
    id: acc.id,
    pub: BigInt(acc.pub_key),
    bal: BigInt(acc.balance),
    nonce: BigInt(acc.nonce),
    idx: acc.tree_index
  };
}

export function updateAccountBalance(accountId, newBalance) {
  const db = getDb();
  const stmt = db.prepare("UPDATE accounts SET balance = ? WHERE id = ?");
  stmt.run(String(newBalance), accountId);
  db.close();
}

// ---------- File Management ----------
export function generateUniqueId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function cleanupTempFiles(fileIds) {
  const filesToDelete = [
    `build/input_${fileIds}.json`,
    `build/proof_${fileIds}.json`,
    `build/public_${fileIds}.json`,
    `build/wtns_${fileIds}.wtns`,  // Witness file
    `build/witness_${fileIds}.json`, // Witness JSON
    `build/circuit_${fileIds}.sym`,  // Symbol file
    `build/circuit_${fileIds}.r1cs`  // R1CS file
  ];
  
  console.log(`  🧹 Cleaning up temporary files for ${fileIds}...`);
  for (const file of filesToDelete) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`    - Cleaned up: ${file}`);
      }
    } catch (error) {
      console.log(`    - Warning: Could not clean up ${file}: ${error.message}`);
    }
  }
}

// Comprehensive cleanup function for all temporary files
export function cleanupAllTempFiles() {
  console.log('🧹 Cleaning up all temporary files...');
  
  // Files to preserve (essential for system operation)
  const preserveFiles = [
    'vkey.json',
    'generic_state_transfer_vkey.json',
    'transfer.zkey',
    'generic_state_transfer.zkey',
    'pot14_final_prepared.ptau'  // Required for Groth16 setup
  ];
  
  const patterns = [
    'build/*.json',
    'build/*.wtns', 
    'build/*.sym',
    'build/*.r1cs',
    'build/input_*.json',
    'build/proof_*.json',
    'build/public_*.json',
    'build/wtns_*.wtns',
    'build/witness_*.json'
  ];
  
  // Also clean up intermediate powers of tau files
  const intermediatePtauFiles = [
    'pot14_0000.ptau',
    'pot14_final.ptau'
  ];
  
  console.log('  🧹 Cleaning up intermediate powers of tau files...');
  for (const file of intermediatePtauFiles) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`    - Cleaned up: ${file}`);
      }
    } catch (error) {
      console.log(`    - Warning: Could not clean up ${file}: ${error.message}`);
    }
  }
  
  let cleanedCount = 0;
  
  for (const pattern of patterns) {
    try {
      const files = fs.readdirSync('build');
      for (const file of files) {
        if (file.match(pattern.replace('build/', '').replace('*', '.*'))) {
          const filePath = `build/${file}`;
          
          // Skip essential files
          if (preserveFiles.includes(file)) {
            console.log(`  - Preserving: ${filePath}`);
            continue;
          }
          
          try {
            fs.unlinkSync(filePath);
            console.log(`  - Cleaned up: ${filePath}`);
            cleanedCount++;
          } catch (error) {
            console.log(`  - Warning: Could not clean up ${filePath}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`  - Warning: Could not process pattern ${pattern}: ${error.message}`);
    }
  }
  
  console.log(`✅ Cleaned up ${cleanedCount} temporary files`);
}

// ---------- CLI utils ----------
export function bin(cmd) {
  // prefer local node_modules binaries if present
  const local = path.join("node_modules", ".bin", cmd + (process.platform === "win32" ? ".cmd" : ""));
  return fs.existsSync(local) ? local : cmd;
}

