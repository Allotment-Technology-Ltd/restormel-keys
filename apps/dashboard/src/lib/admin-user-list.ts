/** Shared shape for service-owner user list (safe for client + server). */
export type AdminUserListRow = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  isServiceOwner: boolean;
  dbServiceOwner: boolean;
  serviceOwnerImmutable: boolean;
  operatorViaEnvUserId: boolean;
};
