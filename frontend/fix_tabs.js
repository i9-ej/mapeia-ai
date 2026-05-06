const fs = require('fs');
let f = fs.readFileSync('frontend/src/app/projects/[id]/page.tsx', 'utf8');

// Remove clarification tab entry
f = f.replace(/\s*\{ key: "clarification", label: "Clarificação", icon: "💬" \},?\n?/g, '\n');

// Remove clarification tab rendering
f = f.replace(/\s*\{activeTab === "clarification" && <ClarificationTab project=\{project\} \/>\}\n?/g, '');

// Update progress steps - remove clarification step
f = f.replace(
    /\{ label: "Clarificação", done: \["analysis", "complete"\]\.includes\(project\.status\) \},/g,
    ''
);

fs.writeFileSync('frontend/src/app/projects/[id]/page.tsx', f);
console.log('Done: removed clarification references');
