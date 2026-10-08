from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="PlanResponseDoneRegionsType0")


@_attrs_define
class PlanResponseDoneRegionsType0:
    """The regions this plan was told are already at their final surface, and the kernel version they were read under — or
    null for none. They are left out of `issues`, of machining times and of toolpaths: a plan whose `issues` are empty
    machines everything it owes *except* these, which the caller vouched for.

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

        plan_response_done_regions_type_0 = cls(
            kernel_version=kernel_version,
            regions=regions,
        )

        return plan_response_done_regions_type_0
