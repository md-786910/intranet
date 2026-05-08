import { useEffect, useState } from 'react';
import { documentsService } from '../../services/documentsService';

// Single fetch of /documents/categories shared between the header (for the
// filter popover's category chips) and CategoryGrid (for the cards).
export default function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    documentsService
      .listCategories()
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || [];
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load categories.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading, error };
}
