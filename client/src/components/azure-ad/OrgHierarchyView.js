import React, { useState, useEffect, useRef, useCallback } from 'react';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';
import AzureOrgChart from './AzureOrgChart';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;

export default function OrgHierarchyView() {
  const { addToast: showToast } = useToast();
  const [roots, setRoots] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(20);
  const [panY, setPanY] = useState(20);
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef  = useRef(null);
  const contentRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const zoomRef = useRef(1);

  zoomRef.current = zoom;

  useEffect(() => {
    setTreeLoading(true);
    azureAdService.getOrgTreeRoots()
      .then((res) => setRoots(res.data?.data || []))
      .catch(() => showToast('Failed to load org hierarchy', 'error'))
      .finally(() => setTreeLoading(false));
  }, [showToast]);

  // After roots render, center them horizontally at zoom=1 — no auto-zoom
  useEffect(() => {
    if (roots.length === 0) return;
    const t = setTimeout(() => {
      const canvas  = canvasRef.current;
      const content = contentRef.current;
      if (!canvas || !content) return;
      const cw = content.scrollWidth;
      setPanX(Math.max(20, (canvas.clientWidth - cw) / 2));
      setPanY(20);
    }, 300);
    return () => clearTimeout(t);
  }, [roots]);

  // Fit HEIGHT to canvas — tree grows downward, not sideways.
  // Cap minimum zoom at 40% so nodes are always readable.
  const fitToView = useCallback(() => {
    const canvas  = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;

    const intrinsicH = content.scrollHeight;
    if (intrinsicH <= 0) return;

    const V_PADDING = 32;
    const MIN_FIT_ZOOM = 0.4;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_FIT_ZOOM,
      (canvas.clientHeight - V_PADDING * 2) / intrinsicH
    ));

    const cw = content.scrollWidth;
    const newPanX = Math.max(20, (canvas.clientWidth - cw * newZoom) / 2);

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(V_PADDING);
    zoomRef.current = newZoom;
  }, []);

  // Reset to zoom=1 with content centered — safe regardless of current pan/zoom
  const resetZoom = useCallback(() => {
    const canvas  = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;
    const cw = content.scrollWidth;
    setPanX(Math.max(20, (canvas.clientWidth - cw) / 2));
    setPanY(20);
    setZoom(1);
    zoomRef.current = 1;
  }, []);

  // Wheel zoom — imperative so preventDefault works (passive:false)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    function onWheel(e) {
      e.preventDefault();
      const factor  = e.deltaY > 0 ? 0.9 : 1.1;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setPanX(px => cx - (cx - px) * (newZoom / oldZoom));
      setPanY(py => cy - (cy - py) * (newZoom / oldZoom));
      setZoom(newZoom);
      zoomRef.current = newZoom;
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [roots]); // re-run when canvas mounts (canvas is conditional on roots.length > 0)

  function applyZoom(newZoom) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    const cx = canvas.clientWidth  / 2;
    const cy = canvas.clientHeight / 2;
    const oldZoom = zoomRef.current;
    setPanX(px => cx - (cx - px) * (newZoom / oldZoom));
    setPanY(py => cy - (cy - py) * (newZoom / oldZoom));
    setZoom(newZoom);
    zoomRef.current = newZoom;
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panX,
      startPanY: panY,
    };
    setIsDragging(true);
  }

  function handleMouseMove(e) {
    if (!drag.current.active) return;
    e.preventDefault();
    setPanX(drag.current.startPanX + (e.clientX - drag.current.startX));
    setPanY(drag.current.startPanY + (e.clientY - drag.current.startY));
  }

  function handleMouseUp() {
    drag.current.active = false;
    setIsDragging(false);
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col w-full min-w-0"
      style={{ height: 'calc(100vh - 11rem)' }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <p className="text-sm font-medium text-gray-700 shrink-0">Reporting Hierarchy</p>
          <p className="text-xs text-gray-400 hidden sm:block truncate">
            Drag to pan · scroll to zoom · click card to view profile
          </p>
        </div>

        {/* Zoom toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => applyZoom(zoom - 0.1)}
            disabled={zoom <= MIN_ZOOM}
            className="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors text-base font-bold disabled:opacity-30"
            title="Zoom out (−)"
          >−</button>

          <span className="text-xs text-gray-600 tabular-nums w-10 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() => applyZoom(zoom + 0.1)}
            disabled={zoom >= MAX_ZOOM}
            className="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors text-base font-bold disabled:opacity-30"
            title="Zoom in (+)"
          >+</button>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <button
            onClick={fitToView}
            className="px-2.5 h-7 rounded text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors font-medium"
            title="Fit to view"
          >Fit</button>

          <button
            onClick={resetZoom}
            className="px-2.5 h-7 rounded text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors font-medium"
            title="Reset to 100%"
          >100%</button>
        </div>
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
          className="flex-1 overflow-hidden select-none relative"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            ref={contentRef}
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0',
              willChange: 'transform',
              position: 'absolute',
              top: 0,
              left: 0,
              display: 'inline-flex',
            }}
          >
            <div className="flex flex-wrap gap-16 justify-center items-start p-8">
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
        </div>
      )}
    </div>
  );
}
