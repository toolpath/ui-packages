from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.cd_data import CdData
    from ..models.tool_fit_result import ToolFitResult


T = TypeVar("T", bound="SurfaceFacts")


@_attrs_define
class SurfaceFacts:
    """A three-dimensional surface a tool has to follow rather than sweep; also the surface
    half of a chamfer.

        Attributes:
            kind (Literal['Three']): Discriminator for this facts variant.
            fillet_radius (float): The blend radius, signed by which way the surface turns: positive rolling over
                an edge, negative running into a corner, zero for no blend at all.
            max_stepdown (float): The deepest cut taken in one pass down the surface, mm.
            surface_finish_cusp_height (float): How much scallop the finishing pass may leave between neighboring passes,
                mm.
            has_sharp_corner (bool): Whether the surface includes a sharp corner a tool must respect.
            use_only_ball_tools_for_finish (bool): Whether only ball tools are suitable for the finishing pass.
            max_bottom_diameter (float): Largest bottom diameter a terminal tool may have, in mm.
            cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
            tool_fit (ToolFitResult): The tool geometry a surface's own shape admits, before the layers are consulted.
            is_u_shaped_fillet (bool): Deprecated: whether the fillet has a U-shaped cross section. tp-kernel 0.10.0 no
                longer computes it, so a feature enriched since reads `false`; `useOnlyBallToolsForFinish` is the whole of that
                verdict. Removed in the next API major.
    """

    kind: Literal["Three"]
    fillet_radius: float
    max_stepdown: float
    surface_finish_cusp_height: float
    has_sharp_corner: bool
    use_only_ball_tools_for_finish: bool
    max_bottom_diameter: float
    cd: CdData
    tool_fit: ToolFitResult
    is_u_shaped_fillet: bool

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        fillet_radius = self.fillet_radius

        max_stepdown = self.max_stepdown

        surface_finish_cusp_height = self.surface_finish_cusp_height

        has_sharp_corner = self.has_sharp_corner

        use_only_ball_tools_for_finish = self.use_only_ball_tools_for_finish

        max_bottom_diameter = self.max_bottom_diameter

        cd = self.cd.to_dict()

        tool_fit = self.tool_fit.to_dict()

        is_u_shaped_fillet = self.is_u_shaped_fillet

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "filletRadius": fillet_radius,
                "maxStepdown": max_stepdown,
                "surfaceFinishCuspHeight": surface_finish_cusp_height,
                "hasSharpCorner": has_sharp_corner,
                "useOnlyBallToolsForFinish": use_only_ball_tools_for_finish,
                "maxBottomDiameter": max_bottom_diameter,
                "cd": cd,
                "toolFit": tool_fit,
                "isUShapedFillet": is_u_shaped_fillet,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cd_data import CdData
        from ..models.tool_fit_result import ToolFitResult

        d = dict(src_dict)
        kind = cast(Literal["Three"], d.pop("kind"))
        if kind != "Three":
            raise ValueError(f"kind must match const 'Three', got '{kind}'")

        fillet_radius = d.pop("filletRadius")

        max_stepdown = d.pop("maxStepdown")

        surface_finish_cusp_height = d.pop("surfaceFinishCuspHeight")

        has_sharp_corner = d.pop("hasSharpCorner")

        use_only_ball_tools_for_finish = d.pop("useOnlyBallToolsForFinish")

        max_bottom_diameter = d.pop("maxBottomDiameter")

        cd = CdData.from_dict(d.pop("cd"))

        tool_fit = ToolFitResult.from_dict(d.pop("toolFit"))

        is_u_shaped_fillet = d.pop("isUShapedFillet")

        surface_facts = cls(
            kind=kind,
            fillet_radius=fillet_radius,
            max_stepdown=max_stepdown,
            surface_finish_cusp_height=surface_finish_cusp_height,
            has_sharp_corner=has_sharp_corner,
            use_only_ball_tools_for_finish=use_only_ball_tools_for_finish,
            max_bottom_diameter=max_bottom_diameter,
            cd=cd,
            tool_fit=tool_fit,
            is_u_shaped_fillet=is_u_shaped_fillet,
        )

        return surface_facts
