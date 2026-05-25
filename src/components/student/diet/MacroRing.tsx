import { cn } from "@/lib/utils";

type MacroRingProps = {
  label: string;
  value: number;
  unit?: string;
  max: number;
  colorClass?: string;
  size?: number;
};

const MacroRing = ({
  label,
  value,
  unit = "",
  max,
  colorClass = "text-primary",
  size = 56,
}: MacroRingProps) => {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(colorClass, "transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={cn("text-xs font-bold leading-none", colorClass)}>
            {Math.round(value)}
          </span>
          {unit && <span className="text-[9px] text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
};

type MacroRingsRowProps = {
  macros: {
    totalCalorias: number;
    totalProteinas: number;
    totalCarboidratos: number;
    totalLipidios: number;
  };
};

export function MacroRingsRow({ macros }: MacroRingsRowProps) {
  const maxKcal = Math.max(macros.totalCalorias, 2000);
  const maxP = Math.max(macros.totalProteinas, 200);
  const maxC = Math.max(macros.totalCarboidratos, 300);
  const maxG = Math.max(macros.totalLipidios, 100);

  return (
    <div className="flex flex-wrap justify-around gap-2 py-2">
      <MacroRing label="Kcal" value={macros.totalCalorias} max={maxKcal} colorClass="text-primary" />
      <MacroRing label="Prot." value={macros.totalProteinas} unit="g" max={maxP} colorClass="text-sky-400" />
      <MacroRing
        label="Carb."
        value={macros.totalCarboidratos}
        unit="g"
        max={maxC}
        colorClass="text-amber-400"
      />
      <MacroRing label="Gord." value={macros.totalLipidios} unit="g" max={maxG} colorClass="text-rose-400" />
    </div>
  );
}

export default MacroRing;
