from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_action_intent import PlanActionIntent

if TYPE_CHECKING:
    from ..models.feed_speed import FeedSpeed
    from ..models.plan_action_tool_type_0 import PlanActionToolType0


T = TypeVar("T", bound="PlanAction")


@_attrs_define
class PlanAction:
    """
    Attributes:
        action_id (UUID): Identifier of this action record.
        idx (int): Position of this item in machining order.
        intent (PlanActionIntent): What kind of pass this action is, as tp-kernel states it. Coarser than the pass’s
            concrete strategy, which the kernel keeps to itself: a whole-part rough reads `AdaptiveRough`, and a drill
            finish, a facing pass, an undercut and a chamfer all read `Finish`.
        tool_name (str): Name of the tool this action uses.
        feature_tags (list[str]): Feature tags (hex) this action is for — join to a part feature’s `featureTag` (from
            `GET /parts/{id}`). Whole-part roughing names the features its sweep folds in and facing the faces it takes;
            plans computed before this was recorded list none for either.
        tool (None | PlanActionToolType0): The full synthesized tool spec, or null when the kernel exposes none. Its
            `key` names the tool within this plan only: two actions with equal keys run in one tool, so a change of key
            between consecutive actions is a tool change. It is not an identity across plans or kernel versions, and is
            absent on plans computed before tp-kernel 0.10.0. It gained `fluteCount` and `stickout` (the tool’s reach below
            its holder, mm) in tp-kernel 0.14.0, both absent on plans made before it. A tap or thread mill carries the
            thread it cuts: `threadPitch` (mm), a tap its `threadHandedness`, and its form `threadProfileDeg` (the included
            flank angle) and taper `threadTaperDeg` (the half angle of the pitch cone, 0 for a straight thread), these two
            absent on plans made before Engine API 1.23.0. Chip load is `cuttingFeedRate / (spindleSpeed × fluteCount)`;
            surface speed is `π × diameter × spindleSpeed / 1000` (m/min). A tool made past the tool crib, for a pass no
            crib tool could play (a job asked for `fallbackTools`), carries `outsideCrib: { reasons }`: the kernel’s reasons
            no crib tool fit this pass’s features — `LengthOverDiameterTooHigh`, `ToolTypeExcluded`, … — each once, possibly
            none.
        feed_speed (FeedSpeed | None): What this action runs at — spindle speed, cutting feed and the step depths — or
            null. Null covers two cases the plan’s `kernelVersion` tells apart: the action’s tool has no feeds for the pass,
            or the plan was computed before tp-kernel 0.14.0 and carries none at all.
    """

    action_id: UUID
    idx: int
    intent: PlanActionIntent
    tool_name: str
    feature_tags: list[str]
    tool: None | PlanActionToolType0
    feed_speed: FeedSpeed | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.feed_speed import FeedSpeed
        from ..models.plan_action_tool_type_0 import PlanActionToolType0

        action_id = str(self.action_id)

        idx = self.idx

        intent = self.intent.value

        tool_name = self.tool_name

        feature_tags = self.feature_tags

        tool: dict[str, Any] | None
        if isinstance(self.tool, PlanActionToolType0):
            tool = self.tool.to_dict()
        else:
            tool = self.tool

        feed_speed: dict[str, Any] | None
        if isinstance(self.feed_speed, FeedSpeed):
            feed_speed = self.feed_speed.to_dict()
        else:
            feed_speed = self.feed_speed

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "actionId": action_id,
                "idx": idx,
                "intent": intent,
                "toolName": tool_name,
                "featureTags": feature_tags,
                "tool": tool,
                "feedSpeed": feed_speed,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.feed_speed import FeedSpeed
        from ..models.plan_action_tool_type_0 import PlanActionToolType0

        d = dict(src_dict)
        action_id = UUID(d.pop("actionId"))

        idx = d.pop("idx")

        intent = PlanActionIntent(d.pop("intent"))

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

        def _parse_feed_speed(data: object) -> FeedSpeed | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                feed_speed_type_0 = FeedSpeed.from_dict(data)

                return feed_speed_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FeedSpeed | None, data)

        feed_speed = _parse_feed_speed(d.pop("feedSpeed"))

        plan_action = cls(
            action_id=action_id,
            idx=idx,
            intent=intent,
            tool_name=tool_name,
            feature_tags=feature_tags,
            tool=tool,
            feed_speed=feed_speed,
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
