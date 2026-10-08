from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

T = TypeVar("T", bound="OffsetLength")


@_attrs_define
class OffsetLength:
    """An outline a pass follows, measured so that any tool's path length can be read off it.

    A pass does not walk the outline: it walks the tool *center*, offset by the tool radius to
    the free side, which is shorter than the outline inside a pocket and longer around a boss.
    So the length a tool of `radius` travels is `Math.max(0, length + radius * dlDr)`, and zero
    means the tool does not fit — the outline is shorter than the tool's own orbit, which a
    caller estimating a pass must refuse rather than read as free.

    Exact for every tool the outline has room for, except at a corner sharper than the tool,
    where it reads long by that corner's miter — zero for the filleted corners a pocket that
    admits the tool is made of.

        Attributes:
            length (float): The outline's own length, in mm — what a pass would travel with a tool of no width.
            dl_dr (float): How the travelled length changes per mm of tool radius: the outline's total signed
                turning, in radians and so dimensionless. Negative around an outline a tool runs
                inside of, positive around one it runs outside of, and `±2π` where the outline closes.
    """

    length: float
    dl_dr: float

    def to_dict(self) -> dict[str, Any]:
        length = self.length

        dl_dr = self.dl_dr

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "length": length,
                "dlDr": dl_dr,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        length = d.pop("length")

        dl_dr = d.pop("dlDr")

        offset_length = cls(
            length=length,
            dl_dr=dl_dr,
        )

        return offset_length
