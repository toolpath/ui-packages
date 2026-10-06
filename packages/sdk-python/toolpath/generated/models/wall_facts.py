from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cd_data import CdData
    from ..models.offset_length import OffsetLength


T = TypeVar("T", bound="WallFacts")


@_attrs_define
class WallFacts:
    """A wall: a run of surface square to the tool axis, with no floor of its own.

    Attributes:
        kind (Literal['Wall']): Discriminator for this facts variant.
        cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
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

    kind: Literal["Wall"]
    cd: CdData
    wall_length: OffsetLength | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        cd = self.cd.to_dict()

        wall_length: dict[str, Any] | Unset = UNSET
        if not isinstance(self.wall_length, Unset):
            wall_length = self.wall_length.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "cd": cd,
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
        kind = cast(Literal["Wall"], d.pop("kind"))
        if kind != "Wall":
            raise ValueError(f"kind must match const 'Wall', got '{kind}'")

        cd = CdData.from_dict(d.pop("cd"))

        _wall_length = d.pop("wallLength", UNSET)
        wall_length: OffsetLength | Unset
        if isinstance(_wall_length, Unset):
            wall_length = UNSET
        else:
            wall_length = OffsetLength.from_dict(_wall_length)

        wall_facts = cls(
            kind=kind,
            cd=cd,
            wall_length=wall_length,
        )

        return wall_facts
