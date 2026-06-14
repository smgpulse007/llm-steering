import type { ReactNode } from "react";

type DiffToken = {
  value: string;
  kind: "same" | "added" | "removed";
};

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

export type DiffResult =
  | { available: true; left: DiffToken[]; right: DiffToken[]; reason: null }
  | { available: false; left: null; right: null; reason: string };

const MAX_DIFF_TOKENS = 900;
const MAX_DIFF_CELLS = 180000;

export function safeDiffTokens(leftText: string, rightText: string): DiffResult {
  const leftCount = tokenize(leftText).length;
  const rightCount = tokenize(rightText).length;
  if (leftCount + rightCount > MAX_DIFF_TOKENS || leftCount * rightCount > MAX_DIFF_CELLS) {
    return {
      available: false,
      left: null,
      right: null,
      reason: "Diff skipped for this long response. Use shorter generations or compare the rendered panes."
    };
  }
  const diff = diffTokens(leftText, rightText);
  return { available: true, left: diff.left, right: diff.right, reason: null };
}

export function diffTokens(leftText: string, rightText: string): { left: DiffToken[]; right: DiffToken[] } {
  const a = tokenize(leftText);
  const b = tokenize(rightText);
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
