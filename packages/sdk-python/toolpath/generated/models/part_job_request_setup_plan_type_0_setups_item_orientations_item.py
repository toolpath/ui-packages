from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.part_job_request_setup_plan_type_0_setups_item_orientations_item_direction import (
        PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection,
    )


T = TypeVar("T", bound="PartJobRequestSetupPlanType0SetupsItemOrientationsItem")


@_attrs_define
class PartJobRequestSetupPlanType0SetupsItemOrientationsItem:
    """
    Attributes:
        direction (PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection):
        features (list[str]):
    """

    direction: PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection
    features: list[str]

    def to_dict(self) -> dict[str, Any]:
        direction = self.direction.to_dict()

        features = self.features

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "direction": direction,
                "features": features,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.part_job_request_setup_plan_type_0_setups_item_orientations_item_direction import (
            PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection,
        )

        d = dict(src_dict)
        direction = PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection.from_dict(d.pop("direction"))

        features = cast(list[str], d.pop("features"))

        part_job_request_setup_plan_type_0_setups_item_orientations_item = cls(
            direction=direction,
            features=features,
        )

        return part_job_request_setup_plan_type_0_setups_item_orientations_item
