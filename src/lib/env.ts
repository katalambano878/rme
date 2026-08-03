/**
 * Startup / health env validation. Does not print secret values.
 */

export type EnvClass = "public" | "server" | "optional"

export type EnvSpec = {
  name: string
  classify: EnvClass
  requiredFor?: Array<"runtime" | "payments" | "sms" | "email" | "database">
}

export const ENV_SPECS: EnvSpec[] = [
  { name: "NEXT_PUBLIC_APP_URL", classify: "public", requiredFor: ["runtime"] },
  { name: "NEXT_PUBLIC_SUPABASE_URL", classify: "public", requiredFor: ["runtime"] },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", classify: "public", requiredFor: ["runtime"] },
  { name: "SUPABASE_SERVICE_ROLE_KEY", classify: "server", requiredFor: ["runtime"] },
  { name: "DATABASE_URL", classify: "server", requiredFor: ["database"] },
  { name: "DATABASE_SSL", classify: "optional" },
  { name: "DATABASE_POOL_MAX", classify: "optional" },
  { name: "PAYSTACK_SECRET_KEY", classify: "server", requiredFor: ["payments"] },
  { name: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY", classify: "public", requiredFor: ["payments"] },
  { name: "PAYSTACK_WEBHOOK_SECRET", classify: "server", requiredFor: ["payments"] },
  { name: "MOOLRE_API_USER", classify: "server", requiredFor: ["payments"] },
  { name: "MOOLRE_API_PUBKEY", classify: "server", requiredFor: ["payments"] },
  { name: "MOOLRE_ACCOUNT_NUMBER", classify: "server", requiredFor: ["payments"] },
  { name: "MOOLRE_CALLBACK_SECRET", classify: "server", requiredFor: ["payments"] },
  { name: "MOOLRE_SMS_API_KEY", classify: "server", requiredFor: ["sms"] },
  { name: "MOOLRE_SMS_SENDER_ID", classify: "optional" },
  { name: "RESEND_API_KEY", classify: "server", requiredFor: ["email"] },
  { name: "EMAIL_FROM", classify: "optional" },
  { name: "ADMIN_EMAIL", classify: "optional" },
  { name: "GROQ_API_KEY", classify: "optional" },
  { name: "NEXT_PUBLIC_RECAPTCHA_SITE_KEY", classify: "public" },
  { name: "RECAPTCHA_SECRET_KEY", classify: "server" },
]

type RequiredScope = "runtime" | "payments" | "sms" | "email" | "database"

export function getMissingEnv(requiredFor: RequiredScope) {
  return ENV_SPECS.filter(
    (s) => s.requiredFor?.includes(requiredFor) && !process.env[s.name]?.trim(),
  ).map((s) => s.name)
}

export function healthEnvReport() {
  const present = ENV_SPECS.map((s) => ({
    name: s.name,
    classify: s.classify,
    set: Boolean(process.env[s.name]?.trim()),
  }))
  return {
    ok: getMissingEnv("runtime").length === 0,
    missingRuntime: getMissingEnv("runtime"),
    missingPayments: getMissingEnv("payments"),
    missingSms: getMissingEnv("sms"),
    missingDatabase: getMissingEnv("database"),
    variables: present,
  }
}
