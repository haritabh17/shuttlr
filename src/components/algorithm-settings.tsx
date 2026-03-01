"use client";

interface AlgorithmSettingsProps {
  mixedRatio: number;
  skillBalance: number;
  partnerVariety: number;
  strictGender: boolean;
  onMixedRatioChange: (v: number) => void;
  onSkillBalanceChange: (v: number) => void;
  onPartnerVarietyChange: (v: number) => void;
  onStrictGenderChange: (v: boolean) => void;
  numCourts?: number;
}

function SliderField({
  label,
  value,
  onChange,
  leftLabel,
  rightLabel,
  description,
  displayValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  description: string;
  displayValue?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-zinc-300">{label}</label>
        <span className="text-xs font-semibold text-teal-400">
          {displayValue ?? `${value}%`}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-zinc-500">{leftLabel}</span>
        <span className="text-[11px] text-zinc-500">{rightLabel}</span>
      </div>
      <p className="text-[11px] text-zinc-500 mt-1">{description}</p>
    </div>
  );
}

export function AlgorithmSettings({
  mixedRatio,
  skillBalance,
  partnerVariety,
  strictGender,
  onMixedRatioChange,
  onSkillBalanceChange,
  onPartnerVarietyChange,
  onStrictGenderChange,
  numCourts = 4,
}: AlgorithmSettingsProps) {
  const mixedCourts = Math.round((mixedRatio / 100) * numCourts);
  const doublesCourts = numCourts - mixedCourts;

  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Selection Algorithm
      </h4>

      <SliderField
        label="Game Type Mix"
        value={mixedRatio}
        onChange={onMixedRatioChange}
        leftLabel="All Doubles"
        rightLabel="All Mixed"
        displayValue={`${mixedRatio}% mixed`}
        description={`~${doublesCourts} doubles, ~${mixedCourts} mixed per round. Adjusts based on available players.`}
      />

      <SliderField
        label="Skill Balance"
        value={skillBalance}
        onChange={onSkillBalanceChange}
        leftLabel="Random"
        rightLabel="Strictly Balanced"
        displayValue={
          skillBalance < 30 ? "Low" : skillBalance < 70 ? "Medium" : "High"
        }
        description="Spread skill levels evenly across courts vs allow natural groupings."
      />

      <div className="mb-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={strictGender}
              onChange={(e) => onStrictGenderChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 rounded-full bg-zinc-700 peer-checked:bg-teal-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </div>
          <div>
            <span className="text-sm font-medium text-zinc-300">Strict Gender Balance</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {strictGender
                ? "Doubles courts are same-gender only (4M or 4F). No 3:1 combos."
                : "Allows mixed-gender doubles (e.g. 3F+1M) when same-gender groups aren't possible."}
            </p>
          </div>
        </label>
      </div>

      <SliderField
        label="Partner Variety"
        value={partnerVariety}
        onChange={onPartnerVarietyChange}
        leftLabel="Repeat OK"
        rightLabel="Max Variety"
        description="How strongly to avoid pairing the same players in consecutive rounds."
      />
    </div>
  );
}
