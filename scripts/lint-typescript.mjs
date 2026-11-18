import ts from "typescript";
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ".", { noUnusedLocals: true, noUnusedParameters: true });
const program = ts.createProgram(parsed.fileNames, parsed.options);
let errors = ts.getPreEmitDiagnostics(program);
for (const source of program.getSourceFiles()) {
  if (!/^(apps|packages|tests)\//.test(source.fileName) || source.fileName.includes("/generated/")) continue;
  const visit = node => {
    if (node.kind === ts.SyntaxKind.AnyKeyword || ts.isCallExpression(node) && /\$(queryRawUnsafe|executeRawUnsafe)$/.test(node.expression.getText(source))) errors.push({ category: ts.DiagnosticCategory.Error, code: 99001, file: source, start: node.pos, length: node.end-node.pos, messageText: "Explicit any and unsafe raw SQL are forbidden in first-party TypeScript." });
    ts.forEachChild(node, visit);
  };
  visit(source);
}
if (errors.length) { console.error(ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: p => p, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n" })); process.exitCode = 1; }
else console.log("TypeScript quality checks passed: strict types, unused symbols, explicit any and unsafe SQL.");
