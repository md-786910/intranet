import React, { useState, useEffect, useRef } from 'react';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';
import AzureOrgChart from './AzureOrgChart';

export default function OrgHierarchyView() {
  const { addToast: showToast } = useToast();
  const [roots, setRoots] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => {
    setTreeLoading(true);
    azureAdService.getOrgTreeRoots()
      .then((res) => setRoots(res.data?.data || []))
      .catch(() => showToast('Failed to load org hierarchy', 'error'))
      .finally(() => setTreeLoading(false));
  }, [showToast]);

  // After roots render, center the canvas horizontally so the root card is in view
  useEffect(() => {
    if (roots.length === 0 || !canvasRef.current) return;
    const t = setTimeout(() => {
      const el = canvasRef.current;
      if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }, 150);
    return () => clearTimeout(t);
  }, [roots]);

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    const el = canvasRef.current;
    drag.current = {
      active: true,
      startX: e.pageX,
      startY: e.pageY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setIsDragging(true);
  }

  function handleMouseMove(e) {
    if (!drag.current.active) return;
    e.preventDefault();
    const el = canvasRef.current;
    el.scrollLeft = drag.current.scrollLeft - (e.pageX - drag.current.startX);
    el.scrollTop  = drag.current.scrollTop  - (e.pageY - drag.current.startY);
  }

  function handleMouseUp() {
    drag.current.active = false;
    setIsDragging(false);
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
      style={{ height: 'calc(100vh - 13rem)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Reporting Hierarchy</p>
        <p className="text-xs text-gray-400">
          Drag to pan · scroll to navigate · click card to view profile · +/− to expand
        </p>
      </div>

      {/* Canvas */}
      {treeLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <svg className="animate-spin w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : roots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          No hierarchy data found
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="flex-1 overflow-auto select-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* block-level flex — avoids inline-flex vertical-align:baseline bug */}
          <div
            className="flex flex-wrap gap-16 justify-center items-start p-8"
            style={{ minWidth: '100%', width: 'max-content' }}
          >
            {roots.map((root) => (
              <AzureOrgChart
                key={root.id}
                user={root}
                depth={0}
                autoExpand={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
