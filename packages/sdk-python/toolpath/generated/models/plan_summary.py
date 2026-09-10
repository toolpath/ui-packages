from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_summary_level import PlanSummaryLevel

if TYPE_CHECKING:
    from ..models.plan_issue import PlanIssue


T = TypeVar("T", bound="PlanSummary")


@_attrs_define
class PlanSummary:
    """
    Attributes:
        plan_id (UUID): Identifier of this plan.
        job_id (UUID): Identifier of the job that produced this plan.
        kernel_version (str): Version of the Toolpath kernel that produced this plan.
        level (PlanSummaryLevel): Fidelity of this plan: `planned` (setups and action-specs only) or `toolpathed`
            (toolpaths also calculated).
        issues (list[PlanIssue]): The plan’s coverage shortfalls (see PlanResponse.issues). Empty when it covers all.
        created_at (datetime.datetime): When this plan was created (ISO 8601).
    """

    plan_id: UUID
    job_id: UUID
    kernel_version: str
    level: PlanSummaryLevel
    issues: list[PlanIssue]
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        plan_id = str(self.plan_id)

        job_id = str(self.job_id)

        kernel_version = self.kernel_version

        level = self.level.value

        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "planId": plan_id,
                "jobId": job_id,
                "kernelVersion": kernel_version,
                "level": level,
                "issues": issues,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_issue import PlanIssue

        d = dict(src_dict)
        plan_id = UUID(d.pop("planId"))

        job_id = UUID(d.pop("jobId"))

        kernel_version = d.pop("kernelVersion")

        level = PlanSummaryLevel(d.pop("level"))

        issues = []
        _issues = d.pop("issues")
        for issues_item_data in _issues:
            issues_item = PlanIssue.from_dict(issues_item_data)

            issues.append(issues_item)

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        plan_summary = cls(
            plan_id=plan_id,
            job_id=job_id,
            kernel_version=kernel_version,
            level=level,
            issues=issues,
            created_at=created_at,
        )

        plan_summary.additional_properties = d
        return plan_summary

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
