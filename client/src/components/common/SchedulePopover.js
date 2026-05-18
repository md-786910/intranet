import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

// Schedule popover anchored beneath an "anchor" element. Custom date + 12-hour
// time UI — separates day picking from time picking so AM/PM is unambiguous
// and the layout stays consistent across browsers (the native
// <input type="datetime-local"> renders very differently per browser and hides
// AM/PM behind a 24-hour spinner). Closes on outside-click or Escape.

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);          // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i);           // 0..59

function pad(n) { return String(n).padStart(2, '0'); }

// `Date` ↔ `<input type="date">` value (yyyy-MM-dd in local time)
function toDateInputValue(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateInputValue(s) {
  if (!s) return null;
  const [y, m, day] = s.split('-').map(Number);
  if (!y || !m || !day) return null;
  return { y, m, day };
}

// Convert a 24h hour into { hour12, ampm } for the UI selects.
function to12h(hour24) {
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  let h = hour24 % 12;
  if (h === 0) h = 12;
  return { hour12: h, ampm };
}

// Default to "in 1 hour, rounded up to the next 5 minutes" — sensible target
// for the most common case ("schedule shortly").
function suggestedDefault() {
  // Default to "in 1 hour" — common ergonomic target. Seconds zeroed so the
  // displayed minute matches what we'll actually send.
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d;
}

function buildQuickPicks() {
  const now = new Date();

  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  inOneHour.setSeconds(0, 0);

  const tomorrow9 = new Date(now);
  tomorrow9.setDate(tomorrow9.getDate() + 1);
  tomorrow9.setHours(9, 0, 0, 0);

  const nextMon = new Date(now);
  const dow = nextMon.getDay();
  const daysUntilMonday = ((8 - dow) % 7) || 7;
  nextMon.setDate(nextMon.getDate() + daysUntilMonday);
  nextMon.setHours(9, 0, 0, 0);

  return [
    { label: 'In 1 hour', date: inOneHour },
    { label: 'Tomorrow 9 AM', date: tomorrow9 },
    { label: 'Next Mon 9 AM', date: nextMon },
  ];
}

export default function SchedulePopover({
  open,
  anchorRef,
  initialValue = null,
  saving = false,
  onCancel,
  onSave,
}) {
  const popRef = useRef(null);
  const seed = initialValue ? new Date(initialValue) : suggestedDefault();
  const seed12 = to12h(seed.getHours());

  const [dateStr, setDateStr] = useState(() => toDateInputValue(seed));
  const [hour12, setHour12] = useState(seed12.hour12);
  const [minute, setMinute] = useState(seed.getMinutes());
  const [ampm, setAmPm] = useState(seed12.ampm);
  const [error, setError] = useState('');
  const [position, setPosition] = useState({ top: 0, right: 0 });

  // Reset state each open so a stale partial entry isn't carried over.
  useEffect(() => {
    if (!open) return;
    const init = initialValue ? new Date(initialValue) : suggestedDefault();
    const t = to12h(init.getHours());
    setDateStr(toDateInputValue(init));
    setHour12(t.hour12);
    setMinute(init.getMinutes());
    setAmPm(t.ampm);
    setError('');
  }, [open, initialValue]);

  // Position the popover under (or above) its anchor. Fixed-positioned, so
  // coordinates are viewport-relative — do NOT add scrollY.
  useEffect(() => {
    if (!open || !anchorRef?.current) return undefined;
    const update = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const ESTIMATED_HEIGHT = 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < ESTIMATED_HEIGHT && rect.top > ESTIMATED_HEIGHT;
      setPosition({
        top: openUpward ? Math.max(8, rect.top - ESTIMATED_HEIGHT - 6) : rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  // Outside-click + Escape to dismiss.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onCancel?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel, anchorRef]);

  // Composite Date from the four controls.
  const composedDate = useMemo(() => {
    const parsed = parseDateInputValue(dateStr);
    if (!parsed) return null;
    let h24 = hour12 % 12;
    if (ampm === 'PM') h24 += 12;
    const d = new Date(parsed.y, parsed.m - 1, parsed.day, h24, minute, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [dateStr, hour12, minute, ampm]);

  const composedLabel = composedDate
    ? composedDate.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : '';

  if (!open) return null;

  const applyDate = (d) => {
    setDateStr(toDateInputValue(d));
    const t = to12h(d.getHours());
    setHour12(t.hour12);
    setMinute(d.getMinutes());
    setAmPm(t.ampm);
    setError('');
  };

  const handleSave = () => {
    if (!composedDate) {
      setError('Pick a date and time');
      return;
    }
    if (composedDate.getTime() <= Date.now() + 30 * 1000) {
      setError('Schedule time must be in the future');
      return;
    }
    onSave?.({ iso: composedDate.toISOString(), date: composedDate });
  };

  const minDate = toDateInputValue(new Date());
  const selectClass =
    'rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none';

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label="Schedule publish time"
      className="fixed z-50 w-[20rem] rounded-xl border border-gray-200 bg-white shadow-xl p-4"
      style={{ top: position.top, right: position.right }}
    >
      <div className="text-sm font-semibold text-gray-900">Schedule publish</div>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">
        Pick a future date and time. It will publish automatically.
      </p>

      {/* Quick picks */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {buildQuickPicks().map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => applyDate(q.date)}
            className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-gray-700"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Date */}
      <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
      <input
        type="date"
        value={dateStr}
        min={minDate}
        onChange={(e) => { setDateStr(e.target.value); setError(''); }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none"
      />

      {/* Time: hour / minute / AM-PM */}
      <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">Time</label>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-stretch">
        <select
          aria-label="Hour"
          value={hour12}
          onChange={(e) => { setHour12(Number(e.target.value)); setError(''); }}
          className={selectClass}
        >
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select
          aria-label="Minute"
          value={minute}
          onChange={(e) => { setMinute(Number(e.target.value)); setError(''); }}
          className={selectClass}
        >
          {MINUTES.map((m) => <option key={m} value={m}>:{pad(m)}</option>)}
        </select>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => { setAmPm('AM'); setError(''); }}
            className={`px-3 text-xs font-semibold ${ampm === 'AM' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => { setAmPm('PM'); setError(''); }}
            className={`px-3 text-xs font-semibold border-l border-gray-300 ${ampm === 'PM' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            PM
          </button>
        </div>
      </div>

      {/* Live preview of the composed instant */}
      {composedLabel && (
        <p className="mt-2 text-xs text-gray-500">
          Will publish on <span className="font-medium text-gray-700">{composedLabel}</span>
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={handleSave} loading={saving} disabled={!composedDate}>Schedule</Button>
      </div>
    </div>,
    document.body,
  );
}
