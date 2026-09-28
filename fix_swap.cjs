const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/features/mobilisations/pages/MobilisationDetailPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The masonry wrapper
const badMasonryStr = `<div className="columns-1 xl:columns-2 gap-6 [&>div]:break-inside-avoid [&>div]:mb-6 [&>form]:break-inside-avoid [&>form]:mb-6">`;
const correctGridStr = `<div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <div className="space-y-6">`;

// Get Rates & Financials
const ratesRegex = /{hasCommercialFields && \([\s\S]*?<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">\s*\{t\('staffMobilisations\.detail\.sectionRatesFinancials'\)\}[\s\S]*?<\/Card>\n\s*\)}/m;
const ratesMatch = content.match(ratesRegex);
const ratesBlock = ratesMatch ? ratesMatch[0] : '';
if (ratesBlock) content = content.replace(ratesBlock, '');

// Get CommercialDetailsCard
const commercialRegex = /{\(canDecide \|\| hasReviewFields\) && \([\s\S]*?<CommercialDetailsCard[\s\S]*?\/>\n\s*\)}/m;
const commercialMatch = content.match(commercialRegex);
const commercialBlock = commercialMatch ? commercialMatch[0] : '';
if (commercialBlock) content = content.replace(commercialBlock, '');

// Get ApprovalTrailView
const approvalRegex = /<ApprovalTrailView request={m} \/>/m;
const approvalMatch = content.match(approvalRegex);
const approvalBlock = approvalMatch ? approvalMatch[0] : '';
if (approvalBlock) content = content.replace(approvalBlock, '');

// Now the content has:
// Documents Card
// Worker & Placement Card
// Coordinators Card

// We need to insert:
// Right after Worker & Placement Card:
// commercialBlock
// approvalBlock
// </div><div className="space-y-6">
// Coordinators Card
// ratesBlock

const workerEndRegex = /<\/Card>\n\s*(?=<Card>\n\s*<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t\('staffMobilisations\.detail\.coordinatorsTitle'\)})/m;
const workerEndMatch = content.match(workerEndRegex);

if (workerEndMatch) {
    const insertString = `</Card>

      ${commercialBlock}

      ${approvalBlock}
      </div>
      <div className="space-y-6">
      `;
    content = content.replace(workerEndRegex, insertString);
} else {
    console.error("Could not find Worker & Placement end!");
}

// Now find end of Coordinators card and append ratesBlock
const coordinatorsEndRegex = /<\/Card>\n\s*(?=<\/div>\n\n\s*<ConfirmDialog)/m;
const coordinatorsEndMatch = content.match(coordinatorsEndRegex);

if (coordinatorsEndMatch) {
    const insertString2 = `</Card>

      ${ratesBlock}
      `;
    content = content.replace(coordinatorsEndRegex, insertString2);
} else {
    console.error("Could not find Coordinators end!");
}

// Replace the wrapper
content = content.replace(badMasonryStr, correctGridStr);

fs.writeFileSync(filePath, content);
console.log('done');
