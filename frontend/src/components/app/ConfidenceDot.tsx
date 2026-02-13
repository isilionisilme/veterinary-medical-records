import { Tooltip } from "../ui/tooltip";

type ConfidenceDotProps = {
  tone: "low" | "med" | "high";
  tooltip: string;
  testId?: string;
};

function toneClass(tone: ConfidenceDotProps["tone"]): string {
  if (tone === "high") {
    return "bg-confidenceHigh";
  }
  if (tone === "med") {
    return "bg-confidenceMed";
  }
  return "bg-confidenceLow";
}

export function ConfidenceDot({ tone, tooltip, testId }: ConfidenceDotProps) {
  return (
    <Tooltip content={tooltip}>
      <span
        data-testid={testId}
        tabIndex={0}
        aria-label={tooltip}
        className={`inline-block h-2.5 w-2.5 rounded-full ${toneClass(tone)}`}
      />
    </Tooltip>
  );
}
