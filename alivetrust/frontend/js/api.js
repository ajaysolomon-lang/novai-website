/* ═══════════════════════════════════════════════════════════════
   AliveTrust — API Client
   Handles all communication with the AliveTrust Worker API
   ═══════════════════════════════════════════════════════════════ */

const API = (function() {
  'use strict';

  const BASE_URL = ''; // Same origin in production, or set to worker URL
  let authToken = localStorage.getItem('alivetrust_token');

  /**
   * Core request helper — handles auth headers, JSON parsing, error handling
   */
  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = 'Bearer ' + authToken;
    }

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    // For GET requests with body (used as query params), append to URL
    let url = BASE_URL + path;

    try {
      const res = await fetch(url, options);

      // Handle 401 — token expired or invalid
      if (res.status === 401) {
        authToken = null;
        localStorage.removeItem('alivetrust_token');
        // Dispatch event so app.js can redirect to login
        window.dispatchEvent(new CustomEvent('alivetrust:auth-expired'));
        throw new Error('Session expired. Please log in again.');
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Request failed');
      }

      return data.data;
    } catch (err) {
      // Network errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw err;
    }
  }

  return {
    /* ─── Token Management ─── */
    setToken: function(t) {
      authToken = t;
      localStorage.setItem('alivetrust_token', t);
    },

    clearToken: function() {
      authToken = null;
      localStorage.removeItem('alivetrust_token');
    },

    getToken: function() {
      return authToken;
    },

    /* ─── Auth ─── */
    register: function(email, password, name) {
      return request('POST', '/auth/register', { email, password, name });
    },

    login: function(email, password) {
      return request('POST', '/auth/login', { email, password });
    },

    logout: function() {
      return request('POST', '/auth/logout', {});
    },

    /* ─── Trust ─── */
    createTrust: function(data) {
      return request('POST', '/trust', data);
    },

    getTrust: function(trustId) {
      return request('GET', '/trust/' + trustId);
    },

    /* ─── Assets ─── */
    getAssets: function(trustId) {
      return request('GET', '/trust/' + trustId + '/assets');
    },

    createAsset: function(trustId, data) {
      return request('POST', '/trust/' + trustId + '/assets', data);
    },

    updateAsset: function(trustId, assetId, data) {
      return request('PUT', '/trust/' + trustId + '/assets/' + assetId, data);
    },

    deleteAsset: function(trustId, assetId) {
      return request('DELETE', '/trust/' + trustId + '/assets/' + assetId);
    },

    /* ─── Documents ─── */
    getDocuments: function(trustId) {
      return request('GET', '/trust/' + trustId + '/documents');
    },

    createDocument: function(trustId, data) {
      return request('POST', '/trust/' + trustId + '/documents', data);
    },

    updateDocument: function(trustId, docId, data) {
      return request('PUT', '/trust/' + trustId + '/documents/' + docId, data);
    },

    /* ─── Evidence ─── */
    getEvidence: function(trustId) {
      return request('GET', '/trust/' + trustId + '/evidence');
    },

    createEvidence: function(trustId, data) {
      return request('POST', '/trust/' + trustId + '/evidence', data);
    },

    /* ─── Compute (Health Scores) ─── */
    compute: function(trustId) {
      return request('POST', '/trust/' + trustId + '/compute', {});
    },

    /* ─── Next Best Actions ─── */
    getNBA: function(trustId) {
      return request('GET', '/trust/' + trustId + '/nba');
    },

    /* ─── RAG (Document Intelligence) ─── */
    ragIngest: function(trustId, data) {
      return request('POST', '/trust/' + trustId + '/rag/ingest', data);
    },

    ragQuery: function(trustId, query) {
      return request('POST', '/trust/' + trustId + '/rag/query', { query });
    },

    /* ─── Providers ─── */
    searchProviders: function(filters) {
      const params = new URLSearchParams(filters).toString();
      return request('GET', '/providers' + (params ? '?' + params : ''));
    },

    /* ─── Exports ─── */
    exportHealthReport: function(trustId) {
      return request('POST', '/trust/' + trustId + '/export/health-report.pdf', {});
    },

    exportTrusteePacket: function(trustId) {
      return request('POST', '/trust/' + trustId + '/export/trustee-packet.pdf', {});
    }
  };
})();
