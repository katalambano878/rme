-- Missing RPCs required after Supabase → plain Postgres cutover.
-- Safe to re-run (CREATE OR REPLACE). No destructive data changes.

-- Ticket numbers are integers in this schema.
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(ticket_number), 1000) + 1 INTO next_num FROM public.support_tickets;
  RETURN next_num;
END;
$$;

-- POS / admin cash-paid path: mark order paid and leave stock to app layer.
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  order_ref text,
  moolre_ref text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'paid',
      updated_at = NOW()
  WHERE order_number = order_ref
    AND status IS DISTINCT FROM 'paid';

  UPDATE public.payments p
  SET status = 'paid',
      provider_ref = COALESCE(moolre_ref, p.provider_ref),
      updated_at = NOW()
  FROM public.orders o
  WHERE p.order_id = o.id
    AND o.order_number = order_ref
    AND p.status IS DISTINCT FROM 'paid';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_memories(
  p_customer_id uuid DEFAULT NULL,
  p_customer_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'customer_type', memory_type,
        'content', content,
        'importance', importance,
        'created_at', created_at
      )
      ORDER BY created_at DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT id, memory_type, content, importance, created_at
    FROM public.ai_memory
    WHERE (p_customer_id IS NOT NULL AND customer_id = p_customer_id)
       OR (p_customer_email IS NOT NULL AND lower(customer_email) = lower(p_customer_email))
    ORDER BY created_at DESC
    LIMIT 20
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.upsert_chat_conversation(
  p_session_id text,
  p_user_id uuid DEFAULT NULL,
  p_messages jsonb DEFAULT '[]'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  conv_id uuid;
BEGIN
  INSERT INTO public.chat_conversations (session_id, user_id, messages, metadata, updated_at)
  VALUES (p_session_id, p_user_id, p_messages, p_metadata, NOW())
  ON CONFLICT (session_id) DO UPDATE
    SET user_id = COALESCE(EXCLUDED.user_id, chat_conversations.user_id),
        messages = EXCLUDED.messages,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
  RETURNING id INTO conv_id;

  RETURN conv_id;
EXCEPTION
  WHEN undefined_column OR unique_violation OR others THEN
    -- Fallback when unique(session_id) is missing: update-or-insert manually.
    SELECT id INTO conv_id FROM public.chat_conversations WHERE session_id = p_session_id LIMIT 1;
    IF conv_id IS NULL THEN
      INSERT INTO public.chat_conversations (session_id, user_id, messages, metadata, updated_at)
      VALUES (p_session_id, p_user_id, p_messages, p_metadata, NOW())
      RETURNING id INTO conv_id;
    ELSE
      UPDATE public.chat_conversations
      SET user_id = COALESCE(p_user_id, user_id),
          messages = p_messages,
          metadata = p_metadata,
          updated_at = NOW()
      WHERE id = conv_id;
    END IF;
    RETURN conv_id;
END;
$$;

-- customer_insights table may not exist on staging; keep a no-op compatible RPC.
CREATE TABLE IF NOT EXISTS public.customer_insights (
  customer_id uuid PRIMARY KEY,
  customer_email text,
  customer_name text,
  last_seen_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.upsert_customer_insight(
  p_customer_id uuid,
  p_customer_email text DEFAULT NULL,
  p_customer_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.customer_insights (customer_id, customer_email, customer_name, last_seen_at, updated_at)
  VALUES (p_customer_id, p_customer_email, p_customer_name, NOW(), NOW())
  ON CONFLICT (customer_id) DO UPDATE
    SET customer_email = COALESCE(EXCLUDED.customer_email, customer_insights.customer_email),
        customer_name = COALESCE(EXCLUDED.customer_name, customer_insights.customer_name),
        last_seen_at = NOW(),
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_support_dashboard_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'open_tickets', (
      SELECT COUNT(*) FROM public.support_tickets
      WHERE status IN ('open', 'in_progress', 'waiting_customer')
    ),
    'total_today', (
      SELECT COUNT(*) FROM public.chat_conversations
      WHERE created_at >= date_trunc('day', NOW())
    ),
    'unresolved_chats', (
      SELECT COUNT(*) FROM public.chat_conversations
      WHERE COALESCE(is_resolved, false) = false
    ),
    'escalated_today', (
      SELECT COUNT(*) FROM public.chat_conversations
      WHERE COALESCE(is_escalated, false) = true
        AND created_at >= date_trunc('day', NOW())
    ),
    'avg_satisfaction', (
      SELECT COALESCE(AVG(rating), 0) FROM public.support_feedback
      WHERE rating IS NOT NULL
    )
  );
$$;

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_session_id_uidx
  ON public.chat_conversations (session_id);
CREATE INDEX IF NOT EXISTS payments_provider_ref_idx ON public.payments (provider_ref);
CREATE INDEX IF NOT EXISTS payments_order_id_idx ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_at DESC);
