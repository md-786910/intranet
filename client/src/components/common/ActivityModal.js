import React from 'react';
import Modal from './Modal';
import ActivityTimeline from './ActivityTimeline';

/**
 * Modal-wrapped activity timeline. Use on list pages for entities that
 * don't have a dedicated detail page (categories, media).
 */
export default function ActivityModal({ isOpen, onClose, title, events }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Activity'} size="lg">
      {/* Modal already scrolls (max-h-[90vh] overflow-y-auto). Disable the
         timeline's inner cap so we don't get a nested scroll region. */}
      <ActivityTimeline events={events} scrollable={false} />
    </Modal>
  );
}
