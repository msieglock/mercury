export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex items-center justify-center bg-surface-container px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
