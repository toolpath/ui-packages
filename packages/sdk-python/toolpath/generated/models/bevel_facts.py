from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.chamfer_curve import ChamferCurve
    from ..models.sink_facts import SinkFacts


T = TypeVar("T", bound="BevelFacts")


@_attrs_define
class BevelFacts:
    """The bevel half of a chamfer: how it leans, how far it runs, and where its surroundings
    let a cone ride it.

        Attributes:
            angle_deg (float): Between the bevel's surface and the tool axis, degrees: zero for a wall, a right
                angle for a floor. A matching tool's cone half angle is this.
            slant (float): How far the bevel runs along its own slope — the length of cutting edge a tool
                needs to span it in one pass.
            is_open_pocket_bottom (bool): Deprecated: whether the bevel breaks the edge along the floor of an open pocket.
                tp-kernel 0.15.0 no longer computes it, so a feature enriched since reads `false`; tool matching reads
                `three.isEdgeBreak` in its place. Removed in the next API major.
            lower_adjacent_z_min (float | None): Deprecated: the highest bottom among the features the bevel stands on — how
                far down there is room under it before a tool would meet something. tp-kernel 0.24.0 replaced it with `curve`,
                which bounds a cone by everything around the bevel, so a feature enriched since Engine API 1.29.0 reads `null`;
                one enriched earlier keeps its number. Removed in the next API major.
            curve (ChamferCurve | Unset): What a bevel's surroundings allow a chamfer tool riding it: how deep its tip may
                sit below
                the bevel's lower edge, how wide its flat bottom may be at that depth, and how far its rim
                may reach to either side. Every cone a tool matcher accepts for the bevel is read off this.

                The picture is the bevel cut straight across, square to its edge: `u` runs across the cut
                and `z` up the tool axis, both in mm, with the bevel's lower edge at `u = 0, z = 0`. The
                bevel rises to the left, to its upper edge at `z = height`. The face above the upper edge
                is the *near side*, on the left; whatever lies past the lower edge is the *far side*, on
                the right. Each figure is the nearest obstacle anywhere along the bevel's edge, so this one
                cut stands for the whole bevel. `slope` is the bevel's rise over run, a ratio: 1 for a 45°
                chamfer.

                A chamfer tool is a cone ground to the bevel's angle, described by three numbers: its tip
                offset `t`, how far its tip sits below the lower edge; its flat `b`, the diameter of the
                flat bottom at its tip, zero for a pointed tool; and its cone height `H`, from the tip up
                to the rim, where the cone is widest. Riding the bevel, the cone's near flank lies along
                the bevel's own line, so its rim sits at height `H − t`, with its near corner at
                `u = −(H − t) / slope` and its far corner at `u = (t + H) / slope + b`. Above the rim the
                shank is no wider than the rim.

                The curve admits a tool when three things hold:

                - It spans the bevel: its rim sits at or above the upper edge, `H − t >= height`.
                - Its flat fits: `b` is at most the widest flat at its tip height `z = −t`. `z` and `flat`
                  are parallel, `z` ascending from the deepest tip the curve places to at or below the
                  lower edge. For the last `z[i]` at or below the tip height, the widest flat is
                  `flat[i] + 2 (z − z[i]) / slope`, widening as the tip rises; no tip sits below `z[0]`.
                - Its rim fits: both rim corners lie between `minU` and `maxU`, the near corner at or
                  right of `minU` and the far corner at or left of `maxU`.

                Every key is always present; a bound nothing sets is `null`.
            countersink (SinkFacts | Unset): A countersink read as a cone of revolution: the circle its bevel starts from
                and the
                one it opens to.
    """

    angle_deg: float
    slant: float
    is_open_pocket_bottom: bool
    lower_adjacent_z_min: float | None
    curve: ChamferCurve | Unset = UNSET
    countersink: SinkFacts | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        angle_deg = self.angle_deg

        slant = self.slant

        is_open_pocket_bottom = self.is_open_pocket_bottom

        lower_adjacent_z_min: float | None
        lower_adjacent_z_min = self.lower_adjacent_z_min

        curve: dict[str, Any] | Unset = UNSET
        if not isinstance(self.curve, Unset):
            curve = self.curve.to_dict()

        countersink: dict[str, Any] | Unset = UNSET
        if not isinstance(self.countersink, Unset):
            countersink = self.countersink.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "angleDeg": angle_deg,
                "slant": slant,
                "isOpenPocketBottom": is_open_pocket_bottom,
                "lowerAdjacentZMin": lower_adjacent_z_min,
            }
        )
        if curve is not UNSET:
            field_dict["curve"] = curve
        if countersink is not UNSET:
            field_dict["countersink"] = countersink

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.chamfer_curve import ChamferCurve
        from ..models.sink_facts import SinkFacts

        d = dict(src_dict)
        angle_deg = d.pop("angleDeg")

        slant = d.pop("slant")

        is_open_pocket_bottom = d.pop("isOpenPocketBottom")

        def _parse_lower_adjacent_z_min(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        lower_adjacent_z_min = _parse_lower_adjacent_z_min(d.pop("lowerAdjacentZMin"))

        _curve = d.pop("curve", UNSET)
        curve: ChamferCurve | Unset
        if isinstance(_curve, Unset):
            curve = UNSET
        else:
            curve = ChamferCurve.from_dict(_curve)

        _countersink = d.pop("countersink", UNSET)
        countersink: SinkFacts | Unset
        if isinstance(_countersink, Unset):
            countersink = UNSET
        else:
            countersink = SinkFacts.from_dict(_countersink)

        bevel_facts = cls(
            angle_deg=angle_deg,
            slant=slant,
            is_open_pocket_bottom=is_open_pocket_bottom,
            lower_adjacent_z_min=lower_adjacent_z_min,
            curve=curve,
            countersink=countersink,
        )

        return bevel_facts
