type Props = {
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, badge, actions }: Props) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {badge && (
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
            {badge}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
