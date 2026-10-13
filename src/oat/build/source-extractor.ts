import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

type BabelTraverse = typeof import("@babel/traverse").default;
const traverseModuleValue: unknown = traverseModule;
const traverse = (
  typeof traverseModuleValue === "function"
    ? traverseModuleValue
    : typeof (traverseModuleValue as { default?: unknown }).default === "function"
      ? (traverseModuleValue as { default: unknown }).default
      : (traverseModuleValue as { default?: { default?: unknown } }).default?.default
) as BabelTraverse;

if (typeof traverse !== "function") {
  throw new Error("Unable to load @babel/traverse for OAT source extraction.");
}

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
  return extractOATStringsFromFile(filename, [calleeName])[calleeName]!;
}

/** Parse each file once, collecting all requested call types in source order. */
export function extractOATStringsFromFile(
  filename: string,
  calleeNames: readonly string[],
): Record<string, string[]> {
  const code = fs.readFileSync(filename, "utf-8");
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const strings = Object.fromEntries(calleeNames.map((name) => [name, [] as string[]]));
  const warnings = Object.fromEntries(calleeNames.map((name) => [name, [] as string[]]));
  traverse(ast, {
    CallExpression({ node }) {
      if (
        node.callee.type !== "Identifier" ||
        !Object.hasOwn(strings, node.callee.name) ||
        node.arguments.length === 0
      ) {
        return;
      }

      const arg = node.arguments[0];
      if (!arg) return;
      const calleeName = node.callee.name;
      if (arg.type === "StringLiteral") {
        strings[calleeName]!.push(arg.value);
        return;
      }

      // Ignore calls such as OAT(variable), OAT(getString()), and template literals, but make them visible to developers.
      const loc = arg.loc?.start;
      const location = loc ? `${filename}:${loc.line}:${loc.column}` : filename;
      warnings[calleeName]!.push(
        `[WARN] ${calleeName}() call with non-string argument at ${location}: will be skipped.`,
      );
    },
  });
  // Retain the old per-callee warning order even though traversal is shared.
  for (const name of calleeNames) warnings[name]!.forEach((warning) => console.warn(warning));
  return strings;
}
