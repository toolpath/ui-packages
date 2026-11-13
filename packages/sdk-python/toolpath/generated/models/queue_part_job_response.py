from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.queue_part_job_response_material import QueuePartJobResponseMaterial
from ..models.queue_part_job_response_status import QueuePartJobResponseStatus
from ..models.queue_part_job_response_workholding import QueuePartJobResponseWorkholding

if TYPE_CHECKING:
    from ..models.fusion_tool_library import FusionToolLibrary
    from ..models.implicit_tool_library import ImplicitToolLibrary
    from ..models.plan_spec import PlanSpec
    from ..models.queue_part_job_response_done_regions_type_0 import QueuePartJobResponseDoneRegionsType0
    from ..models.queue_part_job_response_machine_type_0 import QueuePartJobResponseMachineType0
    from ..models.queue_part_job_response_setup_plan_type_0 import QueuePartJobResponseSetupPlanType0
    from ..models.queue_part_job_response_stock import QueuePartJobResponseStock


T = TypeVar("T", bound="QueuePartJobResponse")


@_attrs_define
class QueuePartJobResponse:
    """
    Attributes:
        job_id (UUID): Identifier of the queued processing job.
        part_id (UUID): Identifier of the part submitted for processing.
        plan_id (UUID): Identifier of the plan this job writes to. Read results at /plans/{planId} once the job
            completes.
        material (QueuePartJobResponseMaterial): The material the job was planned for — the request’s, or the default
            when it named none. Echoed so the choice is visible even when a non-JSON body dropped it. Example:
            LowCarbonSteel.
        tool_crib (list[FusionToolLibrary | ImplicitToolLibrary]): The tool crib the job was planned with — the
            request’s, or the default when it named none — as validated.
        machine (None | QueuePartJobResponseMachineType0): The machine the job was recorded against — the request’s, or
            null when it named none — and whose `maxRpm` its synthesized tools are held under.
        setup_plan (None | QueuePartJobResponseSetupPlanType0): The setup plan the job extends — the request’s, or null
            for the kernel’s own plan.
        done_regions (None | QueuePartJobResponseDoneRegionsType0): The regions the job treats as done — the request’s,
            or null for none.
        plan_spec (None | PlanSpec): The plan spec the job states — the request’s, or null for none. **Experimental.**
            Available now and still gaining functionality. It may change in breaking ways in a minor API release; each such
            change is listed in the release notes, so check them before upgrading.
        stock (QueuePartJobResponseStock): The queued stock input and its not-yet-calculated geometry.
        fallback_tools (bool): Whether the job plans what the crib cannot with fallback tools.
        workholding (QueuePartJobResponseWorkholding): How the job holds the part — the request’s, or `thinAir` when it
            named none. `vacuumTable` is experimental.
        spoilboard_height (float | None): **Experimental.** Available now and still gaining functionality. It may change
            in breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            The height of the vacuum table’s spoilboard, in mm, 0 for none; null under any other workholding.
        status (QueuePartJobResponseStatus): Initial state of the accepted processing job.
    """

    job_id: UUID
    part_id: UUID
    plan_id: UUID
    material: QueuePartJobResponseMaterial
    tool_crib: list[FusionToolLibrary | ImplicitToolLibrary]
    machine: None | QueuePartJobResponseMachineType0
    setup_plan: None | QueuePartJobResponseSetupPlanType0
    done_regions: None | QueuePartJobResponseDoneRegionsType0
    plan_spec: None | PlanSpec
    stock: QueuePartJobResponseStock
    fallback_tools: bool
    workholding: QueuePartJobResponseWorkholding
    spoilboard_height: float | None
    status: QueuePartJobResponseStatus
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.implicit_tool_library import ImplicitToolLibrary
        from ..models.plan_spec import PlanSpec
        from ..models.queue_part_job_response_done_regions_type_0 import QueuePartJobResponseDoneRegionsType0
        from ..models.queue_part_job_response_machine_type_0 import QueuePartJobResponseMachineType0
        from ..models.queue_part_job_response_setup_plan_type_0 import QueuePartJobResponseSetupPlanType0

        job_id = str(self.job_id)

        part_id = str(self.part_id)

        plan_id = str(self.plan_id)

        material = self.material.value

        tool_crib = []
        for tool_crib_item_data in self.tool_crib:
            tool_crib_item: dict[str, Any]
            if isinstance(tool_crib_item_data, ImplicitToolLibrary):
                tool_crib_item = tool_crib_item_data.to_dict()
            else:
                tool_crib_item = tool_crib_item_data.to_dict()

            tool_crib.append(tool_crib_item)

        machine: dict[str, Any] | None
        if isinstance(self.machine, QueuePartJobResponseMachineType0):
            machine = self.machine.to_dict()
        else:
            machine = self.machine

        setup_plan: dict[str, Any] | None
        if isinstance(self.setup_plan, QueuePartJobResponseSetupPlanType0):
            setup_plan = self.setup_plan.to_dict()
        else:
            setup_plan = self.setup_plan

        done_regions: dict[str, Any] | None
        if isinstance(self.done_regions, QueuePartJobResponseDoneRegionsType0):
            done_regions = self.done_regions.to_dict()
        else:
            done_regions = self.done_regions

        plan_spec: dict[str, Any] | None
        if isinstance(self.plan_spec, PlanSpec):
            plan_spec = self.plan_spec.to_dict()
        else:
            plan_spec = self.plan_spec

        stock = self.stock.to_dict()

        fallback_tools = self.fallback_tools

        workholding = self.workholding.value

        spoilboard_height: float | None
        spoilboard_height = self.spoilboard_height

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "jobId": job_id,
                "partId": part_id,
                "planId": plan_id,
                "material": material,
                "toolCrib": tool_crib,
                "machine": machine,
                "setupPlan": setup_plan,
                "doneRegions": done_regions,
                "planSpec": plan_spec,
                "stock": stock,
                "fallbackTools": fallback_tools,
                "workholding": workholding,
                "spoilboardHeight": spoilboard_height,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.fusion_tool_library import FusionToolLibrary
        from ..models.implicit_tool_library import ImplicitToolLibrary
        from ..models.plan_spec import PlanSpec
        from ..models.queue_part_job_response_done_regions_type_0 import QueuePartJobResponseDoneRegionsType0
        from ..models.queue_part_job_response_machine_type_0 import QueuePartJobResponseMachineType0
        from ..models.queue_part_job_response_setup_plan_type_0 import QueuePartJobResponseSetupPlanType0
        from ..models.queue_part_job_response_stock import QueuePartJobResponseStock

        d = dict(src_dict)
        job_id = UUID(d.pop("jobId"))

        part_id = UUID(d.pop("partId"))

        plan_id = UUID(d.pop("planId"))

        material = QueuePartJobResponseMaterial(d.pop("material"))

        tool_crib = []
        _tool_crib = d.pop("toolCrib")
        for tool_crib_item_data in _tool_crib:

            def _parse_tool_crib_item(data: object) -> FusionToolLibrary | ImplicitToolLibrary:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    tool_crib_item_type_0 = ImplicitToolLibrary.from_dict(data)

                    return tool_crib_item_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                if not isinstance(data, dict):
                    raise TypeError()
                tool_crib_item_type_1 = FusionToolLibrary.from_dict(data)

                return tool_crib_item_type_1

            tool_crib_item = _parse_tool_crib_item(tool_crib_item_data)

            tool_crib.append(tool_crib_item)

        def _parse_machine(data: object) -> None | QueuePartJobResponseMachineType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                machine_type_0 = QueuePartJobResponseMachineType0.from_dict(data)

                return machine_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | QueuePartJobResponseMachineType0, data)

        machine = _parse_machine(d.pop("machine"))

        def _parse_setup_plan(data: object) -> None | QueuePartJobResponseSetupPlanType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                setup_plan_type_0 = QueuePartJobResponseSetupPlanType0.from_dict(data)

                return setup_plan_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | QueuePartJobResponseSetupPlanType0, data)

        setup_plan = _parse_setup_plan(d.pop("setupPlan"))

        def _parse_done_regions(data: object) -> None | QueuePartJobResponseDoneRegionsType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                done_regions_type_0 = QueuePartJobResponseDoneRegionsType0.from_dict(data)

                return done_regions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | QueuePartJobResponseDoneRegionsType0, data)

        done_regions = _parse_done_regions(d.pop("doneRegions"))

        def _parse_plan_spec(data: object) -> None | PlanSpec:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                plan_spec_type_0 = PlanSpec.from_dict(data)

                return plan_spec_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PlanSpec, data)

        plan_spec = _parse_plan_spec(d.pop("planSpec"))

        stock = QueuePartJobResponseStock.from_dict(d.pop("stock"))

        fallback_tools = d.pop("fallbackTools")

        workholding = QueuePartJobResponseWorkholding(d.pop("workholding"))

        def _parse_spoilboard_height(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        spoilboard_height = _parse_spoilboard_height(d.pop("spoilboardHeight"))

        status = QueuePartJobResponseStatus(d.pop("status"))

        queue_part_job_response = cls(
            job_id=job_id,
            part_id=part_id,
            plan_id=plan_id,
            material=material,
            tool_crib=tool_crib,
            machine=machine,
            setup_plan=setup_plan,
            done_regions=done_regions,
            plan_spec=plan_spec,
            stock=stock,
            fallback_tools=fallback_tools,
            workholding=workholding,
            spoilboard_height=spoilboard_height,
            status=status,
        )

        queue_part_job_response.additional_properties = d
        return queue_part_job_response

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
