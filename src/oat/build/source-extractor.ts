import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default;

function findFiles(dir: string, exts = [".js", ".jsx", ".ts", ".tsx"]): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) return findFiles(fullPath, exts);
    if (exts.includes(path.extname(fullPath))) return [fullPath];
    return [];
  });
}

export function getAllOATSourceFiles(scanDirs: string[]): string[] {
  return scanDirs.flatMap((dir) => findFiles(dir));
}

export function extractOATCalleeStringsFromFile(
  filename: string,
  calleeName: string,
): string[] {
  const code = fs.readFileSync(filename, "utf-8");
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const strings: string[] = [];
  traverse(ast, {
    CallExpression({ node }) {
      if (
        node.callee.type !== "Identifier" ||
        node.callee.name !== calleeName ||
        node.arguments.length === 0
      ) {
        return;
      }

      const arg = node.arguments[0];
      if (!arg) return;
      if (arg.type === "StringLiteral") {
        strings.push(arg.value);
        return;
      }

      // Ignore calls such as OAT(variable), OAT(getString()), and template literals, but make them visible to developers.
      const loc = arg.loc?.start;
      const location = loc ? `${filename}:${loc.line}:${loc.column}` : filename;
      console.warn(
        `[WARN] ${calleeName}() call with non-string argument at ${location}: will be skipped.`,
      );
    },
  });
  return strings;
}
