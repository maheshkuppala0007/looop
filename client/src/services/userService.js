import api from './api';

/**
 * User Profile & Trust Service
 * Connects directly to real backend API endpoints:
 * - GET   /api/users/me       (authenticated current user profile & real metrics)
 * - PATCH /api/users/me       (update current user profile fields)
 * - GET   /api/users/:userId  (sanitized public user profile, items, and reviews)
 */
export const userService = {
  /**
   * Fetch current authenticated user's profile and real activity statistics
   */
  getMyProfile: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  /**
   * Update current user profile fields (name, bio, city, locality, state, interests, profileVisibility, avatar)
   */
  updateMyProfile: async (profileData) => {
    const response = await api.patch('/users/me', profileData);
    return response.data;
  },

  /**
   * Upload user profile photo (WhatsApp DP style)
   */
  uploadAvatar: async (fileOrFormData) => {
    let body = fileOrFormData;
    let headers = {};
    if (fileOrFormData instanceof File) {
      body = new FormData();
      body.append('avatar', fileOrFormData);
      headers = { 'Content-Type': 'multipart/form-data' };
    }
    const response = await api.post('/users/me/avatar', body, { headers });
    return response.data;
  },

  /**
   * Fetch public community profile of any user by ID
   */
  getPublicProfile: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  }
};

export default userService;
