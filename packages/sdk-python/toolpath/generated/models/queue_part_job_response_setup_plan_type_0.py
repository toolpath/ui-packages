from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.queue_part_job_response_setup_plan_type_0_setups_item import (
        QueuePartJobResponseSetupPlanType0SetupsItem,
    )


T = TypeVar("T", bound="QueuePartJobResponseSetupPlanType0")


@_attrs_define
class QueuePartJobResponseSetupPlanType0:
    """The setup plan the job extends — the request’s, or null for the kernel’s own plan.

    Attributes:
        setups (list[QueuePartJobResponseSetupPlanType0SetupsItem]):
    """

    setups: list[QueuePartJobResponseSetupPlanType0SetupsItem]

    def to_dict(self) -> dict[str, Any]:
        setups = []
        for setups_item_data in self.setups:
            setups_item = setups_item_data.to_dict()
            setups.append(setups_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "setups": setups,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.queue_part_job_response_setup_plan_type_0_setups_item import (
            QueuePartJobResponseSetupPlanType0SetupsItem,
        )

        d = dict(src_dict)
        setups = []
        _setups = d.pop("setups")
        for setups_item_data in _setups:
            setups_item = QueuePartJobResponseSetupPlanType0SetupsItem.from_dict(setups_item_data)

            setups.append(setups_item)

        queue_part_job_response_setup_plan_type_0 = cls(
            setups=setups,
        )

        return queue_part_job_response_setup_plan_type_0
