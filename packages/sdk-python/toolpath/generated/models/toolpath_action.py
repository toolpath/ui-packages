from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ToolpathAction")


@_attrs_define
class ToolpathAction:
    """
    Attributes:
        action_id (UUID): Identifier of this action record.
        idx (int): Position of this item in machining order.
        plan_case (str): The strategy this action realizes, e.g. WholePartRoughing.
        tool_name (str): Name of the tool this action uses.
        feature_tags (list[str]): Feature tags (hex) this action machines — join to a part feature’s `featureTag` (from
            `GET /parts/{id}`). Empty for whole-part roughing and facing, which machine no named feature.
        machining_time (float | None): Machining time for this action from the cut toolpath’s programmed feeds (links
            and rapids included, tool change excluded), in seconds, or null when the action was refused.
        cutting_length (float | None): Cutting-motion length of the toolpath in mm, or null when the action was refused.
        path_length (float | None): Full toolpath length including links and rapids, in mm, or null when the action was
            refused.
        empty (bool): True when the runner ran this action but it produced no cutting motion (nothing left to cut) —
            distinct from a real cut and from a refusal. Its machining time and lengths are zero and no geometry is stored.
            Always false for a refused action or a plan that is only `planned`.
        refused_reason (None | str): Why the runner refused to cut this action (`unsupported:`/`geometry:`), or null
            when it cut.
        toolpath_url (None | str): 15-minute URL for the toolpath geometry (points, segments, placement frame; JSON), or
            null when the action was refused, empty, or its geometry is unavailable.
    """

    action_id: UUID
    idx: int
    plan_case: str
    tool_name: str
    feature_tags: list[str]
    machining_time: float | None
    cutting_length: float | None
    path_length: float | None
    empty: bool
    refused_reason: None | str
    toolpath_url: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        action_id = str(self.action_id)

        idx = self.idx

        plan_case = self.plan_case

        tool_name = self.tool_name

        feature_tags = self.feature_tags

        machining_time: float | None
        machining_time = self.machining_time

        cutting_length: float | None
        cutting_length = self.cutting_length

        path_length: float | None
        path_length = self.path_length

        empty = self.empty

        refused_reason: None | str
        refused_reason = self.refused_reason

        toolpath_url: None | str
        toolpath_url = self.toolpath_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "actionId": action_id,
                "idx": idx,
                "planCase": plan_case,
                "toolName": tool_name,
                "featureTags": feature_tags,
                "machiningTime": machining_time,
                "cuttingLength": cutting_length,
                "pathLength": path_length,
                "empty": empty,
                "refusedReason": refused_reason,
                "toolpathUrl": toolpath_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        action_id = UUID(d.pop("actionId"))

        idx = d.pop("idx")

        plan_case = d.pop("planCase")

        tool_name = d.pop("toolName")

        feature_tags = cast(list[str], d.pop("featureTags"))

        def _parse_machining_time(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        machining_time = _parse_machining_time(d.pop("machiningTime"))

        def _parse_cutting_length(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        cutting_length = _parse_cutting_length(d.pop("cuttingLength"))

        def _parse_path_length(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        path_length = _parse_path_length(d.pop("pathLength"))

        empty = d.pop("empty")

        def _parse_refused_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        refused_reason = _parse_refused_reason(d.pop("refusedReason"))

        def _parse_toolpath_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        toolpath_url = _parse_toolpath_url(d.pop("toolpathUrl"))

        toolpath_action = cls(
            action_id=action_id,
            idx=idx,
            plan_case=plan_case,
            tool_name=tool_name,
            feature_tags=feature_tags,
            machining_time=machining_time,
            cutting_length=cutting_length,
            path_length=path_length,
            empty=empty,
            refused_reason=refused_reason,
            toolpath_url=toolpath_url,
        )

        toolpath_action.additional_properties = d
        return toolpath_action

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
