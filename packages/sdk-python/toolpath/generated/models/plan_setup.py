from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.plan_action import PlanAction
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="PlanSetup")


@_attrs_define
class PlanSetup:
    """
    Attributes:
        idx (int): Position of this item in machining order.
        direction (None | Vec3): The setup’s machining direction (tool axis), or null when none is exposed.
        actions (list[PlanAction]): Action-specs, in machining order.
        unmachined (list[str]): Feature tags (hex) this setup was meant to machine that no pass in it does — a coverage
            loss the tool pool could not finish. Empty when the setup machines everything assigned.
    """

    idx: int
    direction: None | Vec3
    actions: list[PlanAction]
    unmachined: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.vec_3 import Vec3

        idx = self.idx

        direction: dict[str, Any] | None
        if isinstance(self.direction, Vec3):
            direction = self.direction.to_dict()
        else:
            direction = self.direction

        actions = []
        for actions_item_data in self.actions:
            actions_item = actions_item_data.to_dict()
            actions.append(actions_item)

        unmachined = self.unmachined

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "idx": idx,
                "direction": direction,
                "actions": actions,
                "unmachined": unmachined,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_action import PlanAction
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        idx = d.pop("idx")

        def _parse_direction(data: object) -> None | Vec3:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                direction_type_0 = Vec3.from_dict(data)

                return direction_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Vec3, data)

        direction = _parse_direction(d.pop("direction"))

        actions = []
        _actions = d.pop("actions")
        for actions_item_data in _actions:
            actions_item = PlanAction.from_dict(actions_item_data)

            actions.append(actions_item)

        unmachined = cast(list[str], d.pop("unmachined"))

        plan_setup = cls(
            idx=idx,
            direction=direction,
            actions=actions,
            unmachined=unmachined,
        )

        plan_setup.additional_properties = d
        return plan_setup

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
