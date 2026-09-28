const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/features/mobilisations/pages/MobilisationDetailPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The masonry wrapper added previously:
const badMasonryStr = `<div className="columns-1 xl:columns-2 gap-6 [&>div]:break-inside-avoid [&>div]:mb-6 [&>form]:break-inside-avoid [&>form]:mb-6">`;

const correctGridStr = `<div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <div className="space-y-6">`;

content = content.replace(badMasonryStr, correctGridStr);

// We want the left column to end and the right column to start at a specific point.
// Wait, currently the order in the file is:
// 1. Documents Card (lines ~541-594)
// 2. Worker & Placement Card (lines ~596-655)
// 3. Rates & Financials Card (lines ~657-710)
// 4. Coordinators Card (lines ~712-859)
// 5. CommercialDetailsCard (lines ~861-872)
// 6. ApprovalTrailView (lines ~874)

// But we want to reorder the DOM entirely!
// LEFT: Documents, Worker & Placement, CommercialDetailsCard, ApprovalTrailView.
// RIGHT: Coordinators, Rates & Financials.

// It's much safer to use regex or string manipulation to extract the blocks and reassemble them.

const getBlock = (startMarker, endMarker) => {
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker, startIndex) + endMarker.length;
    return content.substring(startIndex, endIndex);
};

const documentsCard = getBlock('<Card>\n        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t(\'staffMobilisations.detail.documentsTitle\')}</h2>', '      </Card>\n\n      <Card>\n        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">\n          {t(\'staffMobilisations.detail.sectionWorkerPlacement\')}').replace('      </Card>\n\n      <Card>\n        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">\n          {t(\'staffMobilisations.detail.sectionWorkerPlacement\')}', '      </Card>');

const workerPlacementCard = getBlock('<Card>\n        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">\n          {t(\'staffMobilisations.detail.sectionWorkerPlacement\')}', '      </Card>\n\n      {hasCommercialFields && (').replace('      </Card>\n\n      {hasCommercialFields && (', '      </Card>');

const ratesFinancialsCard = getBlock('{hasCommercialFields && (\n        <Card>\n          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">\n            {t(\'staffMobilisations.detail.sectionRatesFinancials\')}', '        </Card>\n      )}\n\n      <Card>\n        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t(\'staffMobilisations.detail.coordinatorsTitle\')}</h2>').replace('        </Card>\n      )}\n\n      <Card>\n        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t(\'staffMobilisations.detail.coordinatorsTitle\')}</h2>', '        </Card>\n      )}');

const coordinatorsCard = getBlock('<Card>\n        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t(\'staffMobilisations.detail.coordinatorsTitle\')}</h2>', '      </Card>\n\n      {(canDecide || hasReviewFields) && (').replace('      </Card>\n\n      {(canDecide || hasReviewFields) && (', '      </Card>');

const commercialDetailsCard = getBlock('{(canDecide || hasReviewFields) && (\n        <CommercialDetailsCard', '        />\n      )}\n\n      <ApprovalTrailView').replace('        />\n      )}\n\n      <ApprovalTrailView', '        />\n      )}');

const approvalTrailView = getBlock('<ApprovalTrailView request={m} />\n\n      </div>', '      </div>').replace('\n\n      </div>', '');

const newLayout = `${correctGridStr}
        ${documentsCard}
        ${workerPlacementCard}
        ${commercialDetailsCard}
        ${approvalTrailView}
      </div>
      <div className="space-y-6">
        ${coordinatorsCard}
        ${ratesFinancialsCard}
      </div>
      </div>`;

// Replace the entire section from correctGridStr up to the closing div before ConfirmDialog
const oldLayoutStart = content.indexOf(correctGridStr);
const oldLayoutEnd = content.indexOf('</div>\n\n      <ConfirmDialog');

content = content.substring(0, oldLayoutStart) + newLayout + content.substring(oldLayoutEnd);

fs.writeFileSync(filePath, content);
console.log('done');
