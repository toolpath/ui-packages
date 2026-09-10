from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.machining_time_action import MachiningTimeAction


T = TypeVar("T", bound="MachiningTimeSetup")


@_attrs_define
class MachiningTimeSetup:
    """
    Attributes:
        idx (int): Position of this item in machining order.
        actions (list[MachiningTimeAction]): Actions, in machining order.
    """

    idx: int
    actions: list[MachiningTimeAction]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        idx = self.idx

        actions = []
        for actions_item_data in self.actions:
            actions_item = actions_item_data.to_dict()
            actions.append(actions_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "idx": idx,
                "actions": actions,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.machining_time_action import MachiningTimeAction

        d = dict(src_dict)
        idx = d.pop("idx")

        actions = []
        _actions = d.pop("actions")
        for actions_item_data in _actions:
            actions_item = MachiningTimeAction.from_dict(actions_item_data)

            actions.append(actions_item)

        machining_time_setup = cls(
            idx=idx,
            actions=actions,
        )

        machining_time_setup.additional_properties = d
        return machining_time_setup

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
