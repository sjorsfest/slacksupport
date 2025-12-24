
const fs = require('fs');
const yaml = require('js-yaml');

const manifestPath = '/Users/jeroenmeij/Desktop/personal/slacksupport/slack-app-manifest.yaml';
const fileContent = fs.readFileSync(manifestPath, 'utf8');

console.log('--- Verifying YAML ---');
try {
  const doc = yaml.load(fileContent);
  console.log('YAML is VALID.');
  console.log(JSON.stringify(doc, null, 2));
} catch (e) {
  console.error('YAML is INVALID:', e.message);
}

console.log('\n--- Attempting JSON Parse (Reproduction) ---');
try {
  JSON.parse(fileContent);
  console.log('JSON parse SUCCESS (Unexpected).');
} catch (e) {
  console.log('JSON parse FAILED as expected.');
  console.log('Error message:', e.message);
}
