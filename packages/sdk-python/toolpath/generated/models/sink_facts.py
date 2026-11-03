from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.vec_2 import Vec2
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="SinkFacts")


@_attrs_define
class SinkFacts:
    """A countersink read as a cone of revolution: the circle its bevel starts from and the
    one it opens to.

        Attributes:
            center (Vec2): A 2D vector (a plain `{ x, y }` object), in the plane its holder names: a tool frame's
                `(x, y)` across the tool, or a turned part's `(z, r)` as `{ x: z, y: r }`.
            inner_radius (float): Radius of the circle the bevel starts from, at its lower edge — the pilot hole.
            outer_radius (float): Radius it has opened to at the upper edge.
            top_center (Vec3 | Unset):
    """

    center: Vec2
    inner_radius: float
    outer_radius: float
    top_center: Vec3 | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        center = self.center.to_dict()

        inner_radius = self.inner_radius

        outer_radius = self.outer_radius

        top_center: dict[str, Any] | Unset = UNSET
        if not isinstance(self.top_center, Unset):
            top_center = self.top_center.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "center": center,
                "innerRadius": inner_radius,
                "outerRadius": outer_radius,
            }
        )
        if top_center is not UNSET:
            field_dict["topCenter"] = top_center

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_2 import Vec2
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        center = Vec2.from_dict(d.pop("center"))

        inner_radius = d.pop("innerRadius")

        outer_radius = d.pop("outerRadius")

        _top_center = d.pop("topCenter", UNSET)
        top_center: Vec3 | Unset
        if isinstance(_top_center, Unset):
            top_center = UNSET
        else:
            top_center = Vec3.from_dict(_top_center)

        sink_facts = cls(
            center=center,
            inner_radius=inner_radius,
            outer_radius=outer_radius,
            top_center=top_center,
        )

        return sink_facts
