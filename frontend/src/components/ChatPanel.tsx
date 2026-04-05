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
      <header className="panel-header">
        <div>
          <p className="eyebrow">CHAT</p>
          <h2>Design Conversation</h2>
        </div>
        <div className="session-meta">
          <span>Live workspace</span>
          <button type="button" className="ghost-button" onClick={onReset}>
            Reset
          </button>
        </div>
      </header>

      <section className="summary-card">
        <p className="summary-label">Run Summary</p>
        <p>{latestSummary}</p>
      </section>

      {workflow.pending_assumptions ? (
        <section className="panel-section">
          <div className="card-row">
            <h3>Pending Assumptions</h3>
            <span>{workflow.stage}</span>
          </div>
          <p className="card-muted">{workflow.pending_assumptions.intent_summary}</p>
          <ul className="bullet-list">
            {workflow.pending_assumptions.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
          <div className="panel-actions">
            <span className="section-hint">
              Surface units: {workflow.pending_assumptions.surface_units}
            </span>
            {workflow.can_confirm_assumptions ? (
              <button type="button" className="secondary-button" onClick={onConfirmAssumptions} disabled={isSending}>
                Confirm assumptions
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {workflow.confirmed_assumptions ? (
        <section className="panel-section">
          <div className="card-row">
            <h3>Confirmed Assumptions</h3>
            <span>{workflow.confirmed_assumptions.surface_units}</span>
          </div>
          <ul className="bullet-list">
            {workflow.confirmed_assumptions.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel-section">
        <div className="card-row">
          <h3>Step Plan</h3>
          <span>{workflow.step_plan.length} steps</span>
        </div>
        {workflow.step_plan.length === 0 ? (
          <p className="card-muted">The step plan will appear after assumptions are confirmed.</p>
        ) : (
          <div className="step-list">
            {workflow.step_plan.map((step) => (
              <article key={step.step_id} className={`step-item step-item--${step.status}`}>
                <div className="step-item-header">
                  <div>
                    <p className="step-index">{step.step_id}</p>
                    <h4>{step.title}</h4>
                  </div>
                  <span className="step-status">{step.status.replace("_", " ")}</span>
                </div>
                <p className="card-muted">{step.description}</p>
                {workflow.current_step_id === step.step_id ? <p className="step-current">Current step</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="timeline">
        {timeline.length === 0 ? (
          <div className="timeline-card timeline-card--neutral">
            <div className="timeline-card-header">
              <h3>Waiting for session events</h3>
            </div>
            <p>Create a session to begin the design flow.</p>
          </div>
        ) : null}

        {timeline.map((item) => (
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
            {isSending ? "Working..." : "Send"}
          </button>
        </form>
      </footer>
    </section>
  );
}
