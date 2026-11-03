from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.vec_2 import Vec2


T = TypeVar("T", bound="ContourSegment")


@_attrs_define
class ContourSegment:
    """A straight run of a contour, from `start` to `end`. Lengths mm.

    Attributes:
        kind (Literal['Segment']): Discriminant of a `ContourCurve`; always `'Segment'` here.
        start (Vec2): A 2D vector (a plain `{ x, y }` object), in the plane its holder names: a tool frame's
            `(x, y)` across the tool, or a turned part's `(z, r)` as `{ x: z, y: r }`.
        end (Vec2): A 2D vector (a plain `{ x, y }` object), in the plane its holder names: a tool frame's
            `(x, y)` across the tool, or a turned part's `(z, r)` as `{ x: z, y: r }`.
    """

    kind: Literal["Segment"]
    start: Vec2
    end: Vec2

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        start = self.start.to_dict()

        end = self.end.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "start": start,
                "end": end,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_2 import Vec2

        d = dict(src_dict)
        kind = cast(Literal["Segment"], d.pop("kind"))
        if kind != "Segment":
            raise ValueError(f"kind must match const 'Segment', got '{kind}'")

        start = Vec2.from_dict(d.pop("start"))

        end = Vec2.from_dict(d.pop("end"))

        contour_segment = cls(
            kind=kind,
            start=start,
            end=end,
        )

        return contour_segment
