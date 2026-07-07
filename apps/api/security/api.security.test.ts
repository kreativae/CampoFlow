import { describe, it, expect, beforeAll } from 'vitest';

// Testes de segurança de caixa-preta contra a API rodando.
const BASE = process.env.SECURITY_BASE_URL ?? 'http://localhost:3000';

interface AuthResult {
  token: string;
  farmId: string;
  email: string;
  register: unknown;
}

async function api(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: unknown }> {
  const { token, headers, ...rest } = init;
  const res = await fetch(BASE + path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });
  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

// Cria um usuário + fazenda isolados para o teste.
async function makeUser(): Promise<AuthResult> {
  const email = `sectest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@campoflow.test`;
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'password123', name: 'Sec Test' }),
  });
  expect(reg.status, `registro deveria funcionar (${JSON.stringify(reg.body)})`).toBe(201);
  const token = (reg.body as { accessToken: string }).accessToken;
  const farm = await api('/fazendas', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: 'Fazenda Sec' }),
  });
  expect(farm.status).toBe(201);
  return { token, farmId: (farm.body as { id: string }).id, email, register: reg.body };
}

// Procura recursivamente qualquer chave sensível vazando na resposta.
function findSensitiveKey(value: unknown): string | null {
  const sensitive = ['password', 'passwordhash', 'tokenhash', 'mfasecret', 'refreshtokenhash'];
  const seen = new Set<unknown>();
  function walk(v: unknown): string | null {
    if (!v || typeof v !== 'object' || seen.has(v)) return null;
    seen.add(v);
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (sensitive.includes(k.toLowerCase())) return k;
      const nested = walk(val);
      if (nested) return nested;
    }
    return null;
  }
  return walk(value);
}

describe('Segurança da API (caixa-preta)', () => {
  let userA: AuthResult;
  let userB: AuthResult;

  beforeAll(async () => {
    userA = await makeUser();
    userB = await makeUser();
  });

  it('1) bloqueia acesso a recurso protegido sem autenticação (401)', async () => {
    const semToken = await api('/fazendas');
    expect(semToken.status).toBe(401);

    const tokenInvalido = await api('/fazendas', { token: 'token.forjado.invalido' });
    expect(tokenInvalido.status).toBe(401);
  });

  it('2) impede acesso a dados de outra conta — isolamento multi-tenant (IDOR)', async () => {
    // Usuário A tenta ler a fazenda do usuário B.
    const cross = await api(`/fazendas/${userB.farmId}`, { token: userA.token });
    expect([403, 404]).toContain(cross.status);

    // E tenta ler o rebanho da fazenda do B.
    const crossAnimals = await api(`/fazendas/${userB.farmId}/animais`, {
      token: userA.token,
    });
    expect([403, 404]).toContain(crossAnimals.status);

    // Sanidade: o próprio dono consegue acessar a sua fazenda.
    const own = await api(`/fazendas/${userA.farmId}`, { token: userA.token });
    expect(own.status).toBe(200);
  });

  it('3) não expõe segredos (senha/hash) e não permite login com senha errada', async () => {
    // A resposta de registro não pode conter senha nem hash.
    expect(findSensitiveKey(userA.register)).toBeNull();

    // Login com senha errada => 401 genérico (sem enumeração de usuário).
    const badLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: userA.email, password: 'senhaErrada!!' }),
    });
    expect(badLogin.status).toBe(401);
    expect(findSensitiveKey(badLogin.body)).toBeNull();

    // Login correto retorna token, mas sem vazar hash de senha.
    const okLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: userA.email, password: 'password123' }),
    });
    expect([200, 201]).toContain(okLogin.status);
    expect((okLogin.body as { accessToken?: string }).accessToken).toBeTruthy();
    expect(findSensitiveKey(okLogin.body)).toBeNull();
  });
});
