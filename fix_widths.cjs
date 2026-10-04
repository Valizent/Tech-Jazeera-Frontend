const fs = require('fs');
const path = require('path');
const glob = require('glob');

const srcDir = path.join(__dirname, 'src');

const targetFiles = [
  'ReadyToInvoicePage.jsx',
  'PaymentsDuePage.jsx',
  'CompanySettingsPage.jsx',
  'SectionAccessPage.jsx',
  'ApprovalHierarchyPage.jsx',
  'MobilisationSettingsPage.jsx',
  'LocationsSettingsPage.jsx',
  'ApprovalLogPage.jsx',
  'TimesheetProcessorPage.jsx',
  'SecurityLogPage.jsx',
  'CoordinatorActivityPage.jsx',
  'DataReconciliationPage.jsx'
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

  // Replace class string
  // matches className="mx-auto max-w-[anything]" or className="mx-auto max-w-2xl" etc
  content = content.replace(/className=\"mx-auto max-w-[a-zA-Z0-9\-\[\]]+\"/g, 'className=\"mx-auto max-w-[1600px]\"');
  content = content.replace(/className=\"mx-auto max-w-[a-zA-Z0-9\-\[\]]+ ([^\"]+)\"/g, 'className=\"mx-auto max-w-[1600px] $1\"');

  // Also check if PageHeader is missing onBack
  // Most pages already have it based on screenshots, but let's ensure it has `onBack={() => navigate(-1)}` if it has a <PageHeader>
  // Actually, I'll just check if it's there. If it's missing, I'll print it.
  if (content.includes('<PageHeader') && !content.includes('onBack={')) {
    console.log('Missing back button in:', path.basename(file));
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated width in:', path.basename(file));
    modified++;
  }
});

console.log('Modified', modified, 'files');
