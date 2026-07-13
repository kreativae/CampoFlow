import { defineConfig } from 'vitest/config';

// Testes de segurança "caixa-preta": batem na API rodando (BASE_URL) via fetch,
// sem bootar o Nest em processo (evita o problema de metadata de decorators no
// esbuild). Rode com a API no ar: `npm run start:dev` em outro terminal.
export default defineConfig({
  test: {
    include: ['security/**/*.security.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'forks',
  },
});
