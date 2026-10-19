from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.vec_2 import Vec2


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
    """

    center: Vec2
    inner_radius: float
    outer_radius: float

    def to_dict(self) -> dict[str, Any]:
        center = self.center.to_dict()

        inner_radius = self.inner_radius

        outer_radius = self.outer_radius

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "center": center,
                "innerRadius": inner_radius,
                "outerRadius": outer_radius,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_2 import Vec2

        d = dict(src_dict)
        center = Vec2.from_dict(d.pop("center"))

        inner_radius = d.pop("innerRadius")

        outer_radius = d.pop("outerRadius")

        sink_facts = cls(
            center=center,
            inner_radius=inner_radius,
            outer_radius=outer_radius,
        )

        return sink_facts
