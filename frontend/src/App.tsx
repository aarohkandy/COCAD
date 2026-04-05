import { useEffect, useReducer, useRef, useState } from "react";

import {
  clearStoredGate,
  confirmAssumptions,
  createEventSource,
  createSession,
  hydrateSession,
  mapLiveEvent,
  postMessage,
  readStoredGate,
  writeStoredGate,
} from "./api";
import { ChatPanel } from "./components/ChatPanel";
import { ModelViewer } from "./components/ModelViewer";
import { appReducer, initialState } from "./reducer";
import type { EventType } from "./types";

const EVENT_TYPES: EventType[] = [
  "chat_token",
  "interview_question",
  "assumptions_ready",
  "assumption_confirmation_requested",
  "assumptions_confirmed",
  "step_plan_published",
  "step_started",
  "step_execution_failed",
  "step_checker_failed",
  "step_accepted",
  "viewer_model_ready",
  "progress_summary",
  "downloads_ready",
  "run_cancelled",
  "safety_refusal",
];

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isBootstrappingSession, setIsBootstrappingSession] = useState(false);
  const lastEventIdRef = useRef<string | null>(null);

  const bootstrapSession = async () => {
    dispatch({ type: "error", message: null });
    setIsBootstrappingSession(true);
    try {
      const snapshot = await createSession();
      lastEventIdRef.current = snapshot.events.at(-1)?.id ?? null;
      writeStoredGate({
        sessionId: snapshot.session_id,
        claimId: "",
        email: snapshot.email,
        inviteCode: snapshot.invite_code,
      });
      dispatch({ type: "sessionLoaded", snapshot });
    } catch (error) {
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to start session",
      });
      dispatch({ type: "bootstrapComplete" });
    } finally {
      setIsBootstrappingSession(false);
    }
  };

  useEffect(() => {
    const storedGate = readStoredGate();
    if (!storedGate) {
      void bootstrapSession();
      return;
    }

    hydrateSession(storedGate.sessionId)
      .then((snapshot) => {
        lastEventIdRef.current = snapshot.events.at(-1)?.id ?? null;
        dispatch({ type: "sessionLoaded", snapshot });
      })
      .catch(() => {
        clearStoredGate();
        void bootstrapSession();
      });
  }, []);

  useEffect(() => {
    if (!state.sessionId) {
      return;
    }

    const source = createEventSource(state.sessionId, lastEventIdRef.current);

    const handleEvent = (rawEvent: Event) => {
      const event = rawEvent as MessageEvent<string>;
      const parsed = mapLiveEvent(event.data);
      lastEventIdRef.current = parsed.id;
      dispatch({ type: "eventReceived", event: parsed });
    };

    EVENT_TYPES.forEach((eventType) => source.addEventListener(eventType, handleEvent));
    source.onopen = () => dispatch({ type: "streamOpen" });
    source.onerror = () => dispatch({ type: "streamClosed" });

    return () => {
      EVENT_TYPES.forEach((eventType) => source.removeEventListener(eventType, handleEvent));
      source.close();
      dispatch({ type: "streamClosed" });
    };
  }, [state.sessionId]);

  const handleSend = async (message: string) => {
    if (!state.sessionId) {
      return;
    }

    dispatch({ type: "sendStarted" });
    try {
      await postMessage(state.sessionId, message);
    } catch (error) {
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send message",
      });
      dispatch({ type: "sendFinished" });
    }
  };

  const handleConfirmAssumptions = async () => {
    if (!state.sessionId) {
      return;
    }

    dispatch({ type: "sendStarted" });
    try {
      await confirmAssumptions(state.sessionId);
    } catch (error) {
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to confirm assumptions",
      });
      dispatch({ type: "sendFinished" });
    }
  };

  const handleReset = () => {
    clearStoredGate();
    dispatch({ type: "reset" });
    void bootstrapSession();
  };

  if (!state.bootstrapped || !state.sessionId) {
    return (
      <main className="gate-shell">
        {isBootstrappingSession ? "Opening workspace..." : state.error ?? "Loading session..."}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <ChatPanel
        latestSummary={state.latestSummary}
        workflow={state.workflow}
        timeline={state.timeline}
        isStreaming={state.isStreaming}
        isSending={state.isSending}
        error={state.error}
        onSend={handleSend}
        onConfirmAssumptions={handleConfirmAssumptions}
        onReset={handleReset}
      />
      <ModelViewer
        modelUrl={state.modelUrl}
        downloads={state.downloads}
        renderViews={state.workflow.render_views}
        massProperties={state.workflow.mass_properties}
        checkerReport={state.workflow.checker_report}
        currentRevisionLabel={state.workflow.current_revision_label}
      />
    </main>
  );
}

export default App;
