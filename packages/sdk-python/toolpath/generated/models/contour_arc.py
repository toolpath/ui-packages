from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.vec_2 import Vec2


T = TypeVar("T", bound="ContourArc")


@_attrs_define
class ContourArc:
    """A circular arc of a contour about `center`, starting at the angle `startDeg` from the
    frame's x axis and turning through `sweepDeg`: counterclockwise where positive, clockwise
    where negative. Lengths mm, angles degrees.

        Attributes:
            kind (Literal['Arc']): Discriminant of a `ContourCurve`; always `'Arc'` here.
            center (Vec2): A 2D vector (a plain `{ x, y }` object), in the plane its holder names: a tool frame's
                `(x, y)` across the tool, or a turned part's `(z, r)` as `{ x: z, y: r }`.
            radius (float): The circle's radius.
            start_deg (float): The angle the arc starts at, from the frame's x axis.
            sweep_deg (float): How far it turns, signed: counterclockwise where positive.
    """

    kind: Literal["Arc"]
    center: Vec2
    radius: float
    start_deg: float
    sweep_deg: float

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        center = self.center.to_dict()

        radius = self.radius

        start_deg = self.start_deg

        sweep_deg = self.sweep_deg

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "center": center,
                "radius": radius,
                "startDeg": start_deg,
                "sweepDeg": sweep_deg,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_2 import Vec2

        d = dict(src_dict)
        kind = cast(Literal["Arc"], d.pop("kind"))
        if kind != "Arc":
            raise ValueError(f"kind must match const 'Arc', got '{kind}'")

        center = Vec2.from_dict(d.pop("center"))

        radius = d.pop("radius")

        start_deg = d.pop("startDeg")

        sweep_deg = d.pop("sweepDeg")

        contour_arc = cls(
            kind=kind,
            center=center,
            radius=radius,
            start_deg=start_deg,
            sweep_deg=sweep_deg,
        )

        return contour_arc
