'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BookUser } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useConfirm } from '@/lib/confirm-context';
import type { Contact, ContactCategory, ContactType } from '@/lib/types';

const TYPE_LABEL: Record<ContactType, string> = {
  PESSOA_FISICA: 'Pessoa física',
  PESSOA_JURIDICA: 'Pessoa jurídica',
};

const CATEGORY_OPTIONS: { value: ContactCategory; label: string }[] = [
  { value: 'FORNECEDOR', label: 'Fornecedor' },
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'VETERINARIO', label: 'Veterinário' },
  { value: 'TRANSPORTADOR', label: 'Transportador' },
  { value: 'COMPRADOR', label: 'Comprador' },
  { value: 'PRESTADOR_SERVICO', label: 'Prestador de serviço' },
  { value: 'OUTRO', label: 'Outro' },
];

const CATEGORY_LABEL: Record<ContactCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ContactCategory, string>;

interface FormState {
  type: ContactType;
  category: ContactCategory;
  name: string;
  tradeName: string;
  document: string;
  email: string;
  phone: string;
  whatsapp: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  type: 'PESSOA_FISICA',
  category: 'OUTRO',
  name: '',
  tradeName: '',
  document: '',
  email: '',
  phone: '',
  whatsapp: '',
  addressStreet: '',
  addressCity: '',
  addressState: '',
  addressZip: '',
  notes: '',
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Primeira letra do nome, sem acento e em maiúscula; números/símbolos viram '#'.
function firstLetter(name: string): string {
  const ch = name
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
}

function buildBody(form: FormState) {
  return {
    type: form.type,
    category: form.category,
    name: form.name,
    tradeName: form.tradeName || undefined,
    document: form.document || undefined,
    email: form.email || undefined,
    phone: form.phone || undefined,
    whatsapp: form.whatsapp || undefined,
    addressStreet: form.addressStreet || undefined,
    addressCity: form.addressCity || undefined,
    addressState: form.addressState || undefined,
    addressZip: form.addressZip || undefined,
    notes: form.notes || undefined,
  };
}

function contactToForm(c: Contact): FormState {
  return {
    type: c.type,
    category: c.category,
    name: c.name,
    tradeName: c.tradeName ?? '',
    document: c.document ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    whatsapp: c.whatsapp ?? '',
    addressStreet: c.addressStreet ?? '',
    addressCity: c.addressCity ?? '',
    addressState: c.addressState ?? '',
    addressZip: c.addressZip ?? '',
    notes: c.notes ?? '',
  };
}

export default function ContactsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const { toastSuccess } = useToast();
  const router = useRouter();
  const confirm = useConfirm();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [filterTypes, setFilterTypes] = useState<Set<ContactType>>(new Set());
  const [filterCategories, setFilterCategories] = useState<Set<ContactCategory>>(
    new Set(),
  );

  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Contact[]>(`/fazendas/${farmId}/contatos`, {
        token: accessToken,
      });
      setContacts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar os contatos');
    } finally {
      setFetching(false);
    }
  }, [farmId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  function toggleInSet<T>(set: Set<T>, value: T, setter: (next: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  const availableLetters = new Set(contacts.map((c) => firstLetter(c.name)));

  const filteredContacts = contacts.filter((c) => {
    if (
      searchTerm &&
      !c.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) &&
      !(c.tradeName ?? '').toLowerCase().includes(searchTerm.trim().toLowerCase())
    ) {
      return false;
    }
    if (letterFilter && firstLetter(c.name) !== letterFilter) return false;
    if (filterTypes.size > 0 && !filterTypes.has(c.type)) return false;
    if (filterCategories.size > 0 && !filterCategories.has(c.category)) return false;
    return true;
  });

  function selectNew() {
    setSelectedId('new');
    setForm(EMPTY_FORM);
    setError(null);
  }

  function selectContact(contact: Contact) {
    setSelectedId(contact.id);
    setForm(contactToForm(contact));
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (selectedId === 'new') {
        const created = await apiFetch<Contact>(`/fazendas/${farmId}/contatos`, {
          method: 'POST',
          token: accessToken,
          body: buildBody(form),
        });
        await loadData();
        setSelectedId(created.id);
      } else if (selectedId) {
        await apiFetch(`/fazendas/${farmId}/contatos/${selectedId}`, {
          method: 'PATCH',
          token: accessToken,
          body: buildBody(form),
        });
        await loadData();
      }
      toastSuccess('Contato salvo.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar o contato');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId || selectedId === 'new') return;
    const ok = await confirm({
      title: 'Excluir contato',
      message: `Excluir o contato ${form.name}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/contatos/${selectedId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      setSelectedId(null);
      setForm(EMPTY_FORM);
      await loadData();
      toastSuccess('Contato excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir o contato');
    }
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={BookUser}
        title="Contatos"
        subtitle="Contatos e parceiros"
        backHref={`/fazendas/${farmId}`}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        {/* Left: list */}
        <div>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome..."
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
            <button
              type="button"
              onClick={selectNew}
              className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
            >
              + Novo
            </button>
          </div>

          {/* Índice alfabético — busca por letra inicial do nome */}
          <div className="mb-3 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setLetterFilter(null)}
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                letterFilter === null
                  ? 'bg-emerald-700 text-white'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Todos
            </button>
            {ALPHABET.map((letter) => {
              const enabled = availableLetters.has(letter);
              const active = letterFilter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setLetterFilter(active ? null : letter)}
                  className={`w-6 rounded-lg px-0 py-0.5 text-xs font-medium ${
                    active
                      ? 'bg-emerald-700 text-white'
                      : enabled
                        ? 'text-emerald-700 hover:bg-emerald-50'
                        : 'cursor-default text-gray-300'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
            {availableLetters.has('#') && (
              <button
                type="button"
                onClick={() => setLetterFilter(letterFilter === '#' ? null : '#')}
                className={`w-6 rounded-lg px-0 py-0.5 text-xs font-medium ${
                  letterFilter === '#'
                    ? 'bg-emerald-700 text-white'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                #
              </button>
            )}
          </div>

          <div className="mb-3 rounded-xl border border-gray-200/80 bg-white shadow-sm p-3">
            <p className="mb-1 text-xs font-medium text-gray-600">Tipo</p>
            <div className="mb-2 flex flex-wrap gap-3">
              {(['PESSOA_FISICA', 'PESSOA_JURIDICA'] as ContactType[]).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={filterTypes.has(t)}
                    onChange={() => toggleInSet(filterTypes, t, setFilterTypes)}
                  />
                  {TYPE_LABEL[t]}
                </label>
              ))}
            </div>
            <p className="mb-1 text-xs font-medium text-gray-600">Categoria</p>
            <div className="flex flex-col gap-1">
              {CATEGORY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-1.5 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={filterCategories.has(opt.value)}
                    onChange={() =>
                      toggleInSet(filterCategories, opt.value, setFilterCategories)
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {fetching ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
              <p className="text-lg font-medium text-gray-700">Nenhum contato cadastrado</p>
              <p className="mt-1 text-sm text-gray-500">Cadastre veterinários, fornecedores e outros contatos importantes da fazenda.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredContacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectContact(c)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:border-emerald-600 ${
                      selectedId === c.id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {TYPE_LABEL[c.type]} · {CATEGORY_LABEL[c.category]}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: quick view / edit / create */}
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
          {selectedId === null ? (
            <p className="text-sm text-gray-500">
              Selecione um contato à esquerda ou clique em &quot;+ Novo&quot; para
              cadastrar.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">
                  {selectedId === 'new' ? 'Novo contato' : 'Visualização rápida'}
                </h2>
                {selectedId !== 'new' && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Excluir
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value as ContactType }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  >
                    <option value="PESSOA_FISICA">Pessoa física</option>
                    <option value="PESSOA_JURIDICA">Pessoa jurídica</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Categoria</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        category: e.target.value as ContactCategory,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">
                    {form.type === 'PESSOA_JURIDICA' ? 'Razão social' : 'Nome completo'}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                {form.type === 'PESSOA_JURIDICA' && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">
                      Nome fantasia (opcional)
                    </label>
                    <input
                      type="text"
                      value={form.tradeName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tradeName: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">
                    {form.type === 'PESSOA_JURIDICA' ? 'CNPJ' : 'CPF'}
                  </label>
                  <input
                    type="text"
                    value={form.document}
                    onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                    placeholder={form.type === 'PESSOA_JURIDICA' ? '00.000.000/0000-00' : '000.000.000-00'}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Telefone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">WhatsApp</label>
                  <input
                    type="text"
                    value={form.whatsapp}
                    onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">Endereço</label>
                  <input
                    type="text"
                    value={form.addressStreet}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, addressStreet: e.target.value }))
                    }
                    placeholder="Rua, número, bairro"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Cidade</label>
                  <input
                    type="text"
                    value={form.addressCity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, addressCity: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Estado</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={form.addressState}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, addressState: e.target.value.toUpperCase() }))
                    }
                    placeholder="UF"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">CEP</label>
                  <input
                    type="text"
                    value={form.addressZip}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, addressZip: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">Observações</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setForm(EMPTY_FORM);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
