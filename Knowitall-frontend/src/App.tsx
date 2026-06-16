import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import ChatPanel from './ChatPanel'

export interface ResearchReport {
  company_overview: string
  products_and_services: string[]
  target_customers: string[]
  business_signals: string[]
  risks_and_challenges: string[]
  suggested_discovery_questions: string[]
  suggested_outreach_strategy: string
  unknowns: string[]
  sources: string[]
}

type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ResearchReport }
  | { status: 'error'; message: string }

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-4/6" />
      </div>
    </div>
  )
}

function BulletCard({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-gray-700 text-sm leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function NumberedCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
        <span>💬</span>
        {title}
      </h2>
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-gray-700 text-sm leading-relaxed">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
    </div>
  )
}

function OutreachCard({ strategy }: { strategy: string }) {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-600 mb-3 flex items-center gap-2">
        <span>🎯</span>
        Suggested Outreach Strategy
      </h2>
      <p className="text-indigo-900 text-sm leading-relaxed">{strategy}</p>
    </div>
  )
}

function SourcesFooter({ sources }: { sources: string[] }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
        <span>🔗</span>
        Sources
      </h2>
      <div className="flex flex-wrap gap-2">
        {sources.map((src, i) => {
          let href = src
          if (!/^https?:\/\//i.test(src)) href = 'https://' + src
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3 py-1 transition-colors truncate max-w-[280px]"
              title={src}
            >
              {src}
            </a>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<AppState>({ status: 'idle' })
  const reportRef = useRef<HTMLDivElement>(null)

  async function handleDownload() {
    if (!reportRef.current) return
    const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true })
    const pdf = new jsPDF({ unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
    pdf.save('report.pdf')
  }

  async function handleResearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    setState({ status: 'loading' })

    try {
      const res = await fetch(`/research?url=${encodeURIComponent(trimmed)}`)
      const json = await res.json()

      if (!res.ok) {
        const detail = json?.detail ?? `Request failed with status ${res.status}`
        setState({ status: 'error', message: String(detail) })
        return
      }

      setState({ status: 'success', data: json as ResearchReport })
    } catch {
      setState({ status: 'error', message: 'Network error — make sure the API server is running.' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-12">
      <div className="max-w-3xl mx-auto">

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Know It All</h1>
          <p className="text-gray-500 text-base">Deep-dive B2B research in seconds</p>
        </div>

        <form onSubmit={handleResearch} className="flex gap-3 mb-8">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://company.com"
            required
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={state.status === 'loading'}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm px-6 py-3 shadow-sm transition-colors"
          >
            {state.status === 'loading' ? 'Researching…' : 'Research'}
          </button>
        </form>

        {state.status === 'error' && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-5 py-4 text-sm flex items-start gap-3">
            <span className="text-red-400 text-base flex-shrink-0 mt-0.5">⚠</span>
            <span>{state.message}</span>
          </div>
        )}

        {state.status === 'loading' && (
          <div className="space-y-4">
            <div className="text-center text-sm text-indigo-600 font-medium mb-6 animate-pulse">
              Scraping and analyzing…
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto mb-4" />
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-11/12" />
                <div className="h-3 bg-gray-200 rounded w-10/12" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        )}

        {state.status === 'success' && (() => {
          const d = state.data
          return (
            <div className="space-y-4">
              <div ref={reportRef} className="space-y-4">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Company Overview</div>
                  <p className="text-gray-800 text-base leading-relaxed">{d.company_overview}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <BulletCard title="Products & Services" items={d.products_and_services} icon="📦" />
                  <BulletCard title="Target Customers" items={d.target_customers} icon="🎯" />
                  <BulletCard title="Business Signals" items={d.business_signals} icon="📈" />
                  <BulletCard title="Risks & Challenges" items={d.risks_and_challenges} icon="⚠️" />
                  {d.unknowns.length > 0 && (
                    <BulletCard title="Unknowns" items={d.unknowns} icon="❓" />
                  )}
                </div>

                <OutreachCard strategy={d.suggested_outreach_strategy} />

                <NumberedCard
                  title="Suggested Discovery Questions"
                  items={d.suggested_discovery_questions}
                />

                {d.sources.length > 0 && <SourcesFooter sources={d.sources} />}
              </div>

              <div className="flex justify-center pt-2 pb-4">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm px-6 py-3 shadow-md hover:shadow-lg transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download PDF
                </button>
              </div>

              <ChatPanel report={d} />
            </div>
          )
        })()}

      </div>
    </div>
  )
}
