import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: "default" | "primary" | "ghost";
};

export function IconButton({
  icon,
  label,
  variant = "default",
  className = "",
  ...props
}: Props) {
  const variants = {
    default:
      "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    primary:
      "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
