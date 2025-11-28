import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: false
});

export default {
  async signInWithGoogle(idToken) {
    const res = await client.post('/api/auth/google', { idToken });
    return res.data; // { token, user }
  },

  async getItems(jwt) {
    const res = await client.get('/api/items', {
      headers: { Authorization: `Bearer ${jwt}` }
    });
    return res.data;
  }
};