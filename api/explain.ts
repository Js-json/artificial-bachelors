import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { selectedText, surroundingContext } = req.body || {}

  // 1. Validate that selectedText exists and is a non-empty string
  if (!selectedText || typeof selectedText !== 'string' || selectedText.trim().length === 0) {
    return res.status(400).json({ error: 'selectedText is required and must be a non-empty string.' })
  }

  // 2. Validate reasonable input length
  if (selectedText.length > 5000) {
    return res.status(400).json({ error: 'selectedText exceeds maximum length of 5000 characters.' })
  }

  if (surroundingContext && typeof surroundingContext === 'string' && surroundingContext.length > 10000) {
    return res.status(400).json({ error: 'surroundingContext exceeds maximum length of 10000 characters.' })
  }

  // 3. Read GEMINI_API_KEY from server environment only
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key is not configured on the server.' })
  }

  try {
    // 4. Use official Gemini JS SDK with fast Gemini model
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // 5-8. Structured prompt: college student level, resolve references, preserve technical meaning, concise plain text
    const prompt = `You are an expert tutor explaining complex academic/technical text from a PDF document to a college student.

Passage to explain:
"${selectedText.trim()}"

${surroundingContext ? `Surrounding Context for reference resolution:
"${surroundingContext.trim()}"` : ''}

Instructions:
1. Explain the selected passage clearly for a college student.
2. Use the surrounding context to resolve references like "this method", "this phenomenon", "the previous approach", or pronouns.
3. Preserve the exact technical meaning and accuracy.
4. Keep the explanation concise and plain text, suitable for a small UI popover (2-4 sentences maximum). Do not use Markdown formatting or bullet points.`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    return res.status(200).json({ explanation: responseText.trim() })
  } catch (error: any) {
    // Graceful error logging without exposing sensitive keys
    console.error('Error in Gemini explanation endpoint:', error?.message || error)
    return res.status(500).json({ error: 'Failed to generate explanation.' })
  }
}
