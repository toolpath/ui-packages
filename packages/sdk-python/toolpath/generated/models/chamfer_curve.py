from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="ChamferCurve")


@_attrs_define
class ChamferCurve:
    """What a bevel's surroundings allow a chamfer tool riding it: how deep its tip may sit below
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

        Attributes:
            slope (float): The bevel's rise over run, a ratio: 1 for a 45° chamfer.
            height (float): The bevel's rise, in mm, from its lower edge to its upper edge. A tool's rim sits at or
                above it.
            min_u (float | None): The furthest left a rim's near corner may stand, in mm, negative: where the near side
                stops it. `null` where the near side is open, so that no rim stands too far left. Read
                it as `-Infinity`, not `?? Infinity`: it is the datasheet's one lower bound.
            max_u (float | None): The furthest right a rim's far corner may stand, in mm, positive: where the far side
                stops it. `null` where the far side is open above the upper edge, so that no rim
                stands too far right.
            z (list[float]): Tip heights, in mm, ascending, each at or below the lower edge and so zero or negative;
                the first is the deepest tip the curve places.
            flat (list[float | None]): The widest flat at each tip height, in mm, beside it; `null` where the far side is
                open
                below the upper edge, so that no flat is too wide there.
    """

    slope: float
    height: float
    min_u: float | None
    max_u: float | None
    z: list[float]
    flat: list[float | None]

    def to_dict(self) -> dict[str, Any]:
        slope = self.slope

        height = self.height

        min_u: float | None
        min_u = self.min_u

        max_u: float | None
        max_u = self.max_u

        z = self.z

        flat = []
        for flat_item_data in self.flat:
            flat_item: float | None
            flat_item = flat_item_data
            flat.append(flat_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "slope": slope,
                "height": height,
                "minU": min_u,
                "maxU": max_u,
                "z": z,
                "flat": flat,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        slope = d.pop("slope")

        height = d.pop("height")

        def _parse_min_u(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        min_u = _parse_min_u(d.pop("minU"))

        def _parse_max_u(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        max_u = _parse_max_u(d.pop("maxU"))

        z = cast(list[float], d.pop("z"))

        flat = []
        _flat = d.pop("flat")
        for flat_item_data in _flat:

            def _parse_flat_item(data: object) -> float | None:
                if data is None:
                    return data
                return cast(float | None, data)

            flat_item = _parse_flat_item(flat_item_data)

            flat.append(flat_item)

        chamfer_curve = cls(
            slope=slope,
            height=height,
            min_u=min_u,
            max_u=max_u,
            z=z,
            flat=flat,
        )

        return chamfer_curve
