import React, { useState } from 'react';
import { Key, Copy, Eye, EyeOff } from 'lucide-react';
import { companiesApi } from '../../api';
import { Spinner } from '../../components/ui';

interface GenerateApiKeyProps {
  empresaId: number;
  currentApiKey?: string | null;
  toast: (m: string, t: 'success' | 'error') => void;
  onRefresh: () => void;
}

function copyText(value: string): boolean {
  if (navigator.clipboard && window.isSecureContext) {
    void navigator.clipboard.writeText(value);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

export const GenerateApiKeyButton: React.FC<GenerateApiKeyProps> = ({
  empresaId,
  currentApiKey,
  toast,
  onRefresh,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const visibleKey = generatedKey || currentApiKey || '';

  const handleGenerateKey = async () => {
    const confirmed = window.confirm(
      '¿Estás seguro de regenerar la API Key? Esto invalidará la llave anterior y las integraciones del cliente dejarán de funcionar hasta que actualicen la llave.',
    );

    if (!confirmed) return;

    setIsGenerating(true);
    try {
      const response = await companiesApi.generateApiKey(empresaId);
      const newKey = response.data.apiKey;
      setGeneratedKey(newKey);
      setRevealed(true);
      toast('Nueva API Key generada exitosamente', 'success');
      onRefresh();
    } catch (error: any) {
      toast(error.response?.data?.message || 'Error al generar la API Key', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!visibleKey) return;
    if (copyText(visibleKey)) {
      toast('API Key copiada al portapapeles', 'success');
    } else {
      toast('No se pudo copiar. Revélala y cópiala a mano.', 'error');
    }
  };

  return (
    <div
      className="rounded-xl bg-white p-5 overflow-hidden"
      style={{ border: '1px solid #EAECEF', boxShadow: '0 1px 3px rgba(12,19,58,0.04)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key size={14} style={{ color: '#059669' }} />
          <h3
            className="text-sm font-bold"
            style={{ color: '#0C133A', fontFamily: 'var(--font-display)' }}
          >
            Credenciales de Integración (SSO)
          </h3>
        </div>
        <button
          onClick={handleGenerateKey}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{
            background: isGenerating ? '#E2E8F0' : '#10B981',
            color: isGenerating ? '#64748B' : '#FFFFFF',
          }}
        >
          {isGenerating ? (
            <>
              <Spinner size={12} /> Generando...
            </>
          ) : currentApiKey || generatedKey ? (
            'Regenerar Llave'
          ) : (
            'Generar Llave'
          )}
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        {visibleKey
          ? 'Esta es la API Key de sso-delegate (RCV y funerario). Puedes copiarla de nuevo. Regenerar invalida la actual.'
          : 'La empresa aún no tiene una API Key generada para integraciones externas.'}
      </p>

      {visibleKey && (
        <div
          className="p-3 rounded-md"
          style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: '#065F46' }}>
            Header <code className="font-mono">x-api-key</code> · misma llave para RCV y funerario
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 text-xs bg-white border rounded text-slate-800 select-all break-all shadow-sm">
              {revealed ? visibleKey : maskKey(visibleKey)}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="p-2 text-slate-600 bg-white border rounded hover:bg-slate-50 transition-colors shadow-sm"
              title={revealed ? 'Ocultar' : 'Mostrar'}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 text-slate-600 bg-white border rounded hover:bg-slate-50 transition-colors shadow-sm"
              title="Copiar al portapapeles"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
