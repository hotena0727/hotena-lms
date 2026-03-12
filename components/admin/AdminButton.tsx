import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  variant?: Variant;
};

function getVariantClass(variant: Variant) {
  switch (variant) {
    case "primary":
      return "bg-slate-900 text-white";
    case "danger":
      return "border border-red-200 bg-white text-red-600";
    case "secondary":
    default:
      return "border border-slate-200 bg-white text-slate-700";
  }
}

export default function AdminButton({
  children,
  href,
  onClick,
  type = "button",
  disabled = false,
  className = "",
  variant = "secondary",
}: Props) {
  const base =
    `rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60 ${getVariantClass(
      variant
    )} ${className}`;

  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={base}>
      {children}
    </button>
  );
}