/**
 * Giá trị môi trường (không phải dữ liệu cá nhân). Tách khỏi `wedding-config.ts` để file đó
 * là dữ liệu thuần, đọc được cả từ `vite.config.ts` lúc build.
 */
export const wishesEndpoint = (import.meta.env.VITE_WISHES_ENDPOINT as string | undefined) ?? ''
