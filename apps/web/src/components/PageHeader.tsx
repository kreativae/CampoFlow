import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

/**
 * Cabeçalho padrão das páginas de módulo: breadcrumb de volta,
 * chip de ícone, título e subtítulo — com espaço para ações à direita.
 */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  backHref,
  backLabel = 'Painel',
  actions,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-900"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
            <Icon size={21} strokeWidth={1.9} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}
