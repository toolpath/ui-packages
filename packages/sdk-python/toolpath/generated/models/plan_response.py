from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_response_level import PlanResponseLevel

if TYPE_CHECKING:
    from ..models.plan_issue import PlanIssue
    from ..models.plan_setup import PlanSetup


T = TypeVar("T", bound="PlanResponse")


@_attrs_define
class PlanResponse:
    """
    Attributes:
        part_id (UUID): Identifier of this part.
        plan_id (UUID): Identifier of this plan.
        job_id (UUID): Identifier of the job that produced this plan.
        kernel_version (str): Version of the Toolpath kernel that produced this plan.
        level (PlanResponseLevel): Fidelity of this plan: `planned` (setups and action-specs only) or `toolpathed`
            (toolpaths also calculated — fetch them at /plans/{planId}/toolpaths).
        issues (list[PlanIssue]): The plan’s coverage shortfalls — what it leaves uncut, each with its area (mm²). Empty
            when the plan machines everything it owes; gate a quote on this rather than on cut coverage alone.
        setups (list[PlanSetup]): Setups, in machining order.
    """

    part_id: UUID
    plan_id: UUID
    job_id: UUID
    kernel_version: str
    level: PlanResponseLevel
    issues: list[PlanIssue]
    setups: list[PlanSetup]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        part_id = str(self.part_id)

        plan_id = str(self.plan_id)

        job_id = str(self.job_id)

        kernel_version = self.kernel_version

        level = self.level.value

        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)

        setups = []
        for setups_item_data in self.setups:
            setups_item = setups_item_data.to_dict()
            setups.append(setups_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partId": part_id,
                "planId": plan_id,
                "jobId": job_id,
                "kernelVersion": kernel_version,
                "level": level,
                "issues": issues,
                "setups": setups,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_issue import PlanIssue
        from ..models.plan_setup import PlanSetup

        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        plan_id = UUID(d.pop("planId"))

        job_id = UUID(d.pop("jobId"))

        kernel_version = d.pop("kernelVersion")

        level = PlanResponseLevel(d.pop("level"))

        issues = []
        _issues = d.pop("issues")
        for issues_item_data in _issues:
            issues_item = PlanIssue.from_dict(issues_item_data)

            issues.append(issues_item)

        setups = []
        _setups = d.pop("setups")
        for setups_item_data in _setups:
            setups_item = PlanSetup.from_dict(setups_item_data)

            setups.append(setups_item)

        plan_response = cls(
            part_id=part_id,
            plan_id=plan_id,
            job_id=job_id,
            kernel_version=kernel_version,
            level=level,
            issues=issues,
            setups=setups,
        )

        plan_response.additional_properties = d
        return plan_response

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
