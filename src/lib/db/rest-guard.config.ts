// Which tables the browser may read and write through /rest/v1 for this shop.
// Everything not listed here is staff-only. See rest-guard.ts for the rules.

export interface GuardConfig {
  /** profiles.role values (lower case) with full access. */
  staffRoles: string[];
  /** SQL returning one row with a `role` column for the user id in $1. */
  staffRoleSql: string;
  /** Catalogue / CMS tables anyone may read. */
  publicRead: string[];
  /** Column names removed (at any depth) from every non-staff read, e.g. cost prices. */
  hiddenColumnNames: string[];
  /** Rows removed from non-staff reads, e.g. site_settings key admin_pin. */
  hiddenRows: Record<string, { column: string; values: string[] }>;
  /** Rows a signed-in customer owns: reads and own-mode writes are pinned to them. */
  ownRows: Record<string, { userColumn: string; emailColumn?: string }>;
  /** Tables readable through a parent row the caller may read (order_items under orders). */
  ownChildren: Record<string, { parent: string; fk: string }>;
  /** One row readable by anyone with its exact value in one of these columns. */
  guestLookup: Record<string, { columns: string[]; patterns: Record<string, RegExp> }>;
  /** "parent>child": columns of a staff-only table that may be embedded under a public one. */
  publicEmbeds: Record<string, string[]>;
  /**
   * Browser writes allowed for non-staff callers.
   *   insert: "anyone" | "user" (signed in) | "own" (owner column forced) |
   *           "childOfNewOrder" (only into the caller's own new unpaid order)
   *   update / delete: "own" (pinned to the caller's rows)
   *   upsertOn: conflict columns that make an own-mode upsert safe
   *   ownerColumn: the user-id column of a table not listed in ownRows
   *     (e.g. reviews.user_id), so rows cannot be written for someone else
   */
  write: Record<
    string,
    {
      insert?: "anyone" | "user" | "own" | "childOfNewOrder";
      update?: "own";
      delete?: "own";
      upsertOn?: string[];
      ownerColumn?: string;
    }
  >;
  /** Columns dropped from non-staff inserts and updates. */
  protectedColumns: Record<string, string[]>;
  /** For childOfNewOrder: how new the order must be, and SQL that is true while it is unpaid. */
  childWrite?: { maxAgeMinutes: number; unpaidSql: string };
  /** RPCs non-staff may call. */
  rpc: Record<string, "anyone" | "user">;
  /** Storage buckets signed-in customers may upload to. */
  userUploadBuckets: string[];
}

export const REST_GUARD: GuardConfig = {
  // Same roles as request-auth.ts (STAFF_ROLES); its per-area staff
  // permissions still apply behind this guard.
  staffRoles: ["staff", "admin", "superadmin"],
  staffRoleSql: "SELECT role::text AS role FROM public.profiles WHERE id = $1",
  // The shim's own PUBLIC_READ_TABLES, plus site_settings, which the shim
  // limits to its feature_flags column for non-staff.
  publicRead: [
    "attribute_values",
    "attributes",
    "blog_posts",
    "categories",
    "collection_products",
    "collections",
    "home_content",
    "occasions",
    "product_images",
    "products",
    "reviews",
    "site_settings",
    "storefront_settings",
    "testimonials",
    "variants",
  ],
  hiddenColumnNames: [],
  hiddenRows: {},
  // A signed-in customer may load their own profile (login redirect, account
  // page). Orders, checkout and tracking all go through /api routes.
  ownRows: {
    profiles: { userColumn: "id" },
  },
  ownChildren: {},
  guestLookup: {},
  publicEmbeds: {},
  write: {},
  protectedColumns: {},
  rpc: {},
  userUploadBuckets: [],
};
