import { Navigate } from 'react-router-dom';

/** Раздел «настроений» отключён — ведём в поиск. */
export function Discover() {
  return <Navigate to="/search" replace />;
}
