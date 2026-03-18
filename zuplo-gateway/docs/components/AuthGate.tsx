import type { ReactNode } from "react";
import { useAuth } from "zudoku/components";

export function SignedIn({ children }: { children: ReactNode }) {
  const { isAuthEnabled, isAuthenticated, isPending } = useAuth();
  if (!isAuthEnabled) return <>{children}</>;
  if (isPending) return null;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { isAuthEnabled, isAuthenticated, isPending } = useAuth();
  if (!isAuthEnabled) return null;
  if (isPending) return null;
  if (isAuthenticated) return null;
  return <>{children}</>;
}

