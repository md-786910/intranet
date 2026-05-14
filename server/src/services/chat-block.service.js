// Small helper around the chat_block table for places that need to filter
// people lists by the viewer's admin-configured blocklist (Key Contacts,
// global search, etc.). Centralised so callers don't repeat the query.

const chatBlockService = {
  /**
   * Returns the set of user_ids the given viewer is blocked from seeing in
   * chat-style listings. Blocks are bidirectional (written as paired rows by
   * `employees.service.syncChatBlocks`), so a single-direction query is
   * enough — we read the rows where the viewer is on the `user_id` side.
   *
   * Returns a Set<number>. Empty set means no exclusions.
   */
  async getBlockedIdSet(viewerUserId) {
    if (!viewerUserId) return new Set();
    const { ChatBlock } = require('../database/models');
    const rows = await ChatBlock.findAll({
      where: { user_id: viewerUserId },
      attributes: ['blocked_user_id'],
    });
    return new Set(rows.map((r) => Number(r.blocked_user_id)));
  },
};

module.exports = chatBlockService;
