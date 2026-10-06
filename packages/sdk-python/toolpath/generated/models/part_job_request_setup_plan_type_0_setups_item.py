from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.part_job_request_setup_plan_type_0_setups_item_orientations_item import (
        PartJobRequestSetupPlanType0SetupsItemOrientationsItem,
    )


T = TypeVar("T", bound="PartJobRequestSetupPlanType0SetupsItem")


@_attrs_define
class PartJobRequestSetupPlanType0SetupsItem:
    """
    Attributes:
        orientations (list[PartJobRequestSetupPlanType0SetupsItemOrientationsItem]):
    """

    orientations: list[PartJobRequestSetupPlanType0SetupsItemOrientationsItem]

    def to_dict(self) -> dict[str, Any]:
        orientations = []
        for orientations_item_data in self.orientations:
            orientations_item = orientations_item_data.to_dict()
            orientations.append(orientations_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "orientations": orientations,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.part_job_request_setup_plan_type_0_setups_item_orientations_item import (
            PartJobRequestSetupPlanType0SetupsItemOrientationsItem,
        )

        d = dict(src_dict)
        orientations = []
        _orientations = d.pop("orientations")
        for orientations_item_data in _orientations:
            orientations_item = PartJobRequestSetupPlanType0SetupsItemOrientationsItem.from_dict(orientations_item_data)

            orientations.append(orientations_item)

        part_job_request_setup_plan_type_0_setups_item = cls(
            orientations=orientations,
        )

        return part_job_request_setup_plan_type_0_setups_item
