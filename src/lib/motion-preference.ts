/** Khách bật "giảm chuyển động" trong hệ điều hành. Môi trường không có matchMedia (server, test) coi như không bật. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
