import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  searchProducts,
  getProductForCart,
  trackOrder,
  getCustomerOrders,
  checkCoupon,
  createSupportTicket,
  initiateReturn,
  getRecommendations,
  getStoreInfo,
  getCustomerProfile,
  createChatOrder,
  type ChatProduct,
  type ChatOrder,
  type ChatCoupon,
  type ChatTicket,
  type ChatReturn,
  type ChatCustomerProfile,
  type ChatOrderResult,
} from '@/lib/chat-tools';
import { searchSiteKnowledge, getSiteMapSummary } from '@/lib/site-knowledge';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  CONTACT_EMAIL,
  PHONE_DISPLAY_PRIMARY,
  PHONE_INTERNATIONAL_PRIMARY,
  WHATSAPP_URL,
} from '@/lib/brand';

// ─── Env ────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const groqKey = process.env.GROQ_API_KEY;

// ─── Types ──────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: ChatAction[];
  quickReplies?: string[];
  orderCard?: ChatOrder;
  ticketCard?: ChatTicket;
  returnCard?: ChatReturn;
  couponCard?: ChatCoupon;
  products?: ChatProduct[];
}

interface ChatAction {
  type: 'add_to_cart' | 'view_product' | 'view_order' | 'track_order' | 'apply_coupon' | 'payment_link';
  product?: ChatProduct;
  orderId?: string;
  orderNumber?: string;
  couponCode?: string;
  label?: string;
  paymentUrl?: string;
}

interface RequestBody {
  messages?: ChatMessage[];
  newMessage?: string;
  sessionId?: string;
  pagePath?: string;
  cartItems?: { id: string; name: string; price: number; quantity: number; slug: string }[];
}

// ─── Rate Limiting (in-memory) ──────────────────────────────────────────────

// Per-route rate limiting is delegated to lib/rate-limit so we can also enforce
// a per-IP burst cap (prevents an attacker from rotating sessionId values to
// drain the LLM budget).
import { checkRateLimit as checkSharedRateLimit, getClientIdentifier, RATE_LIMITS as SHARED_RATE_LIMITS } from '@/lib/rate-limit';

// ─── LLM Configuration ──────────────────────────────────────────────────────

const LLM_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const LLM_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = parseFloat(res.headers.get('retry-after') || '3');
      const waitMs = Math.min((retryAfter || 3) * 1000, 15000);
      console.warn(`[Chat API] Rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
  return fetch(url, options);
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

const LLM_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_products',
      description: 'Search for products by name, description, or category. Use when the customer asks about availability, what products exist, to find a product, or wants to browse.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search term from the user' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_product_for_cart',
      description: 'Get one specific product by slug or id for adding to cart. Use when the user wants to add a specific known product.',
      parameters: {
        type: 'object',
        properties: { slug_or_id: { type: 'string', description: 'Product slug or UUID' } },
        required: ['slug_or_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'track_order',
      description: 'Track an order by order number and email. Use when the customer wants to know the status of a specific order. If the customer provided their email earlier in the conversation, use that — do NOT ask again.',
      parameters: {
        type: 'object',
        properties: {
          order_number: { type: 'string', description: 'Order number (e.g. ORD-xxx) or tracking number' },
          email: { type: 'string', description: 'Email address associated with the order. Use email from conversation context if already provided.' },
        },
        required: ['order_number', 'email'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_customer_orders',
      description: 'Get recent orders for the logged-in customer. Use when they ask "show me my orders" or "my recent orders" or "reorder". Only works for authenticated users.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Number of orders to return (default 5)' } },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_coupon',
      description: 'Validate a coupon or discount code. Use when the customer asks about a promo code, discount, or coupon.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Coupon code to validate' },
          cart_total: { type: 'number', description: 'Optional current cart total for minimum purchase check' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_support_ticket',
      description: 'Create a support ticket to escalate an issue to the human support team. Use when the customer has a problem you cannot solve, wants to report an issue, or requests to speak with a human. If the user provided their email in the conversation, pass it in the email parameter.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Short summary of the issue' },
          description: { type: 'string', description: 'Detailed description of the problem' },
          category: { type: 'string', enum: ['order_issue', 'product_inquiry', 'payment', 'shipping', 'return', 'other'], description: 'Issue category' },
          email: { type: 'string', description: 'Customer email address (from conversation or profile). Always include if the customer mentioned their email.' },
        },
        required: ['subject', 'description'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'initiate_return',
      description: 'Start a return request for a delivered order. Only for logged-in users with a delivered order within 30 days. Ask for the order ID and reason before calling.',
      parameters: {
        type: 'object',
        properties: {
          order_id: { type: 'string', description: 'UUID of the order to return' },
          reason: { type: 'string', description: 'Reason for the return' },
          description: { type: 'string', description: 'Additional details about the return' },
        },
        required: ['order_id', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_recommendations',
      description: 'Get product recommendations. Use when the customer asks "what do you recommend?", "bestsellers", "popular items", or you want to suggest alternatives.',
      parameters: {
        type: 'object',
        properties: { context: { type: 'string', description: 'Optional category or interest for recommendations' } },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_store_info',
      description: 'Get store information and policies. Use for questions about shipping, returns policy, payment methods, delivery times, contact info, or business hours.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: ['shipping', 'returns', 'payment', 'contact', 'about', 'delivery_times', 'hours'], description: 'Topic to get info about' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_customer_profile',
      description: 'Get the logged-in customer\'s profile information. Use to personalize the conversation or when the customer asks about their account details.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_website_info',
      description: `Search the website's pages and content for information. Use for questions about ${BRAND_NAME}, policies, contact, shipping, returns, payments, accounts, checkout, or the blog. ALWAYS use this tool for non-product business questions.`,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for (e.g. "return policy", "how to track order", "contact phone number", "payment methods", "password reset")' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_order',
      description: 'Create an order and initiate payment. Use this when the customer has items in their cart AND has provided all required shipping information (firstName, lastName, email, phone, address, city, region) AND has confirmed they want to proceed with checkout. The cart items are provided automatically from the customer\'s current cart - pass them in the items parameter.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Cart items to order. Use the product IDs and quantities from the cart context provided in the conversation.',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'Product UUID' },
                quantity: { type: 'number', description: 'Quantity to order' },
              },
              required: ['productId', 'quantity'],
            },
          },
          shipping: {
            type: 'object',
            description: 'Shipping details collected from the customer',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              address: { type: 'string' },
              city: { type: 'string' },
              region: { type: 'string' },
            },
            required: ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'region'],
          },
          delivery_method: {
            type: 'string',
            enum: ['standard', 'express', 'pickup'],
            description: 'Delivery method. Standard: GH₵20, Express: GH₵40, Pickup: Free',
          },
          payment_method: {
            type: 'string',
            enum: ['paystack', 'moolre', 'cod'],
            description: 'paystack = Paystack link (card/MoMo), moolre = Moolre Mobile Money link, cod = cash on delivery where offered',
          },
        },
        required: ['items', 'shipping', 'delivery_method', 'payment_method'],
      },
    },
  },
];

// ─── System Prompt Builder ──────────────────────────────────────────────────

function buildSystemPrompt(profile: ChatCustomerProfile | null, pagePath?: string): string {
  const now = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let prompt = `You are the AI shopping assistant for ${BRAND_NAME} — ${BRAND_TAGLINE}. We sell beauty, skincare, body care, makeup, hair, and baby essentials in Ghana. Today is ${now}.

ABSOLUTE RULES — NEVER BREAK THESE:
- NEVER show your internal reasoning, thinking steps, chain-of-thought, or planning process. NEVER output anything like "Step 1:", "## Step", "Let me think", or similar. Only output the final customer-facing response.
- NEVER list your available tools or describe how you will use them. Just use them silently and respond with the result.
- NEVER output markdown headers (##) in your responses. Use plain text with bold (**) for emphasis if needed.

PRODUCT RULES — THE MOST IMPORTANT RULES:
- You are ONLY allowed to mention products that appear in a tool result (search_products or get_recommendations). Every product name, brand name, ingredient name, and price you mention MUST come from the tool response data.
- BEFORE mentioning ANY product, you MUST call search_products or get_recommendations. NEVER skip the tool call. NEVER respond about products without calling a tool first.
- If the tool returns results, ONLY mention products from that response. Do NOT add extra products from your training knowledge, even if you "know" they exist.
- If the tool returns NO results for what the customer asked, the tool will automatically provide alternative products from our store. Recommend THOSE alternatives instead. Say something like "We don't carry [what they asked for], but here are some products you might like:" and list the alternatives from the tool result.
- If the customer describes a skin/hair/beauty concern (dry skin, acne, dark spots, frizzy hair, etc.), call search_products with relevant keywords. ONLY recommend products the tool returns. Do NOT suggest products, brands, or ingredients from your general knowledge.
- NEVER say a product name that did not come from a tool result. This includes well-known brands (CeraVe, The Ordinary, Nivea, etc.) — if the tool didn't return it, do NOT mention it.
- NEVER describe what a product does, its ingredients, or how it works UNLESS that information is in the tool result data. You only know what the database tells you.
- When tool results include an "instruction" field, follow it exactly.

CORE BEHAVIORS:
- Be warm, helpful, and concise. Use a friendly but professional tone.
- Always quote prices in GH₵ (Ghana Cedis).
- When mentioning products, include the exact name and price FROM THE TOOL RESULT ONLY.
- If a product is out of stock, say so and proactively suggest alternatives using get_recommendations.
- For order tracking, always ask for both order number AND email if not provided.
- Never make up information — if unsure, use the appropriate tool to look it up.
- Keep responses concise (2-4 sentences max for simple questions).
- For ANY product-related request — IMMEDIATELY call search_products or get_recommendations. Wait for the result before responding. Your response must only reference products from that result.

CRITICAL CONVERSATION RULES — YOU MUST FOLLOW THESE:
1. NEVER ask for information the customer already provided. Read the full conversation history carefully. If they already gave their email, name, order number, or any detail — USE IT, don't ask again.
2. NEVER repeat the same question twice. If you already asked something and the customer responded, move forward with their answer.
3. NEVER give a generic response like "How can I help?" or "Could you tell me more?" after the customer has clearly stated what they need. Always address their specific request.
4. If a tool call fails or you can't complete an action, explain SPECIFICALLY what went wrong and what the customer can do instead. Never just reset to a generic greeting.
5. When the customer provides information (like an email address), ACKNOWLEDGE it specifically (e.g. "Got it, using wepedam@gmail.com...") and proceed with the action immediately.
6. Maintain context throughout the entire conversation. If the customer said they want a password reset 3 messages ago, you still know that's what they want.

HONESTY ABOUT LIMITATIONS:
- You CANNOT directly reset passwords, change account settings, or modify orders. Be upfront about this.
- For password resets: Tell the customer you'll create a support ticket so the team can send them a reset link. Then use the create_support_ticket tool.
- For account changes: Explain that a human agent needs to handle it and offer to create a ticket.
- For order modifications: Explain this requires human intervention and offer to escalate.
- NEVER pretend you can do something you can't. It's better to say "I can't do that directly, but here's what I can do..." than to loop the customer.

WHEN CREATING SUPPORT TICKETS:
- If the customer has provided their email in the conversation, extract it and pass it to the create_support_ticket tool in the "email" parameter.
- Do NOT ask for the email again if they already provided it.
- Always include a clear subject and description based on the full conversation context.

STORE POLICIES (quick reference):
- Delivery: see /policies/shipping; estimates shown at checkout
- Returns: see /policies/returns
- Payment: Paystack (card & mobile money in GHS); COD only when explicitly offered
- Contact: ${CONTACT_EMAIL}, ${PHONE_DISPLAY_PRIMARY}

CAPABILITIES (what you CAN do):
- Search and recommend products
- Check product availability and pricing
- Track orders by order number + email
- Show recent orders (logged-in users)
- Validate coupon/discount codes
- Create support tickets (for issues that need human help)
- Initiate returns (logged-in users, delivered orders within 30 days)
- Answer questions about shipping, returns, payment, and store info
- Look up ANY information about the website, business, policies, FAQs, and more using the get_website_info tool
- **Place orders and initiate payments** using the create_order tool

IMPORTANT — USING WEBSITE KNOWLEDGE:
When a customer asks about ANYTHING related to the business (policies, how to do something, contact info, account help, delivery zones, payment methods, returns process, FAQs, etc.), ALWAYS use the get_website_info tool first to get accurate, up-to-date information from the actual website. Do NOT rely solely on the quick reference above — use the tool for detailed answers.

CHECKOUT & ORDER PLACEMENT:
You can help customers place orders directly in this chat. Here is how:
1. The customer's current cart contents are provided in the conversation context (if they have items).
2. When the customer says they want to checkout, buy, or place an order, collect their shipping info step by step:
   - Full name (first and last)
   - Email address
   - Phone number
   - Delivery address, city, and region
3. Ask them to choose a delivery method:
   - **Standard** — GH₵20 (1-3 business days in Accra, 3-7 days outside)
   - **Express** — GH₵40 (same-day/next-day in Accra)
   - **Pickup** — Free (collect from our location)
4. Ask them to choose a payment method:
   - **Paystack** — card or mobile money (Ghana)
   - **Moolre** — Mobile Money via Moolre secure link
   - **Cash on Delivery** — only if your policies allow it
5. Summarize the order (items, subtotal, delivery fee, total) and ask the customer to confirm.
6. Once confirmed, call the create_order tool with the cart items (product IDs and quantities from the cart context), shipping info, delivery method, and payment method (paystack, moolre, or cod).
7. Share the payment link from the tool for Paystack or Moolre. For COD, confirm the order is placed.
IMPORTANT: Do NOT ask the customer to list their cart items — you already have them. Just reference what is in their cart and proceed. If the cart is empty, tell them to add products first.

LIMITATIONS (what you CANNOT do directly):
- Reset passwords or change login credentials
- Modify or cancel existing orders
- Process refunds
- Change customer account details
- Access or change delivery addresses on active orders

WHEN YOU CANNOT HELP OR ANSWER A QUESTION:
If you genuinely cannot answer a question or resolve an issue (whether it's beyond your capabilities, the customer is frustrated, or anything else), you MUST do TWO things:
1. AUTOMATICALLY create a support ticket using the create_support_ticket tool — don't just offer to, actually do it. Use whatever info the customer already provided (email, name, issue details).
2. ALWAYS provide direct contact information:
   - Phone: ${PHONE_DISPLAY_PRIMARY} (${PHONE_INTERNATIONAL_PRIMARY})
   - WhatsApp: ${WHATSAPP_URL}
   - Email: ${CONTACT_EMAIL}
   Say something like: "I've created a support ticket. You can also reach us at **${PHONE_DISPLAY_PRIMARY}** or **${CONTACT_EMAIL}**."
Never leave a customer stuck without a path forward.

${getSiteMapSummary()}`;

  if (profile) {
    prompt += `\n\nCUSTOMER CONTEXT (logged in):
- Name: ${profile.name}
- Email: ${profile.email}
- Total orders: ${profile.total_orders}
- Total spent: GH₵${profile.total_spent.toFixed(2)}
- Last order: ${profile.last_order_at ? new Date(profile.last_order_at).toLocaleDateString('en-GB') : 'N/A'}
Address the customer by their first name. You can access their orders and profile directly.`;
  } else {
    prompt += `\n\nCUSTOMER CONTEXT: Guest (not logged in). For order tracking, you'll need their order number and email. Suggest signing in for a more personalized experience when relevant.`;
  }

  if (pagePath) {
    prompt += `\n\nThe customer is currently viewing: ${pagePath}`;
    if (pagePath.includes('/products/')) {
      prompt += ` — They may be interested in this specific product.`;
    } else if (pagePath.includes('/track-order')) {
      prompt += ` — They likely need help tracking an order.`;
    } else if (pagePath.includes('/cart') || pagePath.includes('/checkout')) {
      prompt += ` — They are in the purchasing flow; help them complete their purchase.`;
    }
  }

  return prompt;
}

// ─── Auth Detection ─────────────────────────────────────────────────────────

async function detectAuth(request: Request): Promise<{ userId: string | null; email: string | null }> {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const authToken = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('sb-') && c.includes('-auth-token'))
      ?.split('=')
      .slice(1)
      .join('=');

    if (!authToken) return { userId: null, email: null };

    const decoded = decodeURIComponent(authToken);
    let tokenData: any;
    try {
      tokenData = JSON.parse(decoded);
    } catch {
      tokenData = decoded;
    }

    const accessToken = typeof tokenData === 'string' ? tokenData : tokenData?.[0] || tokenData?.access_token;
    if (!accessToken) return { userId: null, email: null };

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return { userId: user.id, email: user.email || null };
    }
  } catch (e) {
    console.error('[Chat API] Auth detection error:', e);
  }
  return { userId: null, email: null };
}

// ─── Main POST Handler ──────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { messages = [], newMessage, sessionId, pagePath, cartItems } = body;

    const userText = (newMessage || '').trim();
    if (!userText) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Two-tier rate limit: per-IP (catches abuse), per-session (catches UI spam).
    const clientIp = getClientIdentifier(request);
    const ipShort = checkSharedRateLimit(`chat:ip:${clientIp}`, SHARED_RATE_LIMITS.chat);
    const ipLong = checkSharedRateLimit(`chat:ip:burst:${clientIp}`, SHARED_RATE_LIMITS.chatBurst);
    if (!ipShort.success || !ipLong.success) {
      return NextResponse.json(
        { message: "You're sending messages too quickly. Please wait a moment and try again.", quickReplies: [] },
        { status: 429, headers: { 'Retry-After': String(Math.max(ipShort.resetIn, ipLong.resetIn)) } },
      );
    }
    if (sessionId) {
      const sessionLimit = checkSharedRateLimit(`chat:session:${sessionId}`, SHARED_RATE_LIMITS.chat);
      if (!sessionLimit.success) {
        return NextResponse.json(
          { message: "You're sending messages too quickly. Please wait a moment and try again.", quickReplies: [] },
          { status: 429, headers: { 'Retry-After': String(sessionLimit.resetIn) } },
        );
      }
    }

    const { userId, email: userEmail } = await detectAuth(request);

    // SECURITY: Tools that act on behalf of the (possibly unauthenticated) caller
    // run with the ANON key so RLS protects other customers' data. Persistence
    // and any write-only paths use a separate service-role client below.
    const supabase = createClient(supabaseUrl, supabaseKey);
    const supabaseWriter = supabaseAdmin;

    let profile: ChatCustomerProfile | null = null;
    if (userId) {
      // Profile lookup is keyed on the JWT-verified userId from detectAuth(),
      // so even with the writer client we only return the caller's own profile.
      profile = await getCustomerProfile(supabaseWriter, userId);
    }

    // Fetch AI memories for context (writer needed because ai_memory has RLS)
    let aiMemories: any[] = [];
    if (userId || userEmail) {
      try {
        const { data: memData, error: memErr } = await supabaseWriter.rpc('get_ai_memories', {
          p_customer_id: userId || null,
          p_customer_email: userEmail || null,
        });
        if (memErr) console.warn('[Chat API] get_ai_memories:', memErr.message);
        aiMemories = Array.isArray(memData) ? memData : [];
      } catch (e) {
        console.warn('[Chat API] get_ai_memories failed', e);
      }
    }

    // Fetch relevant KB articles from Supabase for AI context
    let kbContext = '';
    if (groqKey) {
      try {
        const searchTerms = userText.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3);
        if (searchTerms.length > 0) {
          const { data: kbArticles } = await supabaseWriter
            .from('support_knowledge_base')
            .select('title, content')
            .eq('is_published', true)
            .or(searchTerms.map(t => `title.ilike.%${t}%,content.ilike.%${t}%`).join(','))
            .limit(3);
          if (kbArticles && kbArticles.length > 0) {
            kbContext = '\n\nKNOWLEDGE BASE (use these to answer if relevant):\n' +
              kbArticles.map((a: any) => `- ${a.title}: ${a.content.slice(0, 200)}`).join('\n');
          }
        }
      } catch {}
    }

    // Also inject instant site knowledge context (fast, in-memory, no DB call)
    const siteHits = searchSiteKnowledge(userText, 2);
    if (siteHits.length > 0) {
      kbContext += '\n\nWEBSITE CONTENT (pre-fetched, use to answer immediately if relevant):\n' +
        siteHits.map(h => `[${h.title}] (${h.path}): ${h.content.slice(0, 300)}...`).join('\n');
    }

    let result: any;
    if (groqKey) {
      result = await handleWithAI(supabase, supabaseWriter, messages, userText, groqKey, userId, userEmail, profile, pagePath, aiMemories, kbContext, cartItems, clientIp);
    } else {
      result = await handleWithoutAI(supabase, supabaseWriter, userText, profile);
    }

    if (sessionId) {
      persistConversation(supabaseWriter, sessionId, userId, userEmail, profile, messages, userText, result, pagePath).catch((e) =>
        console.error('[Chat API] Persistence error:', e)
      );
    }

    // Update customer insights asynchronously (writer client — RLS would block anon)
    if (userId) {
      try {
        const { error: insightErr } = await supabaseWriter.rpc('upsert_customer_insight', {
          p_customer_id: userId,
          p_customer_email: userEmail,
          p_customer_name: profile?.name || null,
        });
        if (insightErr) console.warn('[Chat API] upsert_customer_insight:', insightErr.message);
      } catch (e) {
        console.warn('[Chat API] upsert_customer_insight failed', e);
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Chat API] Error:', err);
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.', quickReplies: ['Try again'] },
      { status: 500 }
    );
  }
}

// ─── Conversation Persistence ───────────────────────────────────────────────

async function persistConversation(
  supabase: any,
  sessionId: string,
  userId: string | null,
  userEmail: string | null,
  profile: ChatCustomerProfile | null,
  previousMessages: ChatMessage[],
  userText: string,
  result: any,
  pagePath?: string
) {
  const allMessages = [
    ...previousMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText },
    { role: 'assistant', content: result.message || '' },
  ];
  const last20 = allMessages.slice(-20);
  const messageCount = allMessages.length;

  // Basic sentiment detection from user text
  const lower = userText.toLowerCase();
  const negativeWords = ['angry', 'frustrated', 'terrible', 'horrible', 'worst', 'hate', 'bad', 'awful', 'unacceptable', 'disappointed', 'furious', 'pathetic', 'useless', 'scam', 'refund'];
  const positiveWords = ['great', 'love', 'amazing', 'excellent', 'wonderful', 'fantastic', 'awesome', 'perfect', 'thank', 'happy', 'good', 'best'];
  const negCount = negativeWords.filter(w => lower.includes(w)).length;
  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const sentiment = negCount > posCount ? 'negative' : posCount > negCount ? 'positive' : 'neutral';

  // Category detection
  let category = null;
  if (/order|track|delivery|ship/i.test(lower)) category = 'order';
  else if (/product|buy|price|stock|available/i.test(lower)) category = 'product';
  else if (/return|refund|exchange/i.test(lower)) category = 'return';
  else if (/payment|pay|money|momo/i.test(lower)) category = 'payment';
  else if (/coupon|promo|discount/i.test(lower)) category = 'coupon';
  else if (/support|help|ticket|issue|problem|complaint/i.test(lower)) category = 'support';
  else if (/shipping|deliver/i.test(lower)) category = 'shipping';

  // Intent detection
  let intent = null;
  if (result.products?.length > 0) intent = 'product_search';
  else if (result.orderCard) intent = 'order_tracking';
  else if (result.ticketCard) intent = 'support_ticket';
  else if (result.returnCard) intent = 'return_request';
  else if (result.couponCard) intent = 'coupon_check';
  else if (/\b(hi|hello|hey)\b/i.test(lower)) intent = 'greeting';
  else if (/\b(thank|bye)\b/i.test(lower)) intent = 'closing';

  // Auto-resolution: if AI provided a helpful answer (product, order, coupon info)
  const isResolved = !!(result.products?.length > 0 || result.orderCard || result.couponCard);
  const isEscalated = !!(result.ticketCard);

  // Build conversation summary from last exchange
  const summary = `Customer asked about: ${userText.slice(0, 100)}${userText.length > 100 ? '...' : ''}`;

  // Upsert with enhanced metadata (pass raw objects, not JSON.stringify - Supabase handles serialization)
  await supabase.rpc('upsert_chat_conversation', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_messages: last20,
    p_metadata: {
      lastActivity: new Date().toISOString(),
      lastUserMessage: userText.slice(0, 200),
      hadProducts: (result.products?.length || 0) > 0,
      hadOrderCard: !!result.orderCard,
      hadTicket: !!result.ticketCard,
    },
  });

  // Update the enhanced columns directly
  const { data: existingConv } = await supabase
    .from('chat_conversations')
    .select('id, created_at')
    .eq('session_id', sessionId)
    .single();

  if (existingConv) {
    const durationSeconds = Math.floor((Date.now() - new Date(existingConv.created_at).getTime()) / 1000);
    await supabase.from('chat_conversations').update({
      sentiment,
      category,
      intent,
      summary,
      message_count: messageCount,
      customer_email: userEmail || profile?.email || null,
      customer_name: profile?.name || null,
      is_resolved: isResolved,
      is_escalated: isEscalated,
      escalated_at: isEscalated ? new Date().toISOString() : null,
      page_context: pagePath || null,
      duration_seconds: durationSeconds,
    }).eq('id', existingConv.id);

    // Auto-save AI memory for negative sentiment
    if (sentiment === 'negative' && (userId || userEmail)) {
      await supabase.from('ai_memory').insert({
        customer_id: userId || null,
        customer_email: userEmail || null,
        memory_type: 'issue',
        content: `Had a negative experience: "${userText.slice(0, 150)}"`,
        importance: 'high',
        source_conversation_id: existingConv.id,
      }).then(() => {}).catch(() => {});
    }

    // Auto-save preference memories from product searches
    if (category === 'product' && result.products?.length > 0 && (userId || userEmail)) {
      const productNames = result.products.slice(0, 3).map((p: any) => p.name).join(', ');
      await supabase.from('ai_memory').insert({
        customer_id: userId || null,
        customer_email: userEmail || null,
        memory_type: 'preference',
        content: `Interested in: ${productNames}`,
        importance: 'normal',
        source_conversation_id: existingConv.id,
      }).then(() => {}).catch(() => {});
    }
  }
}

// ─── Rule-Based Fallback ────────────────────────────────────────────────────

async function handleWithoutAI(supabase: any, _supabaseWriter: any, userText: string, profile: ChatCustomerProfile | null) {
  const lower = userText.toLowerCase();

  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(userText)) {
    const greeting = profile ? `Hi ${profile.name.split(' ')[0]}! ` : 'Hi there! ';
    return {
      message: `${greeting}I'm your shopping assistant. I can help you find products, track orders, check stock, and more. What can I help you with?`,
      quickReplies: ['Find a product', 'Track my order', 'What do you recommend?', 'Store info'],
    };
  }

  if (/\b(track|where.*(my|is).*(order|package)|order status)\b/i.test(lower)) {
    return {
      message: 'I can help you track your order! Please provide your order number (e.g. ORD-xxx) and the email address you used when ordering.',
      quickReplies: ['I have my order number', 'I forgot my order number'],
    };
  }

  if (/\b(shipping|delivery|how long|deliver)\b/i.test(lower)) {
    return {
      message: getStoreInfo('shipping'),
      quickReplies: ['Delivery times', 'Payment methods', 'Returns policy'],
    };
  }

  if (/\b(return|refund|exchange)\b/i.test(lower)) {
    return {
      message: getStoreInfo('returns'),
      quickReplies: ['Start a return', 'Track my order', 'Contact support'],
    };
  }

  if (/\b(pay|payment|mobile money|momo|cash on delivery)\b/i.test(lower)) {
    return {
      message: getStoreInfo('payment'),
      quickReplies: ['Shipping info', 'Find a product'],
    };
  }

  if (/\b(contact|support|human|agent|speak|talk|help me)\b/i.test(lower)) {
    return {
      message: getStoreInfo('contact'),
      quickReplies: ['Create a support ticket', 'Track my order', 'Find a product'],
    };
  }

  if (/\b(recommend|popular|bestseller|suggest|trending)\b/i.test(lower)) {
    const products = await getRecommendations(supabase);
    if (products.length > 0) {
      const actions: ChatAction[] = products.filter((p) => p.inStock).map((p) => ({ type: 'add_to_cart' as const, product: p }));
      return {
        message: 'Here are some of our top picks:',
        products,
        actions,
        quickReplies: ['Show me more', 'Search for something specific'],
      };
    }
  }

  if (/\b(coupon|promo|discount|code)\b/i.test(lower)) {
    return {
      message: 'I can check a coupon code for you! Just tell me the code and I\'ll verify if it\'s valid.',
      quickReplies: ['I have a code', 'Find a product', 'What deals are available?'],
    };
  }

  if (/\b(thanks|thank you|bye|goodbye)\b/i.test(lower)) {
    return {
      message: 'You\'re welcome! If you need anything else, I\'m always here to help. Happy shopping!',
      quickReplies: ['Find a product', 'Track my order'],
    };
  }

  const isSearch = /\b(available|stock|have|find|search|look|buy|price|how much|get|show|want)\b/i.test(userText) ||
    (userText.length > 2 && !userText.endsWith('?'));

  if (isSearch || lower.includes('product') || lower.includes('item')) {
    const query = userText
      .replace(/\b(do you have|is there|are there|show me|find|search|available|in stock|price|how much|get|buy|i want|i need)\b/gi, '')
      .replace(/\?/g, '')
      .trim() || ' ';

    const products = await searchProducts(supabase, query, 4);
    if (products.length > 0) {
      const actions: ChatAction[] = products.filter((p) => p.inStock).map((p) => ({ type: 'add_to_cart' as const, product: p }));
      return {
        message: `Here's what I found:`,
        products,
        actions,
        quickReplies: ['Show me more', 'Add to cart', 'Something else'],
      };
    }
  }

  const fallback = await searchProducts(supabase, userText.slice(0, 50), 3);
  if (fallback.length > 0) {
    const actions: ChatAction[] = fallback.filter((p) => p.inStock).map((p) => ({ type: 'add_to_cart' as const, product: p }));
    return {
      message: 'I found these products that might interest you:',
      products: fallback,
      actions,
      quickReplies: ['Search for something else', 'Track my order', 'Store info'],
    };
  }

  // Last resort: show popular products so the customer always sees real options
  const popular = await getRecommendations(supabase);
  if (popular.length > 0) {
    const actions: ChatAction[] = popular.filter((p) => p.inStock).map((p) => ({ type: 'add_to_cart' as const, product: p }));
    return {
      message: `We don't have an exact match for that, but here are some of our popular products you might like:`,
      products: popular,
      actions,
      quickReplies: ['Search for something else', 'Track my order', 'Contact us'],
    };
  }

  return {
    message: `I'm not quite sure what you're looking for. I can help with products, order tracking, coupons, policies, and support tickets.\n\nYou can also reach ${BRAND_NAME} at **${PHONE_DISPLAY_PRIMARY}** or **${CONTACT_EMAIL}**.`,
    quickReplies: ['Find a product', 'Track my order', 'What do you recommend?', 'Call us'],
  };
}

// ─── AI Handler with Function Calling (Groq) ───────────────────────────────

async function handleWithAI(
  supabase: any,
  supabaseWriter: any,
  messages: ChatMessage[],
  userText: string,
  apiKey: string,
  userId: string | null,
  userEmail: string | null,
  profile: ChatCustomerProfile | null,
  pagePath?: string,
  aiMemories?: any[],
  kbContext?: string,
  cartItems?: { id: string; name: string; price: number; quantity: number; slug: string }[],
  clientIp?: string,
) {
  let systemPrompt = buildSystemPrompt(profile, pagePath);

  // Inject AI memories into system prompt
  if (aiMemories && aiMemories.length > 0) {
    systemPrompt += '\n\nCUSTOMER MEMORY (things you remember about this customer from past conversations):';
    for (const mem of aiMemories.slice(0, 10)) {
      systemPrompt += `\n- [${mem.type}] ${mem.content}`;
    }
    systemPrompt += '\nUse these memories to provide personalized service. Reference past interactions naturally.';
  }

  // Inject KB context
  if (kbContext) {
    systemPrompt += kbContext;
  }

  // Inject cart context so AI knows what the customer wants to buy
  if (cartItems && cartItems.length > 0) {
    const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    systemPrompt += `\n\nCUSTOMER'S CURRENT CART (${cartItems.length} item${cartItems.length > 1 ? 's' : ''}, subtotal GH₵${cartTotal.toFixed(2)}):`;
    for (const item of cartItems) {
      systemPrompt += `\n- ${item.name} × ${item.quantity} = GH₵${(item.price * item.quantity).toFixed(2)} (ID: ${item.id})`;
    }
    systemPrompt += `\nWhen the customer wants to checkout, use these product IDs and quantities for the create_order tool.`;
  }

  const truncatedHistory = messages.slice(-18);

  const llmMessages: { role: MessageRole; content: string; tool_call_id?: string; name?: string }[] = [
    { role: 'system', content: systemPrompt },
    ...truncatedHistory.map((m) => ({ role: m.role as MessageRole, content: m.content })),
    { role: 'user', content: userText },
  ];

  let allProducts: ChatProduct[] = [];
  let allActions: ChatAction[] = [];
  let orderCard: ChatOrder | undefined;
  let ticketCard: ChatTicket | undefined;
  let returnCard: ChatReturn | undefined;
  let couponCard: ChatCoupon | undefined;
  let quickReplies: string[] = [];
  let paymentAction: ChatAction | undefined;

  try {
    const res = await fetchWithRetry(LLM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: llmMessages,
        tools: LLM_TOOLS,
        tool_choice: 'auto',
        max_completion_tokens: 1024,
        temperature: 0.6,
        top_p: 1,
      }),
    });

    if (!res.ok) {
      console.error('[Chat API] Groq error:', await res.text());
      return await handleWithoutAI(supabase, supabaseWriter, userText, profile);
    }

    let data = await res.json();
    let choice = data.choices?.[0];
    let toolCalls = choice?.message?.tool_calls;

    // Handle tool calls (support up to 3 rounds of tool calling for multi-step tasks)
    let rounds = 0;
    while (Array.isArray(toolCalls) && toolCalls.length > 0 && rounds < 3) {
      rounds++;

      llmMessages.push(choice.message);

      for (const tc of toolCalls) {
        const fnName = tc.function?.name;
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}

        const toolResult = await executeToolCall(supabase, supabaseWriter, fnName, args, userId, userEmail, profile, cartItems, clientIp);

        if (toolResult.products) allProducts.push(...toolResult.products);
        if (toolResult.orderCard) orderCard = toolResult.orderCard;
        if (toolResult.ticketCard) ticketCard = toolResult.ticketCard;
        if (toolResult.returnCard) returnCard = toolResult.returnCard;
        if (toolResult.couponCard) couponCard = toolResult.couponCard;
        if (toolResult.quickReplies) quickReplies = toolResult.quickReplies;
        if (toolResult.paymentAction) paymentAction = toolResult.paymentAction;

        llmMessages.push({
          role: 'tool',
          content: JSON.stringify(toolResult.data),
          tool_call_id: tc.id,
        });
      }

      const followUpRes = await fetchWithRetry(LLM_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: llmMessages,
          tools: LLM_TOOLS,
          tool_choice: 'auto',
          max_completion_tokens: 1024,
          temperature: 0.6,
          top_p: 1,
        }),
      });

      if (!followUpRes.ok) break;
      data = await followUpRes.json();
      choice = data.choices?.[0];
      toolCalls = choice?.message?.tool_calls;
    }

    let assistantContent = choice?.message?.content?.trim() || '';

    // Strip any leaked reasoning/thinking blocks from the response
    assistantContent = assistantContent
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/## Step \d+:.*$/gm, '')
      .replace(/^Step \d+:.*$/gm, '')
      .replace(/^Let's get started!?\s*/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .trim();

    // If the AI returned empty content, generate a contextual fallback instead of a generic message
    if (!assistantContent) {
      if (ticketCard) {
        assistantContent = `I've created a support ticket for you. Our team will follow up shortly.`;
      } else if (orderCard) {
        assistantContent = `Here are the details for your order.`;
      } else if (allProducts.length > 0) {
        assistantContent = `Here's what I found for you:`;
      } else if (couponCard) {
        assistantContent = `Here's the coupon information:`;
      } else {
        assistantContent = `I'm sorry, I wasn't able to process that properly. Try rephrasing, or contact us:\n\n- **Phone:** ${PHONE_DISPLAY_PRIMARY}\n- **WhatsApp:** ${WHATSAPP_URL}\n- **Email:** ${CONTACT_EMAIL}`;
      }
    }

    allActions = allProducts.filter((p) => p.inStock).map((p) => ({ type: 'add_to_cart' as const, product: p }));
    if (paymentAction) allActions.push(paymentAction);

    if (!quickReplies.length) {
      quickReplies = generateQuickReplies(userText, allProducts, orderCard, ticketCard);
    }

    return {
      message: assistantContent,
      products: allProducts.length > 0 ? allProducts : undefined,
      actions: allActions.length > 0 ? allActions : undefined,
      orderCard,
      ticketCard,
      returnCard,
      couponCard,
      quickReplies,
    };
  } catch (err: any) {
    console.error('[Chat API] AI handler error:', err);
    return await handleWithoutAI(supabase, supabaseWriter, userText, profile);
  }
}

// ─── Tool Call Executor ─────────────────────────────────────────────────────

async function executeToolCall(
  supabase: any,
  supabaseWriter: any,
  fnName: string,
  args: any,
  userId: string | null,
  userEmail: string | null,
  profile: ChatCustomerProfile | null,
  cartItems?: { id: string; name: string; price: number; quantity: number; slug: string }[],
  clientIp?: string,
): Promise<{
  data: any;
  products?: ChatProduct[];
  orderCard?: ChatOrder;
  ticketCard?: ChatTicket;
  returnCard?: ChatReturn;
  couponCard?: ChatCoupon;
  paymentAction?: ChatAction;
  quickReplies?: string[];
}> {
  switch (fnName) {
    case 'search_products': {
      const products = await searchProducts(supabase, args.query, 4);
      if (products.length === 0) {
        const alternatives = await getRecommendations(supabase);
        if (alternatives.length > 0) {
          return {
            data: {
              found: 0,
              results: [],
              not_found: true,
              search_query: args.query,
              instruction: `NO PRODUCTS matching "${args.query}" exist in our store. Do NOT name, describe, or suggest "${args.query}" or any product from your own knowledge. Instead, tell the customer we don't carry that specific item, then recommend these REAL alternatives from our store:`,
              alternatives: alternatives.map((p) => ({ name: p.name, price: p.price, inStock: p.inStock, slug: p.slug })),
              alternatives_instruction: 'ONLY mention products from the "alternatives" list above. Do NOT add any other product names.',
            },
            products: alternatives,
            quickReplies: ['Show me more', 'Add to cart'],
          };
        }
        return {
          data: {
            found: 0,
            results: [],
            not_found: true,
            instruction: `NO PRODUCTS matching "${args.query}" exist in our store and no alternatives are available. Do NOT name any product. Tell the customer we don't carry that item and suggest they browse the shop or contact us.`,
          },
          products: [],
          quickReplies: ['Browse all products', 'Contact us'],
        };
      }
      return {
        data: {
          found: products.length,
          results: products.map((p) => ({ name: p.name, price: p.price, inStock: p.inStock, slug: p.slug })),
          instruction: 'ONLY mention these products by their exact names and prices. Do NOT add any product that is not in this list.',
        },
        products,
        quickReplies: ['Show me more', 'Add to cart'],
      };
    }

    case 'get_product_for_cart': {
      const product = await getProductForCart(supabase, args.slug_or_id);
      return {
        data: product ? { name: product.name, price: product.price, inStock: product.inStock } : { error: 'Product not found' },
        products: product ? [product] : undefined,
      };
    }

    case 'track_order': {
      // Email is verified server-side in trackOrder; uses elevated client because
      // the orders table has RLS that blocks anon select by order_number.
      const requesterEmail = String(args.email || '').trim();
      if (!requesterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
        return { data: { error: 'Please provide a valid email address used when placing the order.' }, quickReplies: ['I have my email'] };
      }
      const order = await trackOrder(supabaseWriter, args.order_number, requesterEmail);
      if (!order) {
        return { data: { error: 'Order not found. Please check the order number and email address.' }, quickReplies: ['Try again', 'Contact support'] };
      }
      return {
        data: {
          order_number: order.order_number,
          status: order.status,
          total: order.total,
          tracking_number: order.tracking_number,
          items: order.items.slice(0, 5),
          created_at: order.created_at,
        },
        orderCard: order,
        quickReplies: ['I have an issue with this order', 'Track another order'],
      };
    }

    case 'get_customer_orders': {
      if (!userId) {
        return { data: { error: 'You need to be logged in to view your orders. Please sign in first.' }, quickReplies: ['Sign in', 'Track order by number'] };
      }
      const orders = await getCustomerOrders(supabaseWriter, userId, args.limit || 5);
      return {
        data: orders.map((o) => ({ order_number: o.order_number, status: o.status, total: o.total, date: o.created_at, items_count: o.items.length })),
        orderCard: orders[0],
        quickReplies: orders.length > 0 ? ['Track an order', 'Reorder'] : ['Browse products'],
      };
    }

    case 'check_coupon': {
      // SECURITY: cap coupon checks per IP so the chat tool can't be used as a
      // brute-force enumeration oracle. ~10 attempts per hour is generous for
      // legitimate customers.
      if (clientIp) {
        const couponLimit = checkSharedRateLimit(`coupon:${clientIp}`, { maxRequests: 10, windowSeconds: 60 * 60 });
        if (!couponLimit.success) {
          return {
            data: { valid: false, reason: 'Too many coupon attempts. Please try again later.' },
            quickReplies: ['Continue shopping'],
          };
        }
      }
      const coupon = await checkCoupon(supabaseWriter, args.code, args.cart_total);
      // Strip details that enable enumeration / margin disclosure. Only tell the
      // customer if the code is valid and (when valid) the discount label.
      const safeCoupon = coupon.valid
        ? { valid: true, code: coupon.code }
        : { valid: false, code: coupon.code, reason: coupon.reason };
      return {
        data: safeCoupon,
        couponCard: safeCoupon as ChatCoupon,
        quickReplies: coupon.valid ? ['Apply at checkout', 'Continue shopping'] : ['Try another code', 'Find a product'],
      };
    }

    case 'create_support_ticket': {
      // Use email from: 1) tool call args (user provided in chat), 2) auth session, 3) profile
      const email = args.email || userEmail || profile?.email || '';
      if (!email) {
        return {
          data: { error: 'I need an email address to create a support ticket. Please ask the customer for their email and include it when calling this tool.' },
          quickReplies: ['I\'ll provide my email'],
        };
      }
      const ticket = await createSupportTicket(supabaseWriter, {
        userId: userId || undefined,
        email,
        subject: args.subject,
        description: args.description,
        category: args.category,
      });
      if (!ticket) {
        return { data: { error: 'Failed to create ticket. Please try again.' }, quickReplies: ['Try again', 'Contact us directly'] };
      }
      return {
        data: { ticket_number: ticket.ticket_number, subject: ticket.subject, status: ticket.status, email_used: email },
        ticketCard: ticket,
        quickReplies: ['Continue shopping', 'Track my order'],
      };
    }

    case 'initiate_return': {
      if (!userId) {
        return { data: { error: 'You need to be logged in to initiate a return. Please sign in first.' }, quickReplies: ['Sign in', 'Contact support'] };
      }
      const ret = await initiateReturn(supabaseWriter, {
        userId,
        orderId: args.order_id,
        reason: args.reason,
        description: args.description || args.reason,
      });
      if (!ret) {
        return { data: { error: 'Could not create return request. The order may not be eligible (must be delivered within 30 days).' }, quickReplies: ['Check eligibility', 'Contact support'] };
      }
      return {
        data: { id: ret.id, status: ret.status, order_number: ret.order_number },
        returnCard: ret,
        quickReplies: ['Continue shopping', 'View my orders'],
      };
    }

    case 'get_recommendations': {
      let products = await getRecommendations(supabase, args.context);
      if (products.length === 0 && args.context) {
        products = await getRecommendations(supabase);
      }
      if (products.length === 0) {
        return {
          data: {
            found: 0,
            results: [],
            instruction: 'No products are available right now. Do NOT name or suggest any product from your own knowledge. Tell the customer to check back later or contact us.',
          },
          products: [],
          quickReplies: ['Contact us'],
        };
      }
      return {
        data: {
          found: products.length,
          results: products.map((p) => ({ name: p.name, price: p.price, inStock: p.inStock, slug: p.slug })),
          instruction: 'ONLY recommend products from this list. Do NOT add any product that is not listed here.',
        },
        products,
        quickReplies: ['Show me more', 'Search for something specific'],
      };
    }

    case 'get_store_info': {
      const info = getStoreInfo(args.topic);
      // Also include relevant site knowledge for richer answers
      const siteResults = searchSiteKnowledge(args.topic || '', 2);
      const extraInfo = siteResults.map(r => r.content).join('\n\n');
      return {
        data: { topic: args.topic, info, additional_details: extraInfo || undefined },
        quickReplies: ['Shipping', 'Returns', 'Payment', 'Contact'].filter((r) => r.toLowerCase() !== args.topic?.toLowerCase()),
      };
    }

    case 'get_customer_profile': {
      if (!userId || !profile) {
        return { data: { error: 'Not logged in' } };
      }
      return { data: { name: profile.name, email: profile.email, total_orders: profile.total_orders } };
    }

    case 'get_website_info': {
      const results = searchSiteKnowledge(args.query, 3);
      if (results.length === 0) {
        return {
          data: { message: 'No specific information found. Try rephrasing or visit /contact or /policies pages on the site.' },
          quickReplies: ['Contact us', 'Store policies'],
        };
      }
      return {
        data: {
          results: results.map(r => ({
            title: r.title,
            page: r.path,
            content: r.content,
          })),
        },
      };
    }

    case 'create_order': {
      const orderResult = await createChatOrder(supabase, {
        items: args.items || [],
        shipping: args.shipping || {},
        deliveryMethod: args.delivery_method || 'standard',
        paymentMethod: args.payment_method || 'moolre',
        userId,
      });

      const result: {
        data: any;
        paymentAction?: ChatAction;
        quickReplies?: string[];
      } = {
        data: {
          success: orderResult.success,
          orderNumber: orderResult.orderNumber,
          total: orderResult.total,
          message: orderResult.message,
          hasPaymentUrl: !!orderResult.paymentUrl,
        },
        quickReplies: orderResult.success ? ['Continue shopping'] : ['Try again', 'Use checkout page'],
      };

      if (orderResult.paymentUrl) {
        result.paymentAction = {
          type: 'payment_link',
          paymentUrl: orderResult.paymentUrl,
          orderNumber: orderResult.orderNumber,
          label: `Pay GH₵${orderResult.total?.toFixed(2)} Now`,
        };
      }

      return result;
    }

    default:
      return { data: { error: `Unknown tool: ${fnName}` } };
  }
}

// ─── Quick Reply Generator ──────────────────────────────────────────────────

function generateQuickReplies(
  userText: string,
  products: ChatProduct[],
  orderCard?: ChatOrder,
  ticketCard?: ChatTicket
): string[] {
  if (ticketCard) return ['Continue shopping', 'Track my order'];
  if (orderCard) return ['I have an issue', 'Track another order', 'Continue shopping'];
  if (products.length > 0) return ['Add to cart', 'Show me more', 'Something else'];

  const lower = userText.toLowerCase();
  if (/\b(hi|hello|hey)\b/.test(lower)) return ['Find a product', 'Track my order', 'What do you recommend?'];
  if (/\b(thank|bye)\b/.test(lower)) return ['Find a product', 'Track my order'];

  return ['Find a product', 'Track my order', 'Store info', 'What do you recommend?'];
}
