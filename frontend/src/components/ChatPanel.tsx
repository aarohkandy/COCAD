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
  const conversationCount = timeline.filter((item) => item.kind === "message").length;

  return (
    <section className="chat-panel">
      <header className="chat-hero">
        <div className="chat-hero-copy">
          <p className="eyebrow">COCAD / Conversation</p>
          <h1>Describe the object. We&apos;ll shape the details together.</h1>
          <p className="hero-copy">
            The agent only asks what it truly needs, locks assumptions, then builds into the live viewer one accepted revision at a time.
          </p>
        </div>
        <div className="session-meta">
          <span className={`status-pill ${isStreaming ? "status-pill--live" : "status-pill--warning"}`}>
            {isStreaming ? "stream connected" : "stream reconnecting"}
          </span>
          <span className="status-pill status-pill--ghost">{humanizeStage(workflow.stage)}</span>
          <button type="button" className="ghost-button" onClick={onReset}>
            New session
          </button>
        </div>
      </header>

      <section className="summary-card summary-card--hero">
        <div>
          <p className="summary-label">Build Pulse</p>
          <p className="summary-copy">{latestSummary}</p>
        </div>
        <div className="summary-stats">
          <div>
            <span>Stage</span>
            <strong>{humanizeStage(workflow.stage)}</strong>
          </div>
          <div>
            <span>Steps</span>
            <strong>{workflow.step_plan.length}</strong>
          </div>
        </div>
      </section>

      <div className="insight-grid">
        {workflow.pending_assumptions ? (
          <section className="panel-section panel-section--accent">
            <div className="card-row">
              <div>
                <p className="summary-label">Assumptions Waiting On You</p>
                <h3>Confirm the design frame</h3>
              </div>
              <span className="status-pill status-pill--warning">{workflow.pending_assumptions.surface_units}</span>
            </div>
            <p className="card-muted">{workflow.pending_assumptions.intent_summary}</p>
            <ul className="bullet-list">
              {workflow.pending_assumptions.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
            <div className="panel-actions">
              <span className="section-hint">Once confirmed, the step plan becomes the source of truth.</span>
              {workflow.can_confirm_assumptions ? (
                <button type="button" className="secondary-button" onClick={onConfirmAssumptions} disabled={isSending}>
                  Confirm assumptions
                </button>
              ) : null}
            </div>
          </section>
        ) : workflow.confirmed_assumptions ? (
          <section className="panel-section panel-section--confirmed">
            <div className="card-row">
              <div>
                <p className="summary-label">Locked Assumptions</p>
                <h3>Build frame confirmed</h3>
              </div>
              <span className="status-pill status-pill--live">{workflow.confirmed_assumptions.surface_units}</span>
            </div>
            <ul className="bullet-list">
              {workflow.confirmed_assumptions.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="panel-section panel-section--quiet">
            <p className="summary-label">Interview Status</p>
            <h3>Waiting for a clearer brief</h3>
            <p className="card-muted">
              Start with the object you want, then the agent will ask only for the geometry-critical details it cannot infer safely.
            </p>
          </section>
        )}

        <section className="panel-section panel-section--plan">
          <div className="card-row">
            <div>
              <p className="summary-label">Step Plan</p>
              <h3>Execution map</h3>
            </div>
            <span className="status-pill status-pill--ghost">{workflow.step_plan.length} steps</span>
          </div>
          {workflow.step_plan.length === 0 ? (
            <div className="step-empty-state">
              <span className="step-empty-index">01</span>
              <p>The plan appears after assumptions are confirmed, then each accepted step flows into the viewer.</p>
            </div>
          ) : (
            <div className="step-list">
              {workflow.step_plan.map((step, index) => (
                <article key={step.step_id} className={`step-item step-item--${step.status}`}>
                  <div className="step-item-marker">{String(index + 1).padStart(2, "0")}</div>
                  <div className="step-item-body">
                    <div className="step-item-header">
                      <div>
                        <p className="step-index">{step.step_id}</p>
                        <h4>{step.title}</h4>
                      </div>
                      <span className="step-status">{step.status.replace("_", " ")}</span>
                    </div>
                    <p className="card-muted">{step.description}</p>
                    {workflow.current_step_id === step.step_id ? <p className="step-current">Currently building</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="conversation-section">
        <div className="section-header">
          <div>
            <p className="summary-label">Conversation</p>
            <h3>Live design thread</h3>
          </div>
          <span className="section-hint">{conversationCount} messages</span>
        </div>
        <div className="timeline">
          {timeline.length === 0 ? (
            <div className="timeline-empty-state">
              <h3>Start the build</h3>
              <p>Describe anything you want to make and the conversation will begin here.</p>
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

function humanizeStage(stage: WorkflowSnapshot["stage"]): string {
  return stage.replace(/_/g, " ");
}
