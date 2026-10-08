from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.part_job_request_setup_plan_type_0_setups_item import PartJobRequestSetupPlanType0SetupsItem


T = TypeVar("T", bound="PartJobRequestSetupPlanType0")


@_attrs_define
class PartJobRequestSetupPlanType0:
    """The setup plan to extend: setups in machining order, each with one `orientations` entry — a 3-axis setup; features
    are measured in thin air, which holds one direction per setup, so a 3+2 setup is not stated yet — naming the
    features (`featureTag`, hex) to machine from its `direction`. A direction must be one a feature of the part was
    extracted from, passed back exactly as served (a unit vector), and a feature is named under its own direction. The
    plan made keeps these setups first, in this order, each holding at least the features named (and every other offered
    feature of its direction), and appends setups where the part needs more. A plan read serves its own `setupPlan`,
    which can be edited and sent back. Tags are stable only within one `kernelVersion`, and a feature named has to be
    offered: one no tool in the crib cuts is not. A statement the kernel cannot honor fails the job, whose `error`
    begins `refused_user_plan:` and gives one clause per refused statement. Omit or null for the kernel’s own plan; on
    **Calculate a plan’s toolpaths**, omit to keep the plan’s statement and null to clear it.

        Example:
            {'setups': [{'orientations': [{'direction': {'x': 0, 'y': 0, 'z': 1}, 'features': ['1f3a09c2']}]},
                {'orientations': [{'direction': {'x': 0, 'y': 0, 'z': -1}, 'features': []}]}]}

        Attributes:
            setups (list[PartJobRequestSetupPlanType0SetupsItem]):
    """

    setups: list[PartJobRequestSetupPlanType0SetupsItem]

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
        from ..models.part_job_request_setup_plan_type_0_setups_item import PartJobRequestSetupPlanType0SetupsItem

        d = dict(src_dict)
        setups = []
        _setups = d.pop("setups")
        for setups_item_data in _setups:
            setups_item = PartJobRequestSetupPlanType0SetupsItem.from_dict(setups_item_data)

            setups.append(setups_item)

        part_job_request_setup_plan_type_0 = cls(
            setups=setups,
        )

        return part_job_request_setup_plan_type_0
