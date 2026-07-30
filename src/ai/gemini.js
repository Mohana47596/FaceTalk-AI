import { GoogleGenerativeAI } from "@google/generative-ai";

export async function askGemini(userMessage, personaName, conversationHistory) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'Gemini API Key is missing. Add VITE_GEMINI_API_KEY=your_key to your .env file. ' +
      'Get a free key at: https://aistudio.google.com/app/apikey'
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const name = personaName || 'an AI companion';
    const systemPrompt = `You are ${name}, a friendly and engaging AI companion in a real-time voice conversation.

Guidelines:
- CRITICAL: Your responses MUST be extremely short and punchy. 1 or 2 sentences MAXIMUM.
- Do not give long explanations. Keep it conversational, like a quick back-and-forth chat.
- Be warm, witty, and show personality.
- React naturally to what the user says.
- Never say you are an AI or mention being a language model unless directly asked.
- If you don't know something, say so naturally like a human would.`;

    // Format history for Gemini API
    const formattedHistory = (conversationHistory || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text || '' }]
    }));

    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: 60,   // Force extremely short responses
        temperature: 0.85,
        topP: 0.95,
      }
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = await result.response.text();
    return responseText.trim();

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
