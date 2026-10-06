from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.queue_part_job_response_material import QueuePartJobResponseMaterial
from ..models.queue_part_job_response_status import QueuePartJobResponseStatus

if TYPE_CHECKING:
    from ..models.queue_part_job_response_done_regions_type_0 import QueuePartJobResponseDoneRegionsType0
    from ..models.queue_part_job_response_machine_type_0 import QueuePartJobResponseMachineType0
    from ..models.queue_part_job_response_setup_plan_type_0 import QueuePartJobResponseSetupPlanType0
    from ..models.queue_part_job_response_stock import QueuePartJobResponseStock
    from ..models.queue_part_job_response_tool_crib_item_type_0 import QueuePartJobResponseToolCribItemType0


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
        tool_crib (list[QueuePartJobResponseToolCribItemType0]): The tool crib the job was planned with — the request’s,
            or the default when it named none — as validated.
        machine (None | QueuePartJobResponseMachineType0): The machine the job was recorded against — the request’s, or
            null when it named none — and whose `maxRpm` its tools are held under.
        setup_plan (None | QueuePartJobResponseSetupPlanType0): The setup plan the job extends — the request’s, or null
            for the kernel’s own plan.
        done_regions (None | QueuePartJobResponseDoneRegionsType0): The regions the job treats as done — the request’s,
            or null for none.
        stock (QueuePartJobResponseStock): The queued stock input and its not-yet-calculated geometry.
        fallback_tools (bool): Whether the job plans what the crib cannot with fallback tools.
        status (QueuePartJobResponseStatus): Initial state of the accepted processing job.
    """

    job_id: UUID
    part_id: UUID
    plan_id: UUID
    material: QueuePartJobResponseMaterial
    tool_crib: list[QueuePartJobResponseToolCribItemType0]
    machine: None | QueuePartJobResponseMachineType0
    setup_plan: None | QueuePartJobResponseSetupPlanType0
    done_regions: None | QueuePartJobResponseDoneRegionsType0
    stock: QueuePartJobResponseStock
    fallback_tools: bool
    status: QueuePartJobResponseStatus
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.queue_part_job_response_done_regions_type_0 import QueuePartJobResponseDoneRegionsType0
        from ..models.queue_part_job_response_machine_type_0 import QueuePartJobResponseMachineType0
        from ..models.queue_part_job_response_setup_plan_type_0 import QueuePartJobResponseSetupPlanType0
        from ..models.queue_part_job_response_tool_crib_item_type_0 import QueuePartJobResponseToolCribItemType0

        job_id = str(self.job_id)

        part_id = str(self.part_id)

        plan_id = str(self.plan_id)

        material = self.material.value

        tool_crib = []
        for tool_crib_item_data in self.tool_crib:
            tool_crib_item: dict[str, Any]
            if isinstance(tool_crib_item_data, QueuePartJobResponseToolCribItemType0):
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

        stock = self.stock.to_dict()

        fallback_tools = self.fallback_tools

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
                "stock": stock,
                "fallbackTools": fallback_tools,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.queue_part_job_response_done_regions_type_0 import QueuePartJobResponseDoneRegionsType0
        from ..models.queue_part_job_response_machine_type_0 import QueuePartJobResponseMachineType0
        from ..models.queue_part_job_response_setup_plan_type_0 import QueuePartJobResponseSetupPlanType0
        from ..models.queue_part_job_response_stock import QueuePartJobResponseStock
        from ..models.queue_part_job_response_tool_crib_item_type_0 import QueuePartJobResponseToolCribItemType0

        d = dict(src_dict)
        job_id = UUID(d.pop("jobId"))

        part_id = UUID(d.pop("partId"))

        plan_id = UUID(d.pop("planId"))

        material = QueuePartJobResponseMaterial(d.pop("material"))

        tool_crib = []
        _tool_crib = d.pop("toolCrib")
        for tool_crib_item_data in _tool_crib:

            def _parse_tool_crib_item(data: object) -> QueuePartJobResponseToolCribItemType0:
                if not isinstance(data, dict):
                    raise TypeError()
                tool_crib_item_type_0 = QueuePartJobResponseToolCribItemType0.from_dict(data)

                return tool_crib_item_type_0

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

        stock = QueuePartJobResponseStock.from_dict(d.pop("stock"))

        fallback_tools = d.pop("fallbackTools")

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
            stock=stock,
            fallback_tools=fallback_tools,
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
