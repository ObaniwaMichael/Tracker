import { useState } from 'react'
import { useTracking } from '../context/TrackingContext'

export default function ShareTrackingLink() {
  const {
    invitePhone,
    setInvitePhone,
    generateTrackingRequest,
    activeInvite,
    inviteBusy,
  } = useTracking()
  const [copied, setCopied] = useState(false)

  const onGenerate = async () => {
    const invite = await generateTrackingRequest(invitePhone)
    if (invite) setCopied(false)
  }

  const onCopy = async () => {
    if (!activeInvite?.trackingUrl) return
    try {
      await navigator.clipboard.writeText(activeInvite.trackingUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Share tracking link</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
          Creates a real trip via <code className="font-mono">POST /api/trips/new</code>,
          then simulates an SMS with the shareable driver URL.
        </p>
      </div>

      <label className="block text-xs text-[var(--color-muted)]">
        Driver phone number
        <input
          type="tel"
          value={invitePhone}
          onChange={(e) => setInvitePhone(e.target.value)}
          placeholder="+234 801 234 5678"
          className="mt-1.5 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2.5 text-sm text-slate-100 outline-none ring-teal-500/40 placeholder:text-slate-500 focus:ring-2"
        />
      </label>

      <button
        type="button"
        onClick={onGenerate}
        disabled={inviteBusy}
        className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {inviteBusy ? 'Creating trip…' : 'Generate Tracking Request'}
      </button>

      {activeInvite && (
        <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 px-3 py-2.5 text-xs">
          <div className="font-semibold text-teal-200">Latest invite</div>
          <div className="mt-1.5 flex justify-between gap-2 text-[var(--color-muted)]">
            <span>Trip ID</span>
            <span className="max-w-[60%] truncate font-mono text-slate-200">
              {activeInvite.tripId}
            </span>
          </div>
          <div className="mt-1 break-all font-mono text-[0.7rem] text-slate-300">
            {activeInvite.trackingUrl}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-[0.7rem] font-semibold text-slate-200 hover:border-teal-400/40"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={activeInvite.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-[0.7rem] font-semibold text-slate-200 hover:border-teal-400/40"
            >
              Open as driver
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
