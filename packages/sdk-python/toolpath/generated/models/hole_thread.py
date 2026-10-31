from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.thread_spec import ThreadSpec


T = TypeVar("T", bound="HoleThread")


@_attrs_define
class HoleThread:
    """A thread cut in an axial hole.

    Attributes:
        thread_spec (ThreadSpec): The thread a hole or stud is to receive: a thread class's limits, read on its side.

            Every diameter, the pitch and `threadPercentage` are finite and positive,
            `threadPercentage` at most 100, each minimum no more than its maximum, and the form deeper
            than nothing — `minMajorDiameter` above `minMinorDiameter` for an internal thread,
            `maxMajorDiameter` above `maxMinorDiameter` for an external one; the two angles keep the
            ranges their fields state.
        z_min (float): Where it starts along the axis, in mm.
        z_max (float): Where it ends along the axis, in mm.
    """

    thread_spec: ThreadSpec
    z_min: float
    z_max: float

    def to_dict(self) -> dict[str, Any]:
        thread_spec = self.thread_spec.to_dict()

        z_min = self.z_min

        z_max = self.z_max

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "threadSpec": thread_spec,
                "zMin": z_min,
                "zMax": z_max,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.thread_spec import ThreadSpec

        d = dict(src_dict)
        thread_spec = ThreadSpec.from_dict(d.pop("threadSpec"))

        z_min = d.pop("zMin")

        z_max = d.pop("zMax")

        hole_thread = cls(
            thread_spec=thread_spec,
            z_min=z_min,
            z_max=z_max,
        )

        return hole_thread
