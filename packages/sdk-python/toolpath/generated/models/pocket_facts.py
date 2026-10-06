from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cd_data import CdData
    from ..models.offset_length import OffsetLength


T = TypeVar("T", bound="PocketFacts")


@_attrs_define
class PocketFacts:
    """A pocket: a walled space with a floor, and the blend where the two meet.

    Attributes:
        kind (Literal['Pocket']): Discriminator for this facts variant.
        cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
        fillet_radius (float): Radius of the floor fillet; 0.0 when unfilleted.
        fillet_height (float): Height of the floor fillet; 0.0 when unfilleted.
        max_bottom_diameter (float | None): Deprecated: the largest bottom diameter a terminal tool may have. Nothing
            ever computed it, so it has always read `null`, and tp-kernel 0.16.0 removed it. Removed in the next API major.
        wall_length (OffsetLength | Unset): An outline a pass follows, measured so that any tool's path length can be
            read off it.

            A pass does not walk the outline: it walks the tool *center*, offset by the tool radius to
            the free side, which is shorter than the outline inside a pocket and longer around a boss.
            So the length a tool of `radius` travels is `Math.max(0, length + radius * dlDr)`, and zero
            means the tool does not fit — the outline is shorter than the tool's own orbit, which a
            caller estimating a pass must refuse rather than read as free.

            Exact for every tool the outline has room for, except at a corner sharper than the tool,
            where it reads long by that corner's miter — zero for the filleted corners a pocket that
            admits the tool is made of.
    """

    kind: Literal["Pocket"]
    cd: CdData
    fillet_radius: float
    fillet_height: float
    max_bottom_diameter: float | None
    wall_length: OffsetLength | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        cd = self.cd.to_dict()

        fillet_radius = self.fillet_radius

        fillet_height = self.fillet_height

        max_bottom_diameter: float | None
        max_bottom_diameter = self.max_bottom_diameter

        wall_length: dict[str, Any] | Unset = UNSET
        if not isinstance(self.wall_length, Unset):
            wall_length = self.wall_length.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "cd": cd,
                "filletRadius": fillet_radius,
                "filletHeight": fillet_height,
                "maxBottomDiameter": max_bottom_diameter,
            }
        )
        if wall_length is not UNSET:
            field_dict["wallLength"] = wall_length

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cd_data import CdData
        from ..models.offset_length import OffsetLength

        d = dict(src_dict)
        kind = cast(Literal["Pocket"], d.pop("kind"))
        if kind != "Pocket":
            raise ValueError(f"kind must match const 'Pocket', got '{kind}'")

        cd = CdData.from_dict(d.pop("cd"))

        fillet_radius = d.pop("filletRadius")

        fillet_height = d.pop("filletHeight")

        def _parse_max_bottom_diameter(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        max_bottom_diameter = _parse_max_bottom_diameter(d.pop("maxBottomDiameter"))

        _wall_length = d.pop("wallLength", UNSET)
        wall_length: OffsetLength | Unset
        if isinstance(_wall_length, Unset):
            wall_length = UNSET
        else:
            wall_length = OffsetLength.from_dict(_wall_length)

        pocket_facts = cls(
            kind=kind,
            cd=cd,
            fillet_radius=fillet_radius,
            fillet_height=fillet_height,
            max_bottom_diameter=max_bottom_diameter,
            wall_length=wall_length,
        )

        return pocket_facts
