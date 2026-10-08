from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_response_level import PlanResponseLevel
from ..models.plan_response_material import PlanResponseMaterial

if TYPE_CHECKING:
    from ..models.plan_issue import PlanIssue
    from ..models.plan_response_done_regions_type_0 import PlanResponseDoneRegionsType0
    from ..models.plan_response_setup_plan_type_0 import PlanResponseSetupPlanType0
    from ..models.plan_response_stock import PlanResponseStock
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
        material (PlanResponseMaterial): The material this plan was synthesized for. Its tools’ feeds and speeds — and
            so every machining time here — are the kernel’s for it. `Aluminum` on plans made before it was recorded.
        stock (PlanResponseStock): The saved stock input and the initial geometry the kernel resolved from it.
        level (PlanResponseLevel): Fidelity of this plan: `planned` (setups and action-specs only) or `toolpathed`
            (toolpaths also calculated — fetch them at /plans/{planId}/toolpaths).
        issues (list[PlanIssue]): The plan’s coverage shortfalls — what it leaves uncut, each with its area (mm²). Empty
            when the plan machines everything it owes; gate a quote on this rather than on cut coverage alone.
        setups (list[PlanSetup]): Setups, in machining order.
        setup_plan (None | PlanResponseSetupPlanType0): The plan’s own statement of itself, in the shape a request’s
            `setupPlan` takes: every setup in order, its direction, and the features planned from it. Sent back with the
            same `doneRegions`, tool crib, material and machine, under the same `kernelVersion`, it plans the same, so it is
            what a caller edits to restate the plan. Its tags belong to this plan’s `kernelVersion`. Null for a plan with no
            setup and for plans made before it was recorded.
        done_regions (None | PlanResponseDoneRegionsType0): The regions this plan was told are already at their final
            surface, and the kernel version they were read under — or null for none. They are left out of `issues`, of
            machining times and of toolpaths: a plan whose `issues` are empty machines everything it owes *except* these,
            which the caller vouched for.
    """

    part_id: UUID
    plan_id: UUID
    job_id: UUID
    kernel_version: str
    material: PlanResponseMaterial
    stock: PlanResponseStock
    level: PlanResponseLevel
    issues: list[PlanIssue]
    setups: list[PlanSetup]
    setup_plan: None | PlanResponseSetupPlanType0
    done_regions: None | PlanResponseDoneRegionsType0
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.plan_response_done_regions_type_0 import PlanResponseDoneRegionsType0
        from ..models.plan_response_setup_plan_type_0 import PlanResponseSetupPlanType0

        part_id = str(self.part_id)

        plan_id = str(self.plan_id)

        job_id = str(self.job_id)

        kernel_version = self.kernel_version

        material = self.material.value

        stock = self.stock.to_dict()

        level = self.level.value

        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)

        setups = []
        for setups_item_data in self.setups:
            setups_item = setups_item_data.to_dict()
            setups.append(setups_item)

        setup_plan: dict[str, Any] | None
        if isinstance(self.setup_plan, PlanResponseSetupPlanType0):
            setup_plan = self.setup_plan.to_dict()
        else:
            setup_plan = self.setup_plan

        done_regions: dict[str, Any] | None
        if isinstance(self.done_regions, PlanResponseDoneRegionsType0):
            done_regions = self.done_regions.to_dict()
        else:
            done_regions = self.done_regions

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partId": part_id,
                "planId": plan_id,
                "jobId": job_id,
                "kernelVersion": kernel_version,
                "material": material,
                "stock": stock,
                "level": level,
                "issues": issues,
                "setups": setups,
                "setupPlan": setup_plan,
                "doneRegions": done_regions,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_issue import PlanIssue
        from ..models.plan_response_done_regions_type_0 import PlanResponseDoneRegionsType0
        from ..models.plan_response_setup_plan_type_0 import PlanResponseSetupPlanType0
        from ..models.plan_response_stock import PlanResponseStock
        from ..models.plan_setup import PlanSetup

        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        plan_id = UUID(d.pop("planId"))

        job_id = UUID(d.pop("jobId"))

        kernel_version = d.pop("kernelVersion")

        material = PlanResponseMaterial(d.pop("material"))

        stock = PlanResponseStock.from_dict(d.pop("stock"))

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

        def _parse_setup_plan(data: object) -> None | PlanResponseSetupPlanType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                setup_plan_type_0 = PlanResponseSetupPlanType0.from_dict(data)

                return setup_plan_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PlanResponseSetupPlanType0, data)

        setup_plan = _parse_setup_plan(d.pop("setupPlan"))

        def _parse_done_regions(data: object) -> None | PlanResponseDoneRegionsType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                done_regions_type_0 = PlanResponseDoneRegionsType0.from_dict(data)

                return done_regions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PlanResponseDoneRegionsType0, data)

        done_regions = _parse_done_regions(d.pop("doneRegions"))

        plan_response = cls(
            part_id=part_id,
            plan_id=plan_id,
            job_id=job_id,
            kernel_version=kernel_version,
            material=material,
            stock=stock,
            level=level,
            issues=issues,
            setups=setups,
            setup_plan=setup_plan,
            done_regions=done_regions,
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
