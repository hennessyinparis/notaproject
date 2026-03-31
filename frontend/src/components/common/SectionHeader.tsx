import { Link } from 'react-router-dom';

export function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      {href && (
        <Link
          to={href}
          style={{
            fontSize: 14,
            color: 'var(--primary)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Все
        </Link>
      )}
    </div>
  );
}
