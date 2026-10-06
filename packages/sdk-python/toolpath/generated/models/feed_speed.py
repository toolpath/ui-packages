from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="FeedSpeed")


@_attrs_define
class FeedSpeed:
    """
    Attributes:
        spindle_speed (float): Spindle speed, rev/min.
        cutting_feed_rate (float): Cutting feed rate, mm/min.
        stepdown (float | Unset): The most a layer may take, in mm, where the pass sets one.
        stepover (float | Unset): The stepover the pass is calculated with, in mm, where the pass sets one; on a
            countersink spiral, the most it steps.
    """

    spindle_speed: float
    cutting_feed_rate: float
    stepdown: float | Unset = UNSET
    stepover: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        spindle_speed = self.spindle_speed

        cutting_feed_rate = self.cutting_feed_rate

        stepdown = self.stepdown

        stepover = self.stepover

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "spindleSpeed": spindle_speed,
                "cuttingFeedRate": cutting_feed_rate,
            }
        )
        if stepdown is not UNSET:
            field_dict["stepdown"] = stepdown
        if stepover is not UNSET:
            field_dict["stepover"] = stepover

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        spindle_speed = d.pop("spindleSpeed")

        cutting_feed_rate = d.pop("cuttingFeedRate")

        stepdown = d.pop("stepdown", UNSET)

        stepover = d.pop("stepover", UNSET)

        feed_speed = cls(
            spindle_speed=spindle_speed,
            cutting_feed_rate=cutting_feed_rate,
            stepdown=stepdown,
            stepover=stepover,
        )

        feed_speed.additional_properties = d
        return feed_speed

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
