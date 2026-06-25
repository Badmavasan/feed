// Prefix a root-relative asset/upload path with the app's basePath (e.g. "/feed").
//
// Next.js automatically applies basePath to the router, <Link>, and /_next assets,
// but NOT to raw string `src`/`href` values like "/uploads/x.png" or
// "/login-illustration.png". Those resolve against the domain root and escape the
// sub-path, so wrap them with this helper.
//
// Pass-through untouched: absolute URLs (http/https), data: URIs, blob:, protocol-
// relative (//), and empty values.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function assetUrl(path?: string | null): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:|\/\/)/.test(path)) return path;
  if (!path.startsWith('/')) return path; // relative — leave as-is
  return `${BASE_PATH}${path}`;
}

// Same prefixing, for internal navigation targets used outside the Next router
// (plain Chakra <Link href>, window.location.href). next/link & router.push apply
// basePath themselves, so don't wrap those.
export const withBasePath = assetUrl;

export default assetUrl;
