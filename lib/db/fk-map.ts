// Auto-generated FK map for ronnyandme — do not hand-edit blindly
export interface FkEdge {
  column: string;
  foreignTable: string;
  foreignColumn: string;
}

export const JSONB_COLUMNS: Record<string, Set<string>> = {
  "chat_conversations": new Set(["messages", "metadata"]),
  "collections": new Set(["rules"]),
  "home_content": new Set(["sections"]),
  "order_items": new Set(["options_snapshot"]),
  "orders": new Set(["billing_address", "shipping_address"]),
  "payments": new Set(["raw_payload"]),
  "products": new Set(["metadata"]),
  "profiles": new Set(["permissions"]),
  "site_settings": new Set(["analytics", "feature_flags", "payment_providers", "theme"]),
  "variants": new Set(["option_values"]),
  "webhook_logs": new Set(["headers", "payload"]),
};

export const FK_MAP: Record<string, FkEdge[]> = {
  "addresses": [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  "ai_memory": [
    { column: "source_conversation_id", foreignTable: "chat_conversations", foreignColumn: "id" },
  ],
  "attribute_values": [
    { column: "attribute_id", foreignTable: "attributes", foreignColumn: "id" },
  ],
  "cart_items": [
    { column: "cart_id", foreignTable: "carts", foreignColumn: "id" },
    { column: "variant_id", foreignTable: "variants", foreignColumn: "id" },
  ],
  "carts": [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  "categories": [
    { column: "parent_id", foreignTable: "categories", foreignColumn: "id" },
  ],
  "collection_products": [
    { column: "collection_id", foreignTable: "collections", foreignColumn: "id" },
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
  ],
  "inventory_movements": [
    { column: "created_by", foreignTable: "profiles", foreignColumn: "id" },
    { column: "variant_id", foreignTable: "variants", foreignColumn: "id" },
  ],
  "login_audit_log": [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  "order_items": [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "variant_id", foreignTable: "variants", foreignColumn: "id" },
  ],
  "orders": [
    { column: "discount_id", foreignTable: "discounts", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  "payments": [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
  ],
  "product_images": [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
  ],
  "products": [
    { column: "category_id", foreignTable: "categories", foreignColumn: "id" },
  ],
  "returns": [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  "reviews": [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  "shipments": [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
  ],
  "support_feedback": [
    { column: "conversation_id", foreignTable: "chat_conversations", foreignColumn: "id" },
    { column: "ticket_id", foreignTable: "support_tickets", foreignColumn: "id" },
  ],
  "support_messages": [
    { column: "ticket_id", foreignTable: "support_tickets", foreignColumn: "id" },
  ],
  "support_tickets": [
    { column: "conversation_id", foreignTable: "chat_conversations", foreignColumn: "id" },
  ],
  "variants": [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
  ],
  "wishlists": [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
    { column: "variant_id", foreignTable: "variants", foreignColumn: "id" },
  ],
};
