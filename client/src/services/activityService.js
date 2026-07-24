import api from "../config/api";

export const activityService = {
  list: (params) => api.get("/activity", { params }),
};
