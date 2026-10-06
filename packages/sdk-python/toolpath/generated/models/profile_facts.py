from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cd_data import CdData
    from ..models.offset_length import OffsetLength


T = TypeVar("T", bound="ProfileFacts")


@_attrs_define
class ProfileFacts:
    """A profile: one pass around the part's outline.

    Attributes:
        kind (Literal['Profile']): Discriminator for this facts variant.
        cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
        length (float): How far the pass travels, mm — the outline's own length. The `radius = 0` term of
            `wallLength`, kept because it is what this boundary has always published; prefer the
            outline itself, which measures the path of the tool actually used.
        is_modified (bool): Whether the outline is the part's silhouette or the bridged reading of it.
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

    kind: Literal["Profile"]
    cd: CdData
    length: float
    is_modified: bool
    wall_length: OffsetLength | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        cd = self.cd.to_dict()

        length = self.length

        is_modified = self.is_modified

        wall_length: dict[str, Any] | Unset = UNSET
        if not isinstance(self.wall_length, Unset):
            wall_length = self.wall_length.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "cd": cd,
                "length": length,
                "isModified": is_modified,
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
        kind = cast(Literal["Profile"], d.pop("kind"))
        if kind != "Profile":
            raise ValueError(f"kind must match const 'Profile', got '{kind}'")

        cd = CdData.from_dict(d.pop("cd"))

        length = d.pop("length")

        is_modified = d.pop("isModified")

        _wall_length = d.pop("wallLength", UNSET)
        wall_length: OffsetLength | Unset
        if isinstance(_wall_length, Unset):
            wall_length = UNSET
        else:
            wall_length = OffsetLength.from_dict(_wall_length)

        profile_facts = cls(
            kind=kind,
            cd=cd,
            length=length,
            is_modified=is_modified,
            wall_length=wall_length,
        )

        return profile_facts
