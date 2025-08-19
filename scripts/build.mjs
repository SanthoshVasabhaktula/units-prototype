import { execSync } from "node:child_process";
import fs from "node:fs";
import { bin } from "./utils.mjs";

fs.mkdirSync("build", { recursive: true });

console.log("▶ Compiling transfer circuit...");
execSync(`${bin("circom")} circuits/transfer.circom --r1cs --wasm --sym -o build -l node_modules/circomlib/circuits`, { stdio: "inherit" });

console.log("▶ Compiling generic state transfer circuit...");
execSync(`${bin("circom")} circuits/generic_state_transfer.circom --r1cs --wasm --sym -o build -l node_modules/circomlib/circuits`, { stdio: "inherit" });

console.log("▶ Groth16 setup for transfer circuit...");
execSync(`${bin("snarkjs")} groth16 setup build/transfer.r1cs pot14_final_prepared.ptau build/transfer.zkey`, { stdio: "inherit" });

console.log("▶ Groth16 setup for generic state transfer circuit...");
execSync(`${bin("snarkjs")} groth16 setup build/generic_state_transfer.r1cs pot14_final_prepared.ptau build/generic_state_transfer.zkey`, { stdio: "inherit" });

console.log("▶ Exporting verification keys...");
execSync(`${bin("snarkjs")} zkey export verificationkey build/transfer.zkey build/vkey.json`, { stdio: "inherit" });
execSync(`${bin("snarkjs")} zkey export verificationkey build/generic_state_transfer.zkey build/generic_state_transfer_vkey.json`, { stdio: "inherit" });

console.log("✔ Build complete");