/**
 * Groq AI Client — ultra-fast LLM inference for real-time voice conversation.
 * Uses Groq's OpenAI-compatible API with llama-3.3-70b-versatile.
 * Typical response time: 200-500ms (vs 1-3s for Gemini).
 */

export async function askGroq(userMessage, personaName, conversationHistory) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Groq API key missing. Add VITE_GROQ_API_KEY to your .env file.');
  }

  const name = personaName || 'an AI companion';

const systemPrompt = `You are ${name}, a warm, witty, and engaging AI companion in a real-time voice conversation.

Rules:
- CRITICAL: Your responses MUST be extremely short and punchy. 1 or 2 sentences MAXIMUM.
- Do not give long explanations. Keep it conversational, like a quick back-and-forth chat.
- Be conversational, expressive, and human. Show personality.
- React to the user's emotion.
- Never break character or mention being an AI unless directly asked.
- Speak as if you are genuinely ${name}.`;

  // Build message history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(conversationHistory || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text || '',
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 60,        // Force extremely short responses
      temperature: 0.85,
      top_p: 0.95,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Groq');
  return text;
}
