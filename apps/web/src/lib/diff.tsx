import type { ReactNode } from "react";

type DiffToken = {
  value: string;
  kind: "same" | "added" | "removed";
};

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

export type DiffResult = {
  available: true;
  left: DiffToken[];
  right: DiffToken[];
  mode: "exact" | "line" | "streaming";
  reason: null;
};

const MAX_DIFF_TOKENS = 900;
const MAX_DIFF_CELLS = 180000;
const MAX_LINE_DIFF_CELLS = 260000;

export function safeDiffTokens(leftText: string, rightText: string): DiffResult {
  const leftTokens = tokenize(leftText);
  const rightTokens = tokenize(rightText);
  if (leftTokens.length + rightTokens.length <= MAX_DIFF_TOKENS && leftTokens.length * rightTokens.length <= MAX_DIFF_CELLS) {
    const diff = diffUnits(leftTokens, rightTokens);
    return { available: true, left: diff.left, right: diff.right, mode: "exact", reason: null };
  }

  const leftLines = splitLines(leftText);
  const rightLines = splitLines(rightText);
  if (leftLines.length * rightLines.length <= MAX_LINE_DIFF_CELLS) {
    const diff = diffUnits(leftLines, rightLines);
    return { available: true, left: diff.left, right: diff.right, mode: "line", reason: null };
  }

  const diff = streamingLineDiff(leftLines, rightLines);
  return { available: true, left: diff.left, right: diff.right, mode: "streaming", reason: null };
}

export function diffTokens(leftText: string, rightText: string): { left: DiffToken[]; right: DiffToken[] } {
  return diffUnits(tokenize(leftText), tokenize(rightText));
}

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function diffUnits(a: string[], b: string[]): { left: DiffToken[]; right: DiffToken[] } {
  const table = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const leftTokens: DiffToken[] = [];
  const rightTokens: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      leftTokens.push({ value: a[i], kind: "same" });
      rightTokens.push({ value: b[j], kind: "same" });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      leftTokens.push({ value: a[i], kind: a[i].trim() ? "removed" : "same" });
      i += 1;
    } else {
      rightTokens.push({ value: b[j], kind: b[j].trim() ? "added" : "same" });
      j += 1;
    }
  }

  while (i < a.length) {
    leftTokens.push({ value: a[i], kind: a[i].trim() ? "removed" : "same" });
    i += 1;
  }
  while (j < b.length) {
    rightTokens.push({ value: b[j], kind: b[j].trim() ? "added" : "same" });
    j += 1;
  }

  return { left: leftTokens, right: rightTokens };
}

function streamingLineDiff(a: string[], b: string[]): { left: DiffToken[]; right: DiffToken[] } {
  const leftTokens: DiffToken[] = [];
  const rightTokens: DiffToken[] = [];
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const leftLine = a[index];
    const rightLine = b[index];
    if (leftLine === rightLine) {
      if (leftLine !== undefined) leftTokens.push({ value: leftLine, kind: "same" });
      if (rightLine !== undefined) rightTokens.push({ value: rightLine, kind: "same" });
      continue;
    }
    if (leftLine !== undefined) leftTokens.push({ value: leftLine, kind: leftLine.trim() ? "removed" : "same" });
    if (rightLine !== undefined) rightTokens.push({ value: rightLine, kind: rightLine.trim() ? "added" : "same" });
  }

  return { left: leftTokens, right: rightTokens };
}

export function renderDiffTokens(tokens: DiffToken[]): ReactNode {
  return tokens.map((token, index) => {
    if (token.kind === "same") return token.value;
    return (
      <mark className={`diff-token ${token.kind}`} key={`${token.kind}-${index}-${token.value}`}>
        {token.value}
      </mark>
    );
  });
}
