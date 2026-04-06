from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import math

import cadquery as cq
from cadquery import exporters
from cadquery.occ_impl.exporters.assembly import exportGLTF
import matplotlib
matplotlib.use("Agg")
from matplotlib import pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np

from app.domain.models import ArtifactLink, DesignSpec, MassProperties, RenderView


@dataclass
class RevisionArtifacts:
    revision_label: str
    model_url: str
    downloads: list[ArtifactLink]
    render_views: list[RenderView]
    render_files: dict[str, Path]
    mass_properties: MassProperties
    interference_relevant: bool
    interference_detected: bool


class CadService:
    def __init__(self, artifact_root: Path) -> None:
        self._artifact_root = artifact_root
        self._artifact_root.mkdir(parents=True, exist_ok=True)

    def execute_step(self, step_id: str, code: str, state: dict) -> dict:
        safe_globals = {
            "__builtins__": {
                "abs": abs,
                "min": min,
                "max": max,
                "range": range,
                "round": round,
                "len": len,
                "float": float,
                "int": int,
                "sum": sum,
            },
            "cq": cq,
            "math": math,
        }
        local_vars: dict[str, object] = {}
        exec(code, safe_globals, local_vars)
        function = local_vars[step_id]
        return function(state)

    def export_revision(
        self,
        *,
        session_id: str,
        spec: DesignSpec,
        state: dict,
        step_id: str,
        revision_number: int,
        api_root: str,
    ) -> RevisionArtifacts:
        revision_label = f"rev-{revision_number:03d}-{step_id}"
        relative_dir = Path("sessions") / session_id / revision_label
        export_dir = self._artifact_root / relative_dir
        export_dir.mkdir(parents=True, exist_ok=True)

        workplane = state["solid"]
        shape = workplane.val()

        step_path = export_dir / f"{step_id}.step"
        stl_path = export_dir / f"{step_id}.stl"
        glb_path = export_dir / f"{step_id}.glb"

        exporters.export(workplane, str(step_path), exportType="STEP")
        exporters.export(workplane, str(stl_path), exportType="STL")
        assembly = cq.Assembly(name=spec.label)
        assembly.add(workplane, name="model")
        exportGLTF(assembly, str(glb_path), binary=True)

        render_views = self._render_views(
            shape=shape,
            export_dir=export_dir,
            relative_dir=relative_dir,
            api_root=api_root,
            title=spec.label,
        )
        mass_properties = self._mass_properties(shape)
        parts = state.get("parts", {})
        interference_relevant = len(parts) > 1

        return RevisionArtifacts(
            revision_label=revision_label,
            model_url=self._url_for(api_root, relative_dir / f"{step_id}.glb"),
            downloads=[
                ArtifactLink(label="Download GLB", url=self._url_for(api_root, relative_dir / f"{step_id}.glb")),
                ArtifactLink(label="Download STL", url=self._url_for(api_root, relative_dir / f"{step_id}.stl")),
                ArtifactLink(label="Download STEP", url=self._url_for(api_root, relative_dir / f"{step_id}.step")),
            ],
            render_views=render_views,
            render_files={key: export_dir / f"{key}.png" for key in ("top", "front", "side", "isometric")},
            mass_properties=mass_properties,
            interference_relevant=interference_relevant,
            interference_detected=False,
        )

    def _render_views(
        self,
        *,
        shape: cq.Shape,
        export_dir: Path,
        relative_dir: Path,
        api_root: str,
        title: str,
    ) -> list[RenderView]:
        vertices, faces = shape.tessellate(0.2, 0.05)
        points = np.array([[vertex.x, vertex.y, vertex.z] for vertex in vertices])
        triangles = [points[list(face)] for face in faces]
        mins = points.min(axis=0)
        maxs = points.max(axis=0)
        center = (maxs + mins) / 2.0
        half_span = float(np.max(np.maximum(maxs - mins, 1.0))) / 2.0

        views = [
            ("top", "Top", 68, -90),
            ("front", "Front", 0, -90),
            ("side", "Side", 0, 0),
            ("isometric", "Isometric", 28, 35),
        ]
        render_views: list[RenderView] = []
        for key, label, elev, azim in views:
            figure = plt.figure(figsize=(4.4, 4.4), facecolor="#fbf5ea")
            axis = figure.add_subplot(111, projection="3d")
            axis.set_proj_type("ortho")
            axis.add_collection3d(
                Poly3DCollection(
                    triangles,
                    facecolor="#c98a4b",
                    edgecolor="none",
                    linewidths=0.0,
                    alpha=0.98,
                )
            )
            axis.set_xlim(center[0] - half_span, center[0] + half_span)
            axis.set_ylim(center[1] - half_span, center[1] + half_span)
            axis.set_zlim(center[2] - half_span, center[2] + half_span)
            axis.view_init(elev=elev, azim=azim)
            axis.set_axis_off()
            figure.suptitle(f"{title} | {label}", y=0.96, fontsize=10, color="#4a3322")
            figure.tight_layout(pad=0.3)
            image_path = export_dir / f"{key}.png"
            figure.savefig(image_path, dpi=140, bbox_inches="tight", pad_inches=0.04)
            plt.close(figure)
            render_views.append(
                RenderView(
                    key=key,
                    label=label,
                    url=self._url_for(api_root, relative_dir / f"{key}.png"),
                )
            )
        return render_views

    def _mass_properties(self, shape: cq.Shape) -> MassProperties:
        center = shape.Center()
        bbox = shape.BoundingBox()
        return MassProperties(
            volume_mm3=round(shape.Volume(), 3),
            center_of_mass_mm=(round(center.x, 3), round(center.y, 3), round(center.z, 3)),
            bounding_box_mm=(round(bbox.xlen, 3), round(bbox.ylen, 3), round(bbox.zlen, 3)),
        )

    @staticmethod
    def _url_for(api_root: str, relative_path: Path) -> str:
        return f"{api_root}/artifacts/{str(relative_path).replace('\\', '/')}"
