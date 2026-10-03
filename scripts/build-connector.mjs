import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
await mkdir('dist-connector/windows', { recursive: true });
const built = await build({ entryPoints: ['services/tally-connector/src/main.ts'], outfile: 'dist-connector/connector.cjs',
  bundle: true, platform: 'node', target: 'node24', format: 'cjs', sourcemap: false, metafile: true });
for (const file of ['Install-Connector.ps1','Pair-Connector.ps1','Uninstall-Connector.ps1']) {
  await copyFile(`services/tally-connector/windows/${file}`, `dist-connector/windows/${file}`);
}
for (const file of ['connector.mock.example.json','connector.local.example.json']) await copyFile(`services/tally-connector/${file}`, `dist-connector/${file}`);
await copyFile('docs/tally-connector.md', 'dist-connector/README.md');
await writeFile('dist-connector/NOTICE.txt', 'Includes fast-xml-parser and its transitive dependencies bundled by esbuild. See THIRD-PARTY-LICENSES.txt. Node.js 24 and WinSW are separately installed runtimes.\n');
// Preserve all dependency license files in the deployable bundle.
const { readFile, readdir } = await import('node:fs/promises');
const licenseParts = [];
const packages = new Set(Object.keys(built.metafile.inputs).filter(file => file.startsWith('node_modules/')).map(file => {
  const parts = file.split('/'); return parts[1].startsWith('@') ? `${parts[1]}/${parts[2]}` : parts[1];
}));
for (const name of packages) {
  const root = `node_modules/${name}`;
  const metadata = JSON.parse(await readFile(`${root}/package.json`, 'utf8'));
  const licenses = (await readdir(root)).filter(file => /^licen[cs]e/i.test(file));
  if (!licenses.length) {
    const filename = `${name.replace(/^@/, '').replaceAll('/', '-')}-${metadata.version}.LICENSE`;
    licenseParts.push(`${name}@${metadata.version} (${metadata.license})\n${await readFile(`scripts/licenses/${filename}`, 'utf8')}`);
  }
  for (const file of licenses) licenseParts.push(`${name}@${metadata.version} (${metadata.license})\n${await readFile(`${root}/${file}`, 'utf8')}`);
}
await writeFile('dist-connector/THIRD-PARTY-LICENSES.txt', licenseParts.join('\n\n'));
console.log('Windows connector bundle built in dist-connector');
