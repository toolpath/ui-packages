from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="PartJobRequestDoneRegionsType0")


@_attrs_define
class PartJobRequestDoneRegionsType0:
    """Regions already at their final surface — near-net stock, a face finished before the part arrives: `regions`, indices
    into the part report’s `regions`, and the `kernelVersion` of the report they were read from. Region indices are
    stable only within one kernel release, so a job planned by another fails, its `error` beginning `stale_regions:`; an
    index the part does not have fails it as `unknown_regions:`. A done region is left out of the plan’s `issues`, its
    machining times and its toolpaths. A feature whose regions are all done is not planned, unless `setupPlan` names it
    — then it is machined, and its regions still do not count toward `issues`. A done region on the top of a direction
    turns off facing from that direction, and the part’s other top faces are machined one by one. The stock is
    unchanged: it is still the block around the part, so the simulation cuts air over a done region. Omit or null for
    none; on **Calculate a plan’s toolpaths**, omit to keep the plan’s and null to clear them.

        Example:
            {'kernelVersion': '0.18.0', 'regions': [12, 13]}

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

        part_job_request_done_regions_type_0 = cls(
            kernel_version=kernel_version,
            regions=regions,
        )

        return part_job_request_done_regions_type_0
