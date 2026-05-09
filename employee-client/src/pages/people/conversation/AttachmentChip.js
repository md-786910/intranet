import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';

export default function AttachmentChip({ attachment }) {
  if (!attachment) return null;

  const Wrapper = attachment.url ? 'a' : 'button';
  const props = attachment.url
    ? { href: attachment.url, download: attachment.name }
    : { type: 'button' };

  return (
    <Wrapper
      {...props}
      className="bg-white border border-outline-variant p-unit-sm rounded-xl flex items-center gap-unit-md hover:bg-surface-container-low cursor-pointer transition-colors w-64 shadow-sm text-left"
    >
      <div className="w-10 h-10 bg-tertiary-fixed rounded-lg flex items-center justify-center shrink-0">
        <MaterialIcon name="description" className="text-on-tertiary-container" />
      </div>
      <div className="overflow-hidden">
        <p className="text-body-sm font-semibold truncate text-on-surface">{attachment.name}</p>
        <p className="text-[11px] text-outline">
          {[attachment.size, attachment.kind].filter(Boolean).join(' • ')}
        </p>
      </div>
    </Wrapper>
  );
}
