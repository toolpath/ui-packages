from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cd_data import CdData


T = TypeVar("T", bound="TslotFacts")


@_attrs_define
class TslotFacts:
    """A t-slot: a groove cut sideways into a wall or around a post, under a ceiling the
    machining direction cannot see past.

        Attributes:
            kind (Literal['Tslot']): Discriminator for this facts variant.
            is_external (bool): The slot runs around material standing in it rather than into the material
                around a void.
            is_closed (bool): The slot's walls close on themselves in plan view.
            cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
            fillet_radius (float): Radius of the blend where the slot's walls meet its floor and ceiling; 0.0 when
                sharp.
            undercut_depth (float | Unset): How far the groove runs back from its opening, radially, in mm; absent where the
                slot
                has no valid measurement, which `isInvalidGeometry` or `cd.measurementFailed` says.
            max_entry_cd (float | Unset): The widest tool that can come down through the opening above the slot to reach it,
                in mm; absent where nothing above the slot limits one. Zero where nothing fits, and
                wherever `isInvalidGeometry` or `cd.measurementFailed` is set.
            is_invalid_geometry (bool | Unset): The slot was measured and is not one a disc cutter can cut: its walls do not
                form a
                slot, nothing overhangs them, or a cutter reaching its depth could not turn inside
                it. Its clearance then admits no tool.
    """

    kind: Literal["Tslot"]
    is_external: bool
    is_closed: bool
    cd: CdData
    fillet_radius: float
    undercut_depth: float | Unset = UNSET
    max_entry_cd: float | Unset = UNSET
    is_invalid_geometry: bool | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        is_external = self.is_external

        is_closed = self.is_closed

        cd = self.cd.to_dict()

        fillet_radius = self.fillet_radius

        undercut_depth = self.undercut_depth

        max_entry_cd = self.max_entry_cd

        is_invalid_geometry = self.is_invalid_geometry

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "isExternal": is_external,
                "isClosed": is_closed,
                "cd": cd,
                "filletRadius": fillet_radius,
            }
        )
        if undercut_depth is not UNSET:
            field_dict["undercutDepth"] = undercut_depth
        if max_entry_cd is not UNSET:
            field_dict["maxEntryCd"] = max_entry_cd
        if is_invalid_geometry is not UNSET:
            field_dict["isInvalidGeometry"] = is_invalid_geometry

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cd_data import CdData

        d = dict(src_dict)
        kind = cast(Literal["Tslot"], d.pop("kind"))
        if kind != "Tslot":
            raise ValueError(f"kind must match const 'Tslot', got '{kind}'")

        is_external = d.pop("isExternal")

        is_closed = d.pop("isClosed")

        cd = CdData.from_dict(d.pop("cd"))

        fillet_radius = d.pop("filletRadius")

        undercut_depth = d.pop("undercutDepth", UNSET)

        max_entry_cd = d.pop("maxEntryCd", UNSET)

        is_invalid_geometry = d.pop("isInvalidGeometry", UNSET)

        tslot_facts = cls(
            kind=kind,
            is_external=is_external,
            is_closed=is_closed,
            cd=cd,
            fillet_radius=fillet_radius,
            undercut_depth=undercut_depth,
            max_entry_cd=max_entry_cd,
            is_invalid_geometry=is_invalid_geometry,
        )

        return tslot_facts
