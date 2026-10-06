from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PlanActionToolType0")


@_attrs_define
class PlanActionToolType0:
    """The full synthesized tool spec, or null when the kernel exposes none. Its `key` names the tool within this plan
    only: two actions with equal keys run in one tool, so a change of key between consecutive actions is a tool change.
    It is not an identity across plans or kernel versions, and is absent on plans computed before tp-kernel 0.10.0. It
    gained `fluteCount` and `stickout` (the tool’s reach below its holder, mm) in tp-kernel 0.14.0, both absent on plans
    made before it. A tap or thread mill carries the thread it cuts: `threadPitch` (mm), a tap its `threadHandedness`,
    and its form `threadProfileDeg` (the included flank angle) and taper `threadTaperDeg` (the half angle of the pitch
    cone, 0 for a straight thread), these two absent on plans made before Engine API 1.23.0. Chip load is
    `cuttingFeedRate / (spindleSpeed × fluteCount)`; surface speed is `π × diameter × spindleSpeed / 1000` (m/min). A
    tool made past the tool crib, for a pass no crib tool could play (a job asked for `fallbackTools`), carries
    `outsideCrib: { reasons }`: the kernel’s reasons no crib tool fit this pass’s features —
    `LengthOverDiameterTooHigh`, `ToolTypeExcluded`, … — each once, possibly none.

    """

    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        plan_action_tool_type_0 = cls()

        plan_action_tool_type_0.additional_properties = d
        return plan_action_tool_type_0

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
