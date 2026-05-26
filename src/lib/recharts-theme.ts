/** Estilos Recharts alinhados ao tema (dark/light). */
export const rechartsTooltipProps = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    color: "hsl(var(--popover-foreground))",
    boxShadow: "0 4px 12px hsl(0 0% 0% / 0.25)",
  },
  labelStyle: {
    color: "hsl(var(--foreground))",
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: {
    color: "hsl(var(--foreground))",
  },
} as const;

export const rechartsLegendProps = {
  wrapperStyle: { color: "hsl(var(--foreground))" },
} as const;
