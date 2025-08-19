#!/usr/bin/env node

import { cleanupAllTempFiles } from './utils.mjs';

console.log('🧹 ZK Proof System Cleanup Utility\n');

try {
  cleanupAllTempFiles();
  console.log('\n✅ Cleanup completed successfully!');
} catch (error) {
  console.error('❌ Cleanup failed:', error.message);
  process.exit(1);
}
