import api, { handleApiError } from './api';

export const projectService = {
  getProjects: async () => {
    try {
      const response = await api.get('/api/projects');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getProjectById: async (id) => {
    try {
      const response = await api.get(`/api/projects/${id}`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createProject: async (projectData) => {
    try {
      const response = await api.post('/api/projects', projectData);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateProject: async (id, projectData) => {
    try {
      const response = await api.put(`/api/projects/${id}`, projectData);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  deleteProject: async (id) => {
    try {
      const response = await api.delete(`/api/projects/${id}`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  toggleProjectStatus: async (id, status) => {
    try {
      const response = await api.put(`/api/projects/${id}/status`, { status });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getProjectPayments: async (id) => {
    try {
      const response = await api.get(`/api/projects/${id}/payments`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createProjectPayment: async (id, paymentData) => {
    try {
      const response = await api.post(`/api/projects/${id}/payments`, paymentData);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getProjectMilestones: async (id) => {
    try {
      const response = await api.get(`/api/projects/${id}/milestones`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createMilestone: async (id, milestoneData) => {
    try {
      const response = await api.post(`/api/projects/${id}/milestones`, milestoneData);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateMilestone: async (milestoneId, milestoneData) => {
    try {
      const response = await api.put(`/api/milestones/${milestoneId}`, milestoneData);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  deleteMilestone: async (milestoneId) => {
    try {
      const response = await api.delete(`/api/milestones/${milestoneId}`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getHierarchy: async () => {
    try {
      const response = await api.get('/api/hierarchy');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getPhases: async () => {
    try {
      const response = await api.get('/api/phases');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getDepartments: async () => {
    try {
      const response = await api.get('/api/departments');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getCategories: async () => {
    try {
      const response = await api.get('/api/categories');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  assignCrewToDepartment: async (projectId, deptId, userIds) => {
    try {
      const response = await api.post(`/api/projects/${projectId}/departments/${deptId}/assign-crew`, { user_ids: userIds });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  assignCrewToCategory: async (projectId, catId, userIds) => {
    try {
      const response = await api.post(`/api/projects/${projectId}/categories/${catId}/assign-crew`, { user_ids: userIds });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  assignCrewToBudgetItem: async (projectId, itemId, userIds) => {
    try {
      const response = await api.post(`/api/projects/${projectId}/budget-items/${itemId}/assign-crew`, { user_ids: userIds });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};
