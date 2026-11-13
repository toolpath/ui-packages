from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PlanRefusedToolEntry")


@_attrs_define
class PlanRefusedToolEntry:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    An entry of a Fusion tool library that did not become a tool.

        Attributes:
            entry (int): The entry’s index among the library’s entries.
            kind (str): Why it is no tool. `UnsupportedType`: a type the import does not read — a probe, a holder, a turning
                tool, a reamer — though nothing need be wrong with the entry. `Invalid`: a milling tool whose entry does not
                make one — no geometry, a unit the import does not know, a field it needs and does not state, or numbers no tool
                can have. `DuplicateTool`: the same tool as an earlier entry, which became the tool. Other values may be added.
            reason (str): Why it is no tool, as a sentence for a person: its wording may change.
            tool_type (str | Unset): For `UnsupportedType`, the library’s own name for its type.
            duplicate_of (int | Unset): For `DuplicateTool`, the earlier entry it repeats, by its index.
    """

    entry: int
    kind: str
    reason: str
    tool_type: str | Unset = UNSET
    duplicate_of: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        entry = self.entry

        kind = self.kind

        reason = self.reason

        tool_type = self.tool_type

        duplicate_of = self.duplicate_of

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "entry": entry,
                "kind": kind,
                "reason": reason,
            }
        )
        if tool_type is not UNSET:
            field_dict["toolType"] = tool_type
        if duplicate_of is not UNSET:
            field_dict["duplicateOf"] = duplicate_of

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        entry = d.pop("entry")

        kind = d.pop("kind")

        reason = d.pop("reason")

        tool_type = d.pop("toolType", UNSET)

        duplicate_of = d.pop("duplicateOf", UNSET)

        plan_refused_tool_entry = cls(
            entry=entry,
            kind=kind,
            reason=reason,
            tool_type=tool_type,
            duplicate_of=duplicate_of,
        )

        plan_refused_tool_entry.additional_properties = d
        return plan_refused_tool_entry

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
