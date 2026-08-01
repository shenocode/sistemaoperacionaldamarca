/** Platform owner — only this account can provision gestores. */
export const ADMIN_MASTER_EMAIL = "sherocha03@gmail.com";

export function isAdminMasterEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_MASTER_EMAIL;
}
