/**
 * Build release package for GitHub Releases
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = require('../package.json').version;
const RELEASE_DIR = 'release';
const RELEASE_NAME = `love-free-tools-v${VERSION}`;

// Files to include in release
const INCLUDE_FILES = [
  'index.html',
  'privacy.html',
  'terms.html',
  'favicon.svg',
  '_headers',
  '_redirects',
  'css/',
  'js/',
  'server/index.js',
  'server/package.json',
  'server/database.sql',
  'server/database-upgrade-ai.sql',
  'server/create-short-links-table.sql',
  'server/workers-mysql.js',
  'server/env.example.txt',
  'server/DEPLOY.md',
  'wrangler.toml',
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'LICENSE'
];

console.log(`Building release v${VERSION}...`);

// Create release directory
if (fs.existsSync(RELEASE_DIR)) {
  fs.rmSync(RELEASE_DIR, { recursive: true });
}
fs.mkdirSync(RELEASE_DIR, { recursive: true });
fs.mkdirSync(path.join(RELEASE_DIR, RELEASE_NAME), { recursive: true });

// Copy files
INCLUDE_FILES.forEach(file => {
  const src = path.join('.', file);
  const dest = path.join(RELEASE_DIR, RELEASE_NAME, file);
  
  if (!fs.existsSync(src)) {
    console.log(`  Skip: ${file} (not found)`);
    return;
  }
  
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`  Copy dir: ${file}`);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`  Copy: ${file}`);
  }
});

// Create ZIP archive
console.log(`\nCreating archive...`);
const zipName = `${RELEASE_NAME}.zip`;
const zipPath = path.join(RELEASE_DIR, zipName);

try {
  // Try using PowerShell Compress-Archive
  execSync(`powershell Compress-Archive -Path "${path.join(RELEASE_DIR, RELEASE_NAME)}" -DestinationPath "${zipPath}" -Force`, { stdio: 'inherit' });
  console.log(`Created: ${zipPath}`);
} catch (e) {
  console.log('PowerShell compression failed, please create ZIP manually');
}

console.log(`\n✓ Release v${VERSION} ready!`);
console.log(`\nTo publish to GitHub:`);
console.log(`  1. Create a new release at: https://github.com/violettoolssite/loveFreeTools/releases/new`);
console.log(`  2. Tag: v${VERSION}`);
console.log(`  3. Upload: ${zipPath}`);
console.log(`  4. Copy release notes from CHANGELOG.md`);

