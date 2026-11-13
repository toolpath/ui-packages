from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PlanToolLibraryTool")


@_attrs_define
class PlanToolLibraryTool:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    An entry of a Fusion tool library that became a tool.

        Attributes:
            entry (int): The entry’s index among the library’s entries (its `data` array).
            key (str): The key of the tool it became, priced for the job: what the plan’s actions and its CAM export name
                the tool by, so an action leads back to its library entry. Valid within this plan only: a key covers the tool’s
                feeds and speeds, so the same entry has another under another material, preset map or kernel version.
    """

    entry: int
    key: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        entry = self.entry

        key = self.key

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "entry": entry,
                "key": key,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        entry = d.pop("entry")

        key = d.pop("key")

        plan_tool_library_tool = cls(
            entry=entry,
            key=key,
        )

        plan_tool_library_tool.additional_properties = d
        return plan_tool_library_tool

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
