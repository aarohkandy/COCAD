import { useEffect, useReducer, useState } from "react";

import {
  claimInvite,
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
import { GateScreen } from "./components/GateScreen";
import { ModelViewer } from "./components/ModelViewer";
import { appReducer, initialState } from "./reducer";
import type { EventType, GateFormValues } from "./types";

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
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  useEffect(() => {
    const storedGate = readStoredGate();
    if (!storedGate) {
      dispatch({ type: "bootstrapComplete" });
      return;
    }

    hydrateSession(storedGate.sessionId)
      .then((snapshot) => dispatch({ type: "sessionLoaded", snapshot }))
      .catch(() => {
        clearStoredGate();
        dispatch({ type: "bootstrapComplete" });
      });
  }, []);

  useEffect(() => {
    if (!state.sessionId) {
      return;
    }

    const source = createEventSource(state.sessionId);

    const handleEvent = (rawEvent: Event) => {
      const event = rawEvent as MessageEvent<string>;
      dispatch({ type: "eventReceived", event: mapLiveEvent(event.data) });
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

  const handleSessionCreate = async (values: GateFormValues) => {
    dispatch({ type: "error", message: null });
    setIsCreatingSession(true);
    try {
      const claim = await claimInvite(values);
      const snapshot = await createSession(claim.claim_id);
      writeStoredGate({
        sessionId: snapshot.session_id,
        claimId: claim.claim_id,
        email: values.email,
        inviteCode: values.inviteCode,
      });
      dispatch({ type: "sessionLoaded", snapshot });
    } catch (error) {
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to start session",
      });
    } finally {
      setIsCreatingSession(false);
    }
  };

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
  };

  if (!state.bootstrapped) {
    return <main className="gate-shell">Loading session...</main>;
  }

  if (!state.sessionId) {
    return <GateScreen onSubmit={handleSessionCreate} disabled={isCreatingSession} error={state.error} />;
  }

  return (
    <main className="app-shell">
      <ChatPanel
        email={state.email}
        inviteCode={state.inviteCode}
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
