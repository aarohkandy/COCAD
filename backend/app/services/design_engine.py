from __future__ import annotations

import re
from typing import Any

from app.domain.models import AssumptionBundle, DesignSpec, StepPlanItem


_UNIT_TO_MM = {
    "mm": 1.0,
    "millimeter": 1.0,
    "millimeters": 1.0,
    "cm": 10.0,
    "centimeter": 10.0,
    "centimeters": 10.0,
    "m": 1000.0,
    "meter": 1000.0,
    "meters": 1000.0,
    "in": 25.4,
    "inch": 25.4,
    "inches": 25.4,
    "\"": 25.4,
}


class DesignEngine:
    def build_spec(self, brief_messages: list[str]) -> DesignSpec:
        combined = " ".join(brief_messages).strip()
        combined_lower = combined.lower()
        kind = self._detect_kind(combined_lower)
        parsed = self._parse_dimensions(brief_messages)
        dimensions_mm = {**self._default_dimensions(kind), **parsed["values"]}
        options = self._default_options(kind, combined_lower)
        options["specified_dimensions_count"] = len(parsed["values"])
        return DesignSpec(
            kind=kind,
            label=self._label_for_kind(kind),
            original_request=combined,
            surface_units=parsed["surface_units"] or "millimeters",
            dimensions_mm=dimensions_mm,
            options=options,
            notes=[],
        )

    def needs_clarification(self, spec: DesignSpec, interview_rounds: int) -> bool:
        if interview_rounds > 0:
            return False
        if spec.kind == "block_object":
            return True
        return int(spec.options.get("specified_dimensions_count", 0)) == 0

    def interview_question(self, spec: DesignSpec) -> str:
        prompts = {
            "hanging_planter": "What overall diameter and height should the hanging planter use, and do you want drainage holes?",
            "planter": "What overall diameter and height should the planter use, and do you want drainage holes?",
            "wall_shelf": "What width and depth should the shelf use, and is it light-duty or something more structural?",
            "enclosure_box": "What overall width, depth, and height should the enclosure use, and do you need any cable openings?",
            "hook": "What should the hook mount to, and roughly how deep or tall should it be?",
            "block_object": "What overall size should I target, and are there any obvious openings or mounting constraints?",
        }
        return prompts[spec.kind]

    def build_assumptions(self, spec: DesignSpec) -> AssumptionBundle:
        dims = spec.dimensions_mm
        assumptions: list[str]
        if spec.kind in {"hanging_planter", "planter"}:
            assumptions = [
                f"Use a cylindrical planter body about {dims['diameter']:.0f} mm in diameter and {dims['height']:.0f} mm tall.",
                "Use a 5 mm wall thickness and a single printable solid.",
                "Include drainage holes." if spec.options.get("drainage_holes", True) else "Skip drainage holes.",
            ]
            if spec.kind == "hanging_planter":
                assumptions.append("Add three equidistant hanging lugs near the rim.")
        elif spec.kind == "wall_shelf":
            assumptions = [
                f"Use a shelf plate about {dims['width']:.0f} mm wide and {dims['depth']:.0f} mm deep.",
                "Use an integrated back plate and underside ribs so the part stays a single solid.",
                "Include mounting holes on the back plate.",
            ]
        elif spec.kind == "enclosure_box":
            assumptions = [
                f"Use an enclosure roughly {dims['width']:.0f} x {dims['depth']:.0f} x {dims['height']:.0f} mm.",
                "Use a hollow shell with printable wall thickness.",
                "Add a subtle opening and lid-lip detail so the enclosure reads clearly in the MVP slice.",
            ]
        elif spec.kind == "hook":
            assumptions = [
                f"Use a mounting plate around {dims['height']:.0f} mm tall with an integrated hook arm about {dims['depth']:.0f} mm deep.",
                "Keep the geometry as one printable solid with mounting holes.",
                "Round the high-contact edges so the hook feels intentional instead of blocky.",
            ]
        else:
            assumptions = [
                f"Start from a compact solid around {dims['width']:.0f} x {dims['depth']:.0f} x {dims['height']:.0f} mm.",
                "Keep the MVP geometry to a single printable solid.",
                "Use rounded edges and one secondary feature so the result is more than a plain box.",
            ]
        return AssumptionBundle(
            intent_summary=f"Design a {spec.label.lower()} based on the current brief.",
            assumptions=assumptions,
            surface_units=spec.surface_units,
        )

    def generate_plan(self, spec: DesignSpec) -> tuple[list[StepPlanItem], dict[str, str]]:
        generators = {
            "hanging_planter": self._plan_hanging_planter,
            "planter": self._plan_planter,
            "wall_shelf": self._plan_wall_shelf,
            "enclosure_box": self._plan_enclosure_box,
            "hook": self._plan_hook,
            "block_object": self._plan_block_object,
        }
        return generators[spec.kind](spec)

    @staticmethod
    def is_confirmation(message: str) -> bool:
        return message.strip().lower() in {
            "yes",
            "y",
            "confirm",
            "confirmed",
            "looks good",
            "sounds good",
            "go ahead",
            "start building",
            "build it",
        }

    @staticmethod
    def is_correction(message: str) -> bool:
        lowered = message.lower()
        return any(
            token in lowered
            for token in ("make it", "change", "adjust", "instead", "add", "remove", "taller", "shorter", "wider", "deeper")
        )

    def _detect_kind(self, text: str) -> str:
        if any(keyword in text for keyword in ("planter", "flower pot", "pot")) and "hang" in text:
            return "hanging_planter"
        if any(keyword in text for keyword in ("planter", "flower pot", "pot")):
            return "planter"
        if any(keyword in text for keyword in ("shelf", "bracket")):
            return "wall_shelf"
        if any(keyword in text for keyword in ("enclosure", "case", "box")):
            return "enclosure_box"
        if any(keyword in text for keyword in ("hook", "hanger")):
            return "hook"
        return "block_object"

    def _label_for_kind(self, kind: str) -> str:
        return {
            "hanging_planter": "Hanging Planter",
            "planter": "Planter",
            "wall_shelf": "Wall Shelf",
            "enclosure_box": "Enclosure Box",
            "hook": "Hook",
            "block_object": "Utility Object",
        }[kind]

    def _default_dimensions(self, kind: str) -> dict[str, float]:
        return {
            "hanging_planter": {"diameter": 200.0, "height": 160.0, "wall": 5.0},
            "planter": {"diameter": 180.0, "height": 150.0, "wall": 5.0},
            "wall_shelf": {"width": 320.0, "depth": 180.0, "thickness": 18.0, "back_height": 120.0},
            "enclosure_box": {"width": 180.0, "depth": 120.0, "height": 80.0, "wall": 4.0},
            "hook": {"width": 70.0, "height": 120.0, "depth": 60.0, "thickness": 12.0},
            "block_object": {"width": 120.0, "depth": 80.0, "height": 60.0, "fillet": 6.0},
        }[kind]

    def _default_options(self, kind: str, text: str) -> dict[str, Any]:
        options: dict[str, Any] = {}
        if kind in {"planter", "hanging_planter"}:
            options["drainage_holes"] = "no drainage" not in text and "without drainage" not in text
        return options

    def _parse_dimensions(self, messages: list[str]) -> dict[str, Any]:
        combined = " ".join(messages)
        surface_units = "millimeters"
        pattern = re.compile(
            r"(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>mm|millimeters?|cm|centimeters?|m|meters?|in|inch|inches|\")",
            re.IGNORECASE,
        )
        measurements: list[tuple[float, str]] = []
        for match in pattern.finditer(combined):
            unit = match.group("unit").lower()
            measurements.append((float(match.group("value")) * _UNIT_TO_MM[unit], unit))
        if measurements:
            first_unit = measurements[0][1]
            surface_units = "inches" if first_unit in {"in", "inch", "inches", "\""} else first_unit
        ordered = [entry[0] for entry in measurements]
        values: dict[str, float] = {}
        if ordered:
            values["width"] = ordered[0]
            values["diameter"] = ordered[0]
        if len(ordered) > 1:
            values["depth"] = ordered[1]
            values["height"] = ordered[1]
        if len(ordered) > 2:
            values["height"] = ordered[2]
        return {"values": values, "surface_units": surface_units}

    @staticmethod
    def _step(step_id: str, description: str) -> StepPlanItem:
        return StepPlanItem(step_id=step_id, title=description.split(",")[0], description=description)

    def _plan_hanging_planter(self, spec: DesignSpec) -> tuple[list[StepPlanItem], dict[str, str]]:
        d = spec.dimensions_mm
        steps = [
            self._step("step_001", f"Create the main cylindrical planter body, {d['diameter']:.0f} mm diameter and {d['height']:.0f} mm tall."),
            self._step("step_002", "Add three drainage holes at the planter base."),
            self._step("step_003", "Add three equidistant hanging lugs near the rim."),
            self._step("step_004", "Add a reinforcing rim band to finish the hanging planter profile."),
        ]
        code = {
            "step_001": f'''def step_001(state):\n    """{steps[0].description}"""\n    outer = cq.Workplane("XY").circle({d["diameter"]/2:.3f}).extrude({d["height"]:.3f})\n    inner = cq.Workplane("XY").workplane(offset={d["wall"]:.3f}).circle({d["diameter"]/2 - d["wall"]:.3f}).extrude({d["height"] - d["wall"]:.3f})\n    solid = outer.cut(inner)\n    state["solid"] = solid\n    state["parts"] = {{"body": solid.val()}}\n    return state\n''',
            "step_002": f'''def step_002(state):\n    """{steps[1].description}"""\n    points = [(0, 0), ({d["diameter"]*0.18:.3f}, 0), ({-d["diameter"]*0.09:.3f}, {d["diameter"]*0.16:.3f})]\n    solid = state["solid"].faces("<Z").workplane().pushPoints(points).hole(8.0)\n    state["solid"] = solid\n    state["parts"]["body"] = solid.val()\n    return state\n''',
            "step_003": f'''def step_003(state):\n    """{steps[2].description}"""\n    solid = state["solid"]\n    lug_shapes = []\n    for angle in (0, 120, 240):\n        radians = math.radians(angle)\n        x = math.cos(radians) * ({d["diameter"]/2 - 9:.3f})\n        y = math.sin(radians) * ({d["diameter"]/2 - 9:.3f})\n        lug = cq.Workplane("XY").transformed(offset=(x, y, {d["height"] - 18:.3f})).box(26.0, 12.0, 18.0, centered=(True, True, False)).val()\n        lug_shapes.append(lug)\n        solid = solid.union(cq.Workplane(obj=lug))\n    state["solid"] = solid\n    state["parts"]["lugs"] = cq.Compound.makeCompound(lug_shapes)\n    return state\n''',
            "step_004": f'''def step_004(state):\n    """{steps[3].description}"""\n    outer_band = cq.Workplane("XY").transformed(offset=(0, 0, {d["height"] - 8:.3f})).circle({d["diameter"]/2 + 4:.3f}).extrude(8.0)\n    inner_band = cq.Workplane("XY").transformed(offset=(0, 0, {d["height"] - 8:.3f})).circle({d["diameter"]/2 - d["wall"]:.3f}).extrude(8.0)\n    rim_band = outer_band.cut(inner_band)\n    solid = state["solid"].union(rim_band)\n    state["solid"] = solid\n    state["parts"]["body"] = solid.val()\n    return state\n''',
        }
        return steps, code

    def _plan_planter(self, spec: DesignSpec) -> tuple[list[StepPlanItem], dict[str, str]]:
        d = spec.dimensions_mm
        steps = [
            self._step("step_001", f"Create the main cylindrical planter body, {d['diameter']:.0f} mm diameter and {d['height']:.0f} mm tall."),
            self._step("step_002", "Add three drainage holes at the planter base."),
            self._step("step_003", "Add a reinforcing rim band to finish the planter profile."),
        ]
        code = {
            "step_001": f'''def step_001(state):\n    """{steps[0].description}"""\n    outer = cq.Workplane("XY").circle({d["diameter"]/2:.3f}).extrude({d["height"]:.3f})\n    inner = cq.Workplane("XY").workplane(offset={d["wall"]:.3f}).circle({d["diameter"]/2 - d["wall"]:.3f}).extrude({d["height"] - d["wall"]:.3f})\n    solid = outer.cut(inner)\n    state["solid"] = solid\n    state["parts"] = {{"body": solid.val()}}\n    return state\n''',
            "step_002": f'''def step_002(state):\n    """{steps[1].description}"""\n    points = [(0, 0), ({d["diameter"]*0.18:.3f}, 0), ({-d["diameter"]*0.09:.3f}, {d["diameter"]*0.16:.3f})]\n    solid = state["solid"].faces("<Z").workplane().pushPoints(points).hole(8.0)\n    state["solid"] = solid\n    state["parts"]["body"] = solid.val()\n    return state\n''',
            "step_003": f'''def step_003(state):\n    """{steps[2].description}"""\n    outer_band = cq.Workplane("XY").transformed(offset=(0, 0, {d["height"] - 8:.3f})).circle({d["diameter"]/2 + 3:.3f}).extrude(8.0)\n    inner_band = cq.Workplane("XY").transformed(offset=(0, 0, {d["height"] - 8:.3f})).circle({d["diameter"]/2 - d["wall"]:.3f}).extrude(8.0)\n    rim_band = outer_band.cut(inner_band)\n    solid = state["solid"].union(rim_band)\n    state["solid"] = solid\n    state["parts"]["body"] = solid.val()\n    return state\n''',
        }
        return steps, code

    def _plan_wall_shelf(self, spec: DesignSpec) -> tuple[list[StepPlanItem], dict[str, str]]:
        d = spec.dimensions_mm
        steps = [
            self._step("step_001", f"Create the main shelf plate, about {d['width']:.0f} mm wide and {d['depth']:.0f} mm deep."),
            self._step("step_002", "Add an integrated back plate and two underside support ribs."),
            self._step("step_003", "Add two mounting holes through the back plate."),
            self._step("step_004", "Add a front retention lip to finish the shelf profile."),
        ]
        code = {
            "step_001": f'''def step_001(state):\n    """{steps[0].description}"""\n    shelf = cq.Workplane("XY").box({d["width"]:.3f}, {d["depth"]:.3f}, {d["thickness"]:.3f}, centered=(True, True, False))\n    state["solid"] = shelf\n    state["parts"] = {{"shelf": shelf.val()}}\n    return state\n''',
            "step_002": f'''def step_002(state):\n    """{steps[1].description}"""\n    solid = state["solid"]\n    back_plate = cq.Workplane("XY").transformed(offset=(0, {-d["depth"]/2 + d["thickness"]/2:.3f}, 0)).box({d["width"]:.3f}, {d["thickness"]:.3f}, {d["back_height"]:.3f}, centered=(True, True, False)).val()\n    rib_a = cq.Workplane("XY").transformed(offset=({-d["width"]*0.22:.3f}, {-d["depth"]*0.12:.3f}, 0)).box(18.0, {d["depth"]*0.76:.3f}, {d["back_height"]*0.7:.3f}, centered=(True, True, False)).val()\n    rib_b = cq.Workplane("XY").transformed(offset=({d["width"]*0.22:.3f}, {-d["depth"]*0.12:.3f}, 0)).box(18.0, {d["depth"]*0.76:.3f}, {d["back_height"]*0.7:.3f}, centered=(True, True, False)).val()\n    solid = solid.union(cq.Workplane(obj=back_plate)).union(cq.Workplane(obj=rib_a)).union(cq.Workplane(obj=rib_b))\n    state["solid"] = solid\n    state["parts"]["support"] = cq.Compound.makeCompound([back_plate, rib_a, rib_b])\n    return state\n''',
            "step_003": f'''def step_003(state):\n    """{steps[2].description}"""\n    solid = state["solid"].faces("<Y").workplane(centerOption="CenterOfMass").pushPoints([({-d["width"]*0.25:.3f}, {d["back_height"]*0.35:.3f}), ({d["width"]*0.25:.3f}, {d["back_height"]*0.35:.3f})]).hole(8.0)\n    state["solid"] = solid\n    return state\n''',
            "step_004": f'''def step_004(state):\n    """{steps[3].description}"""\n    lip = cq.Workplane("XY").transformed(offset=(0, {d["depth"]/2 - 6:.3f}, {d["thickness"]:.3f})).box({d["width"] - 12:.3f}, 10.0, 14.0, centered=(True, True, False))\n    solid = state["solid"].union(lip)\n    state["solid"] = solid\n    return state\n''',
        }
        return steps, code

    def _plan_enclosure_box(self, spec: DesignSpec) -> tuple[list[StepPlanItem], dict[str, str]]:
        d = spec.dimensions_mm
        wall = d["wall"]
        steps = [
            self._step("step_001", f"Create the main enclosure shell, about {d['width']:.0f} x {d['depth']:.0f} x {d['height']:.0f} mm."),
            self._step("step_002", "Cut the interior cavity to make the enclosure hollow."),
            self._step("step_003", "Add a rear cable opening and a subtle lid lip detail."),
            self._step("step_004", "Add four low support feet so the enclosure reads as a finished object."),
        ]
        code = {
            "step_001": f'''def step_001(state):\n    """{steps[0].description}"""\n    outer = cq.Workplane("XY").box({d["width"]:.3f}, {d["depth"]:.3f}, {d["height"]:.3f}, centered=(True, True, False))\n    state["solid"] = outer\n    state["parts"] = {{"shell": outer.val()}}\n    return state\n''',
            "step_002": f'''def step_002(state):\n    """{steps[1].description}"""\n    cavity = cq.Workplane("XY").transformed(offset=(0, 0, {wall:.3f})).box({d["width"] - 2*wall:.3f}, {d["depth"] - 2*wall:.3f}, {d["height"] - wall:.3f}, centered=(True, True, False))\n    solid = state["solid"].cut(cavity)\n    state["solid"] = solid\n    return state\n''',
            "step_003": f'''def step_003(state):\n    """{steps[2].description}"""\n    opening = cq.Workplane("XY").transformed(offset=(0, {-d["depth"]/2:.3f}, {d["height"]*0.38:.3f})).box(24.0, 10.0, 18.0)\n    lip = cq.Workplane("XY").transformed(offset=(0, 0, {d["height"] - 8:.3f})).box({d["width"] - 12:.3f}, {d["depth"] - 12:.3f}, 6.0, centered=(True, True, False))\n    solid = state["solid"].cut(opening).union(lip)\n    state["solid"] = solid\n    return state\n''',
            "step_004": f'''def step_004(state):\n    """{steps[3].description}"""\n    solid = state["solid"]\n    for x in ({-d["width"]/2 + 18:.3f}, {d["width"]/2 - 18:.3f}):\n        for y in ({-d["depth"]/2 + 18:.3f}, {d["depth"]/2 - 18:.3f}):\n            foot = cq.Workplane("XY").transformed(offset=(x, y, 0)).cylinder(10.0, 4.0, centered=(True, True, False))\n            solid = solid.union(foot)\n    state["solid"] = solid\n    return state\n''',
        }
        return steps, code

    def _plan_hook(self, spec: DesignSpec) -> tuple[list[StepPlanItem], dict[str, str]]:
        d = spec.dimensions_mm
        steps = [
            self._step("step_001", f"Create the main mounting plate, about {d['width']:.0f} mm wide and {d['height']:.0f} mm tall."),
            self._step("step_002", "Add the forward hook arm as an integrated solid extension."),
            self._step("step_003", "Add two mounting holes through the back plate."),
            self._step("step_004", "Add a raised stop at the hook tip so objects do not slip forward."),
        ]
        code = {
            "step_001": f'''def step_001(state):\n    """{steps[0].description}"""\n    plate = cq.Workplane("XY").box({d["width"]:.3f}, 10.0, {d["height"]:.3f}, centered=(True, True, False))\n    state["solid"] = plate\n    state["parts"] = {{"plate": plate.val()}}\n    return state\n''',
            "step_002": f'''def step_002(state):\n    """{steps[1].description}"""\n    stem = cq.Workplane("XY").transformed(offset=(0, 5.0, {d["height"]*0.55:.3f})).box(16.0, {d["depth"]:.3f}, 20.0, centered=(True, False, True))\n    tip = cq.Workplane("XY").transformed(offset=(0, {d["depth"] + 2:.3f}, {d["height"]*0.55 - 10:.3f})).box(16.0, 12.0, 28.0, centered=(True, False, False))\n    solid = state["solid"].union(stem).union(tip)\n    state["solid"] = solid\n    return state\n''',
            "step_003": f'''def step_003(state):\n    """{steps[2].description}"""\n    solid = state["solid"].faces("<Y").workplane(centerOption="CenterOfMass").pushPoints([(0, {d["height"]*0.28:.3f}), (0, {d["height"]*0.72:.3f})]).hole(7.0)\n    state["solid"] = solid\n    return state\n''',
            "step_004": f'''def step_004(state):\n    """{steps[3].description}"""\n    stop = cq.Workplane("XY").transformed(offset=(0, {d["depth"] + 8:.3f}, {d["height"]*0.55 + 8:.3f})).box(16.0, 10.0, 16.0, centered=(True, False, False))\n    solid = state["solid"].union(stop)\n    state["solid"] = solid\n    return state\n''',
        }
        return steps, code

    def _plan_block_object(self, spec: DesignSpec) -> tuple[list[StepPlanItem], dict[str, str]]:
        d = spec.dimensions_mm
        steps = [
            self._step("step_001", f"Create the main utility body, about {d['width']:.0f} x {d['depth']:.0f} x {d['height']:.0f} mm."),
            self._step("step_002", "Add a centered pocket feature to keep the geometry from reading as a plain block."),
            self._step("step_003", "Add a shallow top ridge so the utility object feels more intentional."),
        ]
        code = {
            "step_001": f'''def step_001(state):\n    """{steps[0].description}"""\n    solid = cq.Workplane("XY").box({d["width"]:.3f}, {d["depth"]:.3f}, {d["height"]:.3f}, centered=(True, True, False))\n    state["solid"] = solid\n    state["parts"] = {{"body": solid.val()}}\n    return state\n''',
            "step_002": f'''def step_002(state):\n    """{steps[1].description}"""\n    pocket = cq.Workplane("XY").transformed(offset=(0, 0, {d["height"]*0.45:.3f})).box({d["width"]*0.45:.3f}, {d["depth"]*0.45:.3f}, {d["height"]*0.35:.3f}, centered=(True, True, False))\n    solid = state["solid"].cut(pocket)\n    state["solid"] = solid\n    return state\n''',
            "step_003": f'''def step_003(state):\n    """{steps[2].description}"""\n    ridge = cq.Workplane("XY").transformed(offset=(0, 0, {d["height"]:.3f})).box({d["width"]*0.4:.3f}, {d["depth"]*0.18:.3f}, 8.0, centered=(True, True, False))\n    solid = state["solid"].union(ridge)\n    state["solid"] = solid\n    return state\n''',
        }
        return steps, code
