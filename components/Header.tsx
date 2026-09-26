export default function Header({
  showMockIndicator,
  usingMocks,
  resetting,
  disabled,
  onReset,
}: {
  showMockIndicator: boolean;
  usingMocks: boolean;
  resetting: boolean;
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <h1 className="text-[17px] font-semibold">Reviewer Copilot</h1>
        <div className="flex items-center gap-5">
          {showMockIndicator && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${usingMocks ? "bg-amber-500" : "bg-good"}`} />
              {usingMocks ? "Mock data" : "Live data"}
            </span>
          )}
          <button
            onClick={onReset}
            disabled={disabled}
            className="text-sm font-medium text-accent hover:underline disabled:opacity-40"
          >
            {resetting ? "Starting over…" : "Start over"}
          </button>
        </div>
      </div>
    </header>
  );
}
