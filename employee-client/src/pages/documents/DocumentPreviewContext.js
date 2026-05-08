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

  const openDocument = useCallback((doc) => {
    if (!doc) return;
    setCurrent(doc);
    // Bump the view timestamp; ignore failures (server enforces visibility).
    if (doc.document_item_id) {
      documentsService.recordView(doc.document_item_id).catch(() => {});
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
      <DocumentPreviewDrawer doc={current} onClose={closeDocument} />
    </DocumentPreviewContext.Provider>
  );
}

export function useDocumentPreview() {
  return useContext(DocumentPreviewContext);
}
