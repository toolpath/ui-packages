from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.plan_response_setup_plan_type_0_setups_item import PlanResponseSetupPlanType0SetupsItem


T = TypeVar("T", bound="PlanResponseSetupPlanType0")


@_attrs_define
class PlanResponseSetupPlanType0:
    """The plan’s own statement of itself, in the shape a request’s `setupPlan` takes: every setup in order, its direction,
    and the features planned from it. Sent back with the same `doneRegions`, tool crib, material and machine, under the
    same `kernelVersion`, it plans the same, so it is what a caller edits to restate the plan. Its tags belong to this
    plan’s `kernelVersion`. Null for a plan with no setup and for plans made before it was recorded.

        Attributes:
            setups (list[PlanResponseSetupPlanType0SetupsItem]):
    """

    setups: list[PlanResponseSetupPlanType0SetupsItem]

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
        from ..models.plan_response_setup_plan_type_0_setups_item import PlanResponseSetupPlanType0SetupsItem

        d = dict(src_dict)
        setups = []
        _setups = d.pop("setups")
        for setups_item_data in _setups:
            setups_item = PlanResponseSetupPlanType0SetupsItem.from_dict(setups_item_data)

            setups.append(setups_item)

        plan_response_setup_plan_type_0 = cls(
            setups=setups,
        )

        return plan_response_setup_plan_type_0
