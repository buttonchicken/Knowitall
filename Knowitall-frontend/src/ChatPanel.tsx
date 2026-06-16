import { useEffect, useRef, useState } from 'react'
import type { ResearchReport } from './App'

interface Message {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

interface ChatPanelProps {
  report: ResearchReport
}

export default function ChatPanel({ report }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || streaming) return

    const history = messages
      .filter(m => !m.error)
      .map(m => ({ role: m.role, content: m.content }))

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, history, question }),
      })

      if (!res.ok || !res.body) {
        const text = await res.text()
        throw new Error(text || `Request failed with status ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') {
            setStreaming(false)
            return
          }
          try {
            const { token } = JSON.parse(payload)
            if (token) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                updated[updated.length - 1] = { ...last, content: last.content + token }
                return updated
              })
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Something went wrong.',
          error: true,
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Ask about this company</h2>
      </div>

      <div className="h-80 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">Ask anything about this company…</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : msg.error
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {msg.content || (msg.role === 'assistant' && streaming && i === messages.length - 1 ? '' : null)}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span className="animate-pulse">▋</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-100 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={streaming}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm px-5 py-2.5 shadow-sm transition-colors"
        >
          {streaming ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
