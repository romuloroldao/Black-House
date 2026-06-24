import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FINANCIAL_PATHS } from "@/lib/financial-routes";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface FinancialPageLayoutProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FinancialPageLayout({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
}: FinancialPageLayoutProps) {
  const crumbs: BreadcrumbItem[] = breadcrumbs ?? [
    { label: "Financeiro", href: FINANCIAL_PATHS.overview },
    { label: title },
  ];

  return (
    <div className={cn("p-6 space-y-6", className)}>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <span key={crumb.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
            {crumb.href && i < crumbs.length - 1 ? (
              <Link to={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : undefined}>
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>

      {children}
    </div>
  );
}
