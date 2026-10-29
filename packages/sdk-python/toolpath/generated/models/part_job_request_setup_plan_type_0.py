from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.part_job_request_setup_plan_type_0_setups_item import PartJobRequestSetupPlanType0SetupsItem


T = TypeVar("T", bound="PartJobRequestSetupPlanType0")


@_attrs_define
class PartJobRequestSetupPlanType0:
    """The setup plan to extend: setups in machining order, each stated as one `orientations` entry — a setup machines from
    one direction — naming the features (`featureTag`, hex) to machine from its `direction`. A direction must be one of
    the part’s `candidateDirections` — the kernel’s choice, or one added with **Analyze a part** — passed back exactly
    as served (a unit vector), and a feature is named under its own direction. The plan made keeps these setups first,
    in this order, each holding at least the features named (and every other offered feature of its direction), and
    appends setups where the part needs more. A plan read serves its own `setupPlan`, which can be edited and sent back.
    Tags are stable only within one `kernelVersion`. A feature named is machined where it is named whatever it needs:
    one no tool in the crib cuts is planned all the same, its passes left `unmachined`. It also keeps its regions from
    every other feature, in every direction: a feature that shares one is planned as what is left of it, under a tag of
    its own that the plan’s `trimmedFeatures` describes, and the plan’s `setupPlan` may name that tag in turn. A
    statement the kernel cannot honor fails the job, whose `error` begins `refused_user_plan:` and gives one clause per
    refused statement. Omit or null for the kernel’s own plan; on **Calculate a plan’s toolpaths**, omit to keep the
    plan’s statement and null to clear it.

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
