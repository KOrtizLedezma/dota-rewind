import React from "react";

export function SnapSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-h-screen snap-start flex items-center ${className}`}
    >
      <div className="w-full">{children}</div>
    </section>
  );
}
