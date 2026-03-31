import { Link } from 'react-router-dom';

import { Button } from './Button';

interface Props {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-5xl">{icon}</div>}
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      {description && <p className="mb-6 max-w-sm text-[var(--text-secondary)]">{description}</p>}
      {action && (
        action.href ? (
          <Link to={action.href}>
            <Button>{action.label}</Button>
          </Link>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  );
}
