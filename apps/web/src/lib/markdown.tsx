import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

type HeadingTag = "h1" | "h2" | "h3" | "h4";
type MarkdownHeadingProps = ComponentPropsWithoutRef<"h1"> & {
  node?: {
    position?: {
      start?: {
        line?: number;
      };
    };
  };
};

function cleanHeadingText(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`~]/g, "").trim();
}

function slugifyHeading(text: string, seen: Map<string, number>): string {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function headingIdsByLine(text: string, headingIdPrefix?: string): Map<number, string> {
  const ids = new Map<number, string>();
  if (!headingIdPrefix) return ids;

  const seen = new Map<string, number>();
  let inFence = false;

  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const match = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return;
    const title = cleanHeadingText(match[2]);
    if (!title) return;
    ids.set(index + 1, `${headingIdPrefix}${slugifyHeading(title, seen)}`);
  });

  return ids;
}

function createHeadingComponent(tag: HeadingTag, headingIds: Map<number, string>) {
  const Tag = tag;

  return function Heading({ children, node, ...props }: MarkdownHeadingProps) {
    const line = node?.position?.start?.line;
    const id = typeof line === "number" ? headingIds.get(line) : undefined;
    return (
      <Tag {...props} id={id}>
        {children}
      </Tag>
    );
  };
}

export function MarkdownOutput({ text, headingIdPrefix }: { text: string; headingIdPrefix?: string }) {
  const headingIds = headingIdsByLine(text, headingIdPrefix);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          a: ({ children, ...props }) => (
            <a
              {...props}
              target={props.href?.startsWith("#") ? undefined : "_blank"}
              rel={props.href?.startsWith("#") ? undefined : "noreferrer"}
            >
              {children}
            </a>
          ),
          h1: createHeadingComponent("h1", headingIds),
          h2: createHeadingComponent("h2", headingIds),
          h3: createHeadingComponent("h3", headingIds),
          h4: createHeadingComponent("h4", headingIds),
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          )
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
