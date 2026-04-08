"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/tiptap-utils"
import "@/components/tiptap-ui-primitive/popover/popover.scss"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Content
      align={align}
      sideOffset={sideOffset}
      className={cn("tiptap-popover", className)}
      style={{ zIndex: 9999 }}
      {...props}
    />
  )
}

export { Popover, PopoverTrigger, PopoverContent }
