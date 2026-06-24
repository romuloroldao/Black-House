import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PaymentStatus =
  | "RECEIVED"
  | "CONFIRMED"
  | "PENDING"
  | "OVERDUE"
  | "REFUNDED"
  | "CANCELLED"
  | string;

export type ExpenseStatus = "pago" | "pendente" | "atrasada" | string;

interface StatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

const PAYMENT_STATUS_MAP: Record<string, StatusConfig> = {
  RECEIVED: { label: "Recebido", variant: "default", className: "text-primary" },
  CONFIRMED: { label: "Confirmado", variant: "default", className: "text-primary" },
  PENDING: { label: "Pendente", variant: "secondary" },
  OVERDUE: { label: "Vencido", variant: "destructive" },
  REFUNDED: { label: "Reembolsado", variant: "outline" },
  CANCELLED: { label: "Cancelado", variant: "outline" },
};

const EXPENSE_STATUS_MAP: Record<string, StatusConfig> = {
  pago: { label: "Pago", variant: "default", className: "text-primary" },
  pendente: { label: "Pendente", variant: "secondary" },
  atrasada: { label: "Atrasada", variant: "destructive" },
};

export function getPaymentStatusConfig(status: string, dueDate?: string): StatusConfig {
  const upper = status.toUpperCase();
  if (upper === "PENDING" && dueDate && new Date(dueDate) < new Date()) {
    return PAYMENT_STATUS_MAP.OVERDUE;
  }
  return PAYMENT_STATUS_MAP[upper] ?? { label: status, variant: "outline" };
}

export function getStudentFinancialStatus(overdue: number, pending: number, totalPaid: number): StatusConfig {
  if (overdue > 0) return { label: "Atrasado", variant: "destructive" };
  if (pending > 0) return { label: "Pendente", variant: "secondary" };
  if (totalPaid > 0) return { label: "Em dia", variant: "default" };
  return { label: "Sem pagamentos", variant: "outline" };
}

interface FinancialStatusBadgeProps {
  status: string;
  type?: "payment" | "expense" | "student";
  dueDate?: string;
  overdueCount?: number;
  pendingCount?: number;
  totalPaid?: number;
  className?: string;
}

export function FinancialStatusBadge({
  status,
  type = "payment",
  dueDate,
  overdueCount = 0,
  pendingCount = 0,
  totalPaid = 0,
  className,
}: FinancialStatusBadgeProps) {
  let config: StatusConfig;

  if (type === "student") {
    config = getStudentFinancialStatus(overdueCount, pendingCount, totalPaid);
  } else if (type === "expense") {
    config = EXPENSE_STATUS_MAP[status.toLowerCase()] ?? { label: status, variant: "outline" };
  } else {
    config = getPaymentStatusConfig(status, dueDate);
  }

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
