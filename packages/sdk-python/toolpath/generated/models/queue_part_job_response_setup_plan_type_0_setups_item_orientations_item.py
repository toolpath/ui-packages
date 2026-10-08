from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.queue_part_job_response_setup_plan_type_0_setups_item_orientations_item_direction import (
        QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItemDirection,
    )


T = TypeVar("T", bound="QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItem")


@_attrs_define
class QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItem:
    """
    Attributes:
        direction (QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItemDirection):
        features (list[str]):
    """

    direction: QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItemDirection
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
        from ..models.queue_part_job_response_setup_plan_type_0_setups_item_orientations_item_direction import (
            QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItemDirection,
        )

        d = dict(src_dict)
        direction = QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItemDirection.from_dict(d.pop("direction"))

        features = cast(list[str], d.pop("features"))

        queue_part_job_response_setup_plan_type_0_setups_item_orientations_item = cls(
            direction=direction,
            features=features,
        )

        return queue_part_job_response_setup_plan_type_0_setups_item_orientations_item
