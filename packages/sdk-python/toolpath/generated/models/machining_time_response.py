from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.machining_time_setup import MachiningTimeSetup


T = TypeVar("T", bound="MachiningTimeResponse")


@_attrs_define
class MachiningTimeResponse:
    """
    Attributes:
        part_id (UUID): Identifier of this part.
        plan_id (UUID): Identifier of the plan.
        kernel_version (str): Version of the Toolpath kernel that produced these toolpaths.
        total_machining_time_seconds (float): Sum of every cut action’s calculated machining time, in seconds — the
            toolpath time at its programmed feeds (links and rapids included), with tool changes excluded and refused
            actions contributing nothing, so when `refusedCount` is nonzero this total is partial (not the whole job).
        setup_count (int): Number of setups.
        action_count (int): Number of actions.
        refused_count (int): Number of actions the runner refused (no toolpath calculated). These contribute nothing to
            the totals, so a nonzero count means the machining-time total covers only part of the plan.
        total_cutting_length (float): Sum of cut actions’ cutting lengths, in mm.
        total_path_length (float): Sum of cut actions’ full path lengths, in mm.
        setups (list[MachiningTimeSetup]): Per-action machining times, grouped by setup, in machining order.
    """

    part_id: UUID
    plan_id: UUID
    kernel_version: str
    total_machining_time_seconds: float
    setup_count: int
    action_count: int
    refused_count: int
    total_cutting_length: float
    total_path_length: float
    setups: list[MachiningTimeSetup]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        part_id = str(self.part_id)

        plan_id = str(self.plan_id)

        kernel_version = self.kernel_version

        total_machining_time_seconds = self.total_machining_time_seconds

        setup_count = self.setup_count

        action_count = self.action_count

        refused_count = self.refused_count

        total_cutting_length = self.total_cutting_length

        total_path_length = self.total_path_length

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
                "kernelVersion": kernel_version,
                "totalMachiningTimeSeconds": total_machining_time_seconds,
                "setupCount": setup_count,
                "actionCount": action_count,
                "refusedCount": refused_count,
                "totalCuttingLength": total_cutting_length,
                "totalPathLength": total_path_length,
                "setups": setups,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.machining_time_setup import MachiningTimeSetup

        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        plan_id = UUID(d.pop("planId"))

        kernel_version = d.pop("kernelVersion")

        total_machining_time_seconds = d.pop("totalMachiningTimeSeconds")

        setup_count = d.pop("setupCount")

        action_count = d.pop("actionCount")

        refused_count = d.pop("refusedCount")

        total_cutting_length = d.pop("totalCuttingLength")

        total_path_length = d.pop("totalPathLength")

        setups = []
        _setups = d.pop("setups")
        for setups_item_data in _setups:
            setups_item = MachiningTimeSetup.from_dict(setups_item_data)

            setups.append(setups_item)

        machining_time_response = cls(
            part_id=part_id,
            plan_id=plan_id,
            kernel_version=kernel_version,
            total_machining_time_seconds=total_machining_time_seconds,
            setup_count=setup_count,
            action_count=action_count,
            refused_count=refused_count,
            total_cutting_length=total_cutting_length,
            total_path_length=total_path_length,
            setups=setups,
        )

        machining_time_response.additional_properties = d
        return machining_time_response

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
