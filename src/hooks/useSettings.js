import { useState, useEffect } from 'react';

const DEFAULT_SETTINGS = {
  groqKey: '',
  jinaKey: '',
  weights: {
    skills: 40,
    experience: 25,
    location: 15,
    salary: 10,
    workMode: 10
  },
  minMatchScore: 4.0,
  maxResults: 50
};

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('recruitai_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('recruitai_settings', JSON.stringify(settings));
      if (settings.groqKey) localStorage.setItem('groq_api_key', settings.groqKey);
      if (settings.jinaKey)  localStorage.setItem('jina_api_key',  settings.jinaKey);
    } catch {}
  }, [settings]);

  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const updateWeights = (weights) => {
    setSettings(prev => ({ ...prev, weights }));
  };

  return { settings, updateSettings, updateWeights };
}
