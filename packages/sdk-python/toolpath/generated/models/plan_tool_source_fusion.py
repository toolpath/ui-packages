from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_tool_source_fusion_kind import PlanToolSourceFusionKind
from ..types import UNSET, Unset

T = TypeVar("T", bound="PlanToolSourceFusion")


@_attrs_define
class PlanToolSourceFusion:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A tool imported from an entry of a Fusion tool library the plan’s crib named. Its assembly is the entry’s own —
    tool, holder, stickout and tool number, as the entry states them. Where the Engine could not read the entry, the
    assembly is built from the Engine’s own record of the tool it made of the entry, as a synthesized tool’s is: its
    head by its own dimensions, its `shaft` from the flutes up to the holder’s nose, and its `holder`’s outline where
    the library states one; its tool number and catalog fields are absent. Where the Engine could not read that record
    either, its shaft is assumed of its cutting diameter up to its stickout, and it has no holder. `guid` is the entry’s
    for every Fusion tool, modelled or not; `assembly.tool.guid` repeats it where the entry was modelled.

        Attributes:
            kind (PlanToolSourceFusionKind): Read from a Fusion tool library entry.
            tool_library_id (UUID): The library, as the plan’s crib named it and its `toolLibraries` report it.
            entry (int): The entry’s index among the library’s entries (its `data` array).
            guid (str | Unset): The entry’s `guid`, as the library’s file states it, which ties it back to the tool in
                Fusion. Absent where the entry states none.
    """

    kind: PlanToolSourceFusionKind
    tool_library_id: UUID
    entry: int
    guid: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        tool_library_id = str(self.tool_library_id)

        entry = self.entry

        guid = self.guid

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
                "toolLibraryId": tool_library_id,
                "entry": entry,
            }
        )
        if guid is not UNSET:
            field_dict["guid"] = guid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = PlanToolSourceFusionKind(d.pop("kind"))

        tool_library_id = UUID(d.pop("toolLibraryId"))

        entry = d.pop("entry")

        guid = d.pop("guid", UNSET)

        plan_tool_source_fusion = cls(
            kind=kind,
            tool_library_id=tool_library_id,
            entry=entry,
            guid=guid,
        )

        plan_tool_source_fusion.additional_properties = d
        return plan_tool_source_fusion

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
