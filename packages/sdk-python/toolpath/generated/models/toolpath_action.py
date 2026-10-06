from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.toolpath_action_intent import ToolpathActionIntent

if TYPE_CHECKING:
    from ..models.feed_speed import FeedSpeed


T = TypeVar("T", bound="ToolpathAction")


@_attrs_define
class ToolpathAction:
    """
    Attributes:
        action_id (UUID): Identifier of this action record.
        idx (int): Position of this item in machining order.
        intent (ToolpathActionIntent): What kind of pass this action is, as tp-kernel states it. Coarser than the pass’s
            concrete strategy, which the kernel keeps to itself: a whole-part rough reads `AdaptiveRough`, and a drill
            finish, a facing pass, an undercut and a chamfer all read `Finish`.
        tool_name (str): Name of the tool this action uses.
        feature_tags (list[str]): Feature tags (hex) this action is for — join to a part feature’s `featureTag` (from
            `GET /parts/{id}`). Whole-part roughing names the features its sweep folds in and facing the faces it takes;
            plans computed before this was recorded list none for either.
        machining_time (float | None): Machining time for this action from the cut toolpath’s programmed feeds (links
            and rapids included, tool change excluded), in seconds, or null when the action was refused.
        cutting_length (float | None): Cutting-motion length of the toolpath in mm, or null when the action was refused.
        path_length (float | None): Full toolpath length including links and rapids, in mm, or null when the action was
            refused.
        empty (bool): True when the runner ran this action but it produced no cutting motion (nothing left to cut) —
            distinct from a real cut and from a refusal. Its machining time and lengths are zero and no geometry is stored.
            Always false for a refused action or a plan that is only `planned`.
        feed_speed (FeedSpeed | None): What this action runs at — spindle speed, cutting feed and the step depths — or
            null. Null covers two cases the plan’s `kernelVersion` tells apart: the action’s tool has no feeds for the pass,
            or the plan was computed before tp-kernel 0.14.0 and carries none at all.
        refused_reason (None | str): Why the runner refused to cut this action (`unsupported:`/`geometry:`), or null
            when it cut.
        toolpath_url (None | str): 15-minute URL for the toolpath geometry (JSON: `points`, xyz triples in part
            coordinates, and `segments`), or null when the action was refused, empty, or its geometry is unavailable. A file
            written before 1.18.0 also carries a `frame`, and its points are in that frame: place them through it.
        stock_after_url (None | str): 15-minute URL for the in-process stock after this action (GLB, part coordinates,
            mm). Null for a refused or empty action, or an unavailable artifact. Fall back to the preceding available stock
            mesh in machining order, then initialStockUrl, then the plan’s stock.resolved figure. A plain GLB, like
            `meshGlbUrl`: no glTF extension is needed to read it. It is stored gzipped and served with `Content-Encoding:
            gzip` whatever the request’s `Accept-Encoding`: browsers and `fetch` undo that on their own, but curl without
            `--compressed`, wget, Python’s `urllib`, and Java’s and .NET’s HTTP clients by default hand back the gzipped
            bytes, which must be gunzipped before the GLB is parsed.
    """

    action_id: UUID
    idx: int
    intent: ToolpathActionIntent
    tool_name: str
    feature_tags: list[str]
    machining_time: float | None
    cutting_length: float | None
    path_length: float | None
    empty: bool
    feed_speed: FeedSpeed | None
    refused_reason: None | str
    toolpath_url: None | str
    stock_after_url: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.feed_speed import FeedSpeed

        action_id = str(self.action_id)

        idx = self.idx

        intent = self.intent.value

        tool_name = self.tool_name

        feature_tags = self.feature_tags

        machining_time: float | None
        machining_time = self.machining_time

        cutting_length: float | None
        cutting_length = self.cutting_length

        path_length: float | None
        path_length = self.path_length

        empty = self.empty

        feed_speed: dict[str, Any] | None
        if isinstance(self.feed_speed, FeedSpeed):
            feed_speed = self.feed_speed.to_dict()
        else:
            feed_speed = self.feed_speed

        refused_reason: None | str
        refused_reason = self.refused_reason

        toolpath_url: None | str
        toolpath_url = self.toolpath_url

        stock_after_url: None | str
        stock_after_url = self.stock_after_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "actionId": action_id,
                "idx": idx,
                "intent": intent,
                "toolName": tool_name,
                "featureTags": feature_tags,
                "machiningTime": machining_time,
                "cuttingLength": cutting_length,
                "pathLength": path_length,
                "empty": empty,
                "feedSpeed": feed_speed,
                "refusedReason": refused_reason,
                "toolpathUrl": toolpath_url,
                "stockAfterUrl": stock_after_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.feed_speed import FeedSpeed

        d = dict(src_dict)
        action_id = UUID(d.pop("actionId"))

        idx = d.pop("idx")

        intent = ToolpathActionIntent(d.pop("intent"))

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

        def _parse_stock_after_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        stock_after_url = _parse_stock_after_url(d.pop("stockAfterUrl"))

        toolpath_action = cls(
            action_id=action_id,
            idx=idx,
            intent=intent,
            tool_name=tool_name,
            feature_tags=feature_tags,
            machining_time=machining_time,
            cutting_length=cutting_length,
            path_length=path_length,
            empty=empty,
            feed_speed=feed_speed,
            refused_reason=refused_reason,
            toolpath_url=toolpath_url,
            stock_after_url=stock_after_url,
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
