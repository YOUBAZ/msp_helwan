const ROOM_FOR_ONE_PHOTO = 1024 * 1024;

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/** Media storage used vs. the budget: orange from 80 %, red when full. */
export default function StorageMeter({ used, budget }: { used: number; budget: number }) {
  const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
  // A photo (full + small version) is usually under 1 MB: below that much
  // free space the next upload will be refused, so show it as full.
  const full = budget - used < ROOM_FOR_ONE_PHOTO;
  const tone = full ? "bg-red-600" : pct >= 80 ? "bg-orange-500" : "bg-blue-900";
  return (
    <div className="bg-white rounded-[2rem] shadow-lg p-5 md:p-6 mb-6">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Photo storage</p>
        <p className="text-sm font-bold text-slate-700">
          {mb(used)} of {mb(budget)}
        </p>
      </div>
      <div
        className="h-3 rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-label="Photo storage used"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {full ? (
        <p className="mt-3 text-sm font-bold text-red-600">
          Media storage is full: remove photos or move to a bigger storage plan.
        </p>
      ) : pct >= 80 ? (
        <p className="mt-3 text-sm font-bold text-orange-600">
          Storage is almost full. Remove photos you no longer need, or plan a move to a bigger storage
          plan.
        </p>
      ) : null}
    </div>
  );
}
