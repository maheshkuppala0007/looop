import api from './api';

export const contentService = {
  // 1. Site Branding, Navigation & Impact Settings
  async getSiteSettings() {
    try {
      const res = await api.get('/content/settings');
      return res.data;
    } catch (err) {
      console.warn('Failed to fetch site settings, using defaults:', err.message);
      return { success: false };
    }
  },

  async updateSiteSettings(settings) {
    const res = await api.put('/admin/site-settings', settings);
    return res.data;
  },

  // 2. Reviews / Testimonials (Public & Admin)
  async getPublicReviews() {
    try {
      const res = await api.get('/content/reviews');
      return res.data;
    } catch (err) {
      console.warn('Failed to fetch public reviews:', err.message);
      return { success: false, reviews: [] };
    }
  },

  async getAdminReviews() {
    const res = await api.get('/admin/site-reviews');
    return res.data;
  },

  async createReview(data) {
    const res = await api.post('/admin/site-reviews', data);
    return res.data;
  },

  async updateReview(id, data) {
    const res = await api.put(`/admin/site-reviews/${id}`, data);
    return res.data;
  },

  async toggleReviewPublish(id) {
    const res = await api.patch(`/admin/site-reviews/${id}/publish`);
    return res.data;
  },

  async deleteReview(id) {
    const res = await api.delete(`/admin/site-reviews/${id}`);
    return res.data;
  },

  // 3. Live Real Impact Stats
  async getLiveImpactStats() {
    try {
      const res = await api.get('/content/impact-stats');
      return res.data;
    } catch (err) {
      console.warn('Failed to fetch impact stats:', err.message);
      return { success: false };
    }
  },

  // 4. Newsletter Subscription with OTP Verification
  async subscribeNewsletter(email, name = '') {
    const res = await api.post('/content/subscribe', { email, name });
    return res.data;
  },

  async verifySubscriberOtp(email, otp) {
    const res = await api.post('/content/verify-otp', { email, otp });
    return res.data;
  },

  // 5. Admin Broadcast Updates
  async getBroadcasts() {
    const res = await api.get('/admin/broadcasts');
    return res.data;
  },

  async sendBroadcast(broadcastData) {
    const res = await api.post('/admin/broadcasts', broadcastData);
    return res.data;
  },

  async getSubscribers() {
    const res = await api.get('/admin/subscribers');
    return res.data;
  }
};

export default contentService;
