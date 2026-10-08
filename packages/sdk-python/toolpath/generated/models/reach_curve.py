from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="ReachCurve")


@_attrs_define
class ReachCurve:
    """Surrounding material height as a function of distance from the feature. Material
    within `horizontalOffset[i]` rises to `verticalOffset[i]` above the feature. Each
    reading is the worst case over the feature's whole surface, measured above each
    sampled point.
    Both arrays are the same length, ascending, non-negative, in mm. Evaluate the step
    function at the first knot whose horizontal offset is at least the query distance;
    queries beyond the last knot clamp to it.

    The last knot can stand well beyond the others, at the plan-view diagonal of the part and
    its fixtures: where material anywhere in the setup stands taller than the nearer offsets
    read, that knot carries it, since the spindle face atop a finite holder has to clear it
    however far off it stands.

    Offsets start at the feature, not the tool axis, and retain no obstacle direction.
    For an open feature, the cutter can sit between its contact point and an obstacle.
    A cylindrical holder of radius `R` at least as large as the cutting radius `r` reads
    the curve at `R + r`: that height is the required stickout before clearances. For example, a
    Ø10 cutter with a Ø24 holder reads at 17 mm from the feature, not 7 mm.

    ![A cutter beside an external wall, with an obstacle beyond the cutter: the holder
    footprint extends R + r from the contact point](./media/reach-curve.svg)

    Closed features allow an optimization: enclosing material lies beyond the cutting
    edge away from the axis, so a holder wider than the cutter reads at `R - r` instead;
    a holder narrower than the cutter adds no reach constraint. Tool checks
    use this for holes, sinks, non-open pockets, U-slots and threads; potentially open
    feature kinds use the conservative `R + r` footprint. The curve can overestimate
    holder reach because it has lost obstacle direction; it is not a collision proof.

    ![A cutter inside a closed pocket, with horizontal offsets measured outward from
    its floor and vertical offsets measured upward](./media/reach-curve-closed.svg)

    Here the cutter sits inside the pocket. Only the holder's overhang beyond the
    cutting edge, `R - r`, extends over the surrounding material.

    Shaft checks (neck, shoulder and shank) retain the enclosed-cut rule. Tool checks
    sweep tapered shaft and holder layers with their heights and clearances; the
    cylindrical example above explains
    the holder footprint. Callers can draw the curve or sweep an envelope of their own.

        Attributes:
            horizontal_offset (list[float]): Horizontal distance outward from the feature, in mm, ascending.
            vertical_offset (list[float]): How far above the feature the material within that distance rises, in mm,
                ascending.
    """

    horizontal_offset: list[float]
    vertical_offset: list[float]

    def to_dict(self) -> dict[str, Any]:
        horizontal_offset = self.horizontal_offset

        vertical_offset = self.vertical_offset

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "horizontalOffset": horizontal_offset,
                "verticalOffset": vertical_offset,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        horizontal_offset = cast(list[float], d.pop("horizontalOffset"))

        vertical_offset = cast(list[float], d.pop("verticalOffset"))

        reach_curve = cls(
            horizontal_offset=horizontal_offset,
            vertical_offset=vertical_offset,
        )

        return reach_curve
