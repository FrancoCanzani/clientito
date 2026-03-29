import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VariantProps } from "class-variance-authority";

type IconButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    label: string;
    tooltipSide?: React.ComponentProps<typeof TooltipContent>["side"];
  };

function IconButton({
  label,
  tooltipSide = "top",
  variant = "ghost",
  size = "icon-lg",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          aria-label={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export { IconButton };
