import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FinancialPageLayout } from "./FinancialPageLayout";
import { FinancialFiltersBar } from "./FinancialFiltersBar";
import { FinancialDataTable, type ColumnDef } from "./FinancialDataTable";
import { FinancialStatusBadge } from "./FinancialStatusBadge";
import { MoneyDisplay } from "./MoneyDisplay";
import { useFinancialPayments, useFinancialAlunos, buildStudentPaymentSummary } from "@/hooks/useFinancialData";
import { format } from "date-fns";

interface ClientRow {
  id: string;
  nome: string;
  email: string;
  plano: string | null;
  totalPaid: number;
  pendingCount: number;
  overdueCount: number;
  lastPaymentDate: string | null;
}

export default function FinancialClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: payments = [], isLoading: lp } = useFinancialPayments();
  const { data: alunos = [], isLoading: la } = useFinancialAlunos();

  const clients: ClientRow[] = useMemo(() => {
    const summaries = buildStudentPaymentSummary(alunos, payments);
    return summaries
      .filter((s) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return s.nome.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      })
      .map((s) => ({
        id: s.id,
        nome: s.nome,
        email: s.email,
        plano: s.plano ?? null,
        totalPaid: s.totalPaid,
        pendingCount: s.pendingCount,
        overdueCount: s.overdueCount,
        lastPaymentDate: s.lastPaymentDate,
      }));
  }, [alunos, payments, search]);

  const columns: ColumnDef<ClientRow, unknown>[] = [
    {
      accessorKey: "nome",
      header: "Nome",
      cell: ({ row }) => (
        <button type="button" className="font-medium hover:underline" onClick={() => navigate(`/alunos/${row.original.id}?tab=financial`)}>
          {row.original.nome}
        </button>
      ),
    },
    { accessorKey: "email", header: "E-mail" },
    { accessorKey: "plano", header: "Plano", cell: ({ row }) => row.original.plano || "—" },
    {
      accessorKey: "totalPaid",
      header: "Total pago",
      cell: ({ row }) => <MoneyDisplay value={row.original.totalPaid} />,
    },
    {
      id: "status",
      header: "Situação",
      cell: ({ row }) => (
        <FinancialStatusBadge
          status=""
          type="student"
          overdueCount={row.original.overdueCount}
          pendingCount={row.original.pendingCount}
          totalPaid={row.original.totalPaid}
        />
      ),
    },
    {
      accessorKey: "lastPaymentDate",
      header: "Último pagamento",
      cell: ({ row }) =>
        row.original.lastPaymentDate
          ? format(new Date(row.original.lastPaymentDate), "dd/MM/yyyy")
          : "—",
    },
  ];

  if (lp || la) {
    return (
      <FinancialPageLayout title="Clientes">
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
        </div>
      </FinancialPageLayout>
    );
  }

  return (
    <FinancialPageLayout
      title="Clientes"
      description="Visão financeira dos seus alunos"
    >
      <FinancialFiltersBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome ou e-mail..."
      />
      <FinancialDataTable data={clients} columns={columns} emptyMessage="Nenhum cliente encontrado" />
    </FinancialPageLayout>
  );
}
