import { BRAND_LOGO_URL } from "@mangiar/shared";
import type { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface LogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {}

export function Logo({ className, ...props }: LogoProps) {
  return (
    <img src={BRAND_LOGO_URL} alt="Mangiar" className={cn("h-8 w-auto", className)} {...props} />
  );
}
