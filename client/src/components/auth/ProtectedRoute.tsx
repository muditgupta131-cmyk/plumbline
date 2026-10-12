import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/feedback';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';

interface ProtectedRouteProps {
  roles?: Role[];
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;

  if (status === 'anonymous') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function GuestOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/portfolio';

  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={redirectTo} replace />;

  return <Outlet />;
}
