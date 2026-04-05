import { useState } from "react";

import { formatTimestamp, toneClassName } from "../reducer";
import type { TimelineCard, WorkflowSnapshot } from "../types";

interface ChatPanelProps {
  latestSummary: string;
  workflow: WorkflowSnapshot;
  timeline: TimelineCard[];
  isStreaming: boolean;
  isSending: boolean;
  error: string | null;
  onSend: (message: string) => Promise<void>;
  onConfirmAssumptions: () => Promise<void>;
  onReset: () => void;
}

export function ChatPanel({
  latestSummary,
  workflow,
  timeline,
  isStreaming,
  isSending,
  error,
  onSend,
  onConfirmAssumptions,
  onReset,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");

  return (
    <section className="chat-panel">
      <header className="chat-shell-header">
        <div className="chat-shell-title">
          <p className="eyebrow">COCAD</p>
          <h1>Chat</h1>
        </div>
        <div className="session-meta session-meta--minimal">
          <span className={`status-pill ${isStreaming ? "status-pill--live" : "status-pill--warning"}`}>
            {isStreaming ? "live" : "reconnecting"}
          </span>
          <button type="button" className="ghost-button" onClick={onReset}>
            New session
          </button>
        </div>
      </header>

      <p className="chat-shell-summary">{latestSummary}</p>

      <section className="conversation-section conversation-section--plain">
        <div className="timeline">
          {timeline.length === 0 ? (
            <div className="timeline-empty-state">
              <h3>Start the conversation</h3>
              <p>Describe the object you want to design.</p>
            </div>
          ) : null}

          {timeline.map((item) => (
            <article
              key={item.id}
              className={`timeline-card timeline-card--${item.kind} timeline-card--${item.role ?? "system"} ${toneClassName(item.tone)}`}
            >
              <div className="timeline-card-header">
                <div>
                  <p className="timeline-role">{presentTimelineTitle(item)}</p>
                  <time>{formatTimestamp(item.createdAt)}</time>
                </div>
                {item.complete === false ? <span className="live-indicator">live</span> : null}
              </div>
              <p>{item.body || (item.complete === false ? "..." : "")}</p>
            </article>
          ))}

          {workflow.pending_assumptions ? (
            <section className="chat-inline-card">
              <div className="chat-inline-card-header">
                <div>
                  <p className="summary-label">Ready For Confirmation</p>
                  <h3>Assumptions</h3>
                </div>
                <span className="status-pill status-pill--warning">{workflow.pending_assumptions.surface_units}</span>
              </div>
              <p className="card-muted">{workflow.pending_assumptions.intent_summary}</p>
              <ul className="bullet-list">
                {workflow.pending_assumptions.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
              {workflow.can_confirm_assumptions ? (
                <button type="button" className="secondary-button" onClick={onConfirmAssumptions} disabled={isSending}>
                  Confirm assumptions
                </button>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>

      <footer className="composer">
        <div className="status-row">
          <span className={isStreaming ? "status-live" : "status-idle"}>
            {isStreaming ? "Live stream connected" : "Live stream disconnected"}
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
            placeholder="Describe the object you want to design, how large it should be, and any must-have constraints."
            rows={4}
          />
          <button className="primary-button" type="submit" disabled={isSending || !draft.trim()}>
            {isSending ? "Working..." : "Send"}
          </button>
        </form>
      </footer>
    </section>
  );
}

function presentTimelineTitle(item: TimelineCard): string {
  if (item.role === "user") {
    return "You";
  }
  if (item.role === "assistant") {
    return "COCAD";
  }
  return item.title.replace(/_/g, " ");
}
