import api from '../config/api';

export const searchService = {
  // type: 'all' | 'news' | 'document' | 'contact'
  search: ({ q, type = 'all', category_id, limit = 10 } = {}) =>
    api.get('/search', {
      params: {
        q,
        type,
        ...(category_id ? { category_id } : {}),
        limit,
      },
    }),
};
