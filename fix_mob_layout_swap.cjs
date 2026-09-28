const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/features/mobilisations/pages/MobilisationDetailPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Identify start and end points of the blocks using exact strings.
const ratesStart = "      {hasCommercialFields && (\n        <Card>\n          <h2 className=\"mb-3 text-sm font-semibold uppercase tracking-wide text-muted\">\n            {t('staffMobilisations.detail.sectionRatesFinancials')}";
const ratesEnd = "              },\n            ]}\n          />\n        </Card>\n      )}";
const ratesStartIdx = content.indexOf(ratesStart);
const ratesEndIdx = content.indexOf(ratesEnd, ratesStartIdx) + ratesEnd.length;
const ratesBlock = content.substring(ratesStartIdx, ratesEndIdx);

const commercialStart = "      {(canDecide || hasReviewFields) && (\n        <CommercialDetailsCard";
const commercialEnd = "          onReject={(values) => saveThenDecide('Rejected', values)}\n        />\n      )}";
const commercialStartIdx = content.indexOf(commercialStart);
const commercialEndIdx = content.indexOf(commercialEnd, commercialStartIdx) + commercialEnd.length;
const commercialBlock = content.substring(commercialStartIdx, commercialEndIdx);

const approvalStart = "      <ApprovalTrailView request={m} />";
const approvalEnd = approvalStart; // one line
const approvalStartIdx = content.indexOf(approvalStart);
const approvalEndIdx = approvalStartIdx + approvalStart.length;
const approvalBlock = content.substring(approvalStartIdx, approvalEndIdx);

// Remove all three blocks from the content
content = content.replace(ratesBlock, '');
content = content.replace(commercialBlock, '');
content = content.replace(approvalBlock, '');

// Now the content has a gap where Rates & Financials was (between Worker & Placement and Coordinators).
// And a gap at the end (before the final `</div>`).

// Insert Commercial + Approval + split div right before Coordinators card
const coordinatorsCardStart = "      <Card>\n        <h2 className=\"mb-3 text-sm font-semibold uppercase tracking-wide text-muted\">{t('staffMobilisations.detail.coordinatorsTitle')}</h2>";
const splitAndCoordinators = `
      ${commercialBlock}

      ${approvalBlock}

      </div>
      <div className="space-y-6">

${coordinatorsCardStart}`;
content = content.replace(coordinatorsCardStart, splitAndCoordinators);

// Insert Rates right after Coordinators card end (which is now right before the final `</div>`)
// Wait, the end of Coordinators card is:
//               {t('staffMobilisations.detail.submitForReview')}
//             </Button>
//           </div>
//         )}
//       </Card>
const coordinatorsCardEnd = "              {t('staffMobilisations.detail.submitForReview')}\n            </Button>\n          </div>\n        )}\n      </Card>";
const coordinatorsEndWithRates = `${coordinatorsCardEnd}

      ${ratesBlock}`;
content = content.replace(coordinatorsCardEnd, coordinatorsEndWithRates);

// Strip out any redundant newlines left behind
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync(filePath, content);
console.log('done');
