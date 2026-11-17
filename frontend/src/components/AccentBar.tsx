// The orange + blue pill pair used under section headings.
export default function AccentBar({
  size = "lg",
  className = "",
}: {
  size?: "lg" | "sm";
  className?: string;
}) {
  return size === "lg" ? (
    <div className={`flex justify-center gap-1.5 ${className}`}>
      <span className="w-20 h-2 bg-orange-600 rounded-full" />
      <span className="w-5 h-2 bg-blue-900 rounded-full" />
    </div>
  ) : (
    <div className={`flex justify-center gap-1.5 ${className}`}>
      <span className="w-12 h-1.5 bg-orange-600 rounded-full" />
      <span className="w-3 h-1.5 bg-blue-900 rounded-full" />
    </div>
  );
}
