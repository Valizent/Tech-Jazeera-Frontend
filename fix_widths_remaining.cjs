const fs = require('fs');
const path = require('path');
const glob = require('glob');

const srcDir = path.join(__dirname, 'src');

const targetFiles = [
  'ApprovalsPage.jsx',
  'AuditLogPage.jsx',
  'ReconciliationPage.jsx'
];

const allJsx = glob.sync('**/*.jsx', { cwd: srcDir });

const foundPaths = [];
targetFiles.forEach(target => {
  const match = allJsx.find(p => p.endsWith(target));
  if (match) {
    foundPaths.push(path.join(srcDir, match));
  } else {
    console.log('Not found:', target);
  }
});

let modified = 0;

foundPaths.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  content = content.replace(/className=\"mx-auto max-w-[a-zA-Z0-9\-\[\]]+\"/g, 'className=\"mx-auto max-w-[1600px]\"');
  content = content.replace(/className=\"mx-auto max-w-[a-zA-Z0-9\-\[\]]+ ([^\"]+)\"/g, 'className=\"mx-auto max-w-[1600px] $1\"');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated width in:', path.basename(file));
    modified++;
  }
});

console.log('Modified', modified, 'files');
