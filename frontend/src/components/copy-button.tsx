"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  value: string;
  label?: string;
  iconOnly?: boolean;
};

export function CopyButton({
  value,
  label = "Copy",
  iconOnly = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <Button
      type="button"
      size={iconOnly ? "icon-xs" : "sm"}
      variant="outline"
      onClick={() => void onCopy()}
      aria-label={copied ? "Copied" : `${label} ${value}`}
    >
      {copied ? <Check /> : <Copy />}
      {iconOnly ? null : copied ? "Copied" : label}
    </Button>
  );
}
