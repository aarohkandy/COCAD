import { useMemo, useState } from "react";

import { formatTimestamp, toneClassName } from "../reducer";
import type { TimelineCard } from "../types";

interface ChatPanelProps {
  email: string;
  inviteCode: string;
  latestSummary: string;
  timeline: TimelineCard[];
  isStreaming: boolean;
  isSending: boolean;
  error: string | null;
  onSend: (message: string) => Promise<void>;
  onReset: () => void;
}

export function ChatPanel({
  email,
  inviteCode,
  latestSummary,
  timeline,
  isStreaming,
  isSending,
  error,
  onSend,
  onReset,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const orderedTimeline = useMemo(() => timeline, [timeline]);

  return (
    <section className="chat-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">CHAT</p>
          <h2>Design Conversation</h2>
        </div>
        <div className="session-meta">
          <span>{email}</span>
          <span>{inviteCode}</span>
          <button type="button" className="ghost-button" onClick={onReset}>
            Reset
          </button>
        </div>
      </header>

      <section className="summary-card">
        <p className="summary-label">Run Summary</p>
        <p>{latestSummary}</p>
      </section>

      <section className="step-plan-card">
        <div className="card-row">
          <h3>Step Plan</h3>
          <span>Phase 1</span>
        </div>
        <p>
          This panel is already reserved for the confirmed step list. Phase 0 only proves
          the chat loop and viewer plumbing.
        </p>
      </section>

      <div className="timeline">
        {orderedTimeline.length === 0 ? (
          <div className="timeline-card timeline-card--neutral">
            <div className="timeline-card-header">
              <h3>Waiting for session events</h3>
            </div>
            <p>Create a session to begin the Phase 0 round-trip.</p>
          </div>
        ) : null}

        {orderedTimeline.map((item) => (
          <article key={item.id} className={`timeline-card ${toneClassName(item.tone)}`}>
            <div className="timeline-card-header">
              <div>
                <h3>{item.title}</h3>
                <time>{formatTimestamp(item.createdAt)}</time>
              </div>
              {item.complete === false ? <span className="live-indicator">live</span> : null}
            </div>
            <p>{item.body || (item.complete === false ? "..." : "")}</p>
          </article>
        ))}
      </div>

      <footer className="composer">
        <div className="status-row">
          <span className={isStreaming ? "status-live" : "status-idle"}>
            {isStreaming ? "SSE connected" : "SSE disconnected"}
          </span>
          {error ? <span className="inline-error">{error}</span> : null}
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!draft.trim()) {
              return;
            }
            const nextDraft = draft.trim();
            setDraft("");
            await onSend(nextDraft);
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Describe any 3D object you want to design."
            rows={5}
          />
          <button className="primary-button" type="submit" disabled={isSending || !draft.trim()}>
            {isSending ? "Streaming..." : "Send"}
          </button>
        </form>
      </footer>
    </section>
  );
}
