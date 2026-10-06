from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

T = TypeVar("T", bound="PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection")


@_attrs_define
class PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection:
    """
    Attributes:
        x (float):
        y (float):
        z (float):
    """

    x: float
    y: float
    z: float

    def to_dict(self) -> dict[str, Any]:
        x = self.x

        y = self.y

        z = self.z

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "x": x,
                "y": y,
                "z": z,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        x = d.pop("x")

        y = d.pop("y")

        z = d.pop("z")

        part_job_request_setup_plan_type_0_setups_item_orientations_item_direction = cls(
            x=x,
            y=y,
            z=z,
        )

        return part_job_request_setup_plan_type_0_setups_item_orientations_item_direction
