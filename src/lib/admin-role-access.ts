/** Roles that may use the admin dashboard (must match DB user_role enum). */
export const ADMIN_PANEL_ROLES = ['staff', 'admin', 'superadmin'] as const

export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number]

export function canAccessAdminPanel(role: string | null | undefined): boolean {
  if (!role) return false
  return (ADMIN_PANEL_ROLES as readonly string[]).includes(role)
}

/** Change other users’ roles and edit permission flags (UI gate; RLS may still allow broader staff updates). */
export function canManageStaffRoles(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin'
}
