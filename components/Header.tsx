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
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reviewer Copilot</h1>
        <p className="text-sm text-slate-600">A training copilot that rewrites its own harness for each reviewer</p>
      </div>
      <div className="flex items-center gap-4">
        {showMockIndicator && (
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${usingMocks ? "bg-amber-500" : "bg-emerald-500"}`} />
            {usingMocks ? "Mock backend" : "Live backend"}
          </span>
        )}
        <button
          onClick={onReset}
          disabled={disabled}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {resetting ? "Resetting…" : "Reset demo"}
        </button>
      </div>
    </header>
  );
}
