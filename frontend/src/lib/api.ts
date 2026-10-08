const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${apiUrl}/api/v1${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }
  return data;
};

// Agent API Methods
export const agentApi = {
  getHistory: () => fetchApi('/agent/conversations'),
  
  sendMessage: (message: string, conversationId: string | null, language: string) => 
    fetchApi('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId, language }),
    }),
  
  deleteConversation: (conversationId: string) => 
    fetchApi(`/agent/conversations/${conversationId}`, {
      method: 'DELETE',
    })
};
