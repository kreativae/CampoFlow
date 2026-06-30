'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Pasture, PastureOccupation } from '@/lib/types';

export default function PastureDetailPage() {
  const { farmId, pastureId } = useParams<{ farmId: string; pastureId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [pasture, setPasture] = useState<Pasture | null>(null);
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [headCount, setHeadCount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [exitingId, setExitingId] = useState<string | null>(null);
  const [exitQuantity, setExitQuantity] = useState('');
  const [exitDestinationId, setExitDestinationId] = useState('');
  const [exitNotes, setExitNotes] = useState('');
  const [submittingExit, setSubmittingExit] = useState(false);

  const [editingOccId, setEditingOccId] = useState<string | null>(null);
  const [editHeadCount, setEditHeadCount] = useState('');
  const [editEnteredAt, setEditEnteredAt] = useState('');
  const [editExitedAt, setEditExitedAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [data, allPastures] = await Promise.all([
        apiFetch<Pasture>(`/fazendas/${farmId}/pastagens/${pastureId}`, {
          token: accessToken,
        }),
        apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`, { token: accessToken }),
      ]);
      setPasture(data);
      setPastures(allPastures.filter((p) => p.id !== pastureId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o pasto');
    } finally {
      setFetching(false);
    }
  }, [farmId, pastureId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  async function handleEnter(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes`, {
        method: 'POST',
        token: accessToken,
        body: { headCount: Number(headCount), notes: notes || undefined },
      });
      setHeadCount('');
      setNotes('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar entrada de lote');
    } finally {
      setSubmitting(false);
    }
  }

  function startExit(o: PastureOccupation) {
    setExitingId(o.id);
    setExitQuantity(String(o.headCount));
    setExitDestinationId('');
    setExitNotes('');
  }

  async function handleConfirmExit(occupationId: string) {
    setSubmittingExit(true);
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes/${occupationId}/saida`,
        {
          method: 'PATCH',
          token: accessToken,
          body: {
            headCount: exitQuantity ? Number(exitQuantity) : undefined,
            notes: exitNotes || undefined,
            destinationPastureId: exitDestinationId || undefined,
          },
        },
      );
      setExitingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar saída de lote');
    } finally {
      setSubmittingExit(false);
    }
  }

  function startEditOccupation(o: PastureOccupation) {
    setEditingOccId(o.id);
    setEditHeadCount(String(o.headCount));
    setEditEnteredAt(o.enteredAt.slice(0, 10));
    setEditExitedAt(o.exitedAt ? o.exitedAt.slice(0, 10) : '');
    setEditNotes(o.notes ?? '');
  }

  async function handleSaveOccupationEdit(occupationId: string) {
    setSavingEdit(true);
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes/${occupationId}`,
        {
          method: 'PATCH',
          token: accessToken,
          body: {
            headCount: editHeadCount ? Number(editHeadCount) : undefined,
            enteredAt: editEnteredAt
              ? new Date(editEnteredAt).toISOString()
              : undefined,
            exitedAt: editExitedAt
              ? new Date(editExitedAt).toISOString()
              : undefined,
            notes: editNotes || undefined,
          },
        },
      );
      setEditingOccId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar registro');
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  const activeOccupations = pasture?.occupations?.filter((o) => o.exitedAt === null) ?? [];
  const occupiedHeadCount = activeOccupations.reduce((sum, o) => sum + o.headCount, 0);
  const pastOccupations = pasture?.occupations?.filter((o) => o.exitedAt !== null) ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href={`/fazendas/${farmId}/pastagens`} className="text-sm text-green-700 hover:underline">
          ← Pastagens
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">{pasture?.name}</h1>
        <p className="text-sm text-gray-500">
          {pasture?.areaHectares} ha · {pasture?.grassType ?? 'Capim não informado'}
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3">
        <SummaryCard label="Capacidade" value={`${pasture?.animalCapacity ?? 0} animais`} />
        <SummaryCard label="Ocupação atual" value={`${occupiedHeadCount} animais`} />
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Registrar entrada de lote</h2>
        <form onSubmit={handleEnter} className="flex flex-wrap gap-2">
          <input
            type="number"
            placeholder="Qtd. de animais"
            required
            value={headCount}
            onChange={(e) => setHeadCount(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Observações (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Registrar entrada'}
          </button>
        </form>
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Lotes no pasto</h2>
        {activeOccupations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum lote no pasto atualmente.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700">
            {activeOccupations.map((o) =>
              exitingId === o.id ? (
                <li key={o.id} className="rounded border border-green-600 bg-green-50 p-3">
                  <p className="mb-2 text-xs font-medium text-gray-600">
                    Registrar saída do lote ({o.headCount} animais desde{' '}
                    {new Date(o.enteredAt).toLocaleDateString('pt-BR')})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">
                        Qtd. de saída
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={o.headCount}
                        value={exitQuantity}
                        onChange={(e) => setExitQuantity(e.target.value)}
                        className="mt-1 w-28 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">
                        Mover para pasto (opcional)
                      </label>
                      <select
                        value={exitDestinationId}
                        onChange={(e) => setExitDestinationId(e.target.value)}
                        className="mt-1 w-44 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                      >
                        <option value="">— Não mover —</option>
                        {pastures.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600">
                        Observações
                      </label>
                      <input
                        type="text"
                        value={exitNotes}
                        onChange={(e) => setExitNotes(e.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={submittingExit}
                      onClick={() => handleConfirmExit(o.id)}
                      className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                    >
                      {submittingExit ? 'Salvando...' : 'Confirmar saída'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExitingId(null)}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </li>
              ) : editingOccId === o.id ? (
                <OccupationEditForm
                  key={o.id}
                  headCount={editHeadCount}
                  enteredAt={editEnteredAt}
                  exitedAt={editExitedAt}
                  notes={editNotes}
                  saving={savingEdit}
                  showExitedAt={false}
                  onHeadCountChange={setEditHeadCount}
                  onEnteredAtChange={setEditEnteredAt}
                  onExitedAtChange={setEditExitedAt}
                  onNotesChange={setEditNotes}
                  onSave={() => handleSaveOccupationEdit(o.id)}
                  onCancel={() => setEditingOccId(null)}
                />
              ) : (
                <li key={o.id} className="flex items-center justify-between">
                  <span>
                    {o.headCount} animais — desde {new Date(o.enteredAt).toLocaleDateString('pt-BR')}
                    {o.notes ? ` (${o.notes})` : ''}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditOccupation(o)}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => startExit(o)}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      Registrar saída
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Histórico de ocupação</h2>
        {pastOccupations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum lote saiu deste pasto ainda.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {pastOccupations.map((o) =>
              editingOccId === o.id ? (
                <OccupationEditForm
                  key={o.id}
                  headCount={editHeadCount}
                  enteredAt={editEnteredAt}
                  exitedAt={editExitedAt}
                  notes={editNotes}
                  saving={savingEdit}
                  showExitedAt
                  onHeadCountChange={setEditHeadCount}
                  onEnteredAtChange={setEditEnteredAt}
                  onExitedAtChange={setEditExitedAt}
                  onNotesChange={setEditNotes}
                  onSave={() => handleSaveOccupationEdit(o.id)}
                  onCancel={() => setEditingOccId(null)}
                />
              ) : (
                <li key={o.id} className="flex items-center justify-between">
                  <span>
                    {o.headCount} animais — {new Date(o.enteredAt).toLocaleDateString('pt-BR')} até{' '}
                    {o.exitedAt ? new Date(o.exitedAt).toLocaleDateString('pt-BR') : '—'}
                    {o.notes ? ` (${o.notes})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEditOccupation(o)}
                    className="text-xs font-medium text-green-700 hover:underline"
                  >
                    Editar
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function OccupationEditForm({
  headCount,
  enteredAt,
  exitedAt,
  notes,
  saving,
  showExitedAt,
  onHeadCountChange,
  onEnteredAtChange,
  onExitedAtChange,
  onNotesChange,
  onSave,
  onCancel,
}: {
  headCount: string;
  enteredAt: string;
  exitedAt: string;
  notes: string;
  saving: boolean;
  showExitedAt: boolean;
  onHeadCountChange: (v: string) => void;
  onEnteredAtChange: (v: string) => void;
  onExitedAtChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <li className="rounded border border-green-600 bg-green-50 p-3">
      <div className="flex flex-wrap gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600">Qtd. de animais</label>
          <input
            type="number"
            min={1}
            value={headCount}
            onChange={(e) => onHeadCountChange(e.target.value)}
            className="mt-1 w-28 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Data de entrada</label>
          <input
            type="date"
            value={enteredAt}
            onChange={(e) => onEnteredAtChange(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        {showExitedAt && (
          <div>
            <label className="text-xs font-medium text-gray-600">Data de saída</label>
            <input
              type="date"
              value={exitedAt}
              onChange={(e) => onExitedAtChange(e.target.value)}
              className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            />
          </div>
        )}
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600">Observações</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </li>
  );
}
