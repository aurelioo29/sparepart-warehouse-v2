"use client";

type DataFilterCardProps = {
  children: React.ReactNode;
};

export default function DataFilterCard({ children }: DataFilterCardProps) {
  return (
    <div className="mb-3 rounded-none border-0 shadow-none">{children}</div>
  );
}
