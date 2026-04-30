import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaService } from '../services/mediaService';

let nextId = 1;
const newId = () => `upload-${nextId++}`;

function extractError(err) {
  return err?.response?.data?.message || err?.message || 'Upload failed';
}

export function useMultiUpload({ concurrency = 3, onComplete } = {}) {
  const [items, setItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const queueRef = useRef([]);
  const activeRef = useRef(0);
  const succeededRef = useRef([]);
  const failedRef = useRef([]);
  const onCompleteRef = useRef(onComplete);
  const concurrencyRef = useRef(concurrency);
  const pumpRef = useRef(null);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { concurrencyRef.current = concurrency; }, [concurrency]);

  const updateItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  if (pumpRef.current === null) {
    pumpRef.current = () => {
      while (activeRef.current < concurrencyRef.current && queueRef.current.length > 0) {
        const entry = queueRef.current.shift();
        activeRef.current += 1;
        updateItem(entry.id, { status: 'uploading', progress: 0 });

        mediaService
          .upload(entry.file, (e) => {
            if (!e || !e.total) return;
            const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
            updateItem(entry.id, { progress: pct });
          })
          .then((res) => {
            const asset = res?.data?.data;
            updateItem(entry.id, { status: 'done', progress: 100, result: asset });
            succeededRef.current.push(asset);
          })
          .catch((err) => {
            const message = extractError(err);
            updateItem(entry.id, { status: 'error', error: message });
            failedRef.current.push({ name: entry.file.name, error: message });
          })
          .finally(() => {
            activeRef.current = Math.max(0, activeRef.current - 1);
            if (activeRef.current === 0 && queueRef.current.length === 0) {
              const summary = {
                succeeded: succeededRef.current,
                failed: failedRef.current,
              };
              succeededRef.current = [];
              failedRef.current = [];
              setIsUploading(false);
              if (onCompleteRef.current) onCompleteRef.current(summary);
            } else {
              pumpRef.current();
            }
          });
      }
    };
  }

  const start = useCallback((files) => {
    if (!files || files.length === 0) return;
    const entries = Array.from(files).map((file) => ({
      id: newId(),
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
    }));
    setItems((prev) => [
      ...prev,
      ...entries.map((e) => ({ id: e.id, name: e.name, size: e.size, progress: 0, status: 'pending' })),
    ]);
    queueRef.current.push(...entries);
    setIsUploading(true);
    pumpRef.current();
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return { items, start, clear, isUploading };
}
