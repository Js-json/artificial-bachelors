import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }

  const text = body?.selectedText || body?.text
  const context = body?.surroundingContext || body?.context

  if (!text) {
    return res.status(400).json({ error: 'Missing text in request body' })
  }

  if (typeof text === 'string' && text.length > 5000) {
    return res.status(400).json({ error: 'Text exceeds maximum limit of 5000 characters' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    // Using flash model for fast response time
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Explain the following text from a PDF document clearly and concisely to aid understanding.
    
Text to explain: "${text}"
${context ? `Surrounding context: "${context}"` : ''}

Explanation:`

    const result = await model.generateContent(prompt)
    const explanation = result.response.text()

    return res.status(200).json({ explanation })
  } catch (error: any) {
    console.error('Error calling Gemini API:', error)
    return res.status(500).json({ error: 'Failed to generate explanation', details: error?.message || String(error) })
  }
}

