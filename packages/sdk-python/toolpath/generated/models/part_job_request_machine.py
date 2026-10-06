from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PartJobRequestMachine")


@_attrs_define
class PartJobRequestMachine:
    """The machine the part is quoted on: `name`, `maxRpm` (the spindle's top speed, rev/min) and `toolChangeSeconds`.
    Recorded with the plan and echoed back, and carried over by a recalculation. `maxRpm` is applied: every synthesized
    tool is held under it, so machining times move for a machine that states one; without it a default ceiling of 15000
    rev/min applies. Tool changes are never included in machining times; `toolChangeSeconds` is for the caller to price
    them. Omit for none.

        Example:
            {'name': 'Haas VF-2', 'maxRpm': 8100, 'toolChangeSeconds': 4.2}

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

        part_job_request_machine = cls(
            name=name,
            max_rpm=max_rpm,
            tool_change_seconds=tool_change_seconds,
        )

        return part_job_request_machine
