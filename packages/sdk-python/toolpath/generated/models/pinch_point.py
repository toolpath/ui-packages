from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.vec_2 import Vec2
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="PinchPoint")


@_attrs_define
class PinchPoint:
    """Where a feature is at its tightest: one place that sets its clearance minimum, as a point.

    In part coordinates, mm, unlike the rest of the datasheet, so it draws over the part’s own mesh as it stands. Its
    height along the tool, the z the rest of the datasheet is read in, is its dot product with the feature’s
    `machiningDirection`, since the tool frame’s origin is the part’s own. One point per place, whatever shape the place
    has.

        Attributes:
            diameter (float): The clearance there — the datasheet's minimum clearance diameter for the tightest, up
                to the tolerance it was measured at.
            center (Vec2): A 2D vector (a plain `{ x, y }` object), in the plane its holder names: a tool frame's
                `(x, y)` across the tool, or a turned part's `(z, r)` as `{ x: z, y: r }`.
            point (Vec3 | Unset):
    """

    diameter: float
    center: Vec2
    point: Vec3 | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        diameter = self.diameter

        center = self.center.to_dict()

        point: dict[str, Any] | Unset = UNSET
        if not isinstance(self.point, Unset):
            point = self.point.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "diameter": diameter,
                "center": center,
            }
        )
        if point is not UNSET:
            field_dict["point"] = point

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_2 import Vec2
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        diameter = d.pop("diameter")

        center = Vec2.from_dict(d.pop("center"))

        _point = d.pop("point", UNSET)
        point: Vec3 | Unset
        if isinstance(_point, Unset):
            point = UNSET
        else:
            point = Vec3.from_dict(_point)

        pinch_point = cls(
            diameter=diameter,
            center=center,
            point=point,
        )

        return pinch_point
