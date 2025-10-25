export type AuthenticatedUser = {
  id: string;
  authUserId: string;
  email: string;
  tenantId: string;
  role: "owner" | "admin" | "member" | "viewer";
  permissions: string[];
  metadata: Record<string, unknown>;
  status: string;
};
