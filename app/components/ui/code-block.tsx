import { Highlight, themes } from "prism-react-renderer";
import { Button } from "./button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: "tsx" | "typescript" | "javascript" | "html" | "bash";
  className?: string;
}

export function CodeBlock({
  code,
  language = "tsx",
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative group", className)}>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ className: hlClassName, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              hlClassName,
              "p-4 rounded-xl text-sm overflow-x-auto font-mono border border-slate-800 shadow-inner"
            )}
            style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
      <Button
        onClick={copyToClipboard}
        variant="secondary"
        size="sm"
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
