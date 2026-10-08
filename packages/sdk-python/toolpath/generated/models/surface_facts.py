from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.bullnose_curve import BullnoseCurve
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
            cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
            is_u_shaped_fillet (bool): Deprecated: whether the fillet has a U-shaped cross section. tp-kernel 0.10.0 no
                longer computes it, so a feature enriched since reads `false`; `useOnlyBallToolsForFinish` is the whole of that
                verdict. Removed in the next API major.
            tool_fit (ToolFitResult): Deprecated: the tool geometry a surface's own shape admits, before the layers are
                consulted. `BullnoseCurve` replaces it, and these figures are its ends. Removed in the next API major.
            is_edge_break (bool | Unset): Whether the surface is an edge break: a chamfer, slanted face or quarter-round
                outer fillet no taller than a quarter inch, at least twice as long as wide, on a
                convex edge. A sharp corner on one is the stop it runs into.
            max_bottom_diameter (float | Unset): Widest flat bottom that reaches all of the surface, in mm; absent where
                nothing on the
                surface limits a flat bottom.
            bullnose_curve (BullnoseCurve | Unset): The tool geometry a surface's own shape admits, before the layers are
                consulted: at each
                corner radius, the widest flat bottom `D − 2r` a bullnose carrying it may have and still
                reach all of the surface. A tool with corner `r` reaches all of it when its diameter is at
                most `2·rᵢ + bᵢ` at a stored corner `rᵢ`; `2·r + min(bᵢ, bᵢ₊₁)` between two, `rᵢ < r < rᵢ₊₁`,
                since the bottom never widens as the corner grows; and `2·r_last + b_last` past the last.
                An absent bottom limits nothing at its point.
    """

    kind: Literal["Three"]
    fillet_radius: float
    max_stepdown: float
    surface_finish_cusp_height: float
    has_sharp_corner: bool
    use_only_ball_tools_for_finish: bool
    cd: CdData
    is_u_shaped_fillet: bool
    tool_fit: ToolFitResult
    is_edge_break: bool | Unset = UNSET
    max_bottom_diameter: float | Unset = UNSET
    bullnose_curve: BullnoseCurve | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        fillet_radius = self.fillet_radius

        max_stepdown = self.max_stepdown

        surface_finish_cusp_height = self.surface_finish_cusp_height

        has_sharp_corner = self.has_sharp_corner

        use_only_ball_tools_for_finish = self.use_only_ball_tools_for_finish

        cd = self.cd.to_dict()

        is_u_shaped_fillet = self.is_u_shaped_fillet

        tool_fit = self.tool_fit.to_dict()

        is_edge_break = self.is_edge_break

        max_bottom_diameter = self.max_bottom_diameter

        bullnose_curve: dict[str, Any] | Unset = UNSET
        if not isinstance(self.bullnose_curve, Unset):
            bullnose_curve = self.bullnose_curve.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "filletRadius": fillet_radius,
                "maxStepdown": max_stepdown,
                "surfaceFinishCuspHeight": surface_finish_cusp_height,
                "hasSharpCorner": has_sharp_corner,
                "useOnlyBallToolsForFinish": use_only_ball_tools_for_finish,
                "cd": cd,
                "isUShapedFillet": is_u_shaped_fillet,
                "toolFit": tool_fit,
            }
        )
        if is_edge_break is not UNSET:
            field_dict["isEdgeBreak"] = is_edge_break
        if max_bottom_diameter is not UNSET:
            field_dict["maxBottomDiameter"] = max_bottom_diameter
        if bullnose_curve is not UNSET:
            field_dict["bullnoseCurve"] = bullnose_curve

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.bullnose_curve import BullnoseCurve
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

        cd = CdData.from_dict(d.pop("cd"))

        is_u_shaped_fillet = d.pop("isUShapedFillet")

        tool_fit = ToolFitResult.from_dict(d.pop("toolFit"))

        is_edge_break = d.pop("isEdgeBreak", UNSET)

        max_bottom_diameter = d.pop("maxBottomDiameter", UNSET)

        _bullnose_curve = d.pop("bullnoseCurve", UNSET)
        bullnose_curve: BullnoseCurve | Unset
        if isinstance(_bullnose_curve, Unset):
            bullnose_curve = UNSET
        else:
            bullnose_curve = BullnoseCurve.from_dict(_bullnose_curve)

        surface_facts = cls(
            kind=kind,
            fillet_radius=fillet_radius,
            max_stepdown=max_stepdown,
            surface_finish_cusp_height=surface_finish_cusp_height,
            has_sharp_corner=has_sharp_corner,
            use_only_ball_tools_for_finish=use_only_ball_tools_for_finish,
            cd=cd,
            is_u_shaped_fillet=is_u_shaped_fillet,
            tool_fit=tool_fit,
            is_edge_break=is_edge_break,
            max_bottom_diameter=max_bottom_diameter,
            bullnose_curve=bullnose_curve,
        )

        return surface_facts
