import { ChevronDown } from "lucide-react";

type Props = {
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
};

/** Native form select with chevron aligned to the far right */
export function FormSelect({
  name,
  defaultValue,
  children,
  className = "",
}: Props) {
  return (
    <div className={`relative w-full ${className}`}>
      <select
        name={name}
        defaultValue={defaultValue}
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
