from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PlanIssueFeature")


@_attrs_define
class PlanIssueFeature:
    """A feature holding regions of a plan issue, and why no setup machines it.

    Attributes:
        feature_tag (str): Kernel feature tag (hex), as `PlanSetup.unmachined` states one — join to a part feature’s
            `featureTag` (from `GET /v1/parts/{id}`) or to the plan’s `trimmedFeatures`.
        cause (str): Why no setup machines it. `ToolsRefused`: no tool of the plan can cut it, so it was never offered
            to the planner. `Revoked`: it shares regions with a pocket-like feature of another direction, which must be
            machined as that pocket. `RefusesEveryTool`: its own measurement admits no tool at all. `MeasurementFailed`: its
            clearance measurement failed. `FallbackNotNeeded`: only a fallback tool cuts it, and other features machine
            every region it would with the tool crib alone, so the plan does without it (`fallbackTools`). `Unmeasured`: the
            plan’s reading of it would not measure, so nothing is known of it. Other values may be added.
        owed (list[str]): The passes no tool of the plan meets — `Rough`, `Finish` or `Thread` — in that order. Empty
            where the tools meet every pass, or nothing is known of it (`Unmeasured`).
        rejections (list[str]): For `ToolsRefused`, why no tool was invented for those passes, each reason once: the
            tool crib’s reasons, or with `fallbackTools`, the reasons no fallback tool could be made, reach lifted. They are
            the kernel’s rejection codes, such as `ClearanceAtSharpCorner`, `DiameterTooSmall`, `FluteLengthTooLong`,
            `StickoutTooLong`, `LengthOverDiameterTooHigh`, `CannotSynthesizeDrill`, `ToolTypeExcluded` or
            `MeasurementFailed`, and for a `Thread` pass `ThreadNotOnGrid`, `ThreadTapered`, `ThreadEntryObstructed`,
            `ThreadLeadTooLong` or `TeethLengthTooLong`; other values may be added. Empty when the crib lists no tool head
            and `fallbackTools` is off; empty for any other cause.
    """

    feature_tag: str
    cause: str
    owed: list[str]
    rejections: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        feature_tag = self.feature_tag

        cause = self.cause

        owed = self.owed

        rejections = self.rejections

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "featureTag": feature_tag,
                "cause": cause,
                "owed": owed,
                "rejections": rejections,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        feature_tag = d.pop("featureTag")

        cause = d.pop("cause")

        owed = cast(list[str], d.pop("owed"))

        rejections = cast(list[str], d.pop("rejections"))

        plan_issue_feature = cls(
            feature_tag=feature_tag,
            cause=cause,
            owed=owed,
            rejections=rejections,
        )

        plan_issue_feature.additional_properties = d
        return plan_issue_feature

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
