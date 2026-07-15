import { createAuthClient } from "@neondatabase/neon-js/auth";

export const authClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL || "http://localhost:5173/auth"
);
