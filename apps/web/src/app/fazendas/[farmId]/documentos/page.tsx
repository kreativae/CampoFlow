'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, apiUpload, apiDownload, ApiError } from '@/lib/api';
import type { DocumentCategory, FarmDocument } from '@/lib/types';

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: 'GTA', label: 'GTA' },
  { value: 'NFE', label: 'NF-e' },
  { value: 'CONTRATO', label: 'Contrato' },
  { value: 'EXAME', label: 'Exame' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'OUTRO', label: 'Outro' },
];

function categoryLabel(category: DocumentCategory) {
  return CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<FarmDocument[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [category, setCategory] = useState<DocumentCategory>('GTA');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<FarmDocument[]>(`/fazendas/${farmId}/documentos`, {
        token: accessToken,
      });
      setDocuments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar documentos');
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
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Selecione um arquivo');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('file', file);
      await apiUpload(`/fazendas/${farmId}/documentos`, formData, accessToken);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: FarmDocument) {
    setError(null);
    try {
      await apiDownload(`/fazendas/${farmId}/documentos/${doc.id}/baixar`, doc.fileName, accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao baixar documento');
    }
  }

  async function handleDelete(documentId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/documentos/${documentId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir documento');
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Documentos</h1>
        <p className="text-sm text-gray-500">
          Armazenamento local de arquivos. Integração com armazenamento em nuvem (AWS S3,
          Cloudflare R2) é uma evolução futura.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={handleUpload}
        className="mb-8 flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4"
      >
        <div>
          <label className="text-xs font-medium text-gray-600">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600">Arquivo</label>
          <input
            ref={fileInputRef}
            type="file"
            required
            className="mt-1 block w-full text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {uploading ? 'Enviando...' : 'Enviar documento'}
        </button>
      </form>

      {documents.length === 0 ? (
        <p className="text-gray-500">Nenhum documento enviado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-gray-900">{doc.fileName}</p>
                <p className="text-sm text-gray-500">
                  {categoryLabel(doc.category)} · {formatSize(doc.fileSize)} ·{' '}
                  {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDownload(doc)}
                  className="text-xs font-medium text-green-700 hover:underline"
                >
                  Baixar
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
