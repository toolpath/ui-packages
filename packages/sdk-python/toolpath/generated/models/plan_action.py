from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.plan_action_tool_type_0 import PlanActionToolType0


T = TypeVar("T", bound="PlanAction")


@_attrs_define
class PlanAction:
    """
    Attributes:
        action_id (UUID): Identifier of this action record.
        idx (int): Position of this item in machining order.
        plan_case (str): The strategy this action realizes, e.g. WholePartRoughing.
        tool_name (str): Name of the tool this action uses.
        feature_tags (list[str]): Feature tags (hex) this action machines — join to a part feature’s `featureTag` (from
            `GET /parts/{id}`). Empty for whole-part roughing and facing, which machine no named feature.
        tool (None | PlanActionToolType0): The full synthesized tool spec, or null when the kernel exposes none. Its
            `key` names the tool within this plan only: two actions with equal keys run in one tool, so a change of key
            between consecutive actions is a tool change. It is not an identity across plans or kernel versions, and is
            absent on plans computed before tp-kernel 0.10.0.
    """

    action_id: UUID
    idx: int
    plan_case: str
    tool_name: str
    feature_tags: list[str]
    tool: None | PlanActionToolType0
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.plan_action_tool_type_0 import PlanActionToolType0

        action_id = str(self.action_id)

        idx = self.idx

        plan_case = self.plan_case

        tool_name = self.tool_name

        feature_tags = self.feature_tags

        tool: dict[str, Any] | None
        if isinstance(self.tool, PlanActionToolType0):
            tool = self.tool.to_dict()
        else:
            tool = self.tool

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "actionId": action_id,
                "idx": idx,
                "planCase": plan_case,
                "toolName": tool_name,
                "featureTags": feature_tags,
                "tool": tool,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_action_tool_type_0 import PlanActionToolType0

        d = dict(src_dict)
        action_id = UUID(d.pop("actionId"))

        idx = d.pop("idx")

        plan_case = d.pop("planCase")

        tool_name = d.pop("toolName")

        feature_tags = cast(list[str], d.pop("featureTags"))

        def _parse_tool(data: object) -> None | PlanActionToolType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                tool_type_0 = PlanActionToolType0.from_dict(data)

                return tool_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PlanActionToolType0, data)

        tool = _parse_tool(d.pop("tool"))

        plan_action = cls(
            action_id=action_id,
            idx=idx,
            plan_case=plan_case,
            tool_name=tool_name,
            feature_tags=feature_tags,
            tool=tool,
        )

        plan_action.additional_properties = d
        return plan_action

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
