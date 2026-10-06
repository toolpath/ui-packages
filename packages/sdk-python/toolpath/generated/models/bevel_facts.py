from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sink_facts import SinkFacts


T = TypeVar("T", bound="BevelFacts")


@_attrs_define
class BevelFacts:
    """The bevel itself: how it leans, how far it runs, and what its surroundings allow a
    cone to overshoot.

        Attributes:
            angle_deg (float): Between the bevel's surface and the tool axis, degrees: zero for a wall, a right
                angle for a floor. A matching tool's cone half angle is this.
            slant (float): How far the bevel runs along its own slope — the length of cutting edge a tool
                needs to span it in one pass.
            lower_adjacent_z_min (float): The highest bottom among the features the bevel stands on — how far down there
                is room under it before a tool would meet something. z grows up the tool axis,
                so this is *below* the bevel's own `zMin` by the room there is.
            is_open_pocket_bottom (bool): Deprecated: whether the bevel breaks the edge along the floor of an open pocket.
                tp-kernel 0.15.0 no longer computes it, so a feature enriched since reads `false`; tool matching reads
                `three.isEdgeBreak` in its place. Removed in the next API major.
            countersink (SinkFacts | Unset): A countersink read as a cone of revolution: the circle its bevel starts from
                and the
                one it opens to.
    """

    angle_deg: float
    slant: float
    lower_adjacent_z_min: float
    is_open_pocket_bottom: bool
    countersink: SinkFacts | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        angle_deg = self.angle_deg

        slant = self.slant

        lower_adjacent_z_min = self.lower_adjacent_z_min

        is_open_pocket_bottom = self.is_open_pocket_bottom

        countersink: dict[str, Any] | Unset = UNSET
        if not isinstance(self.countersink, Unset):
            countersink = self.countersink.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "angleDeg": angle_deg,
                "slant": slant,
                "lowerAdjacentZMin": lower_adjacent_z_min,
                "isOpenPocketBottom": is_open_pocket_bottom,
            }
        )
        if countersink is not UNSET:
            field_dict["countersink"] = countersink

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sink_facts import SinkFacts

        d = dict(src_dict)
        angle_deg = d.pop("angleDeg")

        slant = d.pop("slant")

        lower_adjacent_z_min = d.pop("lowerAdjacentZMin")

        is_open_pocket_bottom = d.pop("isOpenPocketBottom")

        _countersink = d.pop("countersink", UNSET)
        countersink: SinkFacts | Unset
        if isinstance(_countersink, Unset):
            countersink = UNSET
        else:
            countersink = SinkFacts.from_dict(_countersink)

        bevel_facts = cls(
            angle_deg=angle_deg,
            slant=slant,
            lower_adjacent_z_min=lower_adjacent_z_min,
            is_open_pocket_bottom=is_open_pocket_bottom,
            countersink=countersink,
        )

        return bevel_facts
