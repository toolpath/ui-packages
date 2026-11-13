from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.plan_refused_tool_entry import PlanRefusedToolEntry
    from ..models.plan_tool_library_tool import PlanToolLibraryTool


T = TypeVar("T", bound="PlanToolLibrary")


@_attrs_define
class PlanToolLibrary:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    What a plan’s job read of one Fusion tool library its crib named.

        Attributes:
            tool_library_id (UUID): The library, as the crib named it.
            tools (list[PlanToolLibraryTool]): Each entry that became a tool, in the library’s order.
            refused (list[PlanRefusedToolEntry]): Each entry that did not become a tool, in the library’s order.
    """

    tool_library_id: UUID
    tools: list[PlanToolLibraryTool]
    refused: list[PlanRefusedToolEntry]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        tool_library_id = str(self.tool_library_id)

        tools = []
        for tools_item_data in self.tools:
            tools_item = tools_item_data.to_dict()
            tools.append(tools_item)

        refused = []
        for refused_item_data in self.refused:
            refused_item = refused_item_data.to_dict()
            refused.append(refused_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "toolLibraryId": tool_library_id,
                "tools": tools,
                "refused": refused,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_refused_tool_entry import PlanRefusedToolEntry
        from ..models.plan_tool_library_tool import PlanToolLibraryTool

        d = dict(src_dict)
        tool_library_id = UUID(d.pop("toolLibraryId"))

        tools = []
        _tools = d.pop("tools")
        for tools_item_data in _tools:
            tools_item = PlanToolLibraryTool.from_dict(tools_item_data)

            tools.append(tools_item)

        refused = []
        _refused = d.pop("refused")
        for refused_item_data in _refused:
            refused_item = PlanRefusedToolEntry.from_dict(refused_item_data)

            refused.append(refused_item)

        plan_tool_library = cls(
            tool_library_id=tool_library_id,
            tools=tools,
            refused=refused,
        )

        plan_tool_library.additional_properties = d
        return plan_tool_library

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
