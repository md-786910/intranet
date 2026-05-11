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

function StatTile({ icon, iconColor, iconBg, label, value }) {
  return (
    <div className="flex items-center gap-3 bg-surface-container-low/60 rounded-xl p-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        <MaterialIcon name={icon} className={iconColor} />
      </div>
      <div className="min-w-0">
        <div className="font-h3 text-h3 text-on-background leading-tight">{value}</div>
        <div className="font-label-caps text-label-caps text-on-surface-variant uppercase truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

export default function ResourceStatsCard({ categories }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    documentsService
      .storageSummary()
      .then((res) => {
        if (cancelled) return;
        setSummary(res.data?.data || null);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton className="h-56 rounded-2xl" />;

  const docCount = summary?.document_count ?? 0;
  const categoryCount = Array.isArray(categories) ? categories.length : 0;
  const used = summary?.used_bytes ?? 0;
  const u = formatStorage(used);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-h2 text-h2 text-on-background">Resource Stats</h3>
        <MaterialIcon name="analytics" className="text-outline-variant" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <StatTile
          icon="description"
          iconColor="text-primary"
          iconBg="bg-primary-container"
          label="Documents"
          value={docCount}
        />
        <StatTile
          icon="folder"
          iconColor="text-tertiary"
          iconBg="bg-tertiary-container"
          label="Categories"
          value={categoryCount}
        />
      </div>

      <StatTile
        icon="cloud_done"
        iconColor="text-secondary"
        iconBg="bg-secondary-container"
        label="Storage used"
        value={`${u.value} ${u.unit}`}
      />
    </div>
  );
}
