import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function AdminBadge({ children, className = "" }: Props) {
  return (
    <span
      className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ${className}`}
    >
      {children}
    </span>
  );
}