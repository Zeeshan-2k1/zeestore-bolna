import { ChevronDown } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function SelectField({
  value,
  onChange,
  children,
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="select w-full appearance-none pr-10"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
    </div>
  );
}
