import fs from "node:fs";
import { groth16 } from "snarkjs";
import { getLastTx } from "./utils.mjs";

const vkey = JSON.parse(fs.readFileSync("build/vkey.json"));
const row = getLastTx();
if (!row) throw new Error("No tx found in DB");

const proof = JSON.parse(row.proof_json);
const pub = JSON.parse(row.public_inputs);

const ok = await groth16.verify(vkey, pub, proof);
console.log("tx_id:", row.tx_id);
console.log("root_before:", row.root_before);
console.log("root_after:", row.root_after);
console.log("verify:", ok);