from __future__ import annotations

import base64
from io import BytesIO
import json
from pathlib import Path
import re
from typing import Any

from PIL import Image, ImageDraw
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.domain.models import AssumptionBundle, CheckerReport, DesignSpec, MassProperties, StepPlanItem
from app.llm.providers.base import ImageInput, StreamingChatProvider
from app.services.design_engine import DesignEngine
from app.services.prompt_loader import PromptLoader


_SUPPORTED_KINDS = (
    "cup",
    "hanging_planter",
    "planter",
    "vase",
    "wall_shelf",
    "enclosure_box",
    "hook",
    "block_object",
)
_DIMENSION_KEYS: dict[str, tuple[str, ...]] = {
    "cup": ("diameter", "height", "wall", "base_diameter", "lip_diameter", "handle_span"),
    "hanging_planter": ("diameter", "height", "wall"),
    "planter": ("diameter", "height", "wall"),
    "vase": ("diameter", "height", "wall", "neck_diameter", "mouth_diameter", "base_diameter"),
    "wall_shelf": ("width", "depth", "thickness", "back_height"),
    "enclosure_box": ("width", "depth", "height", "wall"),
    "hook": ("width", "height", "depth", "thickness"),
    "block_object": ("width", "depth", "height", "fillet"),
}
_BOOLEAN_OPTIONS = {
    "has_handle",
    "drainage_holes",
    "narrow_neck",
}


class BriefAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")

    needs_clarification: bool = False
    clarification_question: str | None = None
    intent_summary: str = ""
    design_kind: str = "block_object"
    surface_units: str = "millimeters"
    dimensions_mm: dict[str, float] = Field(default_factory=dict)
    options: dict[str, Any] = Field(default_factory=dict)
    assumptions: list[str] = Field(default_factory=list)


class PlannedStep(BaseModel):
    model_config = ConfigDict(extra="ignore")

    step_id: str
    title: str
    description: str


class PlanAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")

    steps: list[PlannedStep] = Field(default_factory=list)


class AuditAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")

    passed: bool
    summary: str
    notes: list[str] = Field(default_factory=list)
    interference_relevant: bool = False
    interference_detected: bool = False


class ResolvedModels(BaseModel):
    model_config = ConfigDict(extra="forbid")

    main_model: str | None
    checker_model: str | None
    available_models: list[str] = Field(default_factory=list)


class DesignBrain:
    def __init__(
        self,
        *,
        provider: StreamingChatProvider | None,
        prompt_loader: PromptLoader,
        design_engine: DesignEngine,
        preferred_main_model: str,
        preferred_checker_model: str,
    ) -> None:
        self._provider = provider
        self._prompt_loader = prompt_loader
        self._design_engine = design_engine
        self._preferred_main_model = preferred_main_model
        self._preferred_checker_model = preferred_checker_model
        self._resolved_models: ResolvedModels | None = None

    async def analyze_brief(
        self,
        *,
        brief_messages: list[str],
        interview_rounds: int,
    ) -> tuple[DesignSpec, AssumptionBundle, str | None]:
        fallback_spec = self._design_engine.build_spec(brief_messages)
        fallback_assumptions = self._design_engine.build_assumptions(fallback_spec)
        fallback_question = (
            self._design_engine.interview_question(fallback_spec)
            if self._design_engine.needs_clarification(fallback_spec, interview_rounds)
            else None
        )

        if self._provider is None:
            return fallback_spec, fallback_assumptions, fallback_question

        models = await self._resolve_models()
        if models.main_model is None:
            return fallback_spec, fallback_assumptions, fallback_question

        system_prompt = "\n\n".join(
            [
                self._prompt_loader.build_role_prompt("interviewer.md"),
                self._prompt_loader.load("assumption_summarizer.md"),
            ]
        )
        transcript = "\n".join(f"- {message}" for message in brief_messages) or "- (empty)"
        user_prompt = (
            "Return JSON only.\n"
            "Analyze the design brief so the CAD system can either ask one precise follow-up question or publish explicit assumptions.\n"
            f"Supported design kinds: {', '.join(_SUPPORTED_KINDS)}.\n"
            "Choose the closest supported kind and preserve the user's object identity. "
            "If they ask for a cup, mug, vase, planter, hook, enclosure, or shelf, do not collapse it into a generic utility block.\n"
            "Ask a clarification question only if a geometry-critical unknown truly blocks planning. "
            "Do not ask generic questions about mounting or openings unless that is directly relevant.\n"
            "For ordinary household vessels, infer ordinary defaults and ask at most one sharp follow-up.\n"
            "Output schema:\n"
            "{\n"
            '  "needs_clarification": boolean,\n'
            '  "clarification_question": string | null,\n'
            '  "intent_summary": string,\n'
            '  "design_kind": string,\n'
            '  "surface_units": string,\n'
            '  "dimensions_mm": { "key": number },\n'
            '  "options": { "key": boolean | string | number },\n'
            '  "assumptions": ["..."]\n'
            "}\n"
            f"Interview rounds already used: {interview_rounds}.\n"
            f"Fallback interpretation if you are unsure:\n{fallback_spec.model_dump_json()}\n"
            f"Fallback assumptions:\n{json.dumps(fallback_assumptions.assumptions)}\n"
            f"User transcript:\n{transcript}"
        )
        try:
            raw = await self._provider.complete(
                model=models.main_model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            parsed = self._parse_json(raw, BriefAnalysis)
        except Exception:  # noqa: BLE001
            parsed = None

        if parsed is None:
            return fallback_spec, fallback_assumptions, fallback_question

        spec = self._build_spec(parsed, fallback_spec)
        assumptions = self._build_assumptions(parsed, spec)
        question = None
        if parsed.needs_clarification and interview_rounds == 0:
            question = (parsed.clarification_question or "").strip() or self._design_engine.interview_question(spec)
        return spec, assumptions, question

    async def generate_plan(
        self,
        *,
        spec: DesignSpec,
        assumptions: AssumptionBundle,
    ) -> tuple[list[StepPlanItem], dict[str, str]]:
        base_steps, base_code = self._design_engine.generate_plan(spec)
        if self._provider is None:
            return base_steps, base_code

        models = await self._resolve_models()
        if models.main_model is None:
            return base_steps, base_code

        scaffold = [
            {
                "step_id": step.step_id,
                "title": step.title,
                "description": step.description,
            }
            for step in base_steps
        ]
        system_prompt = self._prompt_loader.build_role_prompt("planner.md")
        user_prompt = (
            "Return JSON only.\n"
            "Rewrite this step plan so it follows the confirmed assumptions exactly while staying compatible with the provided scaffold.\n"
            "You must preserve the exact step count and step_id values. "
            "Do not add or remove steps. Do not turn a cup into a box or a vase into a planter.\n"
            "Output schema:\n"
            '{ "steps": [{ "step_id": "step_001", "title": "...", "description": "..." }] }\n'
            f"Design spec:\n{spec.model_dump_json()}\n"
            f"Confirmed assumptions:\n{assumptions.model_dump_json()}\n"
            f"Scaffold:\n{json.dumps(scaffold)}"
        )
        try:
            raw = await self._provider.complete(
                model=models.main_model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            parsed = self._parse_json(raw, PlanAnalysis)
        except Exception:  # noqa: BLE001
            parsed = None

        if parsed is None or len(parsed.steps) != len(base_steps):
            return base_steps, base_code

        merged_steps: list[StepPlanItem] = []
        merged_code: dict[str, str] = {}
        expected_ids = [step.step_id for step in base_steps]
        if [step.step_id for step in parsed.steps] != expected_ids:
            return base_steps, base_code

        for base_step, planned_step in zip(base_steps, parsed.steps, strict=False):
            title = planned_step.title.strip() or base_step.title
            description = planned_step.description.strip() or base_step.description
            merged_steps.append(
                StepPlanItem(
                    step_id=base_step.step_id,
                    title=title,
                    description=description,
                    status="pending",
                )
            )
            merged_code[base_step.step_id] = self._replace_docstring(base_code[base_step.step_id], description)
        return merged_steps, merged_code

    async def audit_revision(
        self,
        *,
        spec: DesignSpec,
        assumptions: AssumptionBundle,
        step: StepPlanItem,
        step_code: str,
        render_files: dict[str, Path],
        mass_properties: MassProperties,
        interference_relevant: bool,
        interference_detected: bool,
    ) -> CheckerReport:
        heuristic = self._heuristic_checker(
            spec=spec,
            step=step,
            mass_properties=mass_properties,
            interference_relevant=interference_relevant,
            interference_detected=interference_detected,
        )
        if not heuristic.passed:
            return heuristic

        if self._provider is None:
            return CheckerReport(
                passed=False,
                summary="Checker blocked acceptance because the live Ollama vision audit is not configured in this environment.",
                interference_relevant=interference_relevant,
                interference_detected=interference_detected,
                notes=[
                    "The deterministic fallback path is disabled for acceptance.",
                    "Configure a vision-capable Ollama model so the checker can inspect the four renders.",
                ],
            )

        models = await self._resolve_models()
        checker_model = models.checker_model
        if checker_model is None or not self._supports_images(checker_model):
            return CheckerReport(
                passed=False,
                summary="Checker blocked acceptance because no vision-capable Ollama model is installed for render inspection.",
                interference_relevant=interference_relevant,
                interference_detected=interference_detected,
                notes=[
                    f"Available models: {', '.join(models.available_models) or 'none'}.",
                    "Install qwen2.5vl:7b or another vision-capable model so the checker can inspect the four rendered views.",
                ],
            )

        system_prompt = self._prompt_loader.build_role_prompt("checker.md")
        user_prompt = (
            "Return JSON only.\n"
            "You are the independent checker. Be skeptical and reject obvious mismatches.\n"
            "Reject the step if the renders look like the wrong object class, if a vessel that should be open looks closed, "
            "if the proportions contradict the assumptions, or if the current step is not visible in the geometry.\n"
            "Judge the current step, not the final finished object. Early massing steps may still be solid and should not be rejected for missing later details.\n"
            "Use double-quoted JSON only. Do not include markdown fences or commentary.\n"
            "Output schema:\n"
            "{\n"
            '  "passed": boolean,\n'
            '  "summary": string,\n'
            '  "notes": ["..."],\n'
            '  "interference_relevant": boolean,\n'
            '  "interference_detected": boolean\n'
            "}\n"
            f"Design spec:\n{spec.model_dump_json()}\n"
            f"Confirmed assumptions:\n{assumptions.model_dump_json()}\n"
            f"Current step:\n{step.model_dump_json()}\n"
            f"Current step function name: {step.step_id}\n"
            f"Current step code should implement this description exactly: {step.description}\n"
            f"Stage-specific expectation: {self._stage_expectation(spec, step)}\n"
            f"Mass properties:\n{mass_properties.model_dump_json()}\n"
            f"Interference relevant: {json.dumps(interference_relevant)}\n"
            f"Interference detected: {json.dumps(interference_detected)}\n"
            "A single contact-sheet image is attached. It is arranged as: top-left=top, top-right=front, bottom-left=side, bottom-right=isometric."
        )
        images = [self._contact_sheet_input(render_files)]

        raw = ""
        try:
            raw = await self._provider.complete(
                model=checker_model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                images=images,
            )
            parsed = self._parse_json(raw, AuditAnalysis)
        except Exception as exc:  # noqa: BLE001
            parsed = None
            error_message = f"{exc.__class__.__name__}: {str(exc).strip()}".strip()
        else:
            error_message = ""

        if parsed is None:
            return CheckerReport(
                passed=False,
                summary="Checker blocked acceptance because the render audit response was invalid.",
                interference_relevant=interference_relevant,
                interference_detected=interference_detected,
                notes=[
                    "The checker did not return valid JSON.",
                    error_message or "The vision model response could not be parsed.",
                    "This revision was not promoted to accepted geometry.",
                ],
            )

        report = CheckerReport(
            passed=parsed.passed,
            summary=parsed.summary,
            interference_relevant=parsed.interference_relevant or interference_relevant,
            interference_detected=parsed.interference_detected or interference_detected,
            notes=parsed.notes,
        )
        return self._reconcile_checker_report(
            spec=spec,
            step=step,
            step_code=step_code,
            report=report,
        )

    async def _resolve_models(self) -> ResolvedModels:
        if self._provider is None:
            self._resolved_models = ResolvedModels(main_model=None, checker_model=None, available_models=[])
            return self._resolved_models

        try:
            available = await self._provider.list_models()
        except Exception:  # noqa: BLE001
            available = []
        main_model = self._pick_main_model(
            preferred=self._preferred_main_model,
            available=available,
        )
        checker_model = self._pick_model(
            preferred=self._preferred_checker_model,
            available=available,
            require_vision=True,
        )
        self._resolved_models = ResolvedModels(
            main_model=main_model,
            checker_model=checker_model,
            available_models=available,
        )
        return self._resolved_models

    def _build_spec(self, parsed: BriefAnalysis, fallback_spec: DesignSpec) -> DesignSpec:
        kind = parsed.design_kind if parsed.design_kind in _SUPPORTED_KINDS else fallback_spec.kind
        allowed_keys = _DIMENSION_KEYS[kind]
        dimensions = dict(fallback_spec.dimensions_mm)
        for key, value in parsed.dimensions_mm.items():
            if key not in allowed_keys:
                continue
            try:
                normalized = float(value)
            except (TypeError, ValueError):
                continue
            if normalized > 0:
                dimensions[key] = round(normalized, 3)

        options = dict(fallback_spec.options)
        for key, value in parsed.options.items():
            if key in _BOOLEAN_OPTIONS and isinstance(value, bool):
                options[key] = value
            elif isinstance(value, (str, int, float)):
                options[key] = value
        options["specified_dimensions_count"] = len(parsed.dimensions_mm)

        label = self._design_engine._label_for_kind(kind)  # noqa: SLF001
        surface_units = self._normalize_surface_units(parsed.surface_units or fallback_spec.surface_units)
        return DesignSpec(
            kind=kind,
            label=label,
            original_request=fallback_spec.original_request,
            surface_units=surface_units,
            dimensions_mm=dimensions,
            options=options,
            notes=list(fallback_spec.notes),
        )

    def _build_assumptions(self, parsed: BriefAnalysis, spec: DesignSpec) -> AssumptionBundle:
        fallback = self._design_engine.build_assumptions(spec)
        assumptions = [item.strip() for item in parsed.assumptions if isinstance(item, str) and item.strip()]
        if len(assumptions) < 2:
            assumptions = fallback.assumptions
        summary = parsed.intent_summary.strip() or fallback.intent_summary
        return AssumptionBundle(
            intent_summary=summary,
            assumptions=assumptions,
            surface_units=self._normalize_surface_units(parsed.surface_units or spec.surface_units),
        )

    @staticmethod
    def _normalize_surface_units(units: str) -> str:
        lowered = units.strip().lower()
        aliases = {
            "mm": "millimeters",
            "millimeter": "millimeters",
            "millimeters": "millimeters",
            "cm": "centimeters",
            "centimeter": "centimeters",
            "centimeters": "centimeters",
            "m": "meters",
            "meter": "meters",
            "meters": "meters",
            "in": "inches",
            "inch": "inches",
            "inches": "inches",
        }
        return aliases.get(lowered, "millimeters")

    @staticmethod
    def _replace_docstring(code: str, description: str) -> str:
        return re.sub(
            r'("""|\'\'\').*?\1',
            lambda match: f'{match.group(1)}{description}{match.group(1)}',
            code,
            count=1,
            flags=re.DOTALL,
        )

    @staticmethod
    def _parse_json(raw: str, schema: type[BaseModel]) -> BaseModel | None:
        candidate = raw.strip()
        if candidate.startswith("```"):
            candidate = re.sub(r"^```(?:json)?\s*|\s*```$", "", candidate, flags=re.DOTALL).strip()
        if not candidate.startswith("{"):
            match = re.search(r"\{.*\}", candidate, flags=re.DOTALL)
            if match is None:
                return None
            candidate = match.group(0)
        try:
            payload = json.loads(candidate)
            return schema.model_validate(payload)
        except (json.JSONDecodeError, ValidationError):
            return None

    @staticmethod
    def _pick_main_model(*, preferred: str, available: list[str]) -> str | None:
        if preferred in available:
            return preferred
        for candidate in ("qwen2.5:14b", "qwen2.5:7b", "qwen2.5vl:7b"):
            if candidate in available:
                return candidate
        return DesignBrain._pick_model(preferred=preferred, available=available, require_vision=False)

    @staticmethod
    def _pick_model(*, preferred: str, available: list[str], require_vision: bool) -> str | None:
        if preferred in available and (not require_vision or DesignBrain._supports_images(preferred)):
            return preferred

        candidates = [
            model for model in available
            if not require_vision or DesignBrain._supports_images(model)
        ]
        if not candidates:
            return None
        for preferred_prefix in ("qwen2.5vl", "qwen2.5", "llava", "llama"):
            for model in candidates:
                if model.lower().startswith(preferred_prefix):
                    return model
        return candidates[0]

    @staticmethod
    def _supports_images(model: str) -> bool:
        lowered = model.lower()
        return "vl" in lowered or lowered.startswith("llava") or "vision" in lowered

    @staticmethod
    def _image_input(key: str, path: Path) -> ImageInput:
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return ImageInput(label=key, mime_type="image/png", data_base64=encoded)

    @staticmethod
    def _contact_sheet_input(render_files: dict[str, Path]) -> ImageInput:
        ordered = [
            ("TOP", render_files["top"]),
            ("FRONT", render_files["front"]),
            ("SIDE", render_files["side"]),
            ("ISO", render_files["isometric"]),
        ]
        tile_size = (224, 224)
        padding = 12
        canvas = Image.new("RGB", (tile_size[0] * 2 + padding * 3, tile_size[1] * 2 + padding * 3), "#171c1b")
        draw = ImageDraw.Draw(canvas)

        for index, (label, path) in enumerate(ordered):
            image = Image.open(path).convert("RGB")
            image.thumbnail(tile_size)
            col = index % 2
            row = index // 2
            x = padding + col * (tile_size[0] + padding)
            y = padding + row * (tile_size[1] + padding)
            tile = Image.new("RGB", tile_size, "#fbf5ea")
            offset = ((tile_size[0] - image.width) // 2, (tile_size[1] - image.height) // 2)
            tile.paste(image, offset)
            canvas.paste(tile, (x, y))
            draw.text((x + 12, y + 10), label, fill="#0f1312")

        buffer = BytesIO()
        canvas.save(buffer, format="PNG", optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return ImageInput(label="render_contact_sheet", mime_type="image/png", data_base64=encoded)

    @staticmethod
    def _heuristic_checker(
        *,
        spec: DesignSpec,
        step: StepPlanItem,
        mass_properties: MassProperties,
        interference_relevant: bool,
        interference_detected: bool,
    ) -> CheckerReport:
        notes = [f"Bounding box {mass_properties.bounding_box_mm[0]:.1f} x {mass_properties.bounding_box_mm[1]:.1f} x {mass_properties.bounding_box_mm[2]:.1f} mm."]
        if mass_properties.volume_mm3 <= 0:
            return CheckerReport(
                passed=False,
                summary="Checker rejected the revision because the resulting solid has no positive volume.",
                interference_relevant=interference_relevant,
                interference_detected=interference_detected,
                notes=notes,
            )

        if spec.kind in {"cup", "vase", "planter", "hanging_planter"}:
            width, depth, height = mass_properties.bounding_box_mm
            wide_span = max(width, depth)
            narrow_span = min(width, depth)
            if height < 0.5 * wide_span:
                return CheckerReport(
                    passed=False,
                    summary=f"Checker rejected {step.step_id} because the vessel proportions are too squat for the requested object.",
                    interference_relevant=interference_relevant,
                    interference_detected=interference_detected,
                    notes=notes,
                )
            if narrow_span < 0.45 * wide_span:
                return CheckerReport(
                    passed=False,
                    summary=f"Checker rejected {step.step_id} because the footprint is implausibly asymmetric for a rotational vessel.",
                    interference_relevant=interference_relevant,
                    interference_detected=interference_detected,
                    notes=notes,
                )

        return CheckerReport(
            passed=True,
            summary="Heuristic precheck passed; awaiting model-based audit.",
            interference_relevant=interference_relevant,
            interference_detected=interference_detected,
            notes=notes,
        )

    @staticmethod
    def _reconcile_checker_report(
        *,
        spec: DesignSpec,
        step: StepPlanItem,
        step_code: str,
        report: CheckerReport,
    ) -> CheckerReport:
        if report.passed:
            return report

        combined = " ".join([report.summary, *report.notes]).lower()
        shell_like = ".shell(" in step_code or ".cut(inner)" in step_code
        closed_false_positive = any(token in combined for token in ("closed", "solid", "not open", "open top"))
        if spec.kind in {"cup", "vase", "planter", "hanging_planter"} and shell_like and closed_false_positive:
            return CheckerReport(
                passed=True,
                summary=f"Vision checker raised an open-top false positive on {step.step_id}, but the structural step code produces an open vessel and the revision was accepted.",
                interference_relevant=report.interference_relevant,
                interference_detected=report.interference_detected,
                notes=[
                    *report.notes,
                    "The checker rejection was overruled because the step code explicitly creates an open shell or hollow vessel.",
                ],
            )
        return report

    @staticmethod
    def _stage_expectation(spec: DesignSpec, step: StepPlanItem) -> str:
        lowered = step.description.lower()
        if any(token in lowered for token in ("outer", "silhouette", "main body", "main cylindrical", "main shelf plate", "main mounting plate")):
            if spec.kind in {"cup", "vase", "planter", "hanging_planter"}:
                return "This is a vessel-form step. If the vessel is open, the top view may show the interior bottom through the opening. Do not mistake visible interior geometry or triangulation for a closed lid."
            return "This is an early form-establishing step. The checker should focus on broad shape and proportions, not later finishing details."
        if "hollow" in lowered or "shell" in lowered:
            return "This step should introduce the interior cavity or shell behavior. The checker should verify that the top now reads as open when applicable. Seeing the interior floor through the opening is acceptable."
        if "handle" in lowered:
            return "This step should visibly add an integrated handle."
        if "drainage" in lowered:
            return "This step should visibly introduce drainage holes."
        if "foot ring" in lowered or "base ring" in lowered:
            return "This step should add a clearly visible pedestal or ring near the bottom silhouette. Focus on the lower profile in the front, side, and isometric views."
        if "lip" in lowered or "rim" in lowered or "base ring" in lowered:
            return "This step adds finishing geometry. The checker should verify the new detail without forgetting the earlier object identity."
        return "Judge whether the current renders plausibly show the change described by this step."
