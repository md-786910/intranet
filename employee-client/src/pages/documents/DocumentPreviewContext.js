import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { documentsService } from '../../services/documentsService';
import DocumentPreviewDrawer from './sections/DocumentPreviewDrawer';

// Lets any documents-area surface (cards, table rows, banners) open a single
// shared right-side preview drawer by calling `openDocument(doc)`.
const DocumentPreviewContext = createContext({
  openDocument: () => {},
  closeDocument: () => {},
  current: null,
});

export function DocumentPreviewProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const [initialFileIndex, setInitialFileIndex] = useState(0);

  // `options.fileIndex` lets the All Files grid open the drawer to a
  // specific file inside the doc (not always the first one).
  const openDocument = useCallback((doc, options = {}) => {
    if (!doc) return;
    setInitialFileIndex(Number.isInteger(options.fileIndex) ? options.fileIndex : 0);
    setCurrent(doc);
    const docId = doc.document_item_id || doc.id;
    if (docId) {
      documentsService.recordView(docId)
        .then(() => {
          // Notify Recently Viewed (and any other listeners) to refetch.
          try {
            window.dispatchEvent(new CustomEvent('documents:viewed', { detail: { id: docId } }));
          } catch {
            /* ignore */
          }
        })
        .catch((err) => {
          // Don't bubble — the drawer should still open even if view-tracking
          // fails — but log so dev tools surface real bugs (broken endpoint,
          // missing migration, audience mismatch, etc.).
          // eslint-disable-next-line no-console
          console.warn('recordView failed', err?.response?.status, err?.response?.data);
        });
    }
  }, []);

  const closeDocument = useCallback(() => setCurrent(null), []);

  const value = useMemo(
    () => ({ openDocument, closeDocument, current }),
    [openDocument, closeDocument, current],
  );

  return (
    <DocumentPreviewContext.Provider value={value}>
      {children}
      <DocumentPreviewDrawer doc={current} initialFileIndex={initialFileIndex} onClose={closeDocument} />
    </DocumentPreviewContext.Provider>
  );
}

export function useDocumentPreview() {
  return useContext(DocumentPreviewContext);
}
