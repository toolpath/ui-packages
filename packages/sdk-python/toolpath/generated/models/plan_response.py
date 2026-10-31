from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_response_level import PlanResponseLevel
from ..models.plan_response_material import PlanResponseMaterial
from ..models.plan_response_workholding import PlanResponseWorkholding

if TYPE_CHECKING:
    from ..models.plan_issue import PlanIssue
    from ..models.plan_response_done_regions_type_0 import PlanResponseDoneRegionsType0
    from ..models.plan_response_setup_plan_type_0 import PlanResponseSetupPlanType0
    from ..models.plan_response_stock import PlanResponseStock
    from ..models.plan_setup import PlanSetup
    from ..models.trimmed_feature import TrimmedFeature


T = TypeVar("T", bound="PlanResponse")


@_attrs_define
class PlanResponse:
    """
    Attributes:
        part_id (UUID): Identifier of this part.
        plan_id (UUID): Identifier of this plan.
        job_id (UUID): Identifier of the job that produced this plan. A toolpath calculation records itself here as soon
            as it has planned the part, while it cuts; a `toolpathed` plan keeps the job of its last result until a
            recalculation completes. Compare it with the job you queued.
        kernel_version (str): Version of the Toolpath kernel that produced this plan.
        material (PlanResponseMaterial): The material this plan was synthesized for. Its tools’ feeds and speeds — and
            so every machining time here — are the kernel’s for it. `Aluminum` on plans made before it was recorded.
        stock (PlanResponseStock): The saved stock input and the initial geometry the kernel resolved from it.
        workholding (PlanResponseWorkholding): How the plan’s job held the part, which a recalculation that names none
            holds it by. `thinAir` for plans made before Engine API 1.24.0.
        level (PlanResponseLevel): Fidelity of this plan: `planned` (setups and action-specs only) or `toolpathed`
            (toolpaths also calculated — fetch them at /plans/{planId}/toolpaths). A plan is readable at `planned` as soon
            as a calculation has planned the part, while `jobId` names the job cutting it. A `toolpathed` plan keeps its
            last result while it is recalculated. After a failed calculation the plan stays as its last successful run left
            it, or `planned` under the failed job.
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
        trimmed_features (list[TrimmedFeature] | None): The features of the part as this plan reads it — after its
            skipped regions and stated features trim it — that `GET /v1/parts/{id}` does not list, whether or not a setup
            names them. A part feature holding a region the plan skips — a done region, or one its stock body already leaves
            at size — or a region of a feature the job’s `setupPlan` names, is read as what is left of it, under a tag of
            its own, which the plan’s `setupPlan`, `featureTags` and `unmachined` may name; each such feature is here, with
            the part feature it was cut from. Empty where nothing trimmed a feature; null for a plan that skips no region
            and whose `setupPlan` names no feature, and for plans made before Engine API 1.30.0.
    """

    part_id: UUID
    plan_id: UUID
    job_id: UUID
    kernel_version: str
    material: PlanResponseMaterial
    stock: PlanResponseStock
    workholding: PlanResponseWorkholding
    level: PlanResponseLevel
    issues: list[PlanIssue]
    setups: list[PlanSetup]
    setup_plan: None | PlanResponseSetupPlanType0
    done_regions: None | PlanResponseDoneRegionsType0
    trimmed_features: list[TrimmedFeature] | None
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

        workholding = self.workholding.value

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

        trimmed_features: list[dict[str, Any]] | None
        if isinstance(self.trimmed_features, list):
            trimmed_features = []
            for trimmed_features_type_0_item_data in self.trimmed_features:
                trimmed_features_type_0_item = trimmed_features_type_0_item_data.to_dict()
                trimmed_features.append(trimmed_features_type_0_item)

        else:
            trimmed_features = self.trimmed_features

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
                "workholding": workholding,
                "level": level,
                "issues": issues,
                "setups": setups,
                "setupPlan": setup_plan,
                "doneRegions": done_regions,
                "trimmedFeatures": trimmed_features,
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
        from ..models.trimmed_feature import TrimmedFeature

        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        plan_id = UUID(d.pop("planId"))

        job_id = UUID(d.pop("jobId"))

        kernel_version = d.pop("kernelVersion")

        material = PlanResponseMaterial(d.pop("material"))

        stock = PlanResponseStock.from_dict(d.pop("stock"))

        workholding = PlanResponseWorkholding(d.pop("workholding"))

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

        def _parse_trimmed_features(data: object) -> list[TrimmedFeature] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                trimmed_features_type_0 = []
                _trimmed_features_type_0 = data
                for trimmed_features_type_0_item_data in _trimmed_features_type_0:
                    trimmed_features_type_0_item = TrimmedFeature.from_dict(trimmed_features_type_0_item_data)

                    trimmed_features_type_0.append(trimmed_features_type_0_item)

                return trimmed_features_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[TrimmedFeature] | None, data)

        trimmed_features = _parse_trimmed_features(d.pop("trimmedFeatures"))

        plan_response = cls(
            part_id=part_id,
            plan_id=plan_id,
            job_id=job_id,
            kernel_version=kernel_version,
            material=material,
            stock=stock,
            workholding=workholding,
            level=level,
            issues=issues,
            setups=setups,
            setup_plan=setup_plan,
            done_regions=done_regions,
            trimmed_features=trimmed_features,
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
