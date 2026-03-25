"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type PageFadeProps = {
  children: ReactNode;
  className?: string;
};

/** Subtle fade-in for main shell content; respects reduced-motion. */
export function PageFade({ children, className }: PageFadeProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
