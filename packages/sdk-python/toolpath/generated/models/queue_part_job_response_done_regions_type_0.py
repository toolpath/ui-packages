from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="QueuePartJobResponseDoneRegionsType0")


@_attrs_define
class QueuePartJobResponseDoneRegionsType0:
    """The regions the job treats as done — the request’s, or null for none.

    Attributes:
        kernel_version (str):
        regions (list[int]):
    """

    kernel_version: str
    regions: list[int]

    def to_dict(self) -> dict[str, Any]:
        kernel_version = self.kernel_version

        regions = self.regions

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kernelVersion": kernel_version,
                "regions": regions,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kernel_version = d.pop("kernelVersion")

        regions = cast(list[int], d.pop("regions"))

        queue_part_job_response_done_regions_type_0 = cls(
            kernel_version=kernel_version,
            regions=regions,
        )

        return queue_part_job_response_done_regions_type_0
