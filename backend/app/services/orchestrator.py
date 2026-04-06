from __future__ import annotations

import asyncio
import contextlib
from copy import deepcopy
from uuid import uuid4

from app.domain.models import WorkflowState
from app.services.cad_service import CadService
from app.services.design_brain import DesignBrain
from app.services.design_engine import DesignEngine
from app.services.safety import SafetyService
from app.services.session_store import SessionStore


class WorkflowOrchestrator:
    def __init__(
        self,
        *,
        session_store: SessionStore,
        design_engine: DesignEngine,
        design_brain: DesignBrain,
        cad_service: CadService,
        safety_service: SafetyService,
    ) -> None:
        self._session_store = session_store
        self._design_engine = design_engine
        self._design_brain = design_brain
        self._cad_service = cad_service
        self._safety_service = safety_service

    async def handle_user_message(self, *, session_id: str, message_text: str) -> None:
        violation = self._safety_service.check(message_text)
        if violation:
            await self._session_store.append_event(
                session_id,
                "safety_refusal",
                {"messageId": f"msg-{uuid4().hex}", "message": violation},
            )
            await self._session_store.append_event(
                session_id,
                "progress_summary",
                {"summary": "Request blocked by the safety policy."},
            )
            return

        workflow = await self._session_store.get_workflow(session_id)
        if workflow is None:
            return

        if workflow.stage == "awaiting_confirmation" and self._design_engine.is_confirmation(message_text):
            await self.confirm_assumptions(session_id=session_id)
            return

        if workflow.stage in {"waiting_for_brief", "interviewing", "awaiting_confirmation"}:
            await self._handle_prebuild_message(session_id=session_id, workflow=workflow, message_text=message_text)
            return

        await self._handle_revision_message(session_id=session_id, workflow=workflow, message_text=message_text)

    async def confirm_assumptions(self, *, session_id: str) -> None:
        workflow = await self._session_store.get_workflow(session_id)
        if workflow is None or workflow.pending_assumptions is None:
            return

        workflow.confirmed_assumptions = workflow.pending_assumptions
        workflow.pending_assumptions = None
        workflow.stage = "planning"
        workflow.latest_summary = "Assumptions confirmed. Writing the build plan and starting the model."
        await self._session_store.save_workflow(session_id, workflow=workflow)
        await self._session_store.append_event(
            session_id,
            "assumptions_confirmed",
            {"assumptions": workflow.confirmed_assumptions.model_dump()},
        )
        await self._session_store.append_event(
            session_id,
            "progress_summary",
            {"summary": workflow.latest_summary},
        )
        await self._emit_assistant_message(
            session_id,
            "Assumptions confirmed. I'm publishing the step plan and building accepted revisions one step at a time.",
        )
        await self._build_from_workflow(session_id=session_id, workflow=workflow)

    async def _handle_prebuild_message(self, *, session_id: str, workflow: WorkflowState, message_text: str) -> None:
        workflow.brief_messages.append(message_text)
        spec, assumptions, question = await self._design_brain.analyze_brief(
            brief_messages=workflow.brief_messages,
            interview_rounds=workflow.interview_rounds,
        )
        workflow.draft_spec = spec
        workflow.design_kind = spec.kind

        if workflow.stage != "awaiting_confirmation" and question:
            workflow.stage = "interviewing"
            workflow.interview_rounds += 1
            workflow.latest_summary = "Collecting one required clarification before assumptions are locked."
            await self._session_store.save_workflow(session_id, workflow=workflow)
            await self._session_store.append_event(session_id, "interview_question", {"question": question})
            await self._session_store.append_event(
                session_id,
                "progress_summary",
                {"summary": workflow.latest_summary},
            )
            await self._emit_assistant_message(session_id, question)
            return

        workflow.pending_assumptions = assumptions
        workflow.stage = "awaiting_confirmation"
        workflow.latest_summary = "Assumptions are ready for confirmation."
        await self._session_store.save_workflow(session_id, workflow=workflow)
        await self._session_store.append_event(
            session_id,
            "assumptions_ready",
            {"assumptions": workflow.pending_assumptions.model_dump()},
        )
        await self._session_store.append_event(
            session_id,
            "assumption_confirmation_requested",
            {"assumptions": workflow.pending_assumptions.model_dump()},
        )
        await self._session_store.append_event(
            session_id,
            "progress_summary",
            {"summary": workflow.latest_summary},
        )
        await self._emit_assistant_message(session_id, self._assumption_message(workflow.pending_assumptions.assumptions))

    async def _handle_revision_message(self, *, session_id: str, workflow: WorkflowState, message_text: str) -> None:
        workflow.brief_messages.append(message_text)
        spec, assumptions, _ = await self._design_brain.analyze_brief(
            brief_messages=workflow.brief_messages,
            interview_rounds=workflow.interview_rounds,
        )
        workflow.draft_spec = spec
        workflow.design_kind = spec.kind
        workflow.confirmed_assumptions = assumptions
        workflow.pending_assumptions = None
        workflow.latest_summary = "Revision request received. Replanning and rebuilding from the updated brief."
        workflow.stage = "planning"
        await self._session_store.save_workflow(session_id, workflow=workflow)
        await self._session_store.append_event(
            session_id,
            "assumptions_confirmed",
            {"assumptions": workflow.confirmed_assumptions.model_dump()},
        )
        await self._session_store.append_event(
            session_id,
            "progress_summary",
            {"summary": workflow.latest_summary},
        )
        await self._emit_assistant_message(
            session_id,
            "I've absorbed that correction and I'm regenerating the plan from the updated source of truth.",
        )
        await self._build_from_workflow(session_id=session_id, workflow=workflow)

    async def _build_from_workflow(self, *, session_id: str, workflow: WorkflowState) -> None:
        spec = workflow.draft_spec
        assumptions = workflow.confirmed_assumptions
        if spec is None or assumptions is None:
            return

        step_plan, step_code = await self._design_brain.generate_plan(spec=spec, assumptions=assumptions)
        workflow.step_plan = step_plan
        workflow.step_code = step_code
        workflow.stage = "planning"
        workflow.current_step_id = None
        workflow.render_views = []
        workflow.mass_properties = None
        workflow.checker_report = None
        await self._session_store.save_workflow(session_id, workflow=workflow)
        await self._session_store.append_event(
            session_id,
            "step_plan_published",
            {"steps": [step.model_dump() for step in workflow.step_plan]},
        )
        await self._emit_assistant_message(
            session_id,
            f"Step plan published with {len(workflow.step_plan)} build steps. I'm executing and validating each accepted revision now.",
        )

        workflow.stage = "building"
        await self._session_store.save_workflow(session_id, workflow=workflow)
        state: dict = {"solid": None, "parts": {}}

        for index, step in enumerate(workflow.step_plan):
            for item in workflow.step_plan:
                if item.step_id == step.step_id:
                    item.status = "in_progress"
                elif item.status != "accepted":
                    item.status = "pending"
            workflow.current_step_id = step.step_id
            workflow.latest_summary = f"Executing {step.step_id}: {step.title}"
            await self._session_store.save_workflow(session_id, workflow=workflow)
            await self._session_store.append_event(session_id, "step_started", {"step": step.model_dump()})
            await self._session_store.append_event(
                session_id,
                "progress_summary",
                {"summary": workflow.latest_summary},
            )
            try:
                state = self._cad_service.execute_step(step.step_id, workflow.step_code[step.step_id], deepcopy(state))
                workflow.revision_number += 1
                artifacts = self._cad_service.export_revision(
                    session_id=session_id,
                    spec=spec,
                    state=state,
                    step_id=step.step_id,
                    revision_number=workflow.revision_number,
                    api_root=workflow.api_root,
                )
            except Exception as exc:  # noqa: BLE001
                step.status = "failed"
                workflow.stage = "blocked"
                workflow.latest_summary = f"{step.step_id} failed during execution."
                await self._session_store.save_workflow(session_id, workflow=workflow)
                await self._session_store.append_event(
                    session_id,
                    "step_execution_failed",
                    {"step": step.model_dump(), "error": str(exc)},
                )
                await self._session_store.append_event(
                    session_id,
                    "progress_summary",
                    {"summary": workflow.latest_summary},
                )
                await self._emit_assistant_message(session_id, f"{step.step_id} failed to execute cleanly: {exc}")
                return

            checker_report = await self._design_brain.audit_revision(
                spec=spec,
                assumptions=assumptions,
                step=step,
                step_code=workflow.step_code[step.step_id],
                render_files=artifacts.render_files,
                mass_properties=artifacts.mass_properties,
                interference_relevant=artifacts.interference_relevant,
                interference_detected=artifacts.interference_detected,
            )
            if not checker_report.passed:
                step.status = "failed"
                workflow.stage = "blocked"
                workflow.checker_report = checker_report
                workflow.latest_summary = f"{step.step_id} failed checker review and was not promoted."
                await self._session_store.save_workflow(session_id, workflow=workflow)
                await self._session_store.append_event(
                    session_id,
                    "step_checker_failed",
                    {
                        "step": step.model_dump(),
                        "summary": checker_report.summary,
                        "notes": checker_report.notes,
                    },
                )
                await self._session_store.append_event(
                    session_id,
                    "progress_summary",
                    {"summary": workflow.latest_summary},
                )
                await self._emit_assistant_message(
                    session_id,
                    f"{step.step_id} was rejected by the checker: {checker_report.summary}",
                )
                return

            step.status = "accepted"
            workflow.render_views = artifacts.render_views
            workflow.mass_properties = artifacts.mass_properties
            workflow.checker_report = checker_report
            workflow.current_revision_label = artifacts.revision_label
            workflow.current_model_url = artifacts.model_url
            workflow.downloads = artifacts.downloads
            workflow.latest_summary = f"Accepted {step.step_id}. Viewer and render bundle updated."
            await self._session_store.save_workflow(
                session_id,
                workflow=workflow,
                model_url=artifacts.model_url,
                downloads=artifacts.downloads,
            )
            await self._session_store.append_event(
                session_id,
                "step_accepted",
                {
                    "step": step.model_dump(),
                    "renderViews": [view.model_dump() for view in artifacts.render_views],
                    "massProperties": artifacts.mass_properties.model_dump(),
                    "checker": checker_report.model_dump(),
                    "revisionLabel": artifacts.revision_label,
                },
            )
            await self._session_store.append_event(
                session_id,
                "viewer_model_ready",
                {
                    "modelUrl": artifacts.model_url,
                    "label": f"Accepted revision after {step.step_id}",
                    "downloads": [download.model_dump() for download in artifacts.downloads],
                },
            )
            await self._session_store.append_event(
                session_id,
                "progress_summary",
                {"summary": workflow.latest_summary},
            )
            if index == len(workflow.step_plan) - 1:
                await self._session_store.append_event(
                    session_id,
                    "downloads_ready",
                    {"downloads": [download.model_dump() for download in artifacts.downloads]},
                )

        workflow.stage = "complete"
        workflow.latest_summary = "Build complete. The latest accepted revision is ready in the viewer and downloads."
        await self._session_store.save_workflow(
            session_id,
            workflow=workflow,
            model_url=workflow.current_model_url,
            downloads=workflow.downloads,
        )
        await self._session_store.append_event(
            session_id,
            "progress_summary",
            {"summary": workflow.latest_summary},
        )
        await self._emit_assistant_message(
            session_id,
            "Build complete. You can orbit the accepted revision, inspect the four renders, or ask for a revision and I'll regenerate from the updated brief.",
        )

    async def _emit_assistant_message(self, session_id: str, content: str) -> None:
        message = await self._session_store.add_assistant_message(session_id, content)
        if message is None:
            return
        await self._session_store.append_event(
            session_id,
            "chat_token",
            {
                "messageId": message.id,
                "role": "assistant",
                "delta": content,
                "complete": True,
            },
        )

    @staticmethod
    def _assumption_message(assumptions: list[str]) -> str:
        bullets = "\n".join(f"- {assumption}" for assumption in assumptions)
        return f"I've translated the brief into these working assumptions:\n{bullets}\n\nConfirm them and I'll publish the step plan."


async def run_session_task(*, session_store: SessionStore, session_id: str, task: asyncio.Task[None]) -> None:
    try:
        await task
    finally:
        with contextlib.suppress(Exception):
            await session_store.clear_active_task(session_id, task)
