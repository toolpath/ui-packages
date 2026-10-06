from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="QueuePartJobResponseMachineType0")


@_attrs_define
class QueuePartJobResponseMachineType0:
    """The machine the job was recorded against — the request’s, or null when it named none — and whose `maxRpm` its tools
    are held under.

        Attributes:
            name (str | Unset):
            max_rpm (int | Unset):
            tool_change_seconds (float | Unset):
    """

    name: str | Unset = UNSET
    max_rpm: int | Unset = UNSET
    tool_change_seconds: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        max_rpm = self.max_rpm

        tool_change_seconds = self.tool_change_seconds

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if max_rpm is not UNSET:
            field_dict["maxRpm"] = max_rpm
        if tool_change_seconds is not UNSET:
            field_dict["toolChangeSeconds"] = tool_change_seconds

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        max_rpm = d.pop("maxRpm", UNSET)

        tool_change_seconds = d.pop("toolChangeSeconds", UNSET)

        queue_part_job_response_machine_type_0 = cls(
            name=name,
            max_rpm=max_rpm,
            tool_change_seconds=tool_change_seconds,
        )

        return queue_part_job_response_machine_type_0
