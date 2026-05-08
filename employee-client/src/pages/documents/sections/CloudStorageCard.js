import React, { useEffect, useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import Skeleton from '../../../components/common/Skeleton';
import { documentsService } from '../../../services/documentsService';

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;

function formatStorage(bytes) {
  if (bytes == null || isNaN(bytes)) return { value: '0', unit: 'B' };
  const n = Number(bytes);
  if (n >= TB) return { value: (n / TB).toFixed(2), unit: 'TB' };
  if (n >= GB) return { value: (n / GB).toFixed(1), unit: 'GB' };
  if (n >= MB) return { value: (n / MB).toFixed(1), unit: 'MB' };
  if (n >= KB) return { value: (n / KB).toFixed(1), unit: 'KB' };
  return { value: String(n), unit: 'B' };
}

export default function CloudStorageCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    documentsService
      .storageSummary()
      .then((res) => {
        if (cancelled) return;
        setData(res.data?.data || null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton className="h-56 rounded-2xl" />;

  const used = data?.used_bytes ?? 0;
  const total = data?.total_bytes ?? 50 * GB;
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const u = formatStorage(used);
  const t = formatStorage(total);

  return (
    <div className="bg-primary-fixed text-on-primary-fixed-variant rounded-2xl p-unit-lg border border-primary-container shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-white/40 rounded-full flex items-center justify-center">
          <MaterialIcon name="cloud_done" className="text-primary" />
        </div>
        <span className="bg-white/40 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Synced
        </span>
      </div>
      <h3 className="font-h3 text-h3 mb-1">Cloud Storage</h3>
      <p className="font-body-sm text-body-sm opacity-80 mb-6">
        Your workspace is automatically backed up to our secure enterprise cloud.
      </p>
      <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden mb-2">
        <div
          className="bg-primary h-full"
          style={{ width: `${percent}%` }}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <div className="flex justify-between text-[11px] font-bold">
        <span>{u.value} {u.unit} used</span>
        <span>{t.value} {t.unit} total</span>
      </div>
    </div>
  );
}
