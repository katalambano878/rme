export function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function sanitizeHtml(html: string): string {
    if (!html) return '';
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<(iframe|object|embed|form|input|textarea|button)\b[^>]*>.*?<\/\1>/gi, '');
    clean = clean.replace(/<(iframe|object|embed|form|input|textarea|button)\b[^>]*\/?>/gi, '');
    clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    clean = clean.replace(/\s+(href|src|action)\s*=\s*["']?\s*javascript:/gi, ' $1="');
    clean = clean.replace(/\s+(href|src|action)\s*=\s*["']?\s*data:/gi, ' $1="');
    clean = clean.replace(/\s+style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, '');
    return clean;
}

export function isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidGhanaPhone(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/\D/g, '');
    return (
        (cleaned.length === 10 && cleaned.startsWith('0')) ||
        (cleaned.length === 12 && cleaned.startsWith('233')) ||
        cleaned.length === 9
    );
}

export function maskEmail(email: string): string {
    if (!email) return '***';
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return local.slice(0, 2) + '***@' + domain;
}
