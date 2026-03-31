import type { NavigateFunction } from 'react-router-dom';

export function goToLogin(navigate: NavigateFunction, from?: string) {
  const path = from ?? `${window.location.pathname}${window.location.search}`;
  navigate('/login', { state: { from: path } });
}

export function goToRegister(navigate: NavigateFunction, from?: string) {
  const path = from ?? `${window.location.pathname}${window.location.search}`;
  navigate('/register', { state: { from: path } });
}
