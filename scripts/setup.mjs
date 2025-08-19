import fs from "node:fs";
import { execSync } from "node:child_process";
import { bin } from "./utils.mjs";

const PTAU_PREPARED = "pot14_final_prepared.ptau";
const PTAU_FINAL = "pot14_final.ptau";
const PTAU_INITIAL = "pot14_0000.ptau";

// Check if the prepared file already exists
if (fs.existsSync(PTAU_PREPARED)) {
  console.log("✔", PTAU_PREPARED, "already present");
  process.exit(0);
}

console.log("▶ Generating powers of tau files...");

// Generate initial powers of tau
if (!fs.existsSync(PTAU_INITIAL)) {
  console.log("▶ Creating initial powers of tau...");
  execSync(`${bin("snarkjs")} powersoftau new bn128 14 ${PTAU_INITIAL}`, { stdio: "inherit" });
}

// Contribute to the ceremony
if (!fs.existsSync(PTAU_FINAL)) {
  console.log("▶ Contributing to powers of tau ceremony...");
  execSync(`${bin("snarkjs")} powersoftau contribute ${PTAU_INITIAL} ${PTAU_FINAL} --name="Local contribution"`, { 
    stdio: "inherit",
    input: "local-development-entropy"
  });
}

// Prepare for phase 2
console.log("▶ Preparing powers of tau for phase 2...");
execSync(`${bin("snarkjs")} powersoftau prepare phase2 ${PTAU_FINAL} ${PTAU_PREPARED}`, { stdio: "inherit" });

// Clean up intermediate files since only the prepared file is needed
console.log("▶ Cleaning up intermediate powers of tau files...");
let cleanedSize = 0;
try {
  if (fs.existsSync(PTAU_INITIAL)) {
    const initialSize = fs.statSync(PTAU_INITIAL).size;
    fs.unlinkSync(PTAU_INITIAL);
    cleanedSize += initialSize;
    console.log(`  - Cleaned up: ${PTAU_INITIAL} (${(initialSize / 1024 / 1024).toFixed(1)} MB)`);
  }
  if (fs.existsSync(PTAU_FINAL)) {
    const finalSize = fs.statSync(PTAU_FINAL).size;
    fs.unlinkSync(PTAU_FINAL);
    cleanedSize += finalSize;
    console.log(`  - Cleaned up: ${PTAU_FINAL} (${(finalSize / 1024 / 1024).toFixed(1)} MB)`);
  }
  const preparedSize = fs.statSync(PTAU_PREPARED).size;
  console.log(`  - Preserved: ${PTAU_PREPARED} (${(preparedSize / 1024 / 1024).toFixed(1)} MB) - required for Groth16 setup`);
  console.log(`  - Total disk space saved: ${(cleanedSize / 1024 / 1024).toFixed(1)} MB`);
} catch (error) {
  console.log(`  - Warning: Could not clean up intermediate files: ${error.message}`);
}

console.log("✔ Powers of tau setup complete");